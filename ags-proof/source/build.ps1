param([ValidateSet('initial','edit')][string]$Revision='initial')
$ErrorActionPreference='Stop'
$proofRoot=Split-Path $PSScriptRoot -Parent
$editorRoot=Join-Path $proofRoot 'vendor\AGS-3.6.3.17'
$gameRoot=Join-Path $proofRoot 'game'
& 'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe' /nologo /debug /platform:x86 "/r:$editorRoot\AGS.Types.dll" /r:System.Drawing.dll /r:System.Windows.Forms.dll "/out:$editorRoot\QuestLabAuthor.exe" (Join-Path $PSScriptRoot 'Author.cs')
if($LASTEXITCODE -ne 0){throw 'Author adapter compilation failed'}
Copy-Item -LiteralPath "$editorRoot\AGSEditor.exe.config" -Destination "$editorRoot\QuestLabAuthor.exe.config"
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'proof.asc') -Destination (Join-Path $gameRoot 'GlobalScript.asc')
Set-Content -LiteralPath (Join-Path $gameRoot 'GlobalScript.ash') -Value 'import function Arrive();'
& "$editorRoot\QuestLabAuthor.exe" $gameRoot $Revision
if($LASTEXITCODE -ne 0){throw "Author adapter failed: $LASTEXITCODE"}
# The editor's compiler provides the definitive build result; adapter completion is also recorded in its log.
$process=Start-Process -FilePath "$editorRoot\AGSEditor.exe" -ArgumentList '/compile',('"'+(Join-Path $gameRoot 'Game.agf')+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $proofRoot 'evidence\compile.txt') -RedirectStandardError (Join-Path $proofRoot 'evidence\compile-error.txt')
if(!$process.WaitForExit(60000)){throw "AGS compiler timed out (PID $($process.Id))"}
Get-Content (Join-Path $proofRoot 'evidence\compile.txt')
Get-Content (Join-Path $proofRoot 'evidence\compile-error.txt')
if($process.ExitCode -ne 0){throw "AGS build failed: $($process.ExitCode)"}
