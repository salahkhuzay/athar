/* =========================================================
   أَثَر — لوحة التحكم (نسخة موسّعة أوضح وأسلس)
   القصائد · الواجهة · الحفظ والنشر · JSON للمتقدمين
   الحفظ: localStorage للمعاينة + تنزيل poems.json للنشر.
   ========================================================= */
(function () {
  'use strict';
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const PASS_KEY  = 'athar-admin-pass';
  const LOCK_KEY  = 'athar-admin-lock';
  const DRAFT_KEY = 'athar-admin-draft';
  const DEFAULT_PASS = 'athar2026';
  const getPass = () => localStorage.getItem(PASS_KEY) || DEFAULT_PASS;
  const lockEnabled = () => localStorage.getItem(LOCK_KEY) === '1';

  let draft = null, dirty = false, tab = 'poems', editingId = null, listFilter = '';
  let unlocked = sessionStorage.getItem('athar-admin-unlocked') === '1';

  const root = $('#adminRoot');
  root.innerHTML =
  '<div class="admin" id="adminPanel" hidden>' +
    '<div class="admin__panel" role="dialog" aria-modal="true" aria-labelledby="adminTitle">' +
      '<header class="admin__head">' +
        '<div class="admin__headtext"><h3 id="adminTitle">لوحة التحكم</h3><p class="admin__sub" id="adminState"></p></div>' +
        '<button class="icon-btn" id="adminClose" type="button" aria-label="إغلاق اللوحة"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</header>' +
      '<nav class="admin__tabs" role="tablist" aria-label="أقسام لوحة التحكم">' +
        '<button class="admin__tab is-active" data-tab="poems" role="tab" aria-selected="true"><span>القصائد</span><small>إضافة وترتيب وتحرير</small></button>' +
        '<button class="admin__tab" data-tab="site" role="tab" aria-selected="false"><span>الواجهة</span><small>البيت والسيرة والتواصل</small></button>' +
        '<button class="admin__tab" data-tab="backup" role="tab" aria-selected="false"><span>الحفظ والنشر</span><small>تنزيل واستيراد وقفل</small></button>' +
        '<button class="admin__tab" data-tab="json" role="tab" aria-selected="false"><span>JSON</span><small>للمتقدمين</small></button>' +
      '</nav>' +
      '<div class="admin__body" id="adminBody"></div>' +
      '<footer class="admin__foot">' +
        '<span class="admin-status" id="adminStatus"></span>' +
        '<button class="btn btn--line btn--sm" id="adminRevert" type="button">تراجع</button>' +
        '<button class="btn btn--gold btn--sm" id="adminSave" type="button">حفظ التغييرات</button>' +
      '</footer>' +
    '</div>' +
  '</div>' +
  '<div class="admin-gate" id="adminGate" hidden>' +
    '<form class="admin-gate__box" id="gateForm">' +
      '<p class="admin-gate__logo">أَثَر</p>' +
      '<p class="admin-gate__hint">أدخل رمز الدخول لفتح لوحة التحكم</p>' +
      '<input class="admin-gate__input" id="gatePass" type="password" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="current-password" placeholder="رمز الدخول (أحرف وأرقام)" dir="ltr">' +
      '<p class="admin-gate__err" id="gateErr" hidden>رمز غير صحيح</p>' +
      '<button class="btn btn--gold" type="submit">دخول</button>' +
    '</form>' +
  '</div>';

  const panel = $('#adminPanel'), gate = $('#adminGate'), body = $('#adminBody');

  /* ---------- فتح / إغلاق ---------- */
  function openAdmin() {
    if (window.Athar.entryMode && window.Athar.entryMode() !== 'user') { window.Athar.toast('ادخل من بوابة الصفحة الأولى بخيار «مستخدم» أولاً'); return; }
    const base = window.Athar.getJSON();
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) {
      if (stored !== JSON.stringify(base) && confirm('توجد مسودة تغييرات غير محفوظة من جلسة سابقة. استعادتها؟')) {
        try { draft = JSON.parse(stored); } catch (e) { draft = clone(base); }
      } else { draft = clone(base); localStorage.removeItem(DRAFT_KEY); }
    } else draft = clone(base);
    dirty = false; editingId = null; listFilter = '';
    showPanel();
  }
  function showPanel() { gate.hidden = true; panel.hidden = false; document.body.style.overflow = 'hidden'; renderTab(); }
  function closeAdmin() { panel.hidden = true; gate.hidden = true; document.body.style.overflow = ''; }
  function setDirty(v) {
    dirty = v;
    if (v) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    paintState();
  }
  function paintState() {
    const n = (draft && draft.poems) ? draft.poems.length : 0;
    $('#adminState').textContent = n + ' قصيدة في المسودة';
    $('#adminStatus').textContent = dirty
      ? '● تغييرات غير محفوظة — ستظهر في موقعك بعد الحفظ'
      : (window.Athar.hasOverride() ? 'محفوظ في متصفحك — صدّر الملف من تبويب «الحفظ والنشر» لنشره' : 'متزامن مع data/poems.json المنشور');
    $('#adminSave').disabled = !dirty;
    $('#adminRevert').disabled = !dirty;
  }

  $('#openAdmin').addEventListener('click', openAdmin);
  $('#adminClose').addEventListener('click', () => {
    if (dirty && !confirm('لديك تغييرات غير محفوظة (بقيت كمسودة). إغلاق اللوحة؟')) return;
    closeAdmin();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!gate.hidden) { gate.hidden = true; document.body.style.overflow = ''; return; }
      if (!panel.hidden && (!dirty || confirm('إغلاق مع إبقاء المسودة؟'))) closeAdmin();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !panel.hidden) {
      e.preventDefault(); if (dirty) $('#adminSave').click();
    }
  });
  gate.addEventListener('click', (e) => { if (e.target === gate) { gate.hidden = true; document.body.style.overflow = ''; } });
  $('#gateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#gatePass').value === getPass()) {
      unlocked = true; sessionStorage.setItem('athar-admin-unlocked', '1');
      $('#gateErr').hidden = true; showPanel();
    } else $('#gateErr').hidden = false;
  });
  if (location.hash === '#admin' && window.Athar.entryMode && window.Athar.entryMode() === 'user') setTimeout(openAdmin, 300);

  /* ---------- حفظ / تراجع ---------- */
  $('#adminSave').addEventListener('click', () => {
    if (!draft || !Array.isArray(draft.poems)) { window.Athar.toast('بنية غير صالحة'); return; }
    window.Athar.commit(clone(draft));
    localStorage.removeItem(DRAFT_KEY);
    setDirty(false);
    window.Athar.toast('حُفظت التغييرات وظهرت في الموقع ✓');
  });
  $('#adminRevert').addEventListener('click', () => {
    draft = clone(window.Athar.getJSON());
    localStorage.removeItem(DRAFT_KEY);
    dirty = false; editingId = null; renderTab();
    window.Athar.toast('أُلغيت التغييرات غير المحفوظة');
  });

  /* ---------- التبويبات ---------- */
  $$('.admin__tab').forEach((t) => t.addEventListener('click', () => {
    if (t.classList.contains('is-active')) return;
    tab = t.getAttribute('data-tab');
    editingId = null;
    $$('.admin__tab').forEach((x) => { const on = x === t; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', String(on)); });
    body.classList.remove('fade'); void body.offsetWidth; body.classList.add('fade');
    renderTab();
  }));
  function renderTab() {
    paintState();
    if (tab === 'poems') editingId === null ? renderPoemsTab() : renderPoemForm(editingId);
    else if (tab === 'site') renderSiteTab();
    else if (tab === 'json') renderJsonTab();
    else renderBackupTab();
  }

  /* =========================================================
     تبويب القصائد
     ========================================================= */
  function renderPoemsTab() {
    const poems = draft.poems || [];
    const q = listFilter.trim();
    const shown = q ? poems.filter((p) => (p.title + ' ' + (p.category || '')).includes(q)) : poems;
    body.innerHTML =
      '<div class="admin__toolbar">' +
        '<input class="fin admin-search" id="listSearch" type="search" placeholder="ابحث في قائمتك…" value="' + esc(listFilter) + '">' +
        '<button class="btn btn--gold btn--sm" id="poemAdd" type="button">+ قصيدة جديدة</button>' +
      '</div>' +
      '<p class="admin__hint">الترتيب هنا = ترتيب العرض في الديوان. استخدم ↑ ↓ لتغييره.</p>' +
      '<div class="admin-list">' +
        (shown.length ? shown.map((p) => {
          const i = poems.indexOf(p);
          return '<div class="admin-row">' +
            '<span class="admin-row__idx">' + (i + 1) + '</span>' +
            '<div class="admin-row__main"><b>' + esc(p.title || 'بلا عنوان') + '</b>' +
              '<span class="admin-row__meta">' + esc(p.category || 'بدون باب') + ' · ' + (p.verses || []).length + ' بيتاً' + (p.featured ? ' · مختارة' : '') + '</span></div>' +
            '<div class="admin-row__acts">' +
              '<button class="abtn" data-act="view" data-i="' + i + '" title="معاينة في القارئ">👁</button>' +
              '<button class="abtn" data-act="up" data-i="' + i + '" title="تقديم" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
              '<button class="abtn" data-act="down" data-i="' + i + '" title="تأخير" ' + (i === poems.length - 1 ? 'disabled' : '') + '>↓</button>' +
              '<button class="abtn" data-act="dup" data-i="' + i + '" title="تكرار">⧉</button>' +
              '<button class="abtn abtn--edit" data-act="edit" data-i="' + i + '">تعديل</button>' +
              '<button class="abtn abtn--danger" data-act="del" data-i="' + i + '" title="حذف">✕</button>' +
            '</div></div>';
        }).join('') : '<p class="admin__hint">لا نتائج مطابقة.</p>') +
      '</div>';

    $('#listSearch').addEventListener('input', (e) => { listFilter = e.target.value; renderPoemsTab(); const el = $('#listSearch'); el.focus(); el.selectionStart = el.selectionEnd = el.value.length; });
    $('#poemAdd').addEventListener('click', () => { editingId = '__new__'; renderPoemForm(editingId); });
    body.onclick = (e) => {
      const btn = e.target.closest('.abtn'); if (!btn) return;
      const i = +btn.getAttribute('data-i'), act = btn.getAttribute('data-act');
      if (act === 'edit') { editingId = poems[i].id; renderPoemForm(editingId); }
      if (act === 'view') window.Athar.previewPoem(clone(poems[i]));
      if (act === 'up' && i > 0) { [poems[i - 1], poems[i]] = [poems[i], poems[i - 1]]; setDirty(true); renderPoemsTab(); }
      if (act === 'down' && i < poems.length - 1) { [poems[i + 1], poems[i]] = [poems[i], poems[i + 1]]; setDirty(true); renderPoemsTab(); }
      if (act === 'dup') {
        const c = clone(poems[i]);
        c.id = c.id + '-copy-' + Date.now().toString(36); c.title += ' (نسخة)'; c.featured = false;
        poems.splice(i + 1, 0, c); setDirty(true); renderPoemsTab();
      }
      if (act === 'del' && confirm('حذف «' + poems[i].title + '» من المسودة؟')) { poems.splice(i, 1); setDirty(true); renderPoemsTab(); }
    };
  }

  /* ---------- نموذج قصيدة ---------- */
  function renderPoemForm(id) {
    let p;
    if (id === '__new__') {
      p = { id: 'qasida-' + Date.now().toString(36), title: '', category: (draft.categories || [])[0] ? draft.categories[0].id : '', year: String(new Date().getFullYear()), mood: '', excerpt: '', accent: 'olive', tags: [], featured: false, verses: [{ sadr: '', ajoz: '' }] };
      draft.poems.push(p); editingId = p.id; setDirty(true);
    } else {
      p = draft.poems.find((x) => x.id === id);
      if (!p) { editingId = null; return renderPoemsTab(); }
    }
    const catOptions = (draft.categories || []).map((c) => '<option value="' + esc(c.id) + '"' + (p.category === c.id ? ' selected' : '') + '>' + esc(c.label || c.id) + '</option>').join('');

    body.innerHTML =
      '<div class="admin__toolbar">' +
        '<button class="btn btn--line btn--sm" id="poemBack" type="button">→ القائمة</button>' +
        '<div class="admin__toolbaracts">' +
          '<button class="btn btn--line btn--sm" id="poemPreview" type="button">معاينة في القارئ</button>' +
        '</div>' +
      '</div>' +

      '<fieldset class="fieldset"><legend class="fieldset__legend">بيانات القصيدة</legend>' +
        '<div class="form-grid">' +
          field('العنوان *', '<input class="fin" data-f="title" value="' + esc(p.title) + '" placeholder="مثال: تراتيل السراب">', 'يظهر في البطاقة والقارئ ورأس الصفحة.') +
          field('الباب', '<div class="fin-row"><select class="fin" data-f="category">' + catOptions + '</select><input class="fin" data-f="__newcat" placeholder="باب جديد…"></div>', 'اكتب باباً جديداً ليُنشأ فوراً.') +
          field('المعرّف (رابط القصيدة)', '<input class="fin" data-f="id" value="' + esc(p.id) + '" dir="ltr">', 'لاتيني بلا مسافات؛ يُبنى عليه الرابط #p-…') +
          field('السنة', '<input class="fin" data-f="year" value="' + esc(p.year || '') + '" dir="ltr">') +
          field('جوّ القصيدة', '<input class="fin" data-f="mood" value="' + esc(p.mood || '') + '" placeholder="مثال: حنينٌ إلى مرفأ بعيد">', 'سطرٌ مائل تحت العنوان.') +
          field('لون القصيدة', '<select class="fin" data-f="accent">' + ['terracotta', 'olive', 'indigo'].map((a) => '<option value="' + a + '"' + (p.accent === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>') +
          field('المقتطف', '<textarea class="fin fin--ta" data-f="excerpt" rows="2" placeholder="سطر تعريفي في البطاقة">' + esc(p.excerpt || '') + '</textarea>') +
          field('وسوم (بفاصلة)', '<input class="fin" data-f="tags" value="' + esc((p.tags || []).join('، ')) + '" placeholder="شوق، ليل…">') +
        '</div>' +
        '<label class="check"><input type="checkbox" data-f="featured"' + (p.featured ? ' checked' : '') + '> مرشّحة لقسم «قصيدة مختارة» في الصفحة الرئيسية</label>' +
      '</fieldset>' +

      '<fieldset class="fieldset"><legend class="fieldset__legend">الأبيات — <span id="verseCount">' + p.verses.length + '</span> بيتاً</legend>' +
        '<p class="admin__hint">كل بيت = صدر + عجز. يظهران جنباً إلى جنب على الشاشات الواسعة ومتتابعَين على الجوال.</p>' +
        '<div id="versesBox">' + p.verses.map(verseRow).join('') + '</div>' +
        '<button class="btn btn--line btn--sm" id="verseAdd" type="button">+ بيت جديد</button>' +
      '</fieldset>' +

      '<fieldset class="fieldset"><legend class="fieldset__legend">معاينة حيّة</legend>' +
        '<div class="live-preview" id="livePreview"></div>' +
      '</fieldset>';

    /* ربط الحقول */
    body.querySelectorAll('[data-f]').forEach((el) => {
      el.addEventListener('input', () => {
        const f = el.getAttribute('data-f');
        if (f === 'tags') p.tags = el.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean);
        else if (f === 'featured') p.featured = el.checked;
        else if (f === '__newcat') {
          const v = el.value.trim();
          if (v) { p.category = v; if (!(draft.categories || []).some((c) => c.id === v)) draft.categories.push({ id: v, label: v, description: '' }); }
        }
        else if (f === 'id') { const old = p.id; p.id = el.value.trim() || p.id; if (old !== p.id) editingId = p.id; }
        else p[f] = el.value;
        setDirty(true); paintPreview(p);
      });
    });

    /* ربط الأبيات */
    const vbox = $('#versesBox');
    vbox.querySelectorAll('[data-v]').forEach((el) => el.addEventListener('input', () => {
      const [i, k] = el.getAttribute('data-v').split('.');
      p.verses[+i][k] = el.value; setDirty(true); paintPreview(p);
    }));
    vbox.onclick = (e) => {
      const b = e.target.closest('[data-va]'); if (!b) return;
      const i = +b.getAttribute('data-i'), act = b.getAttribute('data-va');
      if (act === 'del') { p.verses.splice(i, 1); if (!p.verses.length) p.verses.push({ sadr: '', ajoz: '' }); }
      if (act === 'up' && i > 0) [p.verses[i - 1], p.verses[i]] = [p.verses[i], p.verses[i - 1]];
      if (act === 'down' && i < p.verses.length - 1) [p.verses[i + 1], p.verses[i]] = [p.verses[i], p.verses[i + 1]];
      setDirty(true); keepScroll(() => renderPoemForm(p.id));
    };
    $('#verseAdd').addEventListener('click', () => { p.verses.push({ sadr: '', ajoz: '' }); setDirty(true); keepScroll(() => renderPoemForm(p.id)); });
    $('#poemBack').addEventListener('click', () => {
      draft.poems = draft.poems.filter((x) => x.title || (x.verses || []).some((v) => v.sadr || v.ajoz));
      editingId = null; renderPoemsTab();
    });
    $('#poemPreview').addEventListener('click', () => window.Athar.previewPoem(clone(p)));
    paintPreview(p);
  }

  function keepScroll(fn) { const y = body.scrollTop; fn(); body.scrollTop = y; }

  function paintPreview(p) {
    const box = $('#livePreview'); if (!box) return;
    const vc = $('#verseCount'); if (vc) vc.textContent = p.verses.length;
    box.innerHTML =
      '<p class="lp-title">' + esc(p.title || 'بلا عنوان') + '</p>' +
      (p.mood ? '<p class="lp-mood">' + esc(p.mood) + '</p>' : '') +
      p.verses.slice(0, 3).map((v) => '<p class="lp-verse">' + esc(v.sadr) + ' <span class="lp-sep">◆</span> ' + esc(v.ajoz) + '</p>').join('') +
      (p.verses.length > 3 ? '<p class="lp-more">… و' + (p.verses.length - 3) + ' أبيات أخرى</p>' : '');
  }

  const field = (label, inner, hint) =>
    '<label class="field"><span class="field__label">' + label + '</span>' + inner +
    (hint ? '<small class="field__hint">' + hint + '</small>' : '') + '</label>';

  const verseRow = (v, i) =>
    '<div class="verse-row">' +
      '<span class="verse-row__n">' + (i + 1) + '</span>' +
      '<input class="fin" data-v="' + i + '.sadr" value="' + esc(v.sadr) + '" placeholder="الصدر" aria-label="الصدر ' + (i + 1) + '">' +
      '<input class="fin" data-v="' + i + '.ajoz" value="' + esc(v.ajoz) + '" placeholder="العجز" aria-label="العجز ' + (i + 1) + '">' +
      '<span class="verse-row__acts">' +
        '<button class="abtn" data-va="up" data-i="' + i + '" title="تقديم البيت">↑</button>' +
        '<button class="abtn" data-va="down" data-i="' + i + '" title="تأخير البيت">↓</button>' +
        '<button class="abtn abtn--danger" data-va="del" data-i="' + i + '" title="حذف البيت">✕</button>' +
      '</span></div>';

  /* =========================================================
     تبويب الواجهة
     ========================================================= */
  function renderSiteTab() {
    const s = draft.site = draft.site || {};
    s.heroQuote = s.heroQuote || { sadr: '', ajoz: '' };
    s.contact = s.contact || {};
    const poemsOpts = (draft.poems || []).map((p) => '<option value="' + esc(p.id) + '"' + (s.featuredId === p.id ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('');
    body.innerHTML =
      '<fieldset class="fieldset"><legend class="fieldset__legend">الافتتاحية</legend><div class="form-grid">' +
        field('بيت الواجهة — الصدر', '<input class="fin" data-s="heroQuote.sadr" value="' + esc(s.heroQuote.sadr || '') + '">', 'البيت الكبير تحت شعار أَثَر.') +
        field('بيت الواجهة — العجز', '<input class="fin" data-s="heroQuote.ajoz" value="' + esc(s.heroQuote.ajoz) + '">') +
        field('مسار صورة الواجهة', '<input class="fin" data-s="heroImage" value="' + esc(s.heroImage || '') + '" dir="ltr" placeholder="assets/img/hero-night.jpg">') +
        field('القصيدة المختارة', '<select class="fin" data-s="featuredId">' + poemsOpts + '</select>', 'تظهر أبياتها في قسم «قصيدة مختارة».') +
      '</div></fieldset>' +
      '<fieldset class="fieldset"><legend class="fieldset__legend">الشاعر والسيرة</legend><div class="form-grid">' +
        field('اسم الشاعر', '<input class="fin" data-s="poet" value="' + esc(s.poet || '') + '">') +
        field('عنوان قسم السيرة', '<input class="fin" data-s="aboutHeading" value="' + esc(s.aboutHeading || '') + '">') +
        field('السيرة (فقرة لكل سطر)', '<textarea class="fin fin--ta" data-s="bio" rows="4">' + esc((s.bio || []).join('\n')) + '</textarea>') +
        field('نقاط السيرة (سطر لكل نقطة)', '<textarea class="fin fin--ta" data-s="aboutBullets" rows="3">' + esc((s.aboutBullets || []).join('\n')) + '</textarea>') +
        field('عبارات الشريط المتحرك (سطر لكل عبارة)', '<textarea class="fin fin--ta" data-s="marquee" rows="4">' + esc((s.marquee || []).join('\n')) + '</textarea>') +
      '</div></fieldset>' +
      '<fieldset class="fieldset"><legend class="fieldset__legend">التواصل</legend><div class="form-grid">' +
        field('البريد الإلكتروني', '<input class="fin" data-s="contact.email" value="' + esc(s.contact.email || '') + '" dir="ltr">') +
        field('واتساب (أرقام فقط)', '<input class="fin" data-s="contact.whatsapp" value="' + esc(s.contact.whatsapp || '') + '" dir="ltr">') +
        field('فيسبوك', '<input class="fin" data-s="contact.facebook" value="' + esc(s.contact.facebook || '') + '" dir="ltr">') +
        field('إنستغرام', '<input class="fin" data-s="contact.instagram" value="' + esc(s.contact.instagram || '') + '" dir="ltr">') +
        field('إكس', '<input class="fin" data-s="contact.x" value="' + esc(s.contact.x || '') + '" dir="ltr">') +
        field('يوتيوب', '<input class="fin" data-s="contact.youtube" value="' + esc(s.contact.youtube || '') + '" dir="ltr">') +
      '</div></fieldset>';
    body.querySelectorAll('[data-s]').forEach((el) => el.addEventListener('input', () => {
      const path = el.getAttribute('data-s').split('.');
      let obj = s;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] = obj[path[i]] || {};
      let v = el.value;
      if (['marquee', 'aboutBullets', 'bio'].includes(path[0])) v = v.split('\n').map((x) => x.trim()).filter(Boolean);
      obj[path[path.length - 1]] = v;
      setDirty(true);
    }));
  }

  /* =========================================================
     تبويب JSON للمتقدمين
     ========================================================= */
  function renderJsonTab() {
    body.innerHTML =
      '<p class="admin__hint">تحرير نصّي كامل للملف. بعد «تطبيق» اضغط «حفظ التغييرات» أسفل اللوحة.</p>' +
      '<textarea class="editor" id="jsonArea" spellcheck="false" dir="ltr">' + esc(JSON.stringify(draft, null, 2)) + '</textarea>' +
      '<p class="editor-msg" id="jsonMsg" role="status"></p>' +
      '<div class="admin__toolbar">' +
        '<button class="btn btn--gold btn--sm" id="jsonApply" type="button">تطبيق على المسودة</button>' +
        '<button class="btn btn--line btn--sm" id="jsonReload" type="button">إعادة تحميل من المسودة</button>' +
      '</div>';
    const msgEl = $('#jsonMsg');
    $('#jsonArea').addEventListener('input', () => {
      try { JSON.parse($('#jsonArea').value); msgEl.textContent = 'الصيغة سليمة — لم تُطبَّق بعد'; msgEl.className = 'editor-msg is-ok'; }
      catch (e) { msgEl.textContent = 'خطأ: ' + e.message; msgEl.className = 'editor-msg is-err'; }
    });
    $('#jsonApply').addEventListener('click', () => {
      try {
        const j2 = JSON.parse($('#jsonArea').value);
        if (!j2 || !Array.isArray(j2.poems)) throw new Error('الحقل poems يجب أن يكون مصفوفة');
        draft = j2; setDirty(true);
        msgEl.textContent = 'طُبّق — اضغط «حفظ التغييرات» أسفل اللوحة'; msgEl.className = 'editor-msg is-ok';
        window.Athar.toast('طُبّق JSON على المسودة');
      } catch (e) { msgEl.textContent = 'خطأ: ' + e.message; msgEl.className = 'editor-msg is-err'; }
    });
    $('#jsonReload').addEventListener('click', renderJsonTab);
  }

  /* =========================================================
     تبويب الحفظ والنشر
     ========================================================= */
  function renderBackupTab() {
    body.innerHTML =
      '<div class="backup">' +
        '<div class="backup__card backup__card--warn"><h4>حالة النشر للزوار</h4>' +
          '<p id="pubStatusText">جارٍ فحص النسخة المنشورة…</p>' +
          '<button class="btn btn--gold btn--sm" id="bkExport2" type="button">تنزيل poems.json للنشر</button></div>' +
        '<div class="backup__card"><h4>١) تنزيل poems.json</h4>' +
          '<p>ملفك المحدَّث كاملاً — ضعهُ فوق <code>data/poems.json</code> في المستودع فيتحدّث موقعك المنشور.</p>' +
          '<button class="btn btn--gold btn--sm" id="bkExport" type="button">تنزيل الملف</button></div>' +
        '<div class="backup__card"><h4>٢) استيراد ملف</h4>' +
          '<p>استورد <code>poems.json</code> من جهازك ليحلّ مكان المسودة الحالية.</p>' +
          '<input class="fin" id="bkImport" type="file" accept=".json,application/json"></div>' +
        '<div class="backup__card"><h4>٣) استعادة المنشور</h4>' +
          '<p>احذف نسختك المحلية وعد إلى محتوى المستودع الأصلي.</p>' +
          '<button class="btn btn--line btn--sm" id="bkReset" type="button">استعادة</button></div>' +
        '<div class="backup__card"><h4>كلمة مرور دخول الموقع (خيار المستخدم)</h4>' +
          '<p>' + ((draft.site && draft.site.adminPassHash) ? '✓ كلمة مرور خاصة مضبوطة وستُسجّل مجزّأة في الملف المنشور.' : 'لا كلمة بعد — الافتراضي <code>athar2026</code>؛ ضع كلمتك الخاصة ثم احفظ وانشر.') + '</p>' +
          '<div class="fin-row"><input class="fin" id="bkPass1" type="text" placeholder="كلمة جديدة" dir="ltr"><input class="fin" id="bkPass2" type="text" placeholder="تأكيد" dir="ltr"></div>' +
          '<button class="btn btn--line btn--sm" id="bkPassSave" type="button">حفظ الكلمة (يلزمها نشر)</button></div>' +
        '<div class="backup__card"><h4>الخروج من وضع المستخدم</h4><p>يعيد جهازك إلى بوابة الدخول كزائر.</p><button class="btn btn--line btn--sm" id="bkLogout" type="button">خروج</button></div>' +
        '<div class="backup__card backup__card--warn"><h4>كيف ينشر تعديلي للزوار؟</h4>' +
          '<p>الحفظ هنا يخزّن نسختك في متصفحك ويُحدّث الموقع أمامك فوراً. ليراها الجميع: نزّل <code>poems.json</code> وارفعه إلى مستودعك على GitHub (مجهد data → Add file → Upload files)، أو أرسله لصديقك التقني ليرفعه. لا يحتاج الموقع أي خادم.</p></div>' +
      '</div>';

    const exportJson = () => {
      const json = dirty ? draft : window.Athar.getJSON();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8' });
      const el = document.createElement('a');
      el.href = URL.createObjectURL(blob); el.download = 'poems.json';
      document.body.appendChild(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(el.href), 1500);
      window.Athar.toast('نُزّل poems.json');
    };
    $('#bkExport').addEventListener('click', exportJson);
    $('#bkExport2').addEventListener('click', exportJson);

    /* فحص: هل نسختك المحفوظة وصلت للزوار؟ */
    (async () => {
      const el = $('#pubStatusText'); if (!el) return;
      try {
        const r = await fetch('./data/poems.json?ts=' + Date.now(), { cache: 'no-store' });
        const pub = await r.json();
        const mine = window.Athar.getJSON();
        if (JSON.stringify(pub) === JSON.stringify(mine)) {
          el.innerHTML = '✓ <b>النسخة المنشورة مطابقة</b> لنسختك المحفوظة — الزوار يرون تعديلاتك.';
        } else {
          el.innerHTML = '⚠ <b>نسختك المحفوظة لم تصل للزوار بعد.</b> نزّل الملف بالزر وارفعه إلى مجلد <code>data</code> في مستودعك على GitHub (Add file → Upload files)، أو أرسله في المحادثة ليُنشر لك.';
        }
      } catch (e) { el.textContent = 'تعذّر فحص النسخة المنشورة.'; }
    })();
    $('#bkImport').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const json = JSON.parse(r.result);
          if (!json || !Array.isArray(json.poems)) throw new Error('poems ليست مصفوفة');
          draft = json; setDirty(true); renderTab();
          window.Athar.toast('استُورد — اضغط حفظ التغييرات');
        } catch (err) { alert('ملف غير صالح: ' + err.message); }
      };
      r.readAsText(f);
    });
    $('#bkReset').addEventListener('click', async () => {
      if (!confirm('سيُحذف حفظك المحلي وتعود بيانات المستودع. متابعة؟')) return;
      const ok = await window.Athar.clearOverride();
      localStorage.removeItem(DRAFT_KEY);
      draft = clone(window.Athar.getJSON()); dirty = false; renderTab();
      window.Athar.toast(ok ? 'استُعيدت البيانات المنشورة' : 'تعذّر الوصول للملف الأصلي');
    });
    $('#bkPassSave').addEventListener('click', async () => {
      const p1 = $('#bkPass1').value.trim(), p2 = $('#bkPass2').value.trim();
      if (!p1 || p1.length < 4) { alert('الكلمة 4 خانات فأكثر'); return; }
      if (p1 !== p2) { alert('التأكيد غير مطابق'); return; }
      const h = await window.Athar.sha256(p1);
      draft.site = draft.site || {}; draft.site.adminPassHash = h;
      setDirty(true); renderBackupTab();
      window.Athar.toast('حُفظت مجزّأة في المسودة — اضغط «حفظ» ثم انشر الملف');
    });
    $('#bkLogout').addEventListener('click', () => { location.reload(); });
  }
})();
