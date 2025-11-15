using CertiWatch.Contracts.Requests;
using FluentValidation;

namespace CertiWatch.Api.Features.Rules.Validators;

public sealed class UpdateCourseRuleValidator : AbstractValidator<UpdateCourseRuleRequest>
{
    public UpdateCourseRuleValidator()
    {
        RuleFor(r => r.CourseName).MaximumLength(200);
        RuleFor(r => r.DefaultValidityMonths).InclusiveBetween(1, 120).When(r => r.DefaultValidityMonths.HasValue);
    }
}
