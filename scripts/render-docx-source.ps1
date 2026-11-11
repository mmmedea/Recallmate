param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = [System.IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $outputPath) { throw 'Output already exists; choose a new path.' }
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $word.Options.UpdateLinksAtOpen = $false
  $doc = $word.Documents.Open($sourcePath, $false, $true, $false)
  $doc.ExportAsFixedFormat($outputPath, 17)
} finally {
  if ($doc) { $doc.Close(0) }
  if ($word) { $word.Quit() }
}
