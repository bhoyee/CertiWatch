using CertiWatch.Contracts.Requests;
using FluentValidation;

namespace CertiWatch.Api.Features.Requirements.Validators;

public sealed class UpdateRequirementTypeValidator : AbstractValidator<UpdateRequirementTypeRequest>
{
    public UpdateRequirementTypeValidator()
    {
        RuleFor(r => r.Name).MaximumLength(200);
        RuleFor(r => r.DefaultValidityMonths).InclusiveBetween(1, 120).When(r => r.DefaultValidityMonths.HasValue);
    }
}
