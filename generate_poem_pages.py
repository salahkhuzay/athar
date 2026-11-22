#!/usr/bin/env python3
"""Generate crawler-visible, shareable HTML pages for every poem."""
from __future__ import annotations

import html
import json
import re
import shutil
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "poems.json"
OUT_DIR = ROOT / "poems"
BASE_URL = "https://athar-poetry.com"


def slug_for(poem: dict) -> str:
    raw = str(poem.get("id") or poem.get("title") or "poem").strip()
    slug = re.sub(r"[^\w\-\u0600-\u06ff]+", "-", raw, flags=re.UNICODE).strip("-")
    return slug or "poem"


def page_url(slug: str) -> str:
    return f"{BASE_URL}/poems/{quote(slug, safe='')}/"


AR_MONTHS = ["كانون الثاني","شباط","آذار","نيسان","أيار","حزيران","تموز","آب","أيلول","تشرين الأول","تشرين الثاني","كانون الأول"]


def fmt_date(poem: dict) -> str:
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", str(poem.get("date") or ""))
    if not m:
        return str(poem.get("year") or "")
    return f"{int(m.group(3))} {AR_MONTHS[int(m.group(2)) - 1]} {m.group(1)}"


def verse_count(n: int) -> str:
    if n == 1: return "بيتٌ واحد"
    if n == 2: return "بيتان"
    if 3 <= n <= 10: return f"{n} أبيات"
    return f"{n} بيتاً"


def asset_version() -> str:
    m = re.search(r"app\.js\?v=(\d+)", (ROOT / "index.html").read_text(encoding="utf-8"))
    return m.group(1) if m else "1"


REDIRECTS = {"qasida-mu1qotlr": "الخذراف"}


def redirect_page(slug: str) -> str:
    url = page_url(slug)
    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url={esc(url)}">
