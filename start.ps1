# One-command startup for Windows PowerShell. Only Docker Desktop is required.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Install Docker Desktop, start it, then run .\start.ps1 again.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop, then run .\start.ps1 again.' }
if (-not (Test-Path '.env')) {
    function New-DemoSecret {
        $bytes = New-Object byte[] 48
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    }
    $lines = Get-Content '.env.example' | ForEach-Object {
        if ($_ -match '^([^=]+)=replace-with-') { $Matches[1] + '=' + (New-DemoSecret) } else { $_ }
    }
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), ($lines -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))
}
docker compose up -d --build --wait --wait-timeout 180
if ($LASTEXITCODE -ne 0) { throw 'Startup failed. Inspect docker compose logs.' }
$settings = @{}
Get-Content '.env' | Where-Object { $_ -match '^[^#=]+=' } | ForEach-Object {
    $parts = $_.Split('=',2); $settings[$parts[0]] = $parts[1]
}
Write-Host "`nFraudShield AI is ready: http://localhost:3000"
Write-Host ('Email: ' + $settings['ADMIN_EMAIL'])
Write-Host ('Password: ' + $settings['ADMIN_PASSWORD'])
Write-Host 'API docs: http://localhost:8080/docs'
Write-Host 'Stop without deleting data: docker compose stop'
Start-Process 'http://localhost:3000'
