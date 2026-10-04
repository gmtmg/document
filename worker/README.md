# チャシーのサーバー（Cloudflare Workers）

チャシー（`chat.html`）の「お店の奥」です。画面から届いた会話に、チャシーの指示書（`src/system-prompt.js`）を足して、APIキーを付けて OpenAI に送ります。

```
画面（GitHub Pages の chat.html）
   │  これまでの会話（直近20件）
   ▼
チャシーのサーバー（Cloudflare Workers）  ← APIキーはここだけにある
   │  指示書 ＋ 会話 ＋ APIキー
   ▼
OpenAI の API
```

## なぜ GitHub Pages だけではダメなの？

GitHub Pages はファイルを配るだけの場所なので、APIキーを入れると、ページを開いた誰でもキーを見られてしまいます。
そこで、キーは GitHub の **Secrets** に保存し、GitHub Actions が自動で Cloudflare Workers（無料で使える小さなサーバー）に渡します。キーがサイトやコードに出てくることはありません。

## はじめの設定（1回だけ）

### 1. Cloudflare の準備
1. [Cloudflare](https://dash.cloudflare.com/sign-up) に無料登録する
2. 右上のアカウント → **My Profile → API Tokens → Create Token** →「**Edit Cloudflare Workers**」テンプレートでトークンを作る
3. ダッシュボードの **Workers & Pages** を開き、右側に出ている **Account ID** をメモする

### 2. GitHub に Secrets を登録
リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で、次の3つを登録します。

| 名前 | 中身 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI の APIキー |
| `CLOUDFLARE_API_TOKEN` | 1-2 で作ったトークン |
| `CLOUDFLARE_ACCOUNT_ID` | 1-3 でメモした Account ID |

### 3. サーバーを公開
**Actions** タブ →「**Deploy Chacy server**」→ **Run workflow** を押します（`worker/` を変更して push したときも自動で動きます）。
終わると、ログに `https://chacy.〇〇.workers.dev` のようなアドレスが出ます。

### 4. 画面とつなぐ
`assets/chat-config.js` に、そのアドレスの最後に `/chat` を付けて書きます。

```js
window.CHACY_API_URL = "https://chacy.〇〇.workers.dev/chat";
```

### 5. 使ってよいサイトを確認
`wrangler.toml` の `ALLOWED_ORIGINS` に、チャシーを置くサイトのアドレスが入っているか確認します（最初は `https://gmtmg.github.io`）。ここにないサイトからは使えません。

## お金の使いすぎを防ぐ

- サーバー側で、1人あたり1分に15回まで、質問は2000文字まで、会話は直近20件までに制限しています
- それでも念のため、OpenAI の管理画面（**Settings → Limits**）で、月の利用上限を必ず設定してください

## 自分のパソコンで試す

```sh
OPENAI_API_KEY=sk-... node worker/dev-server.mjs
```

`http://localhost:8787/chat.html` を開くと、チャシーとお話しできます。

## テスト

```sh
node worker/test/run.mjs                      # 点検まわりのテスト（APIキー不要）
OPENAI_API_KEY=sk-... node worker/test/run.mjs # 本物の OpenAI とのやり取りも確認
```

## チャシーの性格を変えたいとき

`src/system-prompt.js` の指示書を書き換えて push します。AIアプリのレッスン第3章で学んだ「# 役割」「# ルール」の書き方そのままです。
