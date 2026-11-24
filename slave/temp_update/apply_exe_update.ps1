Start-Sleep -Seconds 2
Stop-Process -Name cybernexus_slave -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Copy-Item -LiteralPath 'X:\My Drive\Code dev\cybernexus-os\slave\temp_update\extracted\CyberNexus_Control_Center.exe' -Destination 'X:\My Drive\Code dev\cybernexus-os\slave\CyberNexus_Control_Center.exe' -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath 'X:\My Drive\Code dev\cybernexus-os\slave\temp_update\extracted\cybernexus_slave.exe' -Destination 'X:\My Drive\Code dev\cybernexus-os\slave\cybernexus_slave.exe' -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath 'X:\My Drive\Code dev\cybernexus-os\slave\temp_update\extracted\modules\libmod_card_payment.dll' -Destination 'X:\My Drive\Code dev\cybernexus-os\slave\modules\libmod_card_payment.dll' -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath 'X:\My Drive\Code dev\cybernexus-os\slave\temp_update\extracted\modules\libmod_media_stream.dll' -Destination 'X:\My Drive\Code dev\cybernexus-os\slave\modules\libmod_media_stream.dll' -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath 'X:\My Drive\Code dev\cybernexus-os\slave\temp_update\extracted\modules\libmod_network_qos.dll' -Destination 'X:\My Drive\Code dev\cybernexus-os\slave\modules\libmod_network_qos.dll' -Force -ErrorAction SilentlyContinue
$p = Start-Process -FilePath 'X:\My Drive\Code dev\cybernexus-os\slave\cybernexus_slave.exe' -WorkingDirectory 'X:\My Drive\Code dev\cybernexus-os\slave' -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 4
$ok = $false
try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8501/api/health' -TimeoutSec 4; if ($r.StatusCode -eq 200) { $ok = $true } } catch {}
if (-not $ok) {
  if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  Stop-Process -Name cybernexus_slave -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  if (Test-Path 'X:\My Drive\Code dev\cybernexus-os\slave\backup_prev') {
    Get-ChildItem -Path 'X:\My Drive\Code dev\cybernexus-os\slave\backup_prev' -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring('X:\My Drive\Code dev\cybernexus-os\slave\backup_prev'.Length + 1)
      $dst = Join-Path 'X:\My Drive\Code dev\cybernexus-os\slave' $rel
      Copy-Item -LiteralPath $_.FullName -Destination $dst -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Process -FilePath 'X:\My Drive\Code dev\cybernexus-os\slave\cybernexus_slave.exe' -WorkingDirectory 'X:\My Drive\Code dev\cybernexus-os\slave' -WindowStyle Hidden
}
