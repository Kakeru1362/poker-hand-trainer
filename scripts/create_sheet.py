"""Create a Google Sheet with the deployed poker trainer URLs for easy mobile access."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path.home() / ".claude" / "lib"))
from google_sheets import create_sheet, write_data, get_auth_mode

TITLE = "Poker Trainer - モバイルアクセス"
HEADERS = ["ページ名", "URL", "説明"]
ROWS = [
    ["エクイティ推定クイズ",
     "https://kakeru1362.github.io/poker-hand-trainer/quiz.html",
     "レンジ vs レンジ の勝率を推定するクイズ。スマホ対応"],
    ["ハンドストレングス・トレーナー",
     "https://kakeru1362.github.io/poker-hand-trainer/",
     "13×13マトリクスでハンド強度を学ぶ"],
    ["", "", ""],
    ["GitHubリポジトリ",
     "https://github.com/Kakeru1362/poker-hand-trainer",
     "ソースコード"],
]

if __name__ == "__main__":
    print(f"Auth mode: {get_auth_mode()}")
    sheet_id, url = create_sheet(TITLE)
    write_data(sheet_id, HEADERS, ROWS)
    print(f"\n✅ Sheet created!")
    print(f"   ID:  {sheet_id}")
    print(f"   URL: {url}")
