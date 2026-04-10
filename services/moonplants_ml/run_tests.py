"""Run all tests and print results. Used when pytest stdout is suppressed."""
import subprocess, sys, pathlib

root = pathlib.Path(__file__).parent
result = subprocess.run(
    [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short", "--no-header"],
    cwd=str(root),
    capture_output=True,
    text=True,
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:3000])
sys.exit(result.returncode)

