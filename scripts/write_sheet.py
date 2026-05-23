"""Write/refresh the URL data into the existing Poker Trainer sheet."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path.home() / ".claude" / "lib"))
from google_sheets import write_data, open_sheet

SHEET_ID = "1U6g9nGyhzKf_cg1YlzFmKjcdRNHFRYRP02X-mjhSO-U"
HEADERS = ["ページ名", "URL", "説明"]
ROWS = [
    ["エクイティ推定クイズ",
     "https://kakeru1362.github.io/poker-hand-trainer/quiz.html",
     "レンジ vs レンジ の勝率を推定するクイズ。スマホ対応"],
    ["ハンドストレングス・トレーナー",
     "https://kakeru1362.github.io/poker-hand-trainer/",
     "13x13マトリクスでハンド強度を学ぶ"],
    ["", "", ""],
    ["GitHubリポジトリ",
     "https://github.com/Kakeru1362/poker-hand-trainer",
     "ソースコード"],
]

url = write_data(SHEET_ID, HEADERS, ROWS)
print("Sheet written successfully.")
print(f"URL: {url}")

# Verify by reading back
sh = open_sheet(SHEET_ID)
ws = sh.sheet1
values = ws.get_all_values()
print(f"\nVerified content ({len(values)} rows):")
for row in values:
    print(f"  {row}")
