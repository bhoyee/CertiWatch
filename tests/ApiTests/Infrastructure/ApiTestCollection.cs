namespace CertiWatch.Api.Tests.Infrastructure;

// One Postgres container + WebApplicationFactory shared across every test class in the
// collection - starting a fresh container per test class would work but costs real seconds each
// time; every test instead seeds its own randomly-generated tenant so shared state is never
// actually shared between tests.
[CollectionDefinition(Name)]
public sealed class ApiTestCollection : ICollectionFixture<ApiTestFixture>
{
    public const string Name = "Api integration tests";
}
