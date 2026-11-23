$ErrorActionPreference='Stop'
$proofRoot=Split-Path $PSScriptRoot -Parent
$vendor=Join-Path $proofRoot 'vendor'
New-Item -ItemType Directory -Force -Path $vendor | Out-Null
$zip=Join-Path $vendor 'AGS-3.6.3.17.zip'
if(!(Test-Path -LiteralPath $zip)){Invoke-WebRequest 'https://github.com/adventuregamestudio/ags/releases/download/v3.6.3.17/AGS-3.6.3.17.zip' -OutFile $zip}
if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne 'A47E3F2DA489D8980D35E9E7EF59F27D92844136A8EEBAB93499D31172613F7D'){throw 'Official AGS package checksum mismatch'}
$editorRoot=Join-Path $vendor 'AGS-3.6.3.17'
if(!(Test-Path -LiteralPath "$editorRoot\AGSEditor.exe")){Expand-Archive -LiteralPath $zip -DestinationPath $editorRoot}
# App-local signed dependencies, never an OS/runtime installation.
if(!(Test-Path -LiteralPath "$editorRoot\msvcp140.dll")) {
  $redist=Join-Path $vendor 'VCLibs-x86.zip'
  Invoke-WebRequest 'https://aka.ms/Microsoft.VCLibs.x86.14.00.Desktop.appx' -OutFile $redist
  $redistDir=Join-Path $vendor 'VCLibs-x86'
  if(!(Test-Path -LiteralPath $redistDir)){Expand-Archive -LiteralPath $redist -DestinationPath $redistDir}
  foreach($n in @('msvcp140.dll','msvcp140_1.dll','msvcp140_2.dll','msvcp140_atomic_wait.dll','msvcp140_codecvt_ids.dll','vcruntime140.dll','concrt140.dll')){
    $from=Join-Path $redistDir $n;$sig=Get-AuthenticodeSignature $from
    if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Microsoft Corporation'){throw "Dependency signature mismatch: $n"}
    Copy-Item -LiteralPath $from -Destination (Join-Path $editorRoot $n)
  }
}
$game=Join-Path $proofRoot 'game'
if(!(Test-Path -LiteralPath (Join-Path $game 'Game.agf'))) {
  & 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /platform:x86 "/out:$editorRoot\QuestLabProbe.exe" (Join-Path $PSScriptRoot 'Probe.cs')
  if($LASTEXITCODE -ne 0){throw 'Template extractor compilation failed'}
  Copy-Item -LiteralPath "$editorRoot\AGSEditor.exe.config" -Destination "$editorRoot\QuestLabProbe.exe.config"
  Push-Location $editorRoot
  try{& '.\QuestLabProbe.exe' "$editorRoot\Templates\Empty Game.agt" $game;if($LASTEXITCODE -ne 0){throw 'Template extraction failed'}}finally{Pop-Location}
}
Write-Output "Ready: $game"
