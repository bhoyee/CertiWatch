using CertiWatch.Contracts.Requests;
using FluentValidation;

namespace CertiWatch.Api.Features.Rules.Validators;

public sealed class CreateCourseRuleValidator : AbstractValidator<CreateCourseRuleRequest>
{
    public CreateCourseRuleValidator()
    {
        RuleFor(r => r.CourseName).NotEmpty().MaximumLength(200);
        RuleFor(r => r.DefaultValidityMonths).InclusiveBetween(1, 120).When(r => r.DefaultValidityMonths.HasValue);
    }
}
