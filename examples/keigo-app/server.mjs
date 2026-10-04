import http from "node:http";
import { readFile } from "node:fs/promises";

const SYSTEM_PROMPT = `# 役割
あなたはビジネスメールの専門家です。

# ルール
- ユーザーの文章を、取引先に送れる丁寧な敬語に書き換える
- 意味は変えず、情報を足さない
- 前置きや解説は書かない

# 出力形式
書き換えた文章だけを出力する`;

async function askAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) return "エラー: " + data.error.message;
  return data.choices[0].message.content;
}

http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/keigo") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { text } = JSON.parse(body);
    const answer = await askAI(text);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ answer }));
  } else {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(await readFile(new URL("./index.html", import.meta.url)));
  }
}).listen(3000, () => console.log("http://localhost:3000 を開いてください"));
