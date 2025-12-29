using System.ComponentModel.DataAnnotations;

namespace CertiWatch.Api.Domain.Entities;

public class ApiKey : BaseEntity
{
    [Required]
    public Guid TenantId { get; set; }

    [Required]
    [MaxLength(128)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(256)]
    public string Key { get; set; } = string.Empty;

    public bool IsRevoked { get; set; }
}
