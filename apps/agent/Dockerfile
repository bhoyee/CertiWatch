FROM mcr.microsoft.com/dotnet/runtime:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Restore first, with only the .csproj files present - this layer stays cached across any change
# that isn't to a project reference itself, instead of re-downloading every NuGet package on every
# build regardless of what actually changed (which is what `COPY . .` before restore causes).
COPY apps/agent/CertiWatch.Agent.csproj apps/agent/
COPY packages/contracts/CertiWatch.Contracts.csproj packages/contracts/
RUN dotnet restore apps/agent/CertiWatch.Agent.csproj
COPY apps/agent/ apps/agent/
COPY packages/contracts/ packages/contracts/
RUN dotnet publish apps/agent/CertiWatch.Agent.csproj -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CertiWatch.Agent.dll"]
