$lines = Get-Content "C:\Users\RYZEN\.antigravity-ide\handicaplab\src\scripts\research-sprint2.ts" -TotalCount 31
$lines | Set-Content "C:\Users\RYZEN\.antigravity-ide\handicaplab\src\scripts\research-sprint2.ts" -Force
Write-Output "Done"
