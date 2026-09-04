namespace CertiWatch.Contracts.Dtos;

public sealed record AnalyticsOverviewDto(
    int TotalRecords,
    int ExpiringSoon,
    int Expired,
    int LowConfidence,
    int Devices,
    int Sources,
    IReadOnlyDictionary<string, int> StatusCounts,
    IReadOnlyList<RecordDto> ExpiringSoonList,
    IReadOnlyList<DayCountDto> RecordsTrend,
    ExpiryBucketsDto ExpiryBuckets,
    int NewThisWeek,
    int NewLastWeek);
