param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$PatchPath
)

$patchText = [System.IO.File]::ReadAllText($PatchPath)
$lines = [System.Text.RegularExpressions.Regex]::Split($patchText, "`r?`n")
$start = [Array]::FindIndex($lines, [Predicate[string]]{ param($line) $line.StartsWith('+type QuizProviderCandidate') })
$end = [Array]::FindIndex($lines, [Predicate[string]]{ param($line) $line.StartsWith('+async function readPersistentCredentialHealth') })

if ($start -lt 0 -or $end -le $start) {
  throw "Could not locate the quiz-only provider block in the interactive patch."
}

$removedLines = $end - $start
$filtered = @()
if ($start -gt 0) { $filtered += $lines[0..($start - 1)] }
if ($end -lt $lines.Length) { $filtered += $lines[$end..($lines.Length - 1)] }

$headerIndex = [Array]::FindIndex($filtered, [Predicate[string]]{ param($line) $line -match '^@@ -\d+,\d+ \+\d+,(\d+) @@' })
if ($headerIndex -lt 0) {
  throw "Could not locate the insertion hunk header in the interactive patch."
}

$filtered[$headerIndex] = [regex]::Replace(
  $filtered[$headerIndex],
  '^(@@ -\d+,\d+ \+\d+,)(\d+)( @@.*)$',
  { param($match) $match.Groups[1].Value + ([int]$match.Groups[2].Value - $removedLines) + $match.Groups[3].Value }
)

[System.IO.File]::WriteAllText($PatchPath, ($filtered -join "`n"))
