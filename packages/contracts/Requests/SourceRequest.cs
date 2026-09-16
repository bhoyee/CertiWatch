namespace CertiWatch.Contracts.Requests;

// Sent to PATCH /api/sources/{id} to rename a connection or pick/change which folder it watches -
// there's no "create" request type here since a Source only ever comes from finishing the Google
// Drive/OneDrive OAuth flow (see SourceOAuthEndpoints), never a form post.
public sealed class UpdateSourceConfigRequest
{
    public string? DisplayName { get; init; }
    public string? FolderId { get; init; }
    public string? FolderLabel { get; init; }
}
