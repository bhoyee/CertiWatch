namespace CertiWatch.Contracts.Requests;

public sealed class EnrollDeviceRequest
{
    public required string DeviceName { get; init; }
    public required string OperatingSystem { get; init; }
    public required string EnrollmentCode { get; init; }
}
