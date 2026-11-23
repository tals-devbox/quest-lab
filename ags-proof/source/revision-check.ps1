$ErrorActionPreference='Stop'
$proofRoot=Split-Path $PSScriptRoot -Parent
$editorRoot=Join-Path $proofRoot 'vendor\AGS-3.6.3.17'
$gameRoot=Join-Path $proofRoot 'game'
$receipts=@()
foreach($revision in @('before-edit','after-edit')) {
  $snapshot=Join-Path $proofRoot "revisions\$revision"
  foreach($file in Get-ChildItem -LiteralPath $snapshot -File){Copy-Item -LiteralPath $file.FullName -Destination $gameRoot -Force}
  $expected=(Get-FileHash -LiteralPath (Join-Path $snapshot 'room1.crm') -Algorithm SHA256).Hash
  $actual=(Get-FileHash -LiteralPath (Join-Path $gameRoot 'room1.crm') -Algorithm SHA256).Hash
  if($expected -ne $actual){throw 'Snapshot restore mismatch'}
  $p=Start-Process -FilePath "$editorRoot\AGSEditor.exe" -ArgumentList '/compile',('"'+(Join-Path $gameRoot 'Game.agf')+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $proofRoot "evidence\$revision-compile.txt") -RedirectStandardError (Join-Path $proofRoot "evidence\$revision-error.txt")
  if(!$p.WaitForExit(45000) -or $p.ExitCode -ne 0){throw "Restored project did not compile: $revision"}
  $receipts+=@{revision=$revision;room1SHA256=$actual;compiled=$true}
}
@{at=[DateTime]::UtcNow.ToString('o');result='Restored previous native room resource and rebuilt, then restored edited version and rebuilt';revisions=$receipts} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $proofRoot 'evidence\revision-check.json')
$receipts | ConvertTo-Json
