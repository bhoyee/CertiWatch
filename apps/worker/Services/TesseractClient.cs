using System.Diagnostics;
using System.Text;

namespace CertiWatch.Worker.Services;

public interface ITesseractClient
{
    Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken);
}

public sealed class TesseractClient(ILogger<TesseractClient> logger) : ITesseractClient
{
    public async Task<string> ExtractTextAsync(string filePath, CancellationToken cancellationToken)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        if (ext == ".pdf")
        {
            var text = await TryPdfToTextAsync(filePath, cancellationToken);
            if (!string.IsNullOrWhiteSpace(text))
            {
                return text;
            }
            // Fall back to OCR on rasterized pages
            return await ExtractPdfAsync(filePath, cancellationToken);
        }

        return await RunTesseractAsync(filePath, cancellationToken);
    }

    private async Task<string> TryPdfToTextAsync(string filePath, CancellationToken cancellationToken)
    {
        try
        {
            return await RunProcessAsync("pdftotext", $"-layout \"{filePath}\" -", cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "pdftotext failed for {File}, will fall back to OCR", filePath);
            return string.Empty;
        }
    }

    private async Task<string> ExtractPdfAsync(string filePath, CancellationToken cancellationToken)
    {
        // Convert PDF pages to PNGs with poppler (pdftoppm), then OCR each page with tesseract.
        var tempDir = Path.Combine(Path.GetTempPath(), "ocr-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var prefix = Path.Combine(tempDir, "page");
            await RunProcessAsync("pdftoppm", $"-r 300 -gray -png \"{filePath}\" \"{prefix}\"", cancellationToken);

            var pages = Directory.EnumerateFiles(tempDir, "page-*.png")
                .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (pages.Count == 0)
            {
                logger.LogWarning("PDF {File} produced no pages for OCR", filePath);
                return string.Empty;
            }

            var sb = new StringBuilder();
            foreach (var page in pages)
            {
                var text = await RunTesseractAsync(page, cancellationToken);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    sb.AppendLine(text);
                }
            }

            return sb.ToString();
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
