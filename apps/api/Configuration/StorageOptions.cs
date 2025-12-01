namespace CertiWatch.Api.Configuration;

public sealed class StorageOptions
{
    /// <summary>
    /// Root folder where uploaded files are stored. Defaults to /uploads when not provided.
    /// </summary>
    public string UploadsRoot { get; set; } = "/uploads";
}
