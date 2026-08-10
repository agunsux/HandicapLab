import os
import subprocess

print("=" * 60)
print("SCHEDULER / AUTOMATION CHECK")
print("=" * 60)

# Check for GitHub Actions workflows
github_actions_path = '.github/workflows/'
if os.path.exists(github_actions_path):
    workflows = os.listdir(github_actions_path)
    print(f"\n✅ GitHub Actions workflows found: {len(workflows)}")
    for w in workflows:
        print(f"  - {w}")
else:
    print("\n❌ No GitHub Actions workflows found")
    print("   Location expected: .github/workflows/")

# Check for cron jobs (Linux/Mac)
try:
    crontab = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
    if crontab.returncode == 0 and crontab.stdout.strip():
        print(f"\n✅ Cron jobs found:")
        for line in crontab.stdout.strip().split('\n'):
            if 'handicap' in line.lower() or 'python' in line.lower():
                print(f"  {line}")
    else:
        print("\n⚠️ No relevant cron jobs found")
except FileNotFoundError:
    print("\n⚠️ crontab not available (Windows?)")

# Check for Supabase Edge Functions (scheduled)
print("\n⚠️ MANUAL CHECK REQUIRED:")
print("   Go to Supabase Dashboard → Edge Functions")
print("   Check if any scheduled functions exist")
print("   Check Supabase Dashboard → Settings → Cron Jobs")

# Check for any .env scheduler config
env_path = '.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        content = f.read()
        if 'CRON' in content or 'SCHEDULE' in content or 'INTERVAL' in content:
            print("\n✅ Scheduler config found in .env")
        else:
            print("\n⚠️ No scheduler config in .env")
