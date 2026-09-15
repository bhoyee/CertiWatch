using System.Diagnostics;
using System.Text;

namespace CertiWatch.Worker.Services;

public interface ITesseractClient
{
    Task<IReadOnlyList<string>> ExtractPagesAsync(string filePath, CancellationToken cancellationToken);
}

public sealed class TesseractClient(ILogger<TesseractClient> logger) : ITesseractClient
{
    public async Task<IReadOnlyList<string>> ExtractPagesAsync(string filePath, CancellationToken cancellationToken)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        if (ext == ".pdf")
        {
            var pages = await TryPdfToTextAsync(filePath, cancellationToken);
            if (pages.Count > 0)
            {
                return pages;
            }
            // Fall back to OCR on rasterized pages
            return await ExtractPdfAsync(filePath, cancellationToken);
        }

        return new[] { await RunTesseractAsync(filePath, cancellationToken) };
    }

    // pdftotext (poppler) inserts a form-feed character (\f) between pages by default - splitting
    // on it recovers page boundaries without needing to change how the process itself is invoked.
    private async Task<IReadOnlyList<string>> TryPdfToTextAsync(string filePath, CancellationToken cancellationToken)
    {
        try
        {
            var output = await RunProcessAsync("pdftotext", $"-layout \"{filePath}\" -", cancellationToken);
            return output
                .Split('\f')
                .Select(p => p.Trim())
                .Where(p => p.Length > 0)
                .ToList();
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "pdftotext failed for {File}, will fall back to OCR", filePath);
            return Array.Empty<string>();
        }
    }

    private async Task<IReadOnlyList<string>> ExtractPdfAsync(string filePath, CancellationToken cancellationToken)
    {
        // Convert PDF pages to PNGs with poppler (pdftoppm), then OCR each page with tesseract -
        // already naturally one file per page, so returning them separately instead of
        // concatenating is the whole fix here.
        var tempDir = Path.Combine(Path.GetTempPath(), "ocr-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var prefix = Path.Combine(tempDir, "page");
            await RunProcessAsync("pdftoppm", $"-r 300 -gray -png \"{filePath}\" \"{prefix}\"", cancellationToken);

            var pageFiles = Directory.EnumerateFiles(tempDir, "page-*.png")
                .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (pageFiles.Count == 0)
            {
                logger.LogWarning("PDF {File} produced no pages for OCR", filePath);
                return Array.Empty<string>();
            }

            var pages = new List<string>();
            foreach (var pageFile in pageFiles)
            {
                var text = await RunTesseractAsync(pageFile, cancellationToken);
                pages.Add(text);
            }

            return pages;
        }
        finally
        {
            try { Directory.Delete(tempDir, recursive: true); } catch { /* ignore */ }
        }
    }

    private async Task<string> RunTesseractAsync(string imagePath, CancellationToken cancellationToken)
    {
        return await RunProcessAsync("tesseract", $"\"{imagePath}\" stdout -l eng --oem 1 --psm 6", cancellationToken);
    }

    private async Task<string> RunProcessAsync(string fileName, string arguments, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };
        var output = new StringBuilder();
        var error = new StringBuilder();

        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is not null) output.AppendLine(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null) error.AppendLine(e.Data);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await Task.WhenAny(process.WaitForExitAsync(cancellationToken), Task.Delay(Timeout.Infinite, cancellationToken));

        if (!process.HasExited)
        {
            try { process.Kill(entireProcessTree: true); } catch { /* ignore */ }
        }

        if (process.ExitCode != 0)
        {
            logger.LogWarning("Process {File} {Args} exited with {Code}. stderr: {Error}", fileName, arguments, process.ExitCode, error.ToString());
        }

        return output.ToString();
    }
}
