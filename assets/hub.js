(() => {
  "use strict";
  const { $, $$, esc, wait, segmented } = window.Site;

  /* ---------- 前提1: おみくじアプリ ---------- */
  const steps = $$("#omiSteps li");
  const omiBtn = $("#omiBtn");
  const omiResult = $("#omiResult");
  const FORTUNES = ["大吉", "中吉", "小吉", "凶"];
  const light = (i) => steps.forEach((li, j) => li.classList.toggle("on", j === i));
  light(0);
  omiBtn.addEventListener("click", async () => {
    omiBtn.disabled = true;
    omiResult.textContent = "…";
    light(1);
    await wait(700);
    const pick = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    light(2);
    await wait(300);
    omiResult.textContent = pick;
    await wait(900);
    light(0);
    omiBtn.disabled = false;
    omiBtn.textContent = "もう一回引く";
  });

  /* ---------- 前提3: ネットショップの画面と裏方 ---------- */
  const SPOTS = {
    pic: { title: "商品の写真", side: "front", text: "写真を並べて見せるのは画面の仕事です。ただし写真のファイルそのものは、サーバーから送られてきます。" },
    name: { title: "商品名と値段", side: "back", text: "表示しているのは画面ですが、「いくらか」という正しい情報はサーバーが持っています。画面の数字を書き換えても、実際の値段は変わりません。" },
    stock: { title: "在庫の数", side: "back", text: "在庫はサーバーにしかありません。全国のお客さんが同じ在庫を見ているので、どこか1か所（サーバー）で数えておく必要があるからです。" },
    buy: { title: "「買う」ボタン", side: "both", text: "ボタンは画面の部品です。押すと、画面がサーバーに「これを1個買います」と伝えます。サーバーは在庫を1つ減らし、注文を記録して、お金の計算をします。" },
  };
  function showSpot(id) {
    const s = SPOTS[id];
    $$("#shopMock .hotspot").forEach((b) => b.classList.toggle("on", b.dataset.spot === id));
    const tags = s.side === "both"
      ? '<span class="side-tag front">画面</span> ＋ <span class="side-tag back">裏方（サーバー）</span>'
      : s.side === "front" ? '<span class="side-tag front">画面</span>' : '<span class="side-tag back">裏方（サーバー）</span>';
    $("#shopExplain").innerHTML = `<div>${tags}</div><h3 style="font-size:1.1rem">${s.title}</h3><p>${s.text}</p>`;
  }
  $("#shopMock").addEventListener("click", (e) => {
    const b = e.target.closest(".hotspot");
    if (b) showSpot(b.dataset.spot);
  });
  showSpot("stock");

  /* ---------- 用語ミニ辞典 ---------- */
  const WORDS = [
    ["アプリ", "前提", "コンピューターに「こうなったら、こうして」と手順を書いたもの。アプリケーションの略。", "#basics"],
    ["プログラム／コード", "前提", "アプリの手順書。コンピューター用の書き方で書かれた、ただの文字。", "#basics"],
    ["プログラミング言語", "前提", "手順書を書くための言葉。JavaScript、Python など種類がある。", "#basics"],
    ["Webアプリ", "前提", "インストールせず、ブラウザで開いて使うアプリ。このサイトもその一種。", "#basics"],
    ["ブラウザ", "前提", "Webページを見るためのアプリ。Chrome、Safari、Edge など。", "#basics"],
    ["サーバー", "前提", "インターネットの向こうにある、データをしまったり計算したりする裏方のコンピューター。", "#basics"],
    ["ファイル／フォルダ", "前提", "ファイルはデータのひとかたまり。フォルダはファイルを入れておく箱。", "#basics"],
    ["AI（モデル）", "AI", "大量の文章を読んで、文章の続きを書くのが得意になったプログラム。料理人にたとえられる。", "ai-app.html#zero"],
    ["プロンプト", "AI", "AIに渡す文章のぜんぶ。指示書や会話の書き写しも含む。", "ai-app.html#prompt"],
    ["API", "AI", "プログラム同士がやり取りするための窓口。AIの会社のAPIを使うと、自分のアプリからAIを使える。", "ai-app.html#api"],
    ["APIキー", "AI", "APIを使うための、ひみつの番号。会員証のようなもの。人に見せてはいけない。", "ai-app.html#api"],
    ["Git（ギット）", "GitHub", "ファイルの変更を記録しておく「セーブ機能」の道具。自分のパソコンで動く。", "github.html#save"],
    ["GitHub（ギットハブ）", "GitHub", "Gitのセーブデータを預けておける、インターネット上の倉庫。みんなで共有できる。", "github.html#cloud"],
    ["リポジトリ", "GitHub", "1つのプロジェクトのファイルと、セーブの記録をまとめた箱。", "github.html#cloud"],
    ["コミット", "GitHub", "いまのファイルの状態をセーブすること。メモを付けて記録する。", "github.html#save"],
    ["プッシュ／プル", "GitHub", "プッシュはセーブをGitHubに送ること。プルはGitHubから最新のセーブを受け取ること。", "github.html#sync"],
    ["ブランチ", "GitHub", "本番をコピーして作る「下書き用の世界線」。本番を壊さずに試せる。", "github.html#branch"],
    ["プルリクエスト", "GitHub", "「この下書きを本番に入れていいですか？」というお願い。チェックしてもらってから合体させる。", "github.html#branch"],
    ["オンライン／オフライン", "通信", "インターネットにつながっている状態／つながっていない状態。", "online.html#zero"],
    ["クライアント", "通信", "サーバーに「ください」とお願いする側。たいていはあなたのスマホやパソコン。", "online.html#request"],
    ["リクエスト／レスポンス", "通信", "リクエストは「ください」というお願いの手紙。レスポンスは「どうぞ」という返事の手紙。", "online.html#request"],
    ["URL", "通信", "手紙の宛先。https://〜 で始まる、ページやサーバーの住所。", "online.html#request"],
    ["データベース", "通信", "サーバーの中にある、データを整理してしまっておく棚。", "online.html#data"],
    ["リアルタイム通信", "通信", "つなぎっぱなしにして、新しいことがあったらすぐに知らせてもらう通信のしかた。", "online.html#realtime"],
    ["HTTPS", "通信", "手紙を封筒に入れて鍵をかけたような、安全な通信のしかた。URLが https で始まる。", "online.html#care"],
  ];
  let kind = "all";
  function renderGloss() {
    const q = $("#glossSearch").value.trim().toLowerCase();
    const hits = WORDS.filter(([w, k, d]) => (kind === "all" || k === kind) && (!q || (w + d).toLowerCase().includes(q)));
    $("#glossary").innerHTML = hits.map(([w, k, d, href]) =>
      `<div class="term"><span class="kind">${k}</span><b>${esc(w)}</b><p>${esc(d)}</p><a href="${href}">説明しているところへ →</a></div>`).join("");
    $("#glossEmpty").hidden = hits.length > 0;
  }
  segmented($("#glossFilter"), (b) => { kind = b.dataset.kind; renderGloss(); });
  $("#glossSearch").addEventListener("input", renderGloss);
  renderGloss();
})();
