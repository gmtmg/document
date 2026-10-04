// 自分のパソコンでチャシーを試すためのサーバー。サイトのファイルと /chat を同じ場所で動かします。
//   OPENAI_API_KEY=sk-... node worker/dev-server.mjs
// そのあと http://localhost:8787/chat.html を開きます。
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import worker from "./src/index.js";

const PORT = Number(process.env.PORT || 8787);
const ROOT = new URL("..", import.meta.url).pathname;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ALLOWED_ORIGINS: `http://localhost:${PORT},http://127.0.0.1:${PORT}`,
  MODEL: process.env.MODEL,
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/chat") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const response = await worker.fetch(new Request(url, {
      method: req.method,
      headers: { ...req.headers, "CF-Connecting-IP": req.socket.remoteAddress || "local" },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
    }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
    return;
  }
  const path = normalize(join(ROOT, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("見つかりません");
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/chat.html を開いてください`));
