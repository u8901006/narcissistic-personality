import { readdirSync, writeFileSync } from "node:fs";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function getDateDisplay(filename) {
  const dateStr = filename.replace("npd-", "").replace(".html", "");
  const parts = dateStr.split("-");
  if (parts.length !== 3) return { display: dateStr, weekday: "" };
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const display = `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  const weekday = WEEKDAYS[d.getDay()];
  return { display, weekday };
}

const files = readdirSync("docs")
  .filter((f) => f.startsWith("npd-") && f.endsWith(".html"))
  .sort()
  .reverse()
  .slice(0, 30);

const links = files.map((f) => {
  const { display, weekday } = getDateDisplay(f);
  return `<li><a href="${f}">📅 ${display}（週${weekday}）</a></li>`;
}).join("\n");

const total = files.length;

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NPD Research Daily &middot; 自戀型人格疾患文獻日報</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  :root { --bg: #f6f1e8; --surface: #fffaf2; --line: #d8c5ab; --text: #2b2118; --muted: #766453; --accent: #8c4f2b; --accent-soft: #ead2bf; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: radial-gradient(circle at top, #fff6ea 0, var(--bg) 55%, #ead8c6 100%); color: var(--text); font-family: "Noto Sans TC", "PingFang TC", "Helvetica Neue", Arial, sans-serif; min-height: 100vh; }
  .container { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 80px 24px; }
  .logo { font-size: 48px; text-align: center; margin-bottom: 16px; }
  h1 { text-align: center; font-size: 24px; color: var(--text); margin-bottom: 8px; }
  .subtitle { text-align: center; color: var(--accent); font-size: 14px; margin-bottom: 48px; }
  .count { text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 32px; }
  ul { list-style: none; }
  li { margin-bottom: 8px; }
  a { color: var(--text); text-decoration: none; display: block; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: all 0.2s; font-size: 15px; }
  a:hover { background: var(--accent-soft); border-color: var(--accent); transform: translateX(4px); }
  .links-section { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .links-section a { display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-size: 14px; }
  footer { margin-top: 56px; text-align: center; font-size: 12px; color: var(--muted); }
  footer a { display: inline; padding: 0; background: none; border: none; color: var(--muted); }
  footer a:hover { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <div class="logo">🎭</div>
  <h1>NPD Research Daily</h1>
  <p class="subtitle">自戀型人格疾患文獻日報 &middot; 每日自動更新</p>
  <p class="count">共 ${total} 期日報</p>
  <ul>${links}</ul>
  <div class="links-section">
    <a href="https://www.leepsyclinic.com/" target="_blank" rel="noopener">🏥 李政洋身心診所首頁 →</a>
    <a href="https://blog.leepsyclinic.com/" target="_blank" rel="noopener">📬 訂閱電子報 →</a>
    <a href="https://buymeacoffee.com/CYlee" target="_blank" rel="noopener">☕ Buy Me a Coffee →</a>
  </div>
  <footer>
    <p>Powered by PubMed + Zhipu AI &middot; <a href="https://github.com/u8901006/narcissistic-personality">GitHub</a></p>
  </footer>
</div>
</body>
</html>`;

writeFileSync("docs/index.html", html, "utf8");
console.log("Index page generated");
