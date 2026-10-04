# 同梱ライブラリ

チャシー（chat.html）が使うライブラリを、npm から取り出してそのまま置いています。

| ファイル | ライブラリ | バージョン | ライセンス |
| --- | --- | --- | --- |
| `marked.umd.js` | [marked](https://github.com/markedjs/marked) | 18.0.14 | MIT（`LICENSE-marked.txt`） |
| `purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.16 | MPL-2.0 または Apache-2.0（`LICENSE-dompurify.txt`） |
| `mermaid.min.js` | [Mermaid](https://github.com/mermaid-js/mermaid) | 12.1.0 | MIT（`LICENSE-mermaid.txt`） |

`mermaid.min.js` は大きいので、チャシーが図を描くときだけ読み込みます。
