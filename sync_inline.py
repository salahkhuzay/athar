#!/usr/bin/env python3
"""
مزامنة النسخة المضمّنة الاحتياطية داخل index.html مع data/poems.json.

لماذا؟ عند فتح index.html مباشرة (file://) أو في معاينات معزولة بلا شبكة،
يمنع المتصفح جلب data/poems.json، فيعرض الموقع هذه النسخة المضمّنة بدل رسالة خطأ.
عند النشر عبر أي خادم/منصة، يُقرأ data/poems.json أولاً وتُتجاهل النسخة المضمّنة.

الاستخدام:  python3 sync_inline.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data" / "poems.json"
HTML = ROOT / "index.html"

TAG_RE = re.compile(
    r'(<script type="application/json" id="fallbackData">)(.*?)(</script>)',
    re.S,
)


def main() -> int:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # حماية من إغلاق الوسم داخل النص
    payload = payload.replace("</", "<\\/")

    html = HTML.read_text(encoding="utf-8")
    if not TAG_RE.search(html):
        print("لم يُعثر على وسم fallbackData في index.html", file=sys.stderr)
        return 1

    html = TAG_RE.sub(lambda m: m.group(1) + payload + m.group(3), html, count=1)
    HTML.write_text(html, encoding="utf-8")

    n_poems = len(data.get("poems", []))
    n_verses = sum(len(p.get("verses", [])) for p in data.get("poems", []))
    print(f"تمت المزامنة: {n_poems} قصيدة / {n_verses} بيت → النسخة المضمّنة في index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
