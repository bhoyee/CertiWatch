FROM mcr.microsoft.com/dotnet/runtime:8.0 AS base
WORKDIR /app
RUN apt-get -o Acquire::Retries=5 update && \
    apt-get install -y --no-install-recommends tesseract-ocr poppler-utils && \
    rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Restore first, with only the .csproj files present - this layer stays cached across any change
# that isn't to a project reference itself, instead of re-downloading every NuGet package on every
# build regardless of what actually changed (which is what `COPY . .` before restore causes).
COPY apps/worker/CertiWatch.Worker.csproj apps/worker/
COPY packages/contracts/CertiWatch.Contracts.csproj packages/contracts/
COPY packages/parsing/CertiWatch.Parsing.csproj packages/parsing/
RUN dotnet restore apps/worker/CertiWatch.Worker.csproj
COPY apps/worker/ apps/worker/
COPY packages/contracts/ packages/contracts/
COPY packages/parsing/ packages/parsing/
RUN dotnet publish apps/worker/CertiWatch.Worker.csproj -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "CertiWatch.Worker.dll"]