<link rel="canonical" href="{esc(url)}"><meta name="robots" content="noindex">
<title>انتقلت القصيدة</title></head>
<body><p>انتقلت هذه الصفحة إلى <a href="{esc(url)}">{esc(url)}</a></p></body></html>
"""


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def jsonld(poem: dict, url: str, poet: str) -> str:
    published = poem.get("date") or poem.get("year") or None
    payload = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": poem.get("title", ""),
        "headline": poem.get("title", ""),
        "description": poem.get("excerpt") or poem.get("mood") or "قصيدة من ديوان أثر.",
        "url": url,
        "inLanguage": "ar",
        "author": {"@type": "Person", "name": poet},
        "isPartOf": {"@type": "Book", "name": "أثر — ديوان الشعر"},
    }
    if published:
        payload["datePublished"] = str(published)
    return json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")


def render(poem: dict, site: dict, slug: str, labels: dict | None = None) -> str:
    cat = (labels or {}).get(poem.get("category"), poem.get("category"))
    title = poem.get("title") or "قصيدة بلا عنوان"
    poet = site.get("poet") or "صلاح الدين الخزاعي"
    description = poem.get("excerpt") or poem.get("mood") or f"قصيدة «{title}» من ديوان أثر."
    url = page_url(slug)
    ver = asset_version()
    verses = poem.get("verses") or []
    audio = poem.get("audio") or ""
    audio_block = f'<audio class="poem-page__audio" controls preload="none" src="../../{esc(audio)}" aria-label="استمع بصوت الشاعر"></audio>' if audio else ""
    verse_html = "\n".join(
        "        <div class=\"poem-page__verse\">\n"
        f"          <p>{esc(v.get('sadr'))}</p>"
        + (f"          <span aria-hidden=\"true\">◆</span>\n          <p>{esc(v.get('ajoz'))}</p>" if v.get("ajoz") else "")
        + "\n        </div>"
        for v in verses
    )
    meta = " · ".join(str(x) for x in [cat, fmt_date(poem), verse_count(len(verses))] if x)
    tags = " ".join(f"<li>{esc(tag)}</li>" for tag in poem.get("tags") or [])
    tags_block = f"\n      <ul class=\"poem-page__tags\">{tags}</ul>" if tags else ""
    return f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)} — ديوان أثر | {esc(poet)}</title>
  <meta name="description" content="{esc(description)}">
  <meta name="author" content="{esc(poet)}">
  <link rel="canonical" href="{esc(url)}">
  <link rel="icon" type="image/x-icon" href="../../favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@600;700;800&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../assets/css/style.css?v={ver}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="أَثَر">
  <meta property="og:title" content="{esc(title)} — ديوان أثر">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{esc(url)}">
  <meta property="og:image" content="{BASE_URL}/assets/img/og-athar.png">
  <meta property="og:locale" content="ar_AR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)} — ديوان أثر">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="{BASE_URL}/assets/img/og-athar.png">
  <script type="application/ld+json">{jsonld(poem, url, poet)}</script>
</head>
<body class="poem-page">
  <main class="poem-page__main">
    <div class="wrap">
      <nav class="poem-page__nav" aria-label="مسار الصفحة">
        <a href="../../">أثر</a>
        <span aria-hidden="true">/</span>
        <a href="../../#poems">كل القصائد</a>
      </nav>
      <article class="poem-page__article">
        <header class="poem-page__head">
          <p class="kicker">{esc(cat or 'قصيدة')}</p>
          <h1>{esc(title)}</h1>
          <p class="poem-page__meta">{esc(meta)}</p>
          {f'<p class="poem-page__mood">{esc(poem.get("mood"))}</p>' if poem.get('mood') else ''}
          {f'<p class="poem-page__excerpt">{esc(description)}</p>' if description else ''}
          {tags_block}
        </header>
        <div class="poem-page__verses" aria-label="نص القصيدة">
{verse_html}
        </div>
        {audio_block}
        <footer class="poem-page__foot">
          <p>من ديوان <a href="../../">أثر</a> — {esc(poet)}</p>
          <div class="poem-page__actions">
            <button class="btn btn--line btn--sm" type="button" id="shareBtn" data-title="{esc(title)}" data-url="{esc(url)}">مشاركة</button>
            <a class="btn btn--line btn--sm" href="../../#poems">العودة إلى القصائد</a>
          </div>
        </footer>
      </article>
    </div>
  </main>
  <script>
  (function(){{
    var b=document.getElementById('shareBtn'); if(!b) return;
    b.addEventListener('click', async function(){{
      var t=b.getAttribute('data-title'), u=b.getAttribute('data-url');
      try {{
        if (navigator.share) {{ await navigator.share({{ title: t + ' — {esc(poet)}', text: t + ' — ديوان أثر', url: u }}); return; }}
        await navigator.clipboard.writeText(u);
        var old=b.textContent; b.textContent='نُسخ الرابط'; setTimeout(function(){{ b.textContent=old; }}, 1800);
      }} catch(e) {{}}
    }});
  }})();
  </script>
</body>
</html>
'''


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    site = data.get("site") or {}
    labels = {c.get("id"): c.get("label") or c.get("id") for c in data.get("categories") or []}
    poems = data.get("poems") or []
    if not poems:
        raise SystemExit("No poems found")

    OUT_DIR.mkdir(exist_ok=True)
    expected: set[str] = set()
    for poem in poems:
        slug = slug_for(poem)
        if slug in expected:
            raise SystemExit(f"Duplicate generated slug: {slug}")
        expected.add(slug)
        target = OUT_DIR / slug
        target.mkdir(parents=True, exist_ok=True)
        (target / "index.html").write_text(render(poem, site, slug, labels), encoding="utf-8")

    for old, new in REDIRECTS.items():
        if new in expected and old not in expected:
            (OUT_DIR / old).mkdir(parents=True, exist_ok=True)
            (OUT_DIR / old / "index.html").write_text(redirect_page(new), encoding="utf-8")
            expected.add(old)

    for child in OUT_DIR.iterdir():
        if child.is_dir() and child.name not in expected:
            shutil.rmtree(child)

    today = date.today().isoformat()
    urls = [f"  <url>\n    <loc>{BASE_URL}/</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>"]
    for slug in sorted(expected - set(REDIRECTS)):
        urls.append(f"  <url>\n    <loc>{page_url(slug)}</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>")
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n'
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")

    print(f"Generated {len(poems)} poem pages and sitemap.xml")


if __name__ == "__main__":
    main()
