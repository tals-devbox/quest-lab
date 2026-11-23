param([switch]$ServiceOnly)
$ErrorActionPreference='Stop'
$proofRoot=$PSScriptRoot
$url='http://127.0.0.1:4330/'
function Ready {
  try {$r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2;return $r.StatusCode -eq 200 -and $r.Content.Contains('Quest Lab · AGS proof')}catch{return $false}
}
if(!(Ready)) {
  $node=Join-Path (Split-Path $proofRoot -Parent) 'runtime\node.exe'
  Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $proofRoot 'tools\serve.mjs')+'"') -WorkingDirectory $proofRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $proofRoot 'evidence\local-service.log') -RedirectStandardError (Join-Path $proofRoot 'evidence\local-service-error.log')
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  while(!(Ready)){if([DateTime]::UtcNow -gt $deadline){throw 'AGS proof service did not become ready'};Start-Sleep -Milliseconds 200}
}
if(!$ServiceOnly){Start-Process $url}
