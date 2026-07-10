# generate all registry files
$d = "C:\Users\RYZEN\.antigravity-ide\HandicapLab\src\lib\registry"
$NL = [char]10
$SQ = [char]39
$DL = [char]36
$BQ = [char]96
function W($fn, $lines) {
  $content = ($lines -join $NL) + $NL
  [System.IO.File]::WriteAllText("$d\$fn", $content)
  $c = [System.IO.File]::ReadAllText("$d\$fn")
  Write-Host ("{0}: {1} chars, {2} lines" -f $fn, $c.Length, ($c.Split($NL).Length))
}
