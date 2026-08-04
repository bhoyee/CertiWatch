FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Restore first, with only the .csproj files present - this layer stays cached across any change
# that isn't to a project reference itself, instead of re-downloading every NuGet package on every
# build regardless of what actually changed (which is what `COPY . .` before restore causes).
COPY apps/api/CertiWatch.Api.csproj apps/api/
COPY packages/contracts/CertiWatch.Contracts.csproj packages/contracts/
COPY packages/parsing/CertiWatch.Parsing.csproj packages/parsing/
RUN dotnet restore apps/api/CertiWatch.Api.csproj
COPY apps/api/ apps/api/
COPY packages/contracts/ packages/contracts/
COPY packages/parsing/ packages/parsing/
# CertiWatch.Api.csproj pulls the repo-root emails/*.html templates in as Content via a
# ..\..\emails\*.html glob (see the <Content Include> item) - without this, dotnet publish
# silently matches nothing and ships an image with zero email templates.
COPY emails/ emails/
RUN dotnet publish apps/api/CertiWatch.Api.csproj -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "CertiWatch.Api.dll"]
