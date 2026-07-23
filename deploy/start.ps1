$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $PSScriptRoot ".env"
$ComposeFile = Join-Path $PSScriptRoot "compose.yaml"

if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $PSScriptRoot ".env.example") $EnvFile
    throw "Created deploy/.env. Set secure passwords and run start.ps1 again."
}

Set-Location $Root
docker compose --env-file $EnvFile -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
    throw "Failed to start Workforce Portal."
}

docker compose --env-file $EnvFile -f $ComposeFile logs -f create-site
