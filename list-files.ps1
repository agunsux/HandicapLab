Get-ChildItem -Path 'C:\Users\RYZEN\.antigravity-ide\HandicapLab' -Name -Include 'vercel.json','.vercel*','next.config.*' 2>&1
Write-Output "---"
Get-ChildItem -Path 'C:\Users\RYZEN\.antigravity-ide\HandicapLab\tests' -Recurse -Filter '*.test.ts' -Name 2>&1
Write-Output "---"
Get-ChildItem -Path 'C:\Users\RYZEN\.antigravity-ide\HandicapLab' -Filter '.env*' -Name 2>&1
