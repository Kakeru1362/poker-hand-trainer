"""Find the most recently created sheet with our title, return its URL."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path.home() / ".claude" / "lib"))
from google_sheets import get_client

TITLE = "Poker Trainer - モバイルアクセス"

client = get_client()
results = client.list_spreadsheet_files()
matches = [f for f in results if f.get("name") == TITLE]

if not matches:
    print(f"No sheet found with title: {TITLE}")
    sys.exit(1)

# Most recent (list order may vary; show all matches)
print(f"Found {len(matches)} match(es):")
for m in matches:
    sid = m.get("id")
    url = f"https://docs.google.com/spreadsheets/d/{sid}/edit"
    print(f"  ID: {sid}")
    print(f"  URL: {url}")
    print(f"  Modified: {m.get('modifiedTime', 'n/a')}")
    print()
