(() => {
  "use strict";

  const R = window.RECORDED;
  const EX = window.EXAMPLES;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 保存できなくても動く */ } },
  };

  /* ---------- 進捗バー・章ナビ ---------- */
  const progress = $("#progress");
  const navLinks = $$(".chapnav a");
  const chapters = $$("[data-chapter]");
  const seen = new Set(store.get("seenChapters") || []);

  function markRoadmap() {
    $$("#roadmap li").forEach((li) => li.classList.toggle("done", seen.has(li.dataset.ch)));
  }
  markRoadmap();

  function onScroll() {
    const h = document.documentElement;
    const ratio = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    progress.style.width = (ratio * 100).toFixed(1) + "%";

    let current = null;
    for (const ch of chapters) {
      const rect = ch.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.4) current = ch.id;
      if (rect.bottom < window.innerHeight * 0.6 && !seen.has(ch.id)) {
        seen.add(ch.id);
        store.set("seenChapters", [...seen]);
        markRoadmap();
      }
    }
    navLinks.forEach((a) => {
      const on = a.getAttribute("href") === "#" + current;
      if (on && !a.classList.contains("is-active")) a.scrollIntoView({ block: "nearest", inline: "center" });
      a.classList.toggle("is-active", on);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- HERO: 吹き出しを裏返す ---------- */
  const flip = $("#heroFlip");
  const flipBtn = $("#flipBtn");
  flipBtn.addEventListener("click", () => {
    const on = !flip.classList.contains("is-flipped");
    flip.classList.toggle("is-flipped", on);
    flipBtn.setAttribute("aria-pressed", on);
    flipBtn.textContent = on ? "表に戻す" : "裏側を見る";
  });

  /* ---------- 第1章: 記憶のないAI ---------- */
  const MEM_TURNS = [
    {
      user: "カレーの作り方を教えて",
      ai: "玉ねぎを炒めて、肉と野菜を加え、水で煮込んでからルーを溶かせば完成です。",
      noHist: "玉ねぎを炒めて、肉と野菜を加え、水で煮込んでからルーを溶かせば完成です。",
      note: "1回目は、あなたの発言が1つ送られるだけです。",
    },
    {
      user: "それを辛くするには？",
      ai: "カレーを辛くするなら、仕上げにチリパウダーやカイエンペッパーを少しずつ足すのがおすすめです。",
      noHist: "「それ」が何を指しているのかわかりません。何を辛くしたいのか教えてください。",
      note: "2回目は、1回目のやり取りもまとめて送られています。だからAIは「それ」がカレーのことだとわかります。",
    },
    {
      user: "じゃあ子ども向けには？",
      ai: "子ども向けなら甘口のルーを使い、すりおろしたりんごやはちみつを加えるとまろやかになります。",
      noHist: "何を子ども向けにしたいのでしょうか？もう少し詳しく教えてください。",
      note: "会話が長くなるほど、送る文字数も増えていきます。APIは送った文字量で料金が決まるので、長い会話ほどお金もかかります。",
    },
    {
      user: "ありがとう！最初に聞いた料理は何だっけ？",
      ai: "最初にお聞きになったのは「カレー」の作り方です。",
      noHist: "これまでの会話の内容がわからないため、お答えできません。",
      note: "最初の質問を覚えているように見えるのは、毎回ぜんぶ送り直しているからです。",
    },
  ];
  const memChat = $("#memChat");
  const memPayload = $("#memPayload");
  const memNote = $("#memNote");
  const memNext = $("#memNext");
  const memHistory = $("#memHistory");
  let memLog = []; // 実際の会話 [{role, text}]
  let memTurn = 0;

  function payloadRow(role, text, isNew) {
    return `<div class="payload-row${isNew ? " is-new" : ""}"><span><span class="role ${role}">${role}</span></span><p>${esc(text)}</p></div>`;
  }

  function memRender(sent) {
    memChat.innerHTML = memLog.length
      ? memLog.map((m) => `<div class="bubble ${m.role === "user" ? "me" : "ai"}">${esc(m.text)}</div>`).join("")
      : `<p style="color:var(--ink-soft);font-size:0.9rem">まだ何も話していません。</p>`;
    memPayload.innerHTML = sent.length
      ? sent.map((m, i) => payloadRow(m.role, m.text, i === sent.length - 1)).join("")
      : `<p style="color:var(--ink-soft);font-size:0.9rem">送信すると、ここにAIが受け取る中身が表示されます。</p>`;
    const chars = sent.reduce((n, m) => n + m.text.length, 0);
    $("#memCount").textContent = `送った文字数: ${chars}文字`;
    $("#memTurn").textContent = `送信 ${memTurn}回目`;
  }

  function memSend() {
    if (memTurn >= MEM_TURNS.length) return;
    const t = MEM_TURNS[memTurn];
    const withHist = memHistory.checked;
    const sent = withHist ? [...memLog, { role: "user", text: t.user }] : [{ role: "user", text: t.user }];
    memTurn++;
    memLog.push({ role: "user", text: t.user });
    memLog.push({ role: "assistant", text: withHist ? t.ai : t.noHist });
    memRender(sent);
    memNote.textContent = withHist || memTurn === 1
      ? t.note
      : "過去の会話を送らなかったので、AIは話の流れがまったくわかりません。AIは本当に何も覚えていないのです。";
    if (memTurn >= MEM_TURNS.length) {
      memNext.disabled = true;
      memNext.textContent = "会話はここまで";
    }
  }
  function memReset() {
    memLog = [];
    memTurn = 0;
    memNext.disabled = false;
    memNext.textContent = "次の発言を送る";
    memNote.textContent = "「次の発言を送る」を押してください。チェックを外すと、過去の会話を送らなかった場合を試せます。";
    memRender([]);
  }
  memNext.addEventListener("click", memSend);
  $("#memReset").addEventListener("click", memReset);
  memReset();

  /* ---------- 第2章: プロンプトの層 ---------- */
  const layers = $("#layers");
  $$("#prompt .seg button").forEach((b) => {
    b.addEventListener("click", () => {
      const ai = b.dataset.view === "ai";
      $$("#prompt .seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      layers.classList.toggle("user-view", !ai);
      $("#layersCaption").textContent = ai
        ? "AIが受け取っているのは、これ全部です。この全体が「プロンプト」です。"
        : "あなたが書いたのは、この一言だけ。";
    });
  });

  /* ---------- 第3章: 10人テスト ---------- */
  let tenMode = "casual";
  let tenTimer = 0;
  const tenGrid = $("#tenGrid");
  const isReadable = (s) => ["positive", "negative"].includes(s.trim());

  function tenPromptText(mode) {
    const review = R.reviews[0];
    if (mode === "casual") {
      return `<span class="c">// user だけ。指示書（system）はなし</span>\n<span class="k">[user]</span>\n${esc(R.casualTemplate.replace("{review}", review))}`;
    }
    return `<span class="k">[system]</span>\n${esc(R.structuredSystem)}\n\n<span class="k">[user]</span>\n${esc(R.structuredUser.replace("{review}", review))}`;
  }

  function tenRenderEmpty() {
    clearTimeout(tenTimer);
    tenGrid.innerHTML = R.reviews.map((rv, i) => `
      <div class="ten-card">
        <div class="who"><span>お客さん${i + 1}${i === 8 ? ' <span class="injection-tag">いたずら入力</span>' : ""}</span><span class="v"></span></div>
        <div class="review">${esc(rv)}</div>
        <div class="out pending">（未実行）</div>
      </div>`).join("");
    $("#tenScoreNum").textContent = "– / 10";
    $("#tenScoreNote").textContent = "「10人分を実行」を押してください。";
    $("#tenPrompt").innerHTML = tenPromptText(tenMode);
  }

  function tenRun() {
    tenRenderEmpty();
    const outs = R[tenMode];
    const cards = $$(".ten-card", tenGrid);
    let ok = 0;
    let i = 0;
    const btn = $("#tenRun");
    btn.disabled = true;
    const step = () => {
      const out = outs[i];
      const card = cards[i];
      const good = isReadable(out);
      if (good) ok++;
      $(".out", card).classList.remove("pending");
      $(".out", card).textContent = out;
      $(".v", card).innerHTML = good ? '<span class="verdict ok">読めた ✓</span>' : '<span class="verdict ng">読めない ✗</span>';
      $("#tenScoreNum").textContent = `${ok} / 10`;
      i++;
      if (i < outs.length) {
        tenTimer = setTimeout(step, reduceMotion ? 0 : 220);
      } else {
        btn.disabled = false;
        $("#tenScoreNote").textContent = tenMode === "casual"
          ? "人間が読めば正しい内容でも、前置きや説明が付くとプログラムは1語を取り出せません。いたずら入力のお客さん9の返事も見てみてください。"
          : ok === outs.length
            ? "全員分が positive / negative の1語でそろいました。いたずら入力にも、書かれた命令には従わず判定だけを返しています。"
            : "ゆるいプロンプトより、ずっとそろった返事になりました。";
      }
    };
    step();
  }

  $$("#why .seg button").forEach((b) => {
    b.addEventListener("click", () => {
      tenMode = b.dataset.mode;
      $$("#why .seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      $("#tenRun").disabled = false;
      tenRenderEmpty();
    });
  });
  $("#tenRun").addEventListener("click", tenRun);
  tenRenderEmpty();

  /* ---------- 第4章: 注文票の分解 ---------- */
  const keigo = R.apps.keigo;
  const keigoSystem = ["role", "rules", "format"].map((k) => keigo.blocks[k]).join("\n\n");
  const keigoAnswer = keigo.outputs[0]["role+rules+format"];
  const PARTS = [
    { id: "url", label: "宛先", title: "宛先（エンドポイント）", body: "どのAIの会社の、どの窓口に送るかを表します。会話用の窓口は /chat/completions です。", analogy: "たとえるなら：厨房の住所" },
    { id: "key", label: "APIキー", title: "APIキー", body: "あなたが誰かを証明し、料金を請求するための鍵です。他人に知られると勝手に使われてしまうので、絶対に公開しません。", analogy: "たとえるなら：会員証 兼 クレジットカード" },
    { id: "model", label: "モデル", title: "モデル名", body: "どのAIに答えてもらうかを選びます。賢いモデルほど高く、軽いモデルほど速くて安い傾向があります。", analogy: "たとえるなら：料理人の指名" },
    { id: "system", label: "指示書", title: "system（指示書）", body: "アプリの性格とルールを決める部分です。利用者には見えません。ここを書き換えると別のアプリになります。", analogy: "たとえるなら：お店のレシピ帳" },
    { id: "user", label: "利用者の入力", title: "user（利用者の入力）", body: "画面で入力された文章が、そのまま入ります。毎回ここだけが変わります。", analogy: "たとえるなら：お客さんの注文" },
    { id: "answer", label: "答え", title: "content（AIの答え）", body: "AIが書いた返事です。返事のJSONには他にも色々入っていますが、アプリはここだけを取り出して画面に表示します。", analogy: "たとえるなら：出来上がった料理" },
    { id: "usage", label: "使用量", title: "usage（使用量）", body: "送った量と返ってきた量を「トークン」という単位で数えたものです。料金はこの数で決まります。日本語なら、おおよそ1文字で1トークン前後です（この数字は一例です）。", analogy: "たとえるなら：伝票の合計金額" },
  ];
  const P = (id, html) => `<span class="part" data-part="${id}" tabindex="0">${html}</span>`;
  const J = (s) => esc(JSON.stringify(s));
  const shortSystem = keigoSystem.split("\n").slice(0, 2).join("\n") + "\n…";

  $("#slipReq").innerHTML =
`<span class="slip-label">送る注文票（リクエスト）</span>${P("url", "POST https://api.openai.com/v1/chat/completions")}
${P("key", "Authorization: Bearer sk-xxxxxxxxxxxx")}
<span class="dim">Content-Type: application/json</span>

{
  ${P("model", `"model": "${esc(R.model)}"`)},
  "messages": [
    ${P("system", `{ "role": "system",\n      "content": ${J(shortSystem)} }`)},
    ${P("user", `{ "role": "user",\n      "content": ${J(keigo.samples[0])} }`)}
  ]
}`;
  $("#slipRes").innerHTML =
`<span class="slip-label">返ってきた返事（レスポンス）</span>{
  "model": "${esc(R.model)}-2026-03-17",
  "choices": [{
    "message": {
      "role": "assistant",
      ${P("answer", `"content": ${J(keigoAnswer)}`)}
    }
  }],
  ${P("usage", `"usage": { "prompt_tokens": 92, "completion_tokens": 31 }`)}
}`;

  const anaTabs = $("#anaTabs");
  anaTabs.innerHTML = PARTS.map((p) => `<button type="button" data-part="${p.id}" aria-pressed="false">${p.label}</button>`).join("");
  function anaSelect(id) {
    const p = PARTS.find((x) => x.id === id);
    $$("#anaTabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.part === id));
    $$(".slip .part").forEach((s) => s.classList.toggle("on", s.dataset.part === id));
    $("#anaExplain").innerHTML = `<span class="chapno">${PARTS.indexOf(p) + 1} / ${PARTS.length}</span><h3>${p.title}</h3><p>${p.body}</p><p class="analogy">${p.analogy}</p>`;
  }
  anaTabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) anaSelect(b.dataset.part); });
  $$(".slip .part").forEach((s) => {
    s.addEventListener("click", () => anaSelect(s.dataset.part));
    s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); anaSelect(s.dataset.part); } });
  });
  anaSelect("system");

  /* ---------- 第5章: 仕組みフロー ---------- */
  const POS = ["16.67%", "50%", "83.33%"];
  const userText = keigo.samples[0];
  const FLOW = [
    {
      title: "利用者が文章を入れて、ボタンを押す",
      body: "画面（ブラウザ）は、入力された文章を自分のサーバーに送ります。この時点では、まだAIは関係ありません。",
      from: 0, to: 1, active: 0, label: "{ text }", back: false,
      code: `<span class="c">// 画面（index.html）</span>\nfetch(<span class="s">"/api/keigo"</span>, {\n  method: <span class="s">"POST"</span>,\n  body: JSON.stringify({\n    text: <span class="s">${J(userText)}</span>\n  })\n})`,
    },
    {
      title: "サーバーが注文票を組み立てる",
      body: "サーバーは、あらかじめ用意しておいた指示書（system）と、届いた文章（user）を組み合わせて messages を作ります。",
      from: 1, to: 1, active: 1, label: "注文票を作成", back: false,
      code: `<span class="c">// サーバー（server.mjs）</span>\nmessages: [\n  { role: <span class="s">"system"</span>, content: SYSTEM_PROMPT },\n  { role: <span class="s">"user"</span>,   content: text }\n]\n\n<span class="c">// SYSTEM_PROMPT の中身</span>\n<span class="s">${esc(keigoSystem)}</span>`,
    },
    {
      title: "APIキーを付けて、AIの会社へ送る",
      body: "注文票にAPIキーを付けて、AIの会社の窓口（API）に送ります。キーはサーバーの中にあるので、利用者からは見えません。",
      from: 1, to: 2, active: 2, label: "注文票＋APIキー", back: false,
      code: `<span class="c">// サーバー（server.mjs）</span>\nfetch(<span class="s">"https://api.openai.com/v1/chat/completions"</span>, {\n  method: <span class="s">"POST"</span>,\n  headers: {\n    Authorization: <span class="s">\`Bearer \${process.env.OPENAI_API_KEY}\`</span>\n  },\n  body: JSON.stringify({ model, messages })\n})`,
    },
    {
      title: "AIが「続き」を書く",
      body: "AIは注文票を最初から最後まで読み、その続きとして返事の文章を書きます。第1章で見たとおり、AIが知っているのはこの注文票に書かれたことだけです。",
      from: 2, to: 2, active: 2, label: "生成中…", back: false,
      code: `<span class="c">// AIから見た世界（これがすべて）</span>\n<span class="k">[system]</span> あなたはビジネスメールの専門家です。…\n<span class="k">[user]</span>   ${esc(userText)}\n<span class="k">[assistant]</span> ▍ ← ここから続きを書く`,
    },
    {
      title: "返事がサーバーに届き、答えだけ取り出す",
      body: "返事もJSONで届きます。中には使用量などの情報も入っているので、サーバーは答えの文章（content）だけを取り出します。",
      from: 2, to: 1, active: 1, label: "返事（JSON）", back: true,
      code: `<span class="c">// サーバー（server.mjs）</span>\nconst data = await res.json();\nconst answer = data.choices[0].message.content;\n\n<span class="c">// answer の中身</span>\n<span class="s">${J(keigoAnswer)}</span>`,
    },
    {
      title: "画面に表示する",
      body: "サーバーから答えを受け取った画面が、それを表示します。利用者から見れば「ボタンを押したら敬語になった」だけです。",
      from: 1, to: 0, active: 0, label: "答え", back: true,
      code: `<span class="c">// 画面（index.html）</span>\nconst { answer } = await res.json();\noutput.textContent = answer;\n\n<span class="c">// 画面に出る文字</span>\n<span class="s">${esc(keigoAnswer)}</span>`,
    },
  ];
  let flowStep = 0;
  let flowAutoTimer = 0;
  const packet = $("#packet");
  function flowRender(animate = true) {
    const s = FLOW[flowStep];
    $("#flowCount").textContent = `STEP ${flowStep + 1} / ${FLOW.length}`;
    $("#flowTitle").textContent = s.title;
    $("#flowBody").textContent = s.body;
    $("#flowCode").innerHTML = s.code;
    $$("#flowNodes .node").forEach((n) => n.classList.toggle("active", Number(n.dataset.node) === s.active));
    packet.textContent = s.label;
    packet.classList.toggle("back", s.back);
    packet.style.transition = "none";
    packet.style.left = POS[animate ? s.from : s.to];
    void packet.offsetWidth;
    packet.style.transition = "";
    packet.style.left = POS[s.to];
    $("#flowPrev").disabled = flowStep === 0;
    $("#flowNext").disabled = flowStep === FLOW.length - 1;
  }
  function flowGo(d) {
    flowStep = Math.min(FLOW.length - 1, Math.max(0, flowStep + d));
    flowRender();
  }
  function flowStopAuto() {
    clearInterval(flowAutoTimer);
    flowAutoTimer = 0;
    $("#flowAuto").textContent = "自動再生";
  }
  $("#flowPrev").addEventListener("click", () => { flowStopAuto(); flowGo(-1); });
  $("#flowNext").addEventListener("click", () => { flowStopAuto(); flowGo(1); });
  $("#flowAuto").addEventListener("click", () => {
    if (flowAutoTimer) return flowStopAuto();
    $("#flowAuto").textContent = "停止";
    flowStep = 0;
    flowRender();
    flowAutoTimer = setInterval(() => {
      if (flowStep >= FLOW.length - 1) return flowStopAuto();
      flowGo(1);
    }, 2600);
  });
  flowRender(false);

  /* ---------- 第6章: アプリ工房 ---------- */
  const APP_META = {
    keigo: { name: "敬語メール変換", desc: "くだけた文を敬語に" },
    recipe: { name: "冷蔵庫レシピ", desc: "食材から1品を提案" },
    praise: { name: "日記ほめ係", desc: "1日をやさしく褒める" },
  };
  const BLOCKS = [
    { id: "role", name: "役割" },
    { id: "rules", name: "ルール" },
    { id: "format", name: "出力形式" },
  ];
  const lab = { app: "keigo", blocks: new Set(["role", "rules", "format"]), sample: 0, busy: false };

  function comboKey() {
    const k = BLOCKS.map((b) => b.id).filter((id) => lab.blocks.has(id)).join("+");
    return k || "none";
  }
  function labSystem() {
    return BLOCKS.filter((b) => lab.blocks.has(b.id)).map((b) => R.apps[lab.app].blocks[b.id]).join("\n\n");
  }
  function labHint() {
    const has = (id) => lab.blocks.has(id);
    if (lab.blocks.size === 0) return "指示書なし。いつものチャットと同じ状態なので、AIは何をすべきか推測して答えます。聞き返しや余計な提案が混ざりがちです。";
    if (lab.blocks.size === 3) return "役割・ルール・出力形式がそろうと、アプリとして使いやすい安定した答えになります。";
    if (has("format")) return "出力形式があると、答えの形がそろいます。ほかのパーツも足すと、中身も安定します。";
    if (has("role") && !has("rules")) return "役割だけだと、キャラクターは決まっても、答えの長さや形はバラバラになりやすいです。";
    return "パーツを足すほど、答えがアプリの目的に近づいていきます。";
  }

  function labRenderControls() {
    $("#appPicker").innerHTML = Object.entries(APP_META).map(([id, m]) =>
      `<button type="button" data-app="${id}" aria-pressed="${id === lab.app}"><b>${m.name}</b><small>${m.desc}</small></button>`).join("");
    $("#blocks").innerHTML = BLOCKS.map((b) =>
      `<label class="block-toggle"><input type="checkbox" id="blk-${b.id}" data-block="${b.id}"${lab.blocks.has(b.id) ? " checked" : ""}><pre>${esc(R.apps[lab.app].blocks[b.id])}</pre></label>`).join("");
    $("#samples").innerHTML = R.apps[lab.app].samples.map((s, i) =>
      `<button type="button" data-sample="${i}" aria-pressed="${i === lab.sample}">${esc(s)}</button>`).join("");
  }

  function labRenderJson() {
    const sys = labSystem();
    const msgs = [];
    if (sys) msgs.push(`    { <span class="k">"role"</span>: <span class="role system">"system"</span>,\n      <span class="k">"content"</span>: <span class="s">${J(sys)}</span> }`);
    msgs.push(`    { <span class="k">"role"</span>: <span class="role user">"user"</span>,\n      <span class="k">"content"</span>: <span class="s">${J(R.apps[lab.app].samples[lab.sample])}</span> }`);
    $("#labJson").innerHTML = `{\n  <span class="k">"model"</span>: <span class="s">"${esc(R.model)}"</span>,\n  <span class="k">"messages"</span>: [\n${msgs.join(",\n")}\n  ]\n}`;
    $("#labHint").textContent = labHint();
  }

  function labShowResult(text) {
    const box = $("#labResult");
    box.classList.remove("waiting");
    box.textContent = text;
  }
  function labStale() {
    const box = $("#labResult");
    box.classList.add("waiting");
    box.textContent = "注文票が変わりました。「APIに送る」を押すと、この注文票への返事が表示されます。";
  }

  async function labSend() {
    if (lab.busy) return;
    lab.busy = true;
    $("#labSend").disabled = true;
    const box = $("#labResult");
    const out = R.apps[lab.app].outputs[lab.sample][comboKey()];
    const steps = $$("#miniFlow span");
    box.classList.add("waiting");
    box.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    for (let i = 0; i < steps.length - 1; i++) {
      steps.forEach((s, j) => s.classList.toggle("on", j === i));
      await wait(i === 2 ? 700 : 350);
    }
    steps.forEach((s, j) => s.classList.toggle("on", j === steps.length - 1));
    box.classList.remove("waiting");
    if (reduceMotion) {
      box.textContent = out;
    } else {
      box.textContent = "";
      for (let i = 0; i < out.length; i += 3) {
        box.textContent = out.slice(0, i + 3);
        await wait(12);
      }
    }
    await wait(400);
    steps.forEach((s) => s.classList.remove("on"));
    lab.busy = false;
    $("#labSend").disabled = false;
  }

  $("#appPicker").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || lab.busy) return;
    lab.app = b.dataset.app;
    lab.sample = 0;
    labRenderControls();
    labRenderJson();
    labStale();
  });
  $("#blocks").addEventListener("change", (e) => {
    const id = e.target.dataset.block;
    if (!id) return;
    e.target.checked ? lab.blocks.add(id) : lab.blocks.delete(id);
    labRenderJson();
    labStale();
  });
  $("#samples").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || lab.busy) return;
    lab.sample = Number(b.dataset.sample);
    $$("#samples button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    labRenderJson();
    labStale();
  });
  $("#labSend").addEventListener("click", labSend);
  labRenderControls();
  labRenderJson();
  labShowResult(R.apps[lab.app].outputs[lab.sample][comboKey()]);
  $("#labSource").textContent = `返事は、この注文票を ${R.model} に実際に送って記録したものです（3アプリ × 2入力 × パーツの組み合わせ8通り）。注文票の中の \\n は「改行」の意味です。`;

  /* ---------- 第7章: コードの設計図 ---------- */
  const FILES = {
    "index.html": {
      notes: [
        { lines: [4, 7], title: "画面の部品", text: "見出し・入力欄・ボタン・結果を出す場所。普通のWebページと同じです。" },
        { lines: [10, 10], title: "入力を取り出す", text: "入力欄に書かれた文章を text という入れ物に入れます。" },
        { lines: [12, 16], title: "自分のサーバーに送る", text: "AIの会社ではなく、自分のサーバー（/api/keigo）に送ります。だからAPIキーは画面に出てきません。" },
        { lines: [17, 18], title: "答えを表示する", text: "サーバーから返ってきた answer を、結果の場所に表示します。" },
      ],
    },
    "server.mjs": {
      notes: [
        { lines: [4, 13], title: "指示書（system）", text: "このアプリの個性はここだけ。第3章の # を使った書き方そのままです。ここを書き換えれば別のアプリになります。" },
        { lines: [16, 16], title: "宛先", text: "OpenAI の会話用API。第4章の注文票の「宛先」です。" },
        { lines: [20, 20], title: "APIキー", text: ".env ファイルから読み込みます。コードに直接書かないので、コードを人に見せても安全です。" },
        { lines: [23, 27], title: "モデルと messages", text: "使うAIの指定と、指示書（system）＋利用者の入力（user）。注文票の本体です。" },
        { lines: [30, 32], title: "答えだけ取り出す", text: "返事のJSONから content だけを取り出します。失敗したときはエラーの理由を返します。" },
        { lines: [35, 42], title: "画面からの受付窓口", text: "画面から /api/keigo に文章が届いたら、askAI を呼んで答えを返します。" },
      ],
    },
    ".env.example": {
      notes: [
        { lines: [3, 3], title: "APIキーの置き場所", text: "このファイルを .env という名前でコピーし、自分のキーを書きます。.env は公開しません。" },
      ],
    },
  };
  let fileName = "server.mjs";
  let noteIdx = 0;
  function fileRender() {
    const src = EX[fileName].replace(/\n$/, "");
    const note = FILES[fileName].notes[noteIdx];
    $("#fileTabs").innerHTML = Object.keys(FILES).map((f) => `<button type="button" data-file="${f}" aria-pressed="${f === fileName}">${f}</button>`).join("");
    $("#fileCode").innerHTML = src.split("\n").map((line, i) => {
      const n = i + 1;
      const on = note && n >= note.lines[0] && n <= note.lines[1];
      return `<span class="${on ? "hl" : ""}"><span class="c">${String(n).padStart(2, " ")}  </span>${esc(line) || " "}</span>`;
    }).join("\n");
    $("#fileNotes").innerHTML = FILES[fileName].notes.map((nt, i) =>
      `<button type="button" class="note-btn" data-note="${i}" aria-pressed="${i === noteIdx}"><b>${nt.lines[0] === nt.lines[1] ? nt.lines[0] : nt.lines.join("–")}行目　${nt.title}</b><span>${nt.text}</span></button>`).join("");
    const hl = $("#fileCode .hl");
    if (hl) $("#fileCode").scrollTop = hl.offsetTop - 40;
  }
  $("#fileTabs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    fileName = b.dataset.file;
    noteIdx = 0;
    fileRender();
  });
  $("#fileNotes").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    noteIdx = Number(b.dataset.note);
    fileRender();
  });
  fileRender();

  /* ---------- 第8章: クイズ ---------- */
  const QUIZ = [
    {
      q: "ChatGPTが、さっきの会話を覚えているように見えるのはなぜ？",
      opts: ["AIの頭の中に会話が保存されているから", "チャットアプリが、毎回それまでの会話もまとめて送っているから", "インターネットで検索しているから"],
      a: 1,
      why: "AI自体は何も覚えていません。アプリが履歴ごと送り直しています（第1章）。",
    },
    {
      q: "「プロンプト」の説明として一番正しいのは？",
      opts: ["チャット欄に打った一言のこと", "AIに渡す文章のぜんぶ（見えない指示書や履歴も含む）", "AIが返してきた答えのこと"],
      a: 1,
      why: "あなたの一言は一部。指示書・設定・履歴も含めた全体がプロンプトです（第2章）。",
    },
    {
      q: "アプリ用のプロンプトで「# ルール」のように見出しを付けるのは、なぜ？",
      opts: ["# を付けないとAIが動かないから", "指示とデータの区切りをはっきりさせ、何度使っても同じ形の答えを返してもらうため", "AIに対して礼儀正しくするため"],
      a: 1,
      why: "# はただの見出し記号です。聞き返せない・何度も使われる・プログラムが読む、というアプリの事情に合わせて構造をはっきりさせます（第3章）。",
    },
    {
      q: "APIキーはどこに置くのが正しい？",
      opts: ["画面のHTMLに直接書く", "自分のサーバーの中（.env ファイルなど）", "GitHubのREADMEに書いておく"],
      a: 1,
      why: "画面に書くと誰でも見られます。キーはサーバー側に隠し、サーバーが代わりにAIへ送ります（第5章）。",
    },
    {
      q: "敬語変換アプリを「レシピ提案アプリ」に作り変えるとき、一番大きく変えるのは？",
      opts: ["AIの会社", "システムプロンプト（指示書）", "サーバーの起動方法"],
      a: 1,
      why: "コードの仕組みは同じ。アプリの個性はほぼ指示書で決まります（第6章・第7章）。",
    },
  ];
  const quizState = QUIZ.map(() => null);
  function quizRender() {
    $("#quizBox").innerHTML = QUIZ.map((item, qi) => {
      const answered = quizState[qi] !== null;
      return `<div class="q">
        <p class="q-title"><span>Q${qi + 1}</span>${item.q}</p>
        <div class="q-opts">${item.opts.map((o, oi) => {
          let cls = "";
          if (answered && oi === item.a) cls = "correct";
          else if (answered && oi === quizState[qi]) cls = "wrong";
          return `<button type="button" data-q="${qi}" data-o="${oi}" class="${cls}"${answered ? " disabled" : ""}>${o}</button>`;
        }).join("")}</div>
        ${answered ? `<p class="q-explain">${quizState[qi] === item.a ? "正解！" : "おしい！"} ${item.why}</p>` : ""}
      </div>`;
    }).join("");
    const done = quizState.filter((x) => x !== null).length;
    const score = quizState.filter((x, i) => x === QUIZ[i].a).length;
    $("#quizScore").innerHTML = done === QUIZ.length
      ? `${score} / ${QUIZ.length} 問正解${score === QUIZ.length ? "　もうAIアプリの仕組みを説明できます。" : "　解説の章を読み返してみましょう。"} <button class="btn ghost" type="button" id="quizReset" style="font-family:var(--f-body);font-size:0.9rem">もう一度</button>`
      : "";
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#quizBox button");
    if (b) {
      quizState[Number(b.dataset.q)] = Number(b.dataset.o);
      quizRender();
    }
    if (e.target.closest("#quizReset")) {
      quizState.fill(null);
      quizRender();
    }
  });
  quizRender();
})();
