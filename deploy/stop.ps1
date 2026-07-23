$ErrorActionPreference = "Stop"
$EnvFile = Join-Path $PSScriptRoot ".env"
$ComposeFile = Join-Path $PSScriptRoot "compose.yaml"

docker compose --env-file $EnvFile -f $ComposeFile down
