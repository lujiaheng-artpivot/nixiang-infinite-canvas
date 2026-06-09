$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pids = Join-Path $root '.pids'

foreach ($name in @('frontend', 'backend')) {
  $pidFile = Join-Path $pids "$name.pid"
  if (-not (Test-Path -LiteralPath $pidFile)) {
    continue
  }

  $processId = [int](Get-Content -LiteralPath $pidFile -Raw)
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessName -eq 'node') {
    Stop-Process -Id $processId
  }
  Remove-Item -LiteralPath $pidFile -Force
}

Write-Host 'Nixiang Infinite Canvas services stopped.'
