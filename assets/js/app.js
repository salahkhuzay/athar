/* =========================================================
   أَثَر — ديوان صلاح الدين الخزاعي
   المصدر الوحيد للبيانات: data/poems.json
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const store = {
    get(k, f = null) { try { const v = localStorage.getItem(k); return v === null ? f : v; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* تطبيع عربي للبحث: يتسامح مع التشكيل والهمزات والألف المقصورة والتاء المربوطة */
  const norm = (s) => String(s ?? '')
    .replace(/[\u064B-\u0652\u0670\u0640\u06DB\u06DD]/g, '')
    .replace(/[أإآٱٲٳ]/g, 'ا')
    .replace(/[ىيئئي]/g, 'ي')
    .replace(/[هة]/g, 'ه')
    .replace(/[وؤء]/g, 'و')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const TASHKEEL = '[\\u064B-\\u0652\\u0670\\u0640]?';
  const VARIANT = { 'ا': '[أإآٱٲٳا]', 'ي': '[يىئئي]', 'ه': '[هة]', 'و': '[وؤو]' };

  function buildRe(q) {
    const nq = norm(q);
    if (!nq) return null;
    const body = Array.from(nq).map((ch) => (VARIANT[ch] || escapeRe(ch)) + TASHKEEL).join('');
    try { return { test: new RegExp(body, 'i'), split: new RegExp('(' + body + ')', 'gi') }; }
    catch (e) { return null; }
  }

  function hl(text, re) {
    const raw = String(text ?? '');
    if (!re) return esc(raw);
    return raw.split(re.split).map((p, i) => (i % 2 === 1 ? '<mark>' + esc(p) + '</mark>' : esc(p))).join('');
  }

  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      setTimeout(() => { toastEl.hidden = true; }, 320);
    }, 2200);
  }

  /* ---------- الحالة ---------- */
  const state = {
    data: { site: {}, categories: [], poems: [] },
    raw: '', source: '',
    cat: 'all', q: '', re: null,
    bookmarks: new Set(JSON.parse(store.get('athar-bookmarks', '[]') || '[]')),
    reader: { list: [], index: -1, manuscript: store.get('athar-manuscript', '0') === '1' }
  };

  const DEFAULT_MARQUEE = [
    'شِعرٌ يَبقى بَعدَ الرَّحيل', 'الحَرفُ أمانَة', 'كُلُّ قَصيدةٍ أَثَر',
    'مِن ماءِ الحِبرِ يَسقي الوَرَق', 'الكَلِمَةُ الصادِقَةُ لا تَموت', 'لأنّ بعضَ الكلامِ يبقى'
  ];

  /* ---------- تحميل البيانات ---------- */
  async function loadData() {
    const override = store.get('athar-data-override');
    if (override) {
      try {
        const json = JSON.parse(override);
        if (json && Array.isArray(json.poems)) return { json, raw: JSON.stringify(json, null, 2), source: 'حفظ محلي' };
      } catch (e) { store.del('athar-data-override'); }
    }
    try {
      const r = await fetch('./data/poems.json?v=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const text = await r.text();
        const json = JSON.parse(text);
        if (json && Array.isArray(json.poems)) return { json, raw: text, source: './data/poems.json' };
      }
    } catch (e) {}
    const fb = $('#fallbackData');
    if (fb && fb.textContent.trim()) {
      try {
        const json = JSON.parse(fb.textContent.replace(/<\\\//g, '</'));
        if (json && Array.isArray(json.poems)) return { json, raw: JSON.stringify(json, null, 2), source: 'نسخة مضمّنة', inline: true };
      } catch (e) {}
    }
    return { json: null, raw: '', source: '' };
  }

  function normalize(json) {
    const site = json.site || {};
    const poems = (json.poems || []).map((p, i) => ({
      idx: i,
      id: p.id || ('poem-' + (i + 1)),
      title: p.title || 'بلا عنوان',
      category: p.category || '',
      year: p.year || '', date: p.date || '',
      mood: p.mood || '',
      excerpt: p.excerpt || p.epigraph || '',
      accent: p.accent || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      featured: !!p.featured,
      audio: p.audio || '',
      verses: (p.verses || p.lines || []).map((v) => ({
        sadr: v.sadr ?? v['صدر'] ?? '',
        ajoz: v.ajoz ?? v.ajz ?? v['عجز'] ?? ''
      })).filter((v) => v.sadr || v.ajoz)
    }));
    const cats = (json.categories || []).filter((c) => c && c.id)
      .map((c) => ({ id: c.id, label: c.label || c.id, description: c.description || '' }));
    Array.from(new Set(poems.map((p) => p.category).filter(Boolean)))
      .forEach((id) => { if (!cats.some((c) => c.id === id)) cats.push({ id, label: id, description: '' }); });
    return { site, categories: cats, poems };
  }

  /* ---------- الربط الثابت ---------- */
  function bindStatic() {
    const s = state.data.site;
    const poet = s.poet || 'صلاح الدين الخزاعي';
    ['#brandPoet', '#heroPoet', '#footerPoet', '#aboutName'].forEach((sel) => {
      const el = $(sel); if (el) el.textContent = poet;
    });
    document.title = 'أثر | ديوان الشاعر ' + poet;

    const hq = s.heroQuote;
    const hqEl = $('#heroQuote');
    if (hqEl) {
      hqEl.innerHTML = hq
        ? '<p><span class="qmark">«</span>' + esc(hq.sadr) + '</p><p>' + esc(hq.ajoz) + '<span class="qmark">»</span></p>'
        : '';
    }

    const img = s.heroImage ? encodeURI(s.heroImage) : '';
    if (img) {
      const probe = new Image();
      probe.onload = () => document.documentElement.style.setProperty('--hero-bg', "url('" + img + "')");
      probe.src = img;
    }

    const bio = $('#bioText');
    if (bio) bio.innerHTML = (Array.isArray(s.bio) ? s.bio : [s.bio].filter(Boolean)).map((p) => '<p>' + esc(p) + '</p>').join('');
    const heading = $('#aboutHeading');
    if (heading && s.aboutHeading) heading.textContent = s.aboutHeading;
    const bullets = $('#aboutBullets');
    if (bullets) bullets.innerHTML = (s.aboutBullets || []).map((b) => '<li>' + esc(b) + '</li>').join('');

    const ct = $('#contactText');
    if (ct && s.contact && s.contact.text) ct.textContent = s.contact.text;
    renderContact(s.contact || {});

    const y = $('#footerYear'); if (y) y.textContent = new Date().getFullYear();
  }

  const ICONS = {
    email: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
    whatsapp: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"/>',
    facebook: '<path d="M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8.8c0-.5.4-.8 1-.8Z"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".9" fill="currentColor"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
    youtube: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M11 9.5l4 2.5-4 2.5z"/>'
  };

  function renderContact(c) {
    const links = $('#contactLinks'); if (!links) return;
    const items = [];
    if (c.email) items.push(['mailto:' + c.email, c.email, ICONS.email]);
    if (c.whatsapp) items.push(['https://wa.me/' + String(c.whatsapp).replace(/[^\d]/g, ''), 'واتساب', ICONS.whatsapp]);
    if (c.facebook) items.push([c.facebook, 'فيسبوك', ICONS.facebook]);
    if (c.instagram) items.push([c.instagram, 'إنستغرام', ICONS.instagram]);
    if (c.x) items.push([c.x, 'إكس', ICONS.x]);
    if (c.youtube) items.push([c.youtube, 'يوتيوب', ICONS.youtube]);
    if (!items.length) items.push(['#', 'أضف وسائل تواصل في data/poems.json', ICONS.email]);
    links.innerHTML = items.map(([href, label, icon]) =>
      '<a class="clink" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + icon + '</svg><span>' + esc(label) + '</span></a>').join('');
  }

  /* ---------- الشريط المتحرك ---------- */
  function renderMarquee() {
    const track = $('#marqueeTrack'); if (!track) return;
    const items = state.data.site.marquee && state.data.site.marquee.length ? state.data.site.marquee : DEFAULT_MARQUEE;
    const half = items.map((t) => '<span class="marquee__item">' + esc(t) + '</span>').join('');
    track.innerHTML = half + half; /* تكرار لحلقة لا نهائية سلسة */
  }

  /* ---------- قصيدة مختارة ---------- */
  function featuredPoem() {
    const s = state.data.site;
    return state.data.poems.find((p) => p.id === s.featuredId)
      || state.data.poems.find((p) => p.featured)
      || state.data.poems[0];
  }

  function renderFeatured() {
    const box = $('#featuredPoem'); if (!box) return;
    const p = featuredPoem();
    if (!p) { box.innerHTML = ''; return; }
    box.innerHTML = p.verses.slice(0, 4).map((v) =>
      '<div class="fverse"><p>' + esc(v.sadr) + '</p>' + (v.ajoz ? '<span class="sep" aria-hidden="true"></span><p>' + esc(v.ajoz) + '</p>' : '') + '</div>').join('');
    const by = $('#featuredBy');
    if (by) by.textContent = '«' + p.title + '» — ديوان ' + (state.data.site.poet || '');
    const open = $('#featuredOpen');
    if (open) open.onclick = () => openReader(p.id);
  }

  /* ---------- الأبواب (chips) ---------- */
  function renderChips() {
    const box = $('#categoryChips'); if (!box) return;
    const counts = {};
    state.data.poems.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const chips = [{ id: 'all', label: 'كل القصائد', count: state.data.poems.length }]
      .concat(state.data.categories.map((c) => ({ id: c.id, label: c.label, count: counts[c.id] || 0 })))
      .concat([{ id: 'fav', label: '★ المحفوظات', count: state.bookmarks.size }]);
    box.innerHTML = chips.map((c) =>
      '<button class="chip' + (state.cat === c.id ? ' is-active' : '') + '" type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (state.cat === c.id) + '">' +
      '<span>' + esc(c.label) + '</span><span class="chip__count">' + c.count + '</span></button>').join('');
  }

  /* ---------- التصفية ---------- */
  function poemText(p) {
    return [p.title, p.mood, p.excerpt, p.category, p.tags.join(' '),
      p.verses.map((v) => v.sadr + ' ' + v.ajoz).join(' ')].join(' ');
  }

  function visiblePoems() {
    let list = state.data.poems.slice();
    if (state.cat === 'fav') list = list.filter((p) => state.bookmarks.has(p.id));
    else if (state.cat !== 'all') list = list.filter((p) => p.category === state.cat);
    if (state.re) list = list.filter((p) => state.re.test.test(poemText(p)));
    return list.sort((a, b) => a.idx - b.idx);
  }

  /* ---------- البطاقات ---------- */
  const I = {
    star: '<path d="M12 4l2.3 4.9 5.2.7-3.8 3.7.9 5.3L12 16.9 7.4 18.6l.9-5.3L4.5 9.6l5.2-.7z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6.5A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14"/>',
    arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    speaker: '<path d="M4 10v4h3l4 3.5v-11L7 10H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 3 2.5L16 12l4 4"/>'
  };

  function cardHTML(p) {
    const fav = state.bookmarks.has(p.id);
    const preview = p.verses.slice(0, 2).map((v) =>
      '<p class="cverse">' + hl(v.sadr, state.re) + '</p>' + (v.ajoz ? '<p class="cverse cverse--ajoz">' + hl(v.ajoz, state.re) + '</p>' : '')).join('');
    return '<article class="card reveal" data-id="' + esc(p.id) + '">' +
      '<div class="card__top">' +
        '<h3 class="card__title"><button type="button" class="js-open" data-id="' + esc(p.id) + '">' + hl(p.title, state.re) + '</button></h3>' +
        (p.year ? '<span class="card__year">' + esc(p.year) + '</span>' : '') +
      '</div>' +
      (p.mood ? '<p class="card__mood">' + hl(p.mood, state.re) + '</p>' : '') +
      '<div class="card__preview">' + preview + '</div>' +
      (p.excerpt ? '<p class="card__excerpt">' + hl(p.excerpt, state.re) + '</p>' : '') +
      '<div class="card__foot">' +
        '<button class="card__open js-open" type="button" data-id="' + esc(p.id) + '" aria-label="اقرأ قصيدة ' + esc(p.title) + ' كاملة">' +
          '<span>اقرأ القصيدة كاملة</span><svg viewBox="0 0 24 24" aria-hidden="true">' + I.arrow + '</svg></button>' +
        '<span class="spacer"></span>' +
        '<button class="icon-btn js-fav' + (fav ? ' is-on' : '') + '" type="button" data-id="' + esc(p.id) + '" aria-pressed="' + fav + '" aria-label="حفظ القصيدة" title="حفظ">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' + I.star + '</svg></button>' +
        '<button class="icon-btn js-copy" type="button" data-id="' + esc(p.id) + '" aria-label="نسخ القصيدة" title="نسخ القصيدة">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' + I.copy + '</svg></button>' +
        (p.audio ? '<button class="icon-btn js-play" type="button" data-id="' + esc(p.id) + '" aria-label="استمع بصوت الشاعر" title="استمع بصوت الشاعر">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' + I.speaker + '</svg></button>' : '') +
        '<button class="icon-btn js-card" type="button" data-id="' + esc(p.id) + '" aria-label="بطاقة مشاركة" title="بطاقة مشاركة">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' + I.image + '</svg></button>' +
      '</div></article>';
  }

  function renderCards() {
    const list = $('#poemsList'), empty = $('#emptyState'), meta = $('#resultsMeta');
    const poems = visiblePoems();
    list.innerHTML = poems.map(cardHTML).join('');
    empty.hidden = poems.length !== 0;
    meta.textContent = poems.length === state.data.poems.length
      ? state.data.poems.length + ' قصيدة في الديوان'
      : 'يعرض ' + poems.length + ' من ' + state.data.poems.length + ' قصيدة' + (state.q ? ' — بحث: «' + state.q + '»' : '');
    observeReveals(list);
  }

  /* ---------- الإحصاءات ---------- */
  function renderStats() {
    const el = $('#aboutStats'); if (!el) return;
    const verses = state.data.poems.reduce((a, p) => a + p.verses.length, 0);
    el.innerHTML =
      '<div><dd>' + state.data.poems.length + '</dd><dt>قصيدة في الديوان</dt></div>' +
      '<div><dd>' + verses + '</dd><dt>بيتٌ من الشِّعر</dt></div>' +
      '<div><dd>' + state.data.categories.length + '</dd><dt>أبواب شعرية</dt></div>';
  }

  function renderAll() {
    bindStatic(); renderMarquee(); renderFeatured(); renderChips(); renderCards(); renderStats(); renderAudioLib(); paintPlayButtons();
  }

  /* ---------- القارئ ---------- */
  const reader = $('#readerModal');

  function openReader(id, list) {
    const pool = list || visiblePoems();
    let idx = pool.findIndex((p) => p.id === id);
    let poolUsed = pool;
    if (idx === -1) { poolUsed = state.data.poems.slice(); idx = poolUsed.findIndex((p) => p.id === id); }
    if (idx === -1) return;
    state.reader.list = poolUsed; state.reader.index = idx;
    paintReader();
    reader.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.reader__body').scrollTop = 0;
  }

  function paintReader() {
    const p = state.reader.list[state.reader.index];
    if (!p) return;
    $('#readerMeta').textContent = [p.category, p.year, p.verses.length + ' بيتاً'].filter(Boolean).join(' · ');
    $('#readerTitle').textContent = p.title;
    $('#readerMood').textContent = p.mood || '';
    $('#readerVerses').innerHTML = p.verses.map((v) =>
      '<div class="rverse"><p>' + esc(v.sadr) + '</p>' + (v.ajoz ? '<span class="sep" aria-hidden="true"></span><p>' + esc(v.ajoz) + '</p>' : '') + '</div>').join('');
    const fav = state.bookmarks.has(p.id);
    const favBtn = $('#readerFav');
    favBtn.classList.toggle('is-on', fav);
    favBtn.setAttribute('aria-pressed', String(fav));
    const panel = $('.reader__panel');
    panel.classList.toggle('is-manuscript', state.reader.manuscript);
    $('#readerManuscript').setAttribute('aria-pressed', String(state.reader.manuscript));
    $('#readerPrev').disabled = state.reader.index >= state.reader.list.length - 1;
    $('#readerNext').disabled = state.reader.index <= 0;
    const rp = $('#readerPlay');
    if (rp) {
      rp.hidden = !p.audio;
      const on = p.audio && state.audioId === p.id && AU && !AU.paused;
      rp.classList.toggle('is-on', !!on);
      rp.querySelector('svg').innerHTML = on ? I.pause : I.speaker;
    }
  }

  function closeReader() { reader.hidden = true; document.body.style.overflow = ''; }

  $('#readerPrev').addEventListener('click', () => { state.reader.index = Math.min(state.reader.list.length - 1, state.reader.index + 1); paintReader(); $('.reader__body').scrollTop = 0; });
  $('#readerNext').addEventListener('click', () => { state.reader.index = Math.max(0, state.reader.index - 1); paintReader(); $('.reader__body').scrollTop = 0; });
  $('#readerCloseAll').addEventListener('click', () => { closeReader(); $('#poems').scrollIntoView({ behavior: 'smooth' }); });
  $('#readerManuscript').addEventListener('click', () => {
    state.reader.manuscript = !state.reader.manuscript;
    store.set('athar-manuscript', state.reader.manuscript ? '1' : '0');
    paintReader();
    toast(state.reader.manuscript ? 'وضع المخطوط' : 'الوضع الليلي');
  });
  $('#readerCopy').addEventListener('click', () => copyPoem(state.reader.list[state.reader.index].id));
  $('#readerFav').addEventListener('click', () => { toggleFav(state.reader.list[state.reader.index].id); paintReader(); });
  $('#readerPlay').addEventListener('click', () => { togglePlay(state.reader.list[state.reader.index].id); });
  $('#readerCard').addEventListener('click', () => { makeCard(state.reader.list[state.reader.index].id); });

  reader.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeReader(); });

  /* ---------- المحفوظات والنسخ ---------- */
  function toggleFav(id) {
    if (state.bookmarks.has(id)) { state.bookmarks.delete(id); toast('أُزيلت من المحفوظات'); }
    else { state.bookmarks.add(id); toast('حُفظت في المحفوظات ✦'); }
    store.set('athar-bookmarks', JSON.stringify(Array.from(state.bookmarks)));
    renderChips();
    if (state.cat === 'fav') renderCards();
    $$('.js-fav[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]').forEach((b) => {
      const on = state.bookmarks.has(id);
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
  }

  function findPoem(id) { return state.data.poems.find((p) => p.id === id); }

  function poemAsText(p) {
    return [p.title, '']
      .concat(p.verses.map((v) => (v.ajoz ? v.sadr + '  ***  ' + v.ajoz : v.sadr)))
      .concat(['', '— ' + (state.data.site.poet || ''), location.origin + location.pathname + '#p-' + p.id])
      .join('\n');
  }

  async function copyText(text, msg) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;inset-block-start:-1000px;opacity:0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast(msg);
    } catch (e) { toast('تعذّر النسخ'); }
  }
  const copyPoem = (id) => { const p = findPoem(id); if (p) copyText(poemAsText(p), 'نُسِخَت القصيدة ✓'); };

  /* ---------- أحداث مفوّضة ---------- */
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) { state.cat = chip.getAttribute('data-cat'); renderChips(); renderCards(); return; }

    const open = e.target.closest('.js-open');
    if (open) { openReader(open.getAttribute('data-id')); return; }

    const fav = e.target.closest('.js-fav');
    if (fav) { toggleFav(fav.getAttribute('data-id')); return; }

    const copy = e.target.closest('.js-copy');
    if (copy) { copyPoem(copy.getAttribute('data-id')); return; }

    const play = e.target.closest('.js-play');
    if (play) { togglePlay(play.getAttribute('data-id')); return; }

    const card = e.target.closest('.js-card');
    if (card) { makeCard(card.getAttribute('data-id')); return; }
  });

  /* ---------- بطاقة المشاركة: صورة جاهزة للنشر ---------- */
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function makeCard(id) {
    const p = state.data.poems.find((x) => x.id === id);
    if (!p) return;
    toast('جارٍ رسم البطاقة…');
    try {
      await document.fonts.ready;
      const W = 1080, H = 1350;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const x = cv.getContext('2d');
      x.fillStyle = '#0f0b07'; x.fillRect(0, 0, W, H);
      const g = x.createRadialGradient(W / 2, -120, 60, W / 2, 0, 950);
      g.addColorStop(0, '#26180a'); g.addColorStop(1, 'rgba(15,11,7,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(194,148,81,.85)'; x.lineWidth = 3; x.strokeRect(36, 36, W - 72, H - 72);
      x.strokeStyle = 'rgba(194,148,81,.3)'; x.lineWidth = 1; x.strokeRect(54, 54, W - 108, H - 108);
      const logo = await loadImg('assets/img/logo-athar-512.png');
      const ls = 250; x.drawImage(logo, (W - ls) / 2, 92, ls, ls);
      x.textAlign = 'center'; x.direction = 'rtl';
      x.fillStyle = '#e2b977'; x.font = '700 62px Cairo, Tajawal, sans-serif';
      x.fillText(p.title, W / 2, 452);
      x.fillStyle = '#a89a7f'; x.font = '400 32px Tajawal, sans-serif';
      x.fillText((state.data.site && state.data.site.poet) || 'صلاح الدين الخزاعي', W / 2, 512);
      x.strokeStyle = 'rgba(194,148,81,.5)'; x.beginPath(); x.moveTo(W / 2 - 130, 552); x.lineTo(W / 2 + 130, 552); x.stroke();
      x.fillStyle = '#ece4d3'; x.font = '400 42px Amiri, serif';
      let y = 640;
      const wrap = (t) => {
        const words = t.split(' '); const lines = []; let cur = '';
        words.forEach((w) => {
          const test = cur ? cur + ' ' + w : w;
          if (x.measureText(test).width > W - 220) { if (cur) lines.push(cur); cur = w; } else cur = test;
        });
        if (cur) lines.push(cur);
        return lines;
      };
      p.verses.slice(0, 3).forEach((v) => {
        wrap(v.ajoz ? v.sadr + '  ◆  ' + v.ajoz : v.sadr).forEach((ln) => { x.fillText(ln, W / 2, y); y += 62; });
        y += 22;
      });
      x.fillStyle = '#6e6152'; x.font = '400 26px Tajawal, sans-serif';
      x.fillText('ديوانُ صوتٍ وحبر', W / 2, H - 168);
      x.fillStyle = '#c29451'; x.font = '600 30px Cairo, sans-serif';
      x.fillText('salahkhuzay.github.io/athar', W / 2, H - 116);
      cv.toBlob(async (b) => {
        if (!b) { toast('تعذّر رسم البطاقة'); return; }
        const f = new File([b], 'athar-' + p.id + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
          try { await navigator.share({ files: [f], title: p.title, text: p.title + ' — صلاح الدين الخزاعي' }); toast('شُرِكَت البطاقة'); return; } catch (e) {}
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = 'athar-' + p.id + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast('نُزّلت البطاقة — انشرها حيث شئت');
      }, 'image/png');
    } catch (e) { toast('تعذّر رسم البطاقة'); }
  }

  /* ---------- الصوت: مكتبة الديوان بصوت الشاعر ---------- */
  let AU = null;
  state.audioId = '';
  function ensureAU() {
    if (AU) return AU;
    AU = new Audio();
    AU.addEventListener('ended', () => { state.audioId = ''; paintPlayButtons(); hideBar(); });
    AU.addEventListener('timeupdate', paintBar);
    AU.addEventListener('play', () => { paintPlayButtons(); const b = $('#auPP'); if (b) b.querySelector('svg').innerHTML = I.pause; });
    AU.addEventListener('pause', () => { paintPlayButtons(); const b = $('#auPP'); if (b) b.querySelector('svg').innerHTML = I.play; });
    return AU;
  }
  function togglePlay(id) {
    const p = state.data.poems.find((x) => x.id === id);
    if (!p || !p.audio) { toast('لا تسجيل لهذه القصيدة بعد'); return; }
    const a = ensureAU();
    if (state.audioId === id) { if (a.paused) { a.play(); showBar(p); } else a.pause(); return; }
    a.src = p.audio; state.audioId = id; showBar(p); paintBar();
    a.play().catch(() => { toast('تعذّر تشغيل الصوت'); hideBar(); state.audioId = ''; paintPlayButtons(); });
  }
  function paintPlayButtons() {
    document.querySelectorAll('.js-play').forEach((b) => {
      const on = b.getAttribute('data-id') === state.audioId && AU && !AU.paused;
      b.classList.toggle('is-on', !!on);
      b.querySelector('svg').innerHTML = on ? I.pause : I.speaker;
    });
    const rp = $('#readerPlay');
    if (rp && !rp.hidden) {
      const p = state.reader.list[state.reader.index];
      const on = p && p.audio && state.audioId === p.id && AU && !AU.paused;
      rp.classList.toggle('is-on', !!on);
      rp.querySelector('svg').innerHTML = on ? I.pause : I.speaker;
    }
  }
  function barEl() {
    let b = $('#auBar');
    if (!b) {
      b = document.createElement('div'); b.id = 'auBar'; b.className = 'aubar'; b.hidden = true;
      b.innerHTML = '<button class="aubar__pp" type="button" id="auPP" aria-label="تشغيل/إيقاف"><svg viewBox="0 0 24 24" aria-hidden="true">' + I.pause + '</svg></button>' +
        '<div class="aubar__meta"><b id="auTitle"></b><span id="auTime"></span></div>' +
        '<div class="aubar__prog"><i id="auProg"></i></div>' +
        '<button class="aubar__x" type="button" aria-label="إغلاق المشغّل">✕</button>';
      document.body.appendChild(b);
      b.querySelector('.aubar__x').addEventListener('click', () => { if (AU) AU.pause(); state.audioId = ''; hideBar(); paintPlayButtons(); });
      b.querySelector('#auPP').addEventListener('click', () => { if (!AU) return; if (AU.paused) AU.play(); else AU.pause(); });
    }
    return b;
  }
  function showBar(p) { const b = barEl(); b.hidden = false; $('#auTitle').textContent = p.title; }
  function hideBar() { const b = $('#auBar'); if (b) b.hidden = true; }
  function fmtT(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function paintBar() {
    if (!AU) return;
    const pr = $('#auProg'); if (pr) pr.style.width = (AU.duration ? (AU.currentTime / AU.duration * 100) : 0) + '%';
    const t = $('#auTime'); if (t) t.textContent = fmtT(AU.currentTime) + ' / ' + fmtT(AU.duration);
  }
  function renderAudioLib() {
    const sec = $('#audioLib'); if (!sec) return;
    const list = state.data.poems.filter((p) => p.audio);
    sec.hidden = list.length === 0;
    if (!list.length) return;
    $('#audioList').innerHTML = list.map((p) =>
      '<div class="audiolib__row">' +
        '<button class="icon-btn js-play" type="button" data-id="' + esc(p.id) + '" aria-label="تشغيل ' + esc(p.title) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + I.speaker + '</svg></button>' +
        '<b>' + esc(p.title) + '</b><span>' + esc(p.category || '') + '</span>' +
      '</div>').join('');
  }

  /* ---------- البحث ---------- */
  let searchTimer;
  $('#searchInput').addEventListener('input', (e) => {
    const v = e.target.value;
    $('#searchClear').hidden = !v;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = v.trim(); state.re = buildRe(v); renderCards(); }, 130);
  });
  $('#searchClear').addEventListener('click', () => {
    $('#searchInput').value = ''; $('#searchClear').hidden = true;
    state.q = ''; state.re = null; renderCards(); $('#searchInput').focus();
  });
  $('#resetFilters').addEventListener('click', () => {
    $('#searchInput').value = ''; $('#searchClear').hidden = true;
    state.q = ''; state.re = null; state.cat = 'all';
    renderChips(); renderCards();
  });

  /* ---------- القائمة والجوال ---------- */
  const navToggle = $('#navToggle'), nav = $('#primaryNav');
  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); }
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') {
      nav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false');
      if (!reader.hidden) closeReader();
    }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); $('#searchInput').focus(); }
    if (!reader.hidden) {
      if (e.key === 'ArrowLeft') $('#readerPrev').click();   /* التالية في RTL */
      if (e.key === 'ArrowRight') $('#readerNext').click();  /* السابقة في RTL */
    }
  });

  /* ---------- التمرير ---------- */
  const progress = $('#scrollProgress'), toTop = $('#toTop'), topbar = $('#topbar');
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY || 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
      toTop.classList.toggle('is-visible', y > 600);
      topbar.classList.toggle('is-stuck', y > 8);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      $$('.nav__link').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => spy.observe(s));

  /* ---------- الظهور ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealObs.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
  function observeReveals(root) {
    $$('.reveal:not(.is-in)', root || document).forEach((el, i) => {
      el.style.transitionDelay = Math.min(i, 8) * 45 + 'ms';
      revealObs.observe(el);
    });
  }

  /* ---------- الطباعة ---------- */
  function renderPrintArea() {
    let area = $('#printArea');
    if (!area) {
      area = document.createElement('div');
      area.id = 'printArea'; area.className = 'print-area';
      document.body.insertBefore(area, $('.footer'));
    }
    area.innerHTML = '<h1>أَثَر — ديوان ' + esc(state.data.site.poet || '') + '</h1>' +
      state.data.poems.map((p) =>
        '<section><h2>' + esc(p.title) + ' <span>(' + esc([p.category, p.year].filter(Boolean).join(' · ')) + ')</span></h2>' +
        p.verses.map((v) => '<p class="pv">' + esc(v.sadr) + (v.ajoz ? ' <span class="ps">◆</span> ' + esc(v.ajoz) : '') + '</p>').join('') +
        '</section>').join('');
  }
  $('#printBtn').addEventListener('click', () => { renderPrintArea(); setTimeout(() => window.print(), 120); });

  /* ---------- رابط مباشر لقصيدة ---------- */
  function focusHash() {
    const h = decodeURIComponent(location.hash || '');
    if (!h.startsWith('#p-')) return;
    setTimeout(() => openReader(h.slice(3)), 250);
  }

  /* ---------- واجهة برمجية للوحة التحكم ---------- */
  window.Athar = {
    getJSON: () => { try { return JSON.parse(state.raw || '{}'); } catch (e) { return {}; } },
    commit: (json) => {
      store.set('athar-data-override', JSON.stringify(json));
      state.data = normalize(json);
      state.raw = JSON.stringify(json, null, 2);
      renderAll();
    },
    hasOverride: () => !!store.get('athar-data-override'),
    clearOverride: async () => {
      store.del('athar-data-override');
      const res = await loadData();
      if (res.json) { state.data = normalize(res.json); state.raw = res.raw; renderAll(); return true; }
      return false;
    },
    toast,
    sha256,
    entryMode,
    previewPoem: (p) => {
      state.reader.list = [p]; state.reader.index = 0;
      paintReader();
      reader.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.reader__body').scrollTop = 0;
    }
  };

  /* ---------- بوابة الدخول: زائر / مستخدم ---------- */
  let currentMode = '';
  function sha256(t) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
      .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''));
  }
  function entryMode() { return currentMode; }
  function applyEntry() {
    const m = entryMode();
    const btn = $('#openAdmin');
    if (btn) btn.hidden = m !== 'user';
    if (m === 'user' && location.hash === '#admin' && btn) setTimeout(() => btn.click(), 350);
  }
  function showSplash(done) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
    const s = document.createElement('div');
    s.className = 'splash';
    let parts = '';
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2, dist = 90 + Math.random() * 140;
      parts += '<i style="--dx:' + (Math.cos(ang) * dist).toFixed(0) + 'px;--dy:' + (Math.sin(ang) * dist).toFixed(0) + 'px;--dl:' + (0.85 + Math.random() * 0.6).toFixed(2) + 's;--sz:' + (2 + Math.random() * 3).toFixed(1) + 'px"></i>';
    }
    s.innerHTML =
      '<span class="splash__curtain splash__curtain--t"></span>' +
      '<span class="splash__curtain splash__curtain--b"></span>' +
      '<div class="splash__stage">' +
        '<span class="splash__ring splash__ring--1"></span>' +
        '<span class="splash__ring splash__ring--2"></span>' +
        '<img class="splash__logo" src="assets/img/logo-athar-512.png" alt="أثَر">' +
        '<span class="splash__shimmer" aria-hidden="true"></span>' +
        '<span class="splash__parts" aria-hidden="true">' + parts + '</span>' +
        '<p class="splash__name">ديوانُ صوتٍ وحبر</p>' +
      '</div>';
    document.body.prepend(s);
    document.body.style.overflow = 'hidden';
    let ended = false;
    const finish = () => {
      if (ended) return; ended = true;
      s.classList.add('is-out');
      setTimeout(() => { s.remove(); document.body.style.overflow = ''; done(); }, 980);
    };
    s.addEventListener('click', finish);
    setTimeout(finish, 2650);
  }

  function showEntryGate() {
    const g = document.createElement('div');
    g.className = 'entrygate';
    g.innerHTML =
      '<div class="entrygate__card">' +
        '<h1 class="entrygate__logo">أثَر</h1>' +
        '<p class="entrygate__sub">ديوان صلاح الدين الخزاعي</p>' +
        '<div class="entrygate__btns" id="egBtns">' +
          '<button type="button" class="btn btn--gold" id="egVisitor">دخول كزائر</button>' +
          '<button type="button" class="btn btn--line" id="egUser">دخول كمستخدم</button>' +
        '</div>' +
        '<form id="egForm" hidden>' +
          '<label class="entrygate__lab" for="egPass">كلمة المرور</label>' +
          '<input id="egPass" type="password" inputmode="text" autocomplete="current-password" placeholder="••••••">' +
          '<label class="entrygate__eye"><input type="checkbox" id="egShow"> إظهار الكلمة</label>' +
          '<p class="entrygate__err" id="egErr" hidden>كلمة المرور غير صحيحة</p>' +
          '<p class="entrygate__hint" id="egHint" hidden>إن كنت واثقاً منها: تأكّد من غياب المسافات، أو جرّب تبويباً خاصاً — نسخةٌ محلية قديمة على جهازك قد تُتوقّع كلمةً أخرى. ضبطُ كلمةٍ منشورة موحّدة من اللوحة → «الحفظ والنشر» ينهي ذلك نهائياً.</p>' +
          '<div class="entrygate__btns">' +
            '<button class="btn btn--gold" type="submit">دخول</button>' +
            '<button class="btn btn--line" type="button" id="egBack">رجوع</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.prepend(g);
    document.body.style.overflow = 'hidden';
    const close = (mode) => { currentMode = mode; g.remove(); document.body.style.overflow = ''; applyEntry(); };
    g.querySelector('#egVisitor').addEventListener('click', () => close('visitor'));
    g.querySelector('#egUser').addEventListener('click', () => {
      g.querySelector('#egBtns').hidden = true; g.querySelector('#egForm').hidden = false;
      setTimeout(() => g.querySelector('#egPass').focus(), 60);
    });
    g.querySelector('#egBack').addEventListener('click', () => {
      g.querySelector('#egForm').hidden = true; g.querySelector('#egBtns').hidden = false;
    });
    g.querySelector('#egShow').addEventListener('change', (e) => {
      g.querySelector('#egPass').type = e.target.checked ? 'text' : 'password';
      g.querySelector('#egPass').focus();
    });
    g.querySelector('#egForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = g.querySelector('#egPass').value.trim();
      let hash = (state.data && state.data.site && state.data.site.adminPassHash) || '';
      try {
        const r = await fetch('./data/poems.json?v=' + Date.now(), { cache: 'no-store' });
        if (r.ok) { const pub = await r.json(); if (pub && pub.site && pub.site.adminPassHash) hash = pub.site.adminPassHash; }
      } catch (err) {}
      const legacy = localStorage.getItem('athar-admin-pass') || '';
      let ok = false;
      if (hash) { try { ok = (await sha256(v)) === hash; } catch (err) { ok = false; } }
      else ok = v === 'athar2026';
      if (!ok && legacy && v === legacy) ok = true;
      if (ok) close('user');
      else { g.querySelector('#egErr').hidden = false; g.querySelector('#egHint').hidden = false; }
    });
  }

  /* ---------- الإقلاع ---------- */
  (async function init() {
    const res = await loadData();
    if (!res.json) {
      $('#poemsList').innerHTML = '<div class="empty"><p>تعذّر تحميل <code>data/poems.json</code>.</p></div>';
      return;
    }
    state.data = normalize(res.json); state.raw = res.raw; state.source = res.source;
    if (res.inline) {
      const note = $('#srcNote');
      if (note) {
        note.hidden = false;
        note.innerHTML = 'تُعرض <b>نسخة البيانات المضمّنة</b> لأن المتصفح منع جلب <code>data/poems.json</code> (فتح الملف مباشرة). عند النشر يُقرأ الملف تلقائياً.';
      }
    }
    if (res.source === 'حفظ محلي') {
      (async () => {
        try {
          const r = await fetch('./data/poems.json?v=' + Date.now(), { cache: 'no-store' });
          if (!r.ok) return;
          const pub = await r.json();
          if (!pub || !Array.isArray(pub.poems)) return;
          if (JSON.stringify(pub) === JSON.stringify(window.Athar.getJSON())) return;
          const bar = document.createElement('div');
          bar.className = 'localbar'; bar.setAttribute('role', 'status');
          bar.innerHTML = '<p>هذه <b>نسخة محلية</b> محفوظة على جهازك فقط (' + state.data.poems.length + ' قصيدة) — والمنشور للجميع الآن: <b>' + pub.poems.length + ' قصيدة</b>.</p>' +
            '<button type="button" class="localbar__btn" id="localbarSync">عرض النسخة المنشورة</button>';
          document.body.prepend(bar);
          bar.querySelector('#localbarSync').addEventListener('click', async () => {
            await window.Athar.clearOverride();
            location.reload();
          });
        } catch (e) {}
      })();
    }
    renderAll();
    applyEntry(); showSplash(() => showEntryGate());
    observeReveals(document);
    onScroll();
    focusHash();
  })();
})();
