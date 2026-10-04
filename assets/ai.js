(() => {
  "use strict";

  const R = window.RECORDED;
  const EX = window.EXAMPLES;
  const { $, $$, esc, reduceMotion, wait } = window.Site;

  /* ---------- 第0章: そもそも ---------- */
  const CONT = [
    ["むかしむかし、あるところに", "おじいさんとおばあさんが住んでいました。"],
    ["Q. 日本の首都は？ A.", "東京です。"],
    ["「明日遅れます」を丁寧に言うと", "「明日は遅れて参加いたします」となります。"],
  ];
  function showCont(i) {
    $("#contOut").innerHTML = `${esc(CONT[i][0])}<mark>${esc(CONT[i][1])}</mark>`;
  }
  Site.segmented($("#contPicks"), (b) => showCont(Number(b.dataset.i)));
  showCont(0);
  $("#addMine").addEventListener("click", (e) => {
    if ($("#borrowApps .yours")) return;
    $("#borrowApps").insertAdjacentHTML("beforeend", '<div class="app-chip yours"><b>あなたのアプリ</b><small>同じAI本体を借りて使える。このページのゴール！</small></div>');
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "借りられました";
  });

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
      note: "1回目は、あなたの一言だけが注文票に書かれます。",
    },
    {
      user: "それを辛くするには？",
      ai: "カレーを辛くするなら、仕上げにチリパウダーやカイエンペッパーを少しずつ足すのがおすすめです。",
      noHist: "「それ」が何を指しているのかわかりません。何を辛くしたいのか教えてください。",
      note: "2回目は、1回目の会話も書き写されています。だからAIは「それ」がカレーのことだとわかります。",
    },
    {
      user: "じゃあ子ども向けには？",
      ai: "子ども向けなら甘口のルーを使い、すりおろしたりんごやはちみつを加えるとまろやかになります。",
      noHist: "何を子ども向けにしたいのでしょうか？もう少し詳しく教えてください。",
      note: "会話が続くほど、注文票はどんどん長くなります。AIの料金は文字の量で決まるので、長い会話ほどお金もかかります。",
    },
    {
      user: "ありがとう！最初に聞いた料理は何だっけ？",
      ai: "最初にお聞きになったのは「カレー」の作り方です。",
      noHist: "これまでの会話の内容がわからないため、お答えできません。",
      note: "最初の質問を覚えているように見えるのは、毎回ぜんぶ書き写して渡しているからです。",
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
    const label = role === "user" ? "あなた" : "AIの返事";
    return `<div class="payload-row${isNew ? " is-new" : ""}"><span><span class="olabel ${role}">${label}</span></span><p>${esc(text)}</p></div>`;
  }

  function memRender(sent) {
    memChat.innerHTML = memLog.length
      ? memLog.map((m) => `<div class="bubble ${m.role === "user" ? "me" : "ai"}">${esc(m.text)}</div>`).join("")
      : `<p style="color:var(--ink-soft);font-size:0.9rem">まだ何も話していません。</p>`;
    memPayload.innerHTML = sent.length
      ? sent.map((m, i) => payloadRow(m.role, m.text, i === sent.length - 1)).join("")
      : `<p style="color:var(--ink-soft);font-size:0.9rem">送ると、ここにAIが受け取る注文票が表示されます。</p>`;
    const chars = sent.reduce((n, m) => n + m.text.length, 0);
    $("#memCount").textContent = `注文票の文字数: ${chars}文字`;
    $("#memTurn").textContent = `${memTurn}回目`;
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
      : "これまでの会話を書き写さなかったので、AIは話の流れがまったくわかりません。AIは本当に何も覚えていないのです。";
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
    memNote.textContent = "「次の発言を送る」を押してください。途中で「これまでの会話も書き写す」のチェックを外すと、どうなるか試せます。";
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
      return `<span class="c">// 指示書なし。お客さん1の場合</span>\n${esc(R.casualTemplate.replace("{review}", review))}`;
    }
    return `<span class="c">// 指示書</span>\n${esc(R.structuredSystem)}\n\n<span class="c">// お客さんの口コミ（お客さん1の場合）</span>\n${esc(R.structuredUser.replace("{review}", review))}`;
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
      $(".v", card).innerHTML = good ? '<span class="verdict ok">理解できた ✓</span>' : '<span class="verdict ng">理解できない ✗</span>';
      $("#tenScoreNum").textContent = `${ok} / 10`;
      i++;
      if (i < outs.length) {
        tenTimer = setTimeout(step, reduceMotion ? 0 : 220);
      } else {
        btn.disabled = false;
        $("#tenScoreNote").textContent = tenMode === "casual"
          ? "内容は合っていても「ポジティブです。理由は…」と文章で答えるので、プログラムには理解できません。いたずら入力のお客さん9の答えも見てみてください。"
          : ok === outs.length
            ? "全員分が positive か negative の1語でそろいました。いたずら入力にもだまされず、判定だけを返しています。"
            : "ふだん通りの頼み方より、ずっとそろった答えになりました。";
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
  const J = (s) => esc(JSON.stringify(s));

  // 注文票カードの中身を作る。fields: [{ label, cls, text, small, part }]
  function slipHTML(head, fields) {
    return `<div class="oslip-head">${head}</div>` + fields.map((f) =>
      `<div class="ofield"${f.part ? ` data-part="${f.part}" tabindex="0"` : ""}><span class="olabel ${f.cls || ""}">${f.label}</span><p>${esc(f.text)}${f.small ? `<small>${esc(f.small)}</small>` : ""}</p></div>`).join("");
  }

  const PARTS = [
    { id: "dest", label: "届け先", title: "届け先", body: "どのAIの会社の窓口に出すか、です。OpenAI・Google・Anthropic など、会社ごとに窓口の住所があります。", analogy: "たとえるなら：厨房の住所" },
    { id: "key", label: "会員証", title: "会員証（APIキー）", body: "AIの会社から発行される、ひみつの番号です。「誰が使ったか」を確かめて料金を請求するために使います。人に見せてはいけません。", analogy: "たとえるなら：会員証 兼 クレジットカード" },
    { id: "model", label: "AIの種類", title: "AIの種類（モデル）", body: "同じ会社にも、賢さや値段のちがうAIが何種類もいます。賢いほど高く、軽いほど速くて安くなります。", analogy: "たとえるなら：料理人の指名" },
    { id: "system", label: "指示書", title: "指示書", body: "アプリの性格とルールです。お客さんには見えません。ここを書き換えると、別のアプリになります。", analogy: "たとえるなら：お店のレシピ帳" },
    { id: "user", label: "お客さんの入力", title: "お客さんの入力", body: "画面で入力された文章が、そのまま入ります。毎回ここだけが変わります。", analogy: "たとえるなら：お客さんの注文" },
    { id: "answer", label: "AIの答え", title: "AIの答え", body: "AIが書いた答えです。アプリはこれを取り出して、画面に表示します。", analogy: "たとえるなら：できあがった料理" },
    { id: "usage", label: "使った量", title: "使った量", body: "AIがどれだけの文字を読み書きしたかです。料金はこの量で決まります（数字は一例です）。", analogy: "たとえるなら：レシート" },
  ];

  $("#slipReq").innerHTML = slipHTML("APIに出す注文票", [
    { part: "dest", label: "届け先", text: "OpenAIのAI窓口", small: "api.openai.com" },
    { part: "key", label: "会員証", text: "sk-●●●●●●●●（ひみつの番号）" },
    { part: "model", label: "AIの種類", text: R.model },
    { part: "system", label: "指示書", cls: "system", text: keigoSystem },
    { part: "user", label: "お客さんの入力", cls: "user", text: keigo.samples[0] },
  ]);
  $("#slipRes").innerHTML = slipHTML("返ってきたもの", [
    { part: "answer", label: "AIの答え", cls: "assistant", text: keigoAnswer },
    { part: "usage", label: "使った量", text: "読んだ量 92・書いた量 31", small: "「トークン」という単位で数えます" },
  ]);
  $("#rawJson").innerHTML =
`<span class="c">// 送る注文票</span>
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer sk-xxxxxxxxxxxx

{
  <span class="k">"model"</span>: <span class="s">"${esc(R.model)}"</span>,
  <span class="k">"messages"</span>: [
    { <span class="k">"role"</span>: <span class="s">"system"</span>, <span class="k">"content"</span>: <span class="s">${J(keigoSystem)}</span> },
    { <span class="k">"role"</span>: <span class="s">"user"</span>, <span class="k">"content"</span>: <span class="s">${J(keigo.samples[0])}</span> }
  ]
}

<span class="c">// 返ってきたもの（一部）</span>
{
  <span class="k">"choices"</span>: [{ <span class="k">"message"</span>: { <span class="k">"role"</span>: <span class="s">"assistant"</span>, <span class="k">"content"</span>: <span class="s">${J(keigoAnswer)}</span> } }],
  <span class="k">"usage"</span>: { <span class="k">"prompt_tokens"</span>: 92, <span class="k">"completion_tokens"</span>: 31 }
}

<span class="c">// system = 指示書、user = お客さんの入力、assistant = AIの答え</span>`;

  const anaTabs = $("#anaTabs");
  anaTabs.innerHTML = PARTS.map((p) => `<button type="button" data-part="${p.id}" aria-pressed="false">${p.label}</button>`).join("");
  function anaSelect(id) {
    const p = PARTS.find((x) => x.id === id);
    $$("#anaTabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.part === id));
    $$("#api .ofield[data-part]").forEach((s) => s.classList.toggle("on", s.dataset.part === id));
    $("#anaExplain").innerHTML = `<span class="chapno">${PARTS.indexOf(p) + 1} / ${PARTS.length}</span><h3>${p.title}</h3><p>${p.body}</p><p class="analogy">${p.analogy}</p>`;
  }
  anaTabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) anaSelect(b.dataset.part); });
  $$("#api .ofield[data-part]").forEach((s) => {
    s.addEventListener("click", () => anaSelect(s.dataset.part));
    s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); anaSelect(s.dataset.part); } });
  });
  anaSelect("system");

  /* ---------- 第5章: 仕組みフロー ---------- */
  const POS = ["16.67%", "50%", "83.33%"];
  const userText = keigo.samples[0];
  const shortSystem = keigo.blocks.role.split("\n")[1] + "…";
  const text = (t) => `<div class="carry-text">${esc(t)}</div>`;
  const slip = (head, fields) => `<div class="oslip">${slipHTML(head, fields)}</div>`;
  const FLOW = [
    {
      title: "お客さんが文章を入れて、ボタンを押す",
      body: "画面は、入力された文章をお店の奥（サーバー）に渡します。まだAIは登場しません。",
      from: 0, to: 1, active: 0, label: "入力", back: false,
      carry: text(userText),
    },
    {
      title: "お店の奥で、注文票を作る",
      body: "お店の奥では、前もって書いておいた指示書と、届いた文章をセットにして注文票を作ります。",
      from: 1, to: 1, active: 1, label: "注文票を作成", back: false,
      carry: slip("注文票", [
        { label: "指示書", cls: "system", text: shortSystem, small: "前もって書いておいたもの" },
        { label: "お客さんの入力", cls: "user", text: userText },
      ]),
    },
    {
      title: "会員証を付けて、AIに出す",
      body: "注文票に会員証（APIキー）を付けて、AIの会社の窓口（API）に出します。会員証はお店の奥にあるので、お客さんからは見えません。",
      from: 1, to: 2, active: 2, label: "注文票＋会員証", back: false,
      carry: slip("注文票", [
        { label: "会員証", text: "sk-●●●●●●●●" },
        { label: "指示書", cls: "system", text: shortSystem },
        { label: "お客さんの入力", cls: "user", text: userText },
      ]),
    },
    {
      title: "AIが答えを書く",
      body: "AIは注文票を読んで、その続きとして答えを書きます。AIが知っているのは、この注文票に書かれたことだけです。",
      from: 2, to: 2, active: 2, label: "考え中…", back: false,
      carry: text("注文票を読んで、答えを書いています…"),
    },
    {
      title: "答えがお店の奥に届く",
      body: "答えには「使った量」などのおまけ情報も付いてきます。お店の奥は、答えの文章だけを取り出します。",
      from: 2, to: 1, active: 1, label: "答え＋おまけ", back: true,
      carry: slip("返ってきたもの", [
        { label: "AIの答え", cls: "assistant", text: keigoAnswer },
        { label: "使った量", text: "読んだ量 92・書いた量 31" },
      ]),
    },
    {
      title: "画面に表示する",
      body: "画面に答えが表示されます。お客さんから見れば「ボタンを押したら敬語になった」だけです。",
      from: 1, to: 0, active: 0, label: "答え", back: true,
      carry: text(keigoAnswer),
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
    $("#flowCarry").innerHTML = s.carry;
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
    $("#flowAuto").textContent = "自動で再生";
  }
  $("#flowPrev").addEventListener("click", () => { flowStopAuto(); flowGo(-1); });
  $("#flowNext").addEventListener("click", () => { flowStopAuto(); flowGo(1); });
  $("#flowAuto").addEventListener("click", () => {
    if (flowAutoTimer) return flowStopAuto();
    $("#flowAuto").textContent = "止める";
    flowStep = 0;
    flowRender();
    flowAutoTimer = setInterval(() => {
      if (flowStep >= FLOW.length - 1) return flowStopAuto();
      flowGo(1);
    }, 3200);
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
    if (lab.blocks.size === 0) return "指示書なし。AIは何をすればいいか分からないので、聞き返したり、関係ない提案をしたりしがちです。";
    if (lab.blocks.size === 3) return "全部そろうと、アプリとしてちょうどいい答えになります。チェックを外して比べてみてください。";
    if (has("format")) return "出力形式（答えの形）があると、答えの形がそろいます。";
    if (has("role") && !has("rules")) return "役割だけだと、キャラは決まっても、答えが長くなったり形がバラバラになったりします。";
    return "書くことを増やすほど、答えがアプリの目的に近づきます。";
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
    $("#labSlip").innerHTML = slipHTML("注文票", [
      sys
        ? { label: "指示書", cls: "system", text: sys }
        : { label: "指示書", cls: "system", text: "（なし）", small: "いつものチャットで、何の説明もせずに話しかけたのと同じ状態" },
      { label: "お客さんの入力", cls: "user", text: R.apps[lab.app].samples[lab.sample] },
    ]);
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
    box.textContent = "注文票が変わりました。「AIに送る」を押してください。";
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
  $("#labSource").textContent = `AIの答えは、この注文票を実際にAI（${R.model}）へ送って記録したものです。チェックの組み合わせ8通りすべてを記録してあります。`;

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
      opts: ["AIの頭の中に会話が保存されているから", "チャットアプリが、毎回それまでの会話も書き写して送っているから", "インターネットで調べているから"],
      a: 1,
      why: "AI自体は何も覚えていません。店員さん（チャットアプリ）が毎回書き写しています（第1章）。",
    },
    {
      q: "「プロンプト」とは？",
      opts: ["チャット欄に打った一言だけのこと", "AIに渡す注文票の中身ぜんぶ（見えない指示書や会話の書き写しも含む）", "AIが返してきた答えのこと"],
      a: 1,
      why: "あなたの一言は一部だけ。指示書や会話の書き写しも含めた全体がプロンプトです（第2章）。",
    },
    {
      q: "アプリ用の指示書で「# ルール」のように書くのは、なぜ？",
      opts: ["# を付けないとAIが動かないから", "その場にいなくても伝わるように、内容を見出しではっきり分けるため", "AIに礼儀正しくするため"],
      a: 1,
      why: "# はただの見出しの印。アプリでは言い直せないので、はっきり分けて書きます（第3章）。",
    },
    {
      q: "会員証（APIキー）は、どこにしまうのが正しい？",
      opts: ["画面（お客さんが触る所）", "お店の奥（サーバー）", "SNSのプロフィール"],
      a: 1,
      why: "画面に置くと誰でも盗み見できます。お店の奥にしまって、お店の奥がAIに注文します（第5章）。",
    },
    {
      q: "敬語変換アプリを「レシピ提案アプリ」に作り変えるとき、いちばん大きく変えるのは？",
      opts: ["AIの会社", "指示書", "パソコン"],
      a: 1,
      why: "仕組みは同じまま。アプリの性格は、ほとんど指示書で決まります（第6章・第7章）。",
    },
  ];
  Site.quiz({
    items: QUIZ,
    box: $("#quizBox"),
    score: $("#quizScore"),
    perfect: "もうAIアプリの仕組みを説明できます。",
  });
})();
