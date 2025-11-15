namespace CertiWatch.Contracts.Requests;

public sealed record PagedQuery(int Page = 1, int PageSize = 50, string? Filter = null, string? Sort = null)
{
    public int Offset => Math.Max(Page - 1, 0) * Math.Clamp(PageSize, 1, 250);
    public int Take => Math.Clamp(PageSize, 1, 250);
}
