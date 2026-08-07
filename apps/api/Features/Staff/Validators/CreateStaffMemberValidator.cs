using CertiWatch.Contracts.Requests;
using FluentValidation;

namespace CertiWatch.Api.Features.Staff.Validators;

public sealed class CreateStaffMemberValidator : AbstractValidator<CreateStaffMemberRequest>
{
    public CreateStaffMemberValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(200);
        RuleFor(r => r.JobTitle).MaximumLength(200);
    }
}
