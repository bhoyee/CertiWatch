using CertiWatch.Contracts.Requests;
using FluentValidation;

namespace CertiWatch.Api.Features.Requirements.Validators;

public sealed class CreateRequirementTypeValidator : AbstractValidator<CreateRequirementTypeRequest>
{
    public CreateRequirementTypeValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(200);
        RuleFor(r => r.DefaultValidityMonths).InclusiveBetween(1, 120).When(r => r.DefaultValidityMonths.HasValue);
    }
}
