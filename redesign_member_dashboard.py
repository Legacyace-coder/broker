
from pathlib import Path

ROOT = Path.cwd()
JS_PATH = ROOT / "frontend" / "assets" / "js" / "app.js"
CSS_PATH = ROOT / "frontend" / "assets" / "css" / "style.css"

if not JS_PATH.exists() or not CSS_PATH.exists():
    raise SystemExit(
        "Run this script from your broker project root. "
        "Expected frontend/assets/js/app.js and "
        "frontend/assets/css/style.css."
    )

js = JS_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")

old = """app.innerHTML=`<section class="section"><div class="container"><p class="eyebrow">${admin?'ADMINISTRATION':'MEMBER AREA'}</p><h1>${title}</h1><div class="dashboard-layout">"""

new = """app.innerHTML=`<section class="section ${page==='dashboard'?'member-dashboard-shell':admin?'admin-dashboard-shell':'member-page-shell'}"><div class="container"><p class="eyebrow">${admin?'ADMINISTRATION':'MEMBER AREA'}</p><h1>${title}</h1><div class="dashboard-layout">"""

if "member-dashboard-shell" in js and "member dashboard refresh" in css:
    raise SystemExit("Redesign already appears to be applied.")

if old not in js:
    raise SystemExit(
        "Could not locate the expected dashboard wrapper. "
        "No files were changed. Check your current app.js version."
    )

