/* =========================================================
   أَثَر — لوحة التحكم المدمجة
   إدارة القصائد والإعدادات والنسخ الاحتياطي من داخل الموقع.
   الحفظ: localStorage (معاينة فورية) + تنزيل poems.json للنشر.
   ========================================================= */
(function () {
  'use strict';
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const PASS_KEY = 'athar-admin-pass';
  const DEFAULT_PASS = 'athar2026';
  const getPass = () => localStorage.getItem(PASS_KEY) || DEFAULT_PASS;

  let draft = null;          /* نسخة عمل تُحرَّر ثم تُحفظ */
  let dirty = false;
  let tab = 'poems';
  let editingId = null;      /* معرّف القصيدة المفتوحة في نموذج التحرير */
  let unlocked = sessionStorage.getItem('athar-admin-unlocked') === '1';

  const root = $('#adminRoot');

  /* ---------- الهيكل العام ---------- */
  root.innerHTML =
  '<div class="admin" id="adminPanel" hidden>' +
    '<div class="admin__panel" role="dialog" aria-modal="true" aria-labelledby="adminTitle">' +
      '<header class="admin__head">' +
        '<div><h3 id="adminTitle">لوحة التحكم</h3><p class="admin__sub" id="adminState"></p></div>' +
        '<div class="admin__headbtns">' +
          '<button class="btn btn--gold btn--sm" id="adminSave" type="button">حفظ التغييرات</button>' +
          '<button class="btn btn--line btn--sm" id="adminRevert" type="button">تراجع</button>' +
          '<button class="icon-btn" id="adminClose" type="button" aria-label="إغلاق اللوحة"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div>' +
      '</header>' +
      '<nav class="admin__tabs" role="tablist">' +
        '<button class="admin__tab is-active" data-tab="poems" role="tab" aria-selected="true">القصائد</button>' +
        '<button class="admin__tab" data-tab="site" role="tab" aria-selected="false">الواجهة والإعدادات</button>' +
        '<button class="admin__tab" data-tab="backup" role="tab" aria-selected="false">النسخ والنشر</button>' +
      '</nav>' +
      '<div class="admin__body" id="adminBody"></div>' +
    '</div>' +
  '</div>' +
  '<div class="admin-gate" id="adminGate" hidden>' +
    '<form class="admin-gate__box" id="gateForm">' +
      '<p class="admin-gate__logo">أَثَر</p>' +
      '<p class="admin-gate__hint">أدخل رمز الدخول لفتح لوحة التحكم<br>(الافتراضي: <code>athar2026</code>)</p>' +
      '<input class="admin-gate__input" id="gatePass" type="password" inputmode="numeric" autocomplete="current-password" placeholder="رمز الدخول" dir="ltr">' +
      '<p class="admin-gate__err" id="gateErr" hidden>رمز غير صحيح</p>' +
      '<button class="btn btn--gold" type="submit">دخول</button>' +
    '</form>' +
  '</div>';

  const panel = $('#adminPanel'), gate = $('#adminGate'), body = $('#adminBody');

  /* ---------- فتح/إغلاق ---------- */
  function openAdmin() {
    draft = clone(window.Athar.getJSON());
    dirty = false; editingId = null;
    if (!unlocked) { gate.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#gatePass').focus(), 60); return; }
    showPanel();
  }
  function showPanel() {
    gate.hidden = true;
    panel.hidden = false;
    document.body.style.overflow = 'hidden';
    renderTab();
  }
  function closeAdmin() {
    panel.hidden = true; gate.hidden = true;
    document.body.style.overflow = '';
  }
  function setDirty(v) { dirty = v; paintState(); }
  function paintState() {
    $('#adminState').textContent = dirty
      ? 'تغييرات غير محفوظة — احفظها لتظهر في الموقع ومتصفحك'
      : (window.Athar.hasOverride() ? 'محفوظ في متصفحك — صدّر الملف لنشره' : 'متزامن مع ملف data/poems.json');
    $('#adminSave').disabled = !dirty;
  }

  $('#openAdmin').addEventListener('click', openAdmin);
  $('#adminClose').addEventListener('click', () => {
    if (dirty && !confirm('لديك تغييرات غير محفوظة. إغلاق دون حفظ؟')) return;
    closeAdmin();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!gate.hidden) { gate.hidden = true; document.body.style.overflow = ''; return; }
      if (!panel.hidden && (!dirty || confirm('إغلاق دون حفظ؟'))) closeAdmin();
    }
  });
  gate.addEventListener('click', (e) => { if (e.target === gate) { gate.hidden = true; document.body.style.overflow = ''; } });
  if (location.hash === '#admin') setTimeout(openAdmin, 300);

  $('#gateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#gatePass').value === getPass()) {
      unlocked = true; sessionStorage.setItem('athar-admin-unlocked', '1');
      $('#gateErr').hidden = true; showPanel();
    } else { $('#gateErr').hidden = false; }
  });

  /* ---------- التبويبات ---------- */
  $$('.admin__tab').forEach((t) => t.addEventListener('click', () => {
    if (dirty && !confirm('تبديل التبويب سيلغي تغييرات غير محفوظة. متابعة؟')) return;
    draft = clone(window.Athar.getJSON()); dirty = false; editingId = null;
    tab = t.getAttribute('data-tab');
    $$('.admin__tab').forEach((x) => { const on = x === t; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', String(on)); });
    renderTab();
  }));

  function renderTab() {
    paintState();
    if (tab === 'poems') renderPoemsTab();
    else if (tab === 'site') renderSiteTab();
    else renderBackupTab();
  }

  /* ---------- حفظ/تراجع ---------- */
  $('#adminSave').addEventListener('click', () => {
    if (!draft) return;
    if (!Array.isArray(draft.poems)) { alert('بنية غير صالحة: poems ليست مصفوفة'); return; }
    window.Athar.commit(clone(draft));
    setDirty(false);
    window.Athar.toast('حُفظت التغييرات في متصفحك ✓');
    renderTab();
  });
  $('#adminRevert').addEventListener('click', () => {
    draft = clone(window.Athar.getJSON()); dirty = false; editingId = null; renderTab();
    window.Athar.toast('أُلغيت التغييرات غير المحفوظة');
  });

  /* =========================================================
     تبويب القصائد
     ========================================================= */
  function renderPoemsTab() {
    if (editingId !== null) return renderPoemForm(editingId);
    const poems = draft.poems || [];
    body.innerHTML =
      '<div class="admin__toolbar">' +
        '<p class="admin__hint">رتّب، عدّل، أو أضف قصائدك. التعديل يظهر في الموقع بعد «حفظ التغييرات».</p>' +
        '<button class="btn btn--gold btn--sm" id="poemAdd" type="button">+ قصيدة جديدة</button>' +
      '</div>' +
      '<div class="admin-list">' +
        poems.map((p, i) =>
          '<div class="admin-row">' +
            '<span class="admin-row__idx">' + (i + 1) + '</span>' +
            '<div class="admin-row__main">' +
              '<b>' + esc(p.title) + '</b>' +
              '<span class="admin-row__meta">' + esc(p.category || '—') + ' · ' + (p.verses || []).length + ' بيتاً' + (p.featured ? ' · مختارة' : '') + '</span>' +
            '</div>' +
            '<div class="admin-row__acts">' +
              '<button class="abtn" data-act="up" data-i="' + i + '" title="تقديم" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
              '<button class="abtn" data-act="down" data-i="' + i + '" title="تأخير" ' + (i === poems.length - 1 ? 'disabled' : '') + '>↓</button>' +
              '<button class="abtn" data-act="dup" data-i="' + i + '" title="تكرار">⧉</button>' +
              '<button class="abtn abtn--edit" data-act="edit" data-i="' + i + '">تعديل</button>' +
              '<button class="abtn abtn--danger" data-act="del" data-i="' + i + '">حذف</button>' +
            '</div>' +
          '</div>').join('') +
      '</div>';

    $('#poemAdd').addEventListener('click', () => { editingId = '__new__'; renderPoemForm(editingId); });

    body.addEventListener('click', onListClick);
  }

  function onListClick(e) {
    const btn = e.target.closest('.abtn'); if (!btn) return;
    const i = +btn.getAttribute('data-i');
    const act = btn.getAttribute('data-act');
    const poems = draft.poems;
    if (act === 'edit') { editingId = poems[i].id; renderPoemForm(editingId); }
    if (act === 'up' && i > 0) { [poems[i - 1], poems[i]] = [poems[i], poems[i - 1]]; setDirty(true); renderPoemsTab(); }
    if (act === 'down' && i < poems.length - 1) { [poems[i + 1], poems[i]] = [poems[i], poems[i + 1]]; setDirty(true); renderPoemsTab(); }
    if (act === 'dup') {
      const c = clone(poems[i]);
      c.id = c.id + '-copy-' + Date.now().toString(36);
      c.title = c.title + ' (نسخة)';
      c.featured = false;
      poems.splice(i + 1, 0, c); setDirty(true); renderPoemsTab();
    }
    if (act === 'del') {
      if (confirm('حذف قصيدة «' + poems[i].title + '» نهائياً من المسودة؟')) { poems.splice(i, 1); setDirty(true); renderPoemsTab(); }
    }
  }

  /* ---------- نموذج قصيدة ---------- */
  function renderPoemForm(id) {
    body.removeEventListener('click', onListClick);
    let p;
    if (id === '__new__') {
      p = { id: 'qasida-' + Date.now().toString(36), title: '', category: (draft.categories || [])[0] ? draft.categories[0].id : '', year: String(new Date().getFullYear()), mood: '', excerpt: '', accent: 'olive', tags: [], featured: false, verses: [{ sadr: '', ajoz: '' }] };
      draft.poems.push(p);
      editingId = p.id;
    } else {
      p = draft.poems.find((x) => x.id === id);
      if (!p) { editingId = null; return renderPoemsTab(); }
    }

    const catOptions = (draft.categories || []).map((c) => '<option value="' + esc(c.id) + '">' + esc(c.label || c.id) + '</option>').join('');

    body.innerHTML =
      '<div class="admin__toolbar">' +
        '<button class="btn btn--line btn--sm" id="poemBack" type="button">→ قائمة القصائد</button>' +
        '<span class="admin__hint">تحرير: ' + esc(p.title || 'قصيدة جديدة') + '</span>' +
      '</div>' +
      '<div class="form-grid">' +
        field('العنوان', '<input class="fin" data-f="title" value="' + esc(p.title) + '" placeholder="عنوان القصيدة">') +
        field('المعرّف (رابط)', '<input class="fin" data-f="id" value="' + esc(p.id) + '" dir="ltr">') +
        field('الباب', '<div class="fin-row"><select class="fin" data-f="category">' + catOptions + '</select>' +
          '<input class="fin" data-f="__newcat" placeholder="أو باب جديد…"></div>') +
        field('السنة', '<input class="fin" data-f="year" value="' + esc(p.year || '') + '" dir="ltr">') +
        field('الجو (mood)', '<input class="fin" data-f="mood" value="' + esc(p.mood || '') + '" placeholder="جملة تصف جو القصيدة">') +
        field('اللون (accent)', '<select class="fin" data-f="accent">' +
          ['terracotta', 'olive', 'indigo'].map((a) => '<option value="' + a + '"' + (p.accent === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>') +
        field('المقتطف', '<textarea class="fin fin--ta" data-f="excerpt" rows="2" placeholder="سطر تعريفي يظهر في البطاقة">' + esc(p.excerpt || '') + '</textarea>') +
        field('وسوم (بفاصلة)', '<input class="fin" data-f="tags" value="' + esc((p.tags || []).join('، ')) + '" placeholder="شوق، ليل…">') +
        field('مختارة؟', '<label class="check"><input type="checkbox" data-f="featured"' + (p.featured ? ' checked' : '') + '> تظهر في «قصيدة مختارة»</label>') +
      '</div>' +
      '<h4 class="form-sec">الأبيات (صدر وعجز)</h4>' +
      '<div id="versesBox">' + p.verses.map((v, i) => verseRow(v, i)).join('') + '</div>' +
      '<div class="admin__toolbar"><button class="btn btn--line btn--sm" id="verseAdd" type="button">+ بيت جديد</button></div>';

    /* ربط الحقول */
    body.querySelectorAll('[data-f]').forEach((el) => {
      el.addEventListener('input', () => {
        const f = el.getAttribute('data-f');
        if (f === 'tags') p.tags = el.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean);
        else if (f === 'featured') p.featured = el.checked;
        else if (f === '__newcat') {
          const v = el.value.trim();
          if (v) {
            p.category = v;
            if (!(draft.categories || []).some((c) => c.id === v)) draft.categories.push({ id: v, label: v, description: '' });
          }
        }
        else if (f === 'id') {
          const old = p.id; p.id = el.value.trim() || p.id;
          if (old !== p.id) editingId = p.id;
        }
        else p[f] = el.value;
        setDirty(true);
      });
    });

    /* ربط الأبيات */
    const vbox = $('#versesBox');
    vbox.querySelectorAll('[data-v]').forEach((el) => {
      el.addEventListener('input', () => {
        const [i, k] = el.getAttribute('data-v').split('.');
        p.verses[+i][k] = el.value; setDirty(true);
      });
    });
    vbox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-va]'); if (!b) return;
      const i = +b.getAttribute('data-i');
      const act = b.getAttribute('data-va');
      if (act === 'del') { p.verses.splice(i, 1); if (!p.verses.length) p.verses.push({ sadr: '', ajoz: '' }); }
      if (act === 'up' && i > 0) [p.verses[i - 1], p.verses[i]] = [p.verses[i], p.verses[i - 1]];
      if (act === 'down' && i < p.verses.length - 1) [p.verses[i + 1], p.verses[i]] = [p.verses[i], p.verses[i + 1]];
      setDirty(true); renderPoemForm(p.id);
    });
    $('#verseAdd').addEventListener('click', () => { p.verses.push({ sadr: '', ajoz: '' }); setDirty(true); renderPoemForm(p.id); });
    $('#poemBack').addEventListener('click', () => {
      /* تخلَّ عن القصائد الجديدة الفارغة */
      draft.poems = draft.poems.filter((x) => x.title || (x.verses || []).some((v) => v.sadr || v.ajoz));
      editingId = null; renderPoemsTab();
    });
  }

  const field = (label, inner) => '<label class="field"><span class="field__label">' + label + '</span>' + inner + '</label>';
  const verseRow = (v, i) =>
    '<div class="verse-row">' +
      '<span class="verse-row__n">' + (i + 1) + '</span>' +
      '<input class="fin" data-v="' + i + '.sadr" value="' + esc(v.sadr) + '" placeholder="الصدر">' +
      '<input class="fin" data-v="' + i + '.ajoz" value="' + esc(v.ajoz) + '" placeholder="العجز">' +
      '<span class="verse-row__acts">' +
        '<button class="abtn" data-va="up" data-i="' + i + '" title="تقديم">↑</button>' +
        '<button class="abtn" data-va="down" data-i="' + i + '" title="تأخير">↓</button>' +
        '<button class="abtn abtn--danger" data-va="del" data-i="' + i + '" title="حذف البيت">✕</button>' +
      '</span>' +
    '</div>';

  /* =========================================================
     تبويب الإعدادات
     ========================================================= */
  function renderSiteTab() {
    const s = draft.site = draft.site || {};
    s.heroQuote = s.heroQuote || { sadr: '', ajoz: '' };
    s.contact = s.contact || {};
    const poemsOpts = (draft.poems || []).map((p) => '<option value="' + esc(p.id) + '"' + (s.featuredId === p.id ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('');
    body.innerHTML =
      '<div class="form-grid">' +
        field('اسم الشاعر', '<input class="fin" data-s="poet" value="' + esc(s.poet || '') + '">') +
        field('صورة الواجهة (مسار)', '<input class="fin" data-s="heroImage" value="' + esc(s.heroImage || '') + '" dir="ltr" placeholder="assets/img/hero-night.jpg">') +
        field('بيت الواجهة — الصدر', '<input class="fin" data-s="heroQuote.sadr" value="' + esc(s.heroQuote.sadr || '') + '">') +
        field('بيت الواجهة — العجز', '<input class="fin" data-s="heroQuote.ajoz" value="' + esc(s.heroQuote.ajoz || '') + '">') +
        field('القصيدة المختارة', '<select class="fin" data-s="featuredId">' + poemsOpts + '</select>') +
        field('عنوان قسم «عن الشاعر»', '<input class="fin" data-s="aboutHeading" value="' + esc(s.aboutHeading || '') + '">') +
        field('عبارات الشريط المتحرك (سطر لكل عبارة)', '<textarea class="fin fin--ta" data-s="marquee" rows="4">' + esc((s.marquee || []).join('\n')) + '</textarea>') +
        field('السيرة (فقرة لكل سطر)', '<textarea class="fin fin--ta" data-s="bio" rows="4">' + esc((s.bio || []).join('\n')) + '</textarea>') +
        field('نقاط السيرة (سطر لكل نقطة)', '<textarea class="fin fin--ta" data-s="aboutBullets" rows="3">' + esc((s.aboutBullets || []).join('\n')) + '</textarea>') +
        field('البريد الإلكتروني', '<input class="fin" data-s="contact.email" value="' + esc(s.contact.email || '') + '" dir="ltr">') +
        field('واتساب (أرقام فقط)', '<input class="fin" data-s="contact.whatsapp" value="' + esc(s.contact.whatsapp || '') + '" dir="ltr">') +
        field('فيسبوك', '<input class="fin" data-s="contact.facebook" value="' + esc(s.contact.facebook || '') + '" dir="ltr">') +
        field('إنستغرام', '<input class="fin" data-s="contact.instagram" value="' + esc(s.contact.instagram || '') + '" dir="ltr">') +
        field('إكس', '<input class="fin" data-s="contact.x" value="' + esc(s.contact.x || '') + '" dir="ltr">') +
        field('يوتيوب', '<input class="fin" data-s="contact.youtube" value="' + esc(s.contact.youtube || '') + '" dir="ltr">') +
      '</div>';
    body.querySelectorAll('[data-s]').forEach((el) => {
      el.addEventListener('input', () => {
        const path = el.getAttribute('data-s').split('.');
        let obj = s;
        for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] = obj[path[i]] || {};
        let v = el.value;
        if (path[0] === 'marquee' || path[0] === 'aboutBullets') v = v.split('\n').map((x) => x.trim()).filter(Boolean);
        if (path[0] === 'bio') v = v.split('\n').map((x) => x.trim()).filter(Boolean);
        obj[path[path.length - 1]] = v;
        setDirty(true);
      });
    });
  }

  /* =========================================================
     تبويب النسخ والنشر
     ========================================================= */
  function renderBackupTab() {
    body.innerHTML =
      '<div class="backup">' +
        '<div class="backup__card">' +
          '<h4>تنزيل poems.json</h4>' +
          '<p>حمّل النسخة الحالية (مع تعديلاتك المحفوظة) وضعها فوق <code>data/poems.json</code> في مشروعك، ثم ارفعها لمنصتك (Netlify Drop / GitHub / Vercel).</p>' +
          '<button class="btn btn--gold btn--sm" id="bkExport" type="button">تنزيل الملف</button>' +
        '</div>' +
        '<div class="backup__card">' +
          '<h4>استيراد ملف</h4>' +
          '<p>استورد ملف <code>poems.json</code> من جهازك ليصبح بيانات الموقع (يُنسخ داخل المسودة ثم احفظ).</p>' +
          '<input class="fin" id="bkImport" type="file" accept=".json,application/json">' +
        '</div>' +
        '<div class="backup__card">' +
          '<h4>استعادة الملف المنشور</h4>' +
          '<p>احذف نسخة متصفحك المحلية وعد إلى محتوى <code>data/poems.json</code> الأصلي.</p>' +
          '<button class="btn btn--line btn--sm" id="bkReset" type="button">استعادة</button>' +
        '</div>' +
        '<div class="backup__card">' +
          '<h4>تغيير رمز الدخول</h4>' +
          '<p>الرمز الحالي: <code>' + esc(getPass()) + '</code> — غيّره إلى رمز خاص بك (يُحفظ في متصفحك فقط).</p>' +
          '<div class="fin-row"><input class="fin" id="bkPass1" type="text" placeholder="رمز جديد" dir="ltr"><input class="fin" id="bkPass2" type="text" placeholder="تأكيد الرمز" dir="ltr"></div>' +
          '<button class="btn btn--line btn--sm" id="bkPassSave" type="button">تغيير الرمز</button>' +
        '</div>' +
        '<div class="backup__card backup__card--warn">' +
          '<h4>مهمّ عن النشر</h4>' +
          '<p>الموقع ثابت بلا خادم: حفظك هنا يُخزَّن في <b>متصفحك</b> للعرض والفحص الفوري. ليراه الجميع، نزّل <code>poems.json</code> وارفعه مع المشروع. هكذا تبقى لوحة التحكم أداة تحرير آمنة بلا قاعدة بيانات.</p>' +
        '</div>' +
      '</div>';

    $('#bkExport').addEventListener('click', () => {
      const json = dirty ? draft : window.Athar.getJSON();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'poems.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      window.Athar.toast('نُزّل poems.json');
    });

    $('#bkImport').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const json = JSON.parse(r.result);
          if (!json || !Array.isArray(json.poems)) throw new Error('poems ليست مصفوفة');
          draft = json; setDirty(true);
          window.Athar.toast('استُورد الملف — اضغط حفظ التغييرات');
          renderTab();
        } catch (err) { alert('ملف غير صالح: ' + err.message); }
      };
      r.readAsText(f);
    });

    $('#bkReset').addEventListener('click', async () => {
      if (!confirm('سيُحذف حفظك المحلي وتعود البيانات المنشورة. متابعة؟')) return;
      const ok = await window.Athar.clearOverride();
      draft = clone(window.Athar.getJSON()); dirty = false;
      renderTab();
      window.Athar.toast(ok ? 'استُعيدت البيانات المنشورة' : 'تعذّر الوصول للملف الأصلي');
    });

    $('#bkPassSave').addEventListener('click', () => {
      const p1 = $('#bkPass1').value.trim(), p2 = $('#bkPass2').value.trim();
      if (!p1 || p1.length < 4) { alert('الرمز يجب ألا يقل عن 4 أحرف'); return; }
      if (p1 !== p2) { alert('التأكيد غير مطابق'); return; }
      localStorage.setItem(PASS_KEY, p1);
      window.Athar.toast('تم تغيير رمز الدخول');
      renderBackupTab();
    });
  }
})();
