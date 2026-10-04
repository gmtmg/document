"""examples/keigo-app のファイルを、サイトで表示するために assets/examples.js へ書き出す。

使い方:  python3 tools/build_examples.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "examples" / "keigo-app"
FILES = ["index.html", "server.mjs", ".env.example"]

data = {name: (SRC / name).read_text(encoding="utf-8") for name in FILES}
(ROOT / "assets" / "examples.js").write_text(
    "// tools/build_examples.py が examples/keigo-app から生成したファイルです。手で編集しないでください。\n"
    "window.EXAMPLES = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
print("wrote assets/examples.js")