css_add = r"""
/* Northstar Capital member dashboard refresh */
.member-dashboard-shell {
  --member-ink: #1b2942;
  --member-muted: #7b8496;
  --member-line: #e7eaf1;
  background: #f5f6fa;
  color: var(--member-ink);
  min-height: calc(100vh - 82px);
  padding: 36px 0 64px;
}

.member-dashboard-shell > .container {
  width: min(calc(100% - 44px), 1500px);
}

.member-dashboard-shell > .container > .eyebrow {
  color: #bd7b00;
  margin-bottom: 6px;
}

.member-dashboard-shell > .container > h1 {
  font-size: clamp(1.8rem, 3vw, 2.45rem);
  letter-spacing: -.04em;
  margin: 0 0 25px;
  color: var(--member-ink);
}

.member-dashboard-shell .dashboard-layout {
  grid-template-columns: 218px minmax(0, 1fr);
  gap: 22px;
}

.member-dashboard-shell .sidebar {
  position: sticky;
  top: 102px;
  gap: 6px;
  padding: 14px;
  background: #fff;
  border: 1px solid var(--member-line);
  border-radius: 18px;
  box-shadow: 0 8px 26px rgba(28, 42, 72, .045);
}

.member-dashboard-shell .sidebar a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  border-radius: 10px;
  color: #727c90;
  font-weight: 600;
  transition: background .2s, color .2s;
}

.member-dashboard-shell .sidebar a:hover,
.member-dashboard-shell .sidebar a.active {
  background: #fff4db;
  color: #a66b00;
}

.member-dashboard-shell .dashboard-main {
  min-width: 0;
  color: var(--member-ink);
}

.member-dashboard-shell .dashboard-summary {
  gap: 18px;
}

.member-dashboard-shell .dashboard-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  background: #fff;
  border: 1px solid var(--member-line);
  border-radius: 18px;
  box-shadow: 0 8px 26px rgba(28, 42, 72, .035);
}

.member-dashboard-shell .dashboard-topbar .eyebrow,
.member-dashboard-shell .panel .eyebrow {
  color: #c1840a;
  font-size: .67rem;
  margin-bottom: 5px;
}

.member-dashboard-shell .dashboard-topbar h2 {
  font-size: 1.55rem;
  line-height: 1.25;
  letter-spacing: -.035em;
  margin: 0;
  color: var(--member-ink);
}

.member-dashboard-shell .chip {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  padding: 7px 11px;
  border: 1px solid #f4dca6;
  border-radius: 99px;
  background: #fff9eb;
  color: #9c6800;
  font-size: .75rem;
  font-weight: 700;
}

.member-dashboard-shell .ticker-strip {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.member-dashboard-shell .ticker-item {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 17px 18px;
  background: #fff;
  border: 1px solid var(--member-line);
  border-radius: 16px;
  box-shadow: 0 8px 26px rgba(28, 42, 72, .035);
}

.member-dashboard-shell .ticker-item span {
  color: var(--member-muted);
  font-size: .78rem;
  font-weight: 700;
}

.member-dashboard-shell .ticker-item strong {
  color: var(--member-ink);
  font: 800 1.25rem Manrope, sans-serif;
  letter-spacing: -.03em;
}

.member-dashboard-shell .ticker-item em {
  font-style: normal;
  font-size: .76rem;
  font-weight: 700;
  color: #16845e;
}

.member-dashboard-shell .stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.member-dashboard-shell .card.stat-card {
  padding: 19px 18px;
  background: #fff;
  border: 1px solid var(--member-line);
  border-radius: 16px;
  box-shadow: 0 8px 26px rgba(28, 42, 72, .035);
}

.member-dashboard-shell .stat-card p {
  margin: 0;
  color: var(--member-muted);
  font-size: .8rem;
}

.member-dashboard-shell .stat-card strong {
  color: var(--member-ink);
  font-size: clamp(1.15rem, 1.7vw, 1.65rem);
  letter-spacing: -.04em;
  overflow-wrap: anywhere;
}

.member-dashboard-shell .stat-card small {
  color: #8992a3;
  font-size: .73rem;
}

.member-dashboard-shell .dashboard-panels {
  grid-template-columns: minmax(0, 1.45fr) minmax(250px, .9fr);
  gap: 14px;
}

.member-dashboard-shell .panel {
  min-width: 0;
  padding: 20px;
  background: #fff;
  border: 1px solid var(--member-line);
  border-radius: 18px;
  box-shadow: 0 8px 26px rgba(28, 42, 72, .035);
}

.member-dashboard-shell .panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.member-dashboard-shell .panel-header h3 {
  font: 750 1.02rem Manrope, sans-serif;
  letter-spacing: -.02em;
  margin: 0;
  color: var(--member-ink);
}

.member-dashboard-shell .panel-header a {
  color: #a66b00;
  font-size: .82rem;
  font-weight: 700;
}

.member-dashboard-shell .positive-pill {
  white-space: nowrap;
  padding: 6px 9px;
  border-radius: 99px;
  background: #e8f8f0;
  color: #18815e;
  font-size: .72rem;
  font-weight: 800;
}

.member-dashboard-shell .canvas-panel .mini-chart {
  height: 190px;
  gap: clamp(5px, 1vw, 12px);
  padding: 24px 8px 0;
  border-bottom: 1px solid #eef0f5;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 45px,
    #edf0f5 46px,
    #edf0f5 47px
  );
}

.member-dashboard-shell .mini-bar {
  flex: 1;
  max-width: 34px;
  border-radius: 7px 7px 2px 2px;
  background: linear-gradient(180deg, #ffc247, #f5a400);
  box-shadow: 0 4px 9px #f5a40020;
}

.member-dashboard-shell .tier-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 17px;
  border-radius: 13px;
  background: #fff7e5;
  border: 1px solid #f6e2b5;
}

.member-dashboard-shell .tier-box strong {
  color: #8b5b00;
  font: 800 1.1rem Manrope, sans-serif;
}

.member-dashboard-shell .tier-box span {
  color: #987b48;
  font-size: .8rem;
}

.member-dashboard-shell .check-list {
  display: grid;
  gap: 10px;
  padding-left: 20px;
  color: #687388;
  font-size: .82rem;
}

.member-dashboard-shell .check-list li::marker,
.member-dashboard-shell .notice-list li::marker {
  color: #e5a000;
}

.member-dashboard-shell .activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.member-dashboard-shell .activity-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #eff1f5;
}

.member-dashboard-shell .activity-list li:last-child {
  border-bottom: 0;
}

.member-dashboard-shell .activity-list li > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.member-dashboard-shell .activity-list strong {
  color: var(--member-ink);
  font-size: .88rem;
}

.member-dashboard-shell .activity-list span,
.member-dashboard-shell .activity-list small {
  color: var(--member-muted);
  font-size: .75rem;
}

.member-dashboard-shell .activity-list small {
  text-align: right;
  overflow-wrap: anywhere;
}

.member-dashboard-shell .notice-list {
  padding-left: 18px;
  color: #687388;
  font-size: .83rem;
}

.member-dashboard-shell .notice-list li {
  padding: 5px 0;
}

.member-dashboard-shell .support-box p,
.member-dashboard-shell .chat-preview {
  color: #687388;
  font-size: .84rem;
}

.member-dashboard-shell .btn {
  border-radius: 10px;
}

.member-dashboard-shell .btn-primary {
  background: #f5a400;
  color: #fff;
  border-color: #f5a400;
}

.member-dashboard-shell .notice {
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid #f0dfb9;
  border-radius: 12px;
  background: #fff9eb;
  color: #80652d;
  font-size: .82rem;
}

@media (max-width: 1100px) {
  .member-dashboard-shell .dashboard-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 15px;
  }

  .member-dashboard-shell .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .member-dashboard-shell .ticker-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 850px) {
  .member-dashboard-shell {
    padding-top: 26px;
  }

  .member-dashboard-shell .dashboard-layout {
    grid-template-columns: 1fr;
  }

  .member-dashboard-shell .sidebar {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .member-dashboard-shell .dashboard-panels {
    grid-template-columns: 1fr;
  }

  .member-dashboard-shell .dashboard-topbar {
    padding: 18px;
  }
}

@media (max-width: 580px) {
  .member-dashboard-shell > .container {
    width: min(calc(100% - 26px), 1500px);
  }

  .member-dashboard-shell .sidebar {
    grid-template-columns: 1fr 1fr;
    padding: 9px;
  }

  .member-dashboard-shell .sidebar a {
    font-size: .78rem;
    padding: 10px;
  }

  .member-dashboard-shell .ticker-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .member-dashboard-shell .ticker-item {
    padding: 14px;
  }

  .member-dashboard-shell .ticker-item strong {
    font-size: 1.05rem;
  }

  .member-dashboard-shell .stat-grid {
    gap: 9px;
  }

  .member-dashboard-shell .card.stat-card {
    padding: 15px 13px;
  }

  .member-dashboard-shell .panel {
    padding: 16px;
  }

  .member-dashboard-shell .activity-list li {
    align-items: flex-start;
  }

  .member-dashboard-shell .activity-list small {
    max-width: 46%;
  }
}
"""

js = js.replace(old, new, 1)
css = css.rstrip() + "\n\n" + css_add.lstrip() + "\n"

JS_PATH.write_text(js, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")

print("Member dashboard redesign applied.")
print("Updated:")
print(" - frontend/assets/js/app.js")
print(" - frontend/assets/css/style.css")
print("Dashboard data fetching and transaction actions were left unchanged.")
