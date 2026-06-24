# HandicapLab Diagnostic and Verification Script

param (
    [string]$TargetUrl = "http://localhost:3000"
)

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "RUNNING HANDICAPLAB DIAGNOSTIC FLOW" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 1. Load env variables from .env
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim()
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $Matches[1]
            }
            [System.Environment]::SetEnvironmentVariable($name, $value)
            # Support local script run context
            Set-Item -Path "Env:\$name" -Value $value
        }
    }
} else {
    Write-Host "⚠️ Warning: .env file not found." -ForegroundColor Red
}

$CronSecret = [System.Environment]::GetEnvironmentVariable("CRON_SECRET")
if (-not $CronSecret) {
    $CronSecret = $env:CRON_SECRET
}
if (-not $CronSecret) {
    Write-Host "❌ Error: CRON_SECRET is not defined in environment." -ForegroundColor Red
    Exit 1
}

Write-Host "Target URL: $TargetUrl" -ForegroundColor Yellow

# 2. Trigger Ingest
Write-Host "`n1. Triggering live ingestion..." -ForegroundColor Yellow
try {
    $IngestHeaders = @{
        "Authorization" = "Bearer $CronSecret"
    }
    $IngestResponse = Invoke-WebRequest -Uri "$TargetUrl/api/cron/ingest" -Headers $IngestHeaders -Method Get -UseBasicParsing -TimeoutSec 60
    Write-Host "Status Code: $($IngestResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body: $($IngestResponse.Content)" -ForegroundColor Green
} catch {
    Write-Host "❌ Ingest Trigger Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $Body = $Reader.ReadToEnd()
        Write-Host "Response: $Body" -ForegroundColor Red
    }
}

# 3. Trigger Predict
Write-Host "`n2. Triggering predictions..." -ForegroundColor Yellow
try {
    $PredictHeaders = @{
        "Authorization" = "Bearer $CronSecret"
    }
    $PredictResponse = Invoke-WebRequest -Uri "$TargetUrl/api/cron/predict" -Headers $PredictHeaders -Method Get -UseBasicParsing -TimeoutSec 60
    Write-Host "Status Code: $($PredictResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body: $($PredictResponse.Content)" -ForegroundColor Green
} catch {
    Write-Host "❌ Predict Trigger Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $Body = $Reader.ReadToEnd()
        Write-Host "Response: $Body" -ForegroundColor Red
    }
}

# 4. Check Matches, Predictions, and Paper Trades in Database
Write-Host "`n3. Checking production database table status and row counts..." -ForegroundColor Yellow
npx tsx --env-file=.env src/scripts/check-production-db.ts

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTIC FLOW COMPLETE" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
