/* Geopals - home page mock-up: cards and characters as two tabs.
 *
 * Reads the same published globals as the rest of the site, so nothing in the
 * publishing chain changes: publish.ps1 -> data/*.js -> this page.
 *   window.GEOPALS_CARDS   the card register, public rows only
 *   window.GEOPALS_LORE    the lore register, public rows only
 *
 * The holo effect is not implemented here. It lives in assets/js/holo.js and
 * assets/css/holo.css, one copy, shared with the card gallery.
 */
(function () {
  'use strict';

  var CARDS = (window.GEOPALS_CARDS || []).slice();
  var LORE  = (window.GEOPALS_LORE || []).slice();
  var H     = window.GeopalsHolo;

  var REGION_DOT = {
    Volcanic: '#e2603a', Desert: '#d9a05a', Forest: '#4c9b52', Ocean: '#2f7fc4',
    Ice: '#79c4de', Mountain: '#9a8d7d', Mystic: '#b087bb', Shadow: '#6a5b8a'
  };
  function regionColour(r) {
    if (!r) return '#3a4557';
    return REGION_DOT[String(r).split('&')[0].trim()] || '#3a4557';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function numericId(v) { var n = parseInt(String(v), 10); return isNaN(n) ? 9999 : n; }
  function val(row, k) { return String(row[k] == null ? '' : row[k]).trim(); }

  /* ---------- characters ----------
   *
   * There is no character register on the site, so the roster is derived: every
   * published card that carries a characterNumber, collapsed to one row per
   * character, then joined to the lore register by cardId where an entry exists.
   *
   * ⚠ characterNumber is NOT the card id. Card 85 Beakabou is character 43.
   */
  var loreByCard = {};
  LORE.forEach(function (r) {
    if (r.type === 'character' && val(r, 'cardId')) loreByCard[val(r, 'cardId')] = r;
  });

  var CHARS = (function () {
    var seen = {}, out = [];
    CARDS.forEach(function (c) {
      var n = val(c, 'characterNumber');
      if (!n || seen[n]) return;
      seen[n] = true;
      var lore = loreByCard[String(c.id)];
      out.push({
        num: n,
        name: c.name,
        region: c.region,
        stage: c.stage,
        style: c.style,
        rarity: c.rarity,
        illustrator: c.illustrator,
        card: c,
        kind: lore ? val(lore, 'kind') : (val(c, 'style') === 'Chaser' ? 'Chaser' : 'Geopal'),
        role: lore ? val(lore, 'role') : '',
        status: lore ? val(lore, 'status') : '',
        era: lore ? val(lore, 'era') : '',
        aliases: lore ? val(lore, 'aliases') : '',
        summary: lore ? val(lore, 'summary') : '',
        canonNotes: lore ? val(lore, 'canonNotes') : ''
      });
    });
    return out.sort(function (a, b) { return numericId(a.num) - numericId(b.num); });
  }());

  /* ---------- shared bits ---------- */

  function fillSelect(el, label, values) {
    el.innerHTML = '<option value="">' + label + '</option>' +
      values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
  }
  function distinct(rows, key) {
    var seen = {};
    rows.forEach(function (r) { var v = val(r, key); if (v) seen[v] = true; });
    return Object.keys(seen).sort();
  }
  function hay(obj, keys) {
    return keys.map(function (k) { return obj[k] || ''; }).join(' ').toLowerCase();
  }

  var modal = document.getElementById('modal');
  var modalIn = document.getElementById('modal-in');
  function openModal(html) {
    modalIn.innerHTML = html;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }
  document.getElementById('close').addEventListener('click', function () {
    if (typeof modal.close === 'function') modal.close(); else modal.removeAttribute('open');
  });

  function abilityBlock(tag, name, cost, text) {
    if (!name && !text) return '';
    var costHtml = cost ? ' <span class="ability-cost">cost ' + esc(cost) + '</span>' : '';
    return '<div class="ability"><div class="ability-tag">' + tag + '</div>' +
      (name ? '<div class="ability-name">' + esc(name) + costHtml + '</div>' : '') +
      (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
  }
  function statRow(label, value) {
    if (!value) return '';
    return '<tr><th>' + label + '</th><td>' + esc(value) + '</td></tr>';
  }

  /* ---------- tab 1: cards ---------- */

  var cState = { q: '', region: '', type: '', rarity: '', holo: '' };
  var cEls = {
    search: document.getElementById('c-search'), region: document.getElementById('c-region'),
    type: document.getElementById('c-type'), rarity: document.getElementById('c-rarity'),
    holo: document.getElementById('c-holo'), grid: document.getElementById('c-grid'),
    empty: document.getElementById('c-empty'), count: document.getElementById('c-count')
  };
  var CARD_SEARCH = ['name', 'id', 'cardType', 'region', 'style', 'stage', 'illustrator',
                     'passiveName', 'passiveText', 'activeName', 'activeText'];

  function cardMatches(r) {
    if (cState.q && hay(r, CARD_SEARCH).indexOf(cState.q) === -1) return false;
    if (cState.region && val(r, 'region') !== cState.region) return false;
    if (cState.type && val(r, 'cardType') !== cState.type) return false;
    if (cState.rarity && val(r, 'rarity') !== cState.rarity) return false;
    if (cState.holo === 'yes' && !H.isHolo(r)) return false;
    if (cState.holo === 'no' && H.isHolo(r)) return false;
    return true;
  }

  function renderCards() {
    var rows = CARDS.filter(cardMatches).sort(function (a, b) { return numericId(a.id) - numericId(b.id); });
    cEls.grid.innerHTML = '';
    rows.forEach(function (row) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gal-card';
      btn.setAttribute('aria-label', 'Open ' + (row.name || 'card') + ' details');
      btn.innerHTML =
        '<div class="gal-shot">' +
          '<img loading="lazy" alt="' + esc(row.name) + ' card" src="' + esc(row.thumb || row.image) + '">' +
          '<span class="gal-no">' + esc(row.id) + '</span>' +
          (H.isHolo(row) ? '<span class="gal-holo">HOLO</span>' : '') +
        '</div>' +
        '<div class="gal-meta">' +
          '<div class="gal-name">' + esc(row.name) + '</div>' +
          '<div class="gal-sub"><span class="dot" style="background:' + regionColour(row.region) + '"></span>' +
            esc([row.cardType, row.region].filter(Boolean).join(' · ')) + '</div>' +
        '</div>';
      btn.addEventListener('click', function () { openCard(row); });
      H.attachTile(btn, btn.querySelector('.gal-shot'), row, .45);
      cEls.grid.appendChild(btn);
    });
    cEls.empty.hidden = rows.length > 0;
    cEls.count.textContent = rows.length + (rows.length === 1 ? ' card' : ' cards');
  }

  function openCard(row) {
    var pills = '';
    if (row.rarity) pills += '<span class="pill ' + (/^(S|SS|A)$/i.test(row.rarity) ? 'pill-rare' : '') + '">Rarity ' + esc(row.rarity) + '</span>';
    if (H.isHolo(row)) pills += '<span class="pill pill-holo">Holo</span>';
    if (String(row.firstEdition) === 'true') pills += '<span class="pill">1st edition</span>';
    if (row.stage) pills += '<span class="pill">' + esc(row.stage) + '</span>';

    var art = H.isHolo(row)
      ? '<div class="gal-modal-art-wrap" id="holo-host"><img class="holo-still" alt="' +
        esc(row.name) + ' card" src="' + esc(row.image || row.thumb) + '"></div>' +
        '<p class="gal-holo-hint">Move your pointer across the card</p>'
      : '<img class="gal-modal-art" alt="' + esc(row.name) + ' card" src="' + esc(row.image || row.thumb) + '">';

    openModal(
      '<div>' + art + '<div id="char-slot"></div></div>' +
      '<div>' +
        '<h2>' + esc(row.name) + '</h2>' +
        '<p class="gal-modal-kicker"><span class="dot" style="background:' + regionColour(row.region) + '"></span>' +
          esc([row.cardType, row.region].filter(Boolean).join(' · ')) + ' &middot; No. ' + esc(row.id) + '</p>' +
        '<div class="pillbox">' + pills + '</div>' +
        abilityBlock('Ability', row.passiveName, '', row.passiveText) +
        abilityBlock('Active', row.activeName, row.activeCost, row.activeText) +
        '<table class="gal-stats">' +
          statRow('Max stamina', row.maxStamina) + statRow('Style', row.style) +
          statRow('Set', row.setCode && row.setSize ? row.setCode + ' · ' + row.id + '/' + row.setSize : '') +
          statRow('Art type', row.artType) + statRow('Border colour', row.borderColour) +
          statRow('Character no.', row.characterNumber) + statRow('Illustrator', row.illustrator) +
        '</table>' +
      '</div>');

    H.attachDetail(document.getElementById('holo-host'), row, 1);
    showCharacterArt(row.characterNumber, row.name, row.region, document.getElementById('char-slot'));
  }

  /* The burst design, added only once it proves it loads. */
  function showCharacterArt(num, name, region, slot) {
    var n = String(num == null ? '' : num).trim();
    if (!slot || !n) return;
    var src = H.assetUrl('assets/character/' + n + '.jpg');
    var probe = new Image();
    probe.onload = function () {
      if (!slot.isConnected) return;
      slot.innerHTML = '<figure class="gal-char"><div class="gal-char-plate" style="--c:' + regionColour(region) + '">' +
        '<img alt="' + esc(name) + ' character design" src="' + esc(src) + '"></div>' +
        '<figcaption>Character ' + esc(n) + ' &middot; ' + esc(name) + '</figcaption></figure>';
    };
    probe.src = src;
  }

  /* ---------- tab 2: characters ---------- */

  var hState = { q: '', region: '', kind: '', stage: '' };
  var hEls = {
    search: document.getElementById('h-search'), region: document.getElementById('h-region'),
    kind: document.getElementById('h-kind'), stage: document.getElementById('h-stage'),
    grid: document.getElementById('h-grid'), empty: document.getElementById('h-empty'),
    count: document.getElementById('h-count')
  };
  var CHAR_SEARCH = ['name', 'num', 'region', 'kind', 'role', 'status', 'era', 'aliases', 'summary', 'illustrator'];

  function charMatches(c) {
    if (hState.q && hay(c, CHAR_SEARCH).indexOf(hState.q) === -1) return false;
    if (hState.region && val(c, 'region') !== hState.region) return false;
    if (hState.kind && val(c, 'kind') !== hState.kind) return false;
    if (hState.stage && val(c, 'stage') !== hState.stage) return false;
    return true;
  }

  function renderChars() {
    var rows = CHARS.filter(charMatches);
    hEls.grid.innerHTML = '';
    rows.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'char-card';
      btn.setAttribute('aria-label', 'Open ' + c.name + ' details');
      btn.innerHTML =
        '<div class="char-plate" style="--c:' + regionColour(c.region) + '">' +
          '<span class="char-no">' + esc(c.num) + '</span>' +
          (c.kind && c.kind !== 'Geopal' ? '<span class="char-kind">' + esc(c.kind.toUpperCase()) + '</span>' : '') +
          '<img loading="lazy" alt="' + esc(c.name) + ' character design" src="assets/character/' + esc(c.num) + '.jpg">' +
        '</div>' +
        '<div class="char-meta"><div class="char-name">' + esc(c.name) + '</div>' +
          '<div class="char-sub"><span class="dot" style="background:' + regionColour(c.region) + '"></span>' +
            esc(c.region || '—') + '</div></div>';
      btn.addEventListener('click', function () { openChar(c); });
      hEls.grid.appendChild(btn);
    });
    hEls.empty.hidden = rows.length > 0;
    hEls.count.textContent = rows.length + (rows.length === 1 ? ' character' : ' characters');
  }

  function openChar(c) {
    var col = regionColour(c.region);
    var pills = '';
    if (c.region) pills += '<span class="pill">' + esc(c.region) + '</span>';
    if (c.kind) pills += '<span class="pill">' + esc(c.kind) + '</span>';
    if (c.stage) pills += '<span class="pill">' + esc(c.stage) + '</span>';
    if (c.style) pills += '<span class="pill">' + esc(c.style) + '</span>';
    if (c.status) pills += '<span class="pill">' + esc(c.status) + '</span>';

    /* Only 14 characters have a lore entry. Say so rather than padding it out:
       an admitted gap beats a guess that reads like canon. */
    var lore = c.summary
      ? '<div class="lore-block" style="--c:' + col + '"><div class="tag">Lore' +
          (c.role ? ' · ' + esc(c.role) : '') + '</div><p>' + esc(c.summary) + '</p>' +
          (c.canonNotes ? '<p><strong>Canon:</strong> ' + esc(c.canonNotes) + '</p>' : '') + '</div>'
      : '<div class="lore-block" style="--c:' + col + '"><div class="tag">Lore</div>' +
          '<p class="gap-note">No entry written yet.</p></div>';

    openModal(
      '<div><div class="char-plate" style="--c:' + col + '">' +
        '<img alt="' + esc(c.name) + ' character design" src="assets/character/' + esc(c.num) + '.jpg"></div></div>' +
      '<div>' +
        '<h2>' + esc(c.name) + '</h2>' +
        '<p class="gal-modal-kicker"><span class="dot" style="background:' + col + '"></span>' +
          'Character ' + esc(c.num) + (c.card ? ' &middot; card ' + esc(c.card.id) : '') + '</p>' +
        '<div class="pillbox">' + pills + '</div>' +
        lore +
        (c.card ? abilityBlock('Ability', c.card.passiveName, '', c.card.passiveText) +
                  abilityBlock('Active', c.card.activeName, c.card.activeCost, c.card.activeText) : '') +
        '<table class="gal-stats">' +
          statRow('Aliases', c.aliases) + statRow('Era', c.era) +
          statRow('Rarity', c.rarity) + statRow('Illustrator', c.illustrator) +
        '</table>' +
      '</div>');
  }

  /* ---------- tabs ---------- */

  var tabs = [
    { btn: document.getElementById('tab-cards'), panel: document.getElementById('panel-cards'), hash: '#cards' },
    { btn: document.getElementById('tab-chars'), panel: document.getElementById('panel-chars'), hash: '#characters' }
  ];
  function selectTab(i, push) {
    tabs.forEach(function (t, j) {
      t.btn.setAttribute('aria-selected', j === i ? 'true' : 'false');
      t.panel.hidden = j !== i;
    });
    if (push && window.history && history.replaceState) history.replaceState(null, '', tabs[i].hash);
  }
  tabs.forEach(function (t, i) { t.btn.addEventListener('click', function () { selectTab(i, true); }); });

  /* ---------- start ---------- */

  fillSelect(cEls.region, 'All regions', distinct(CARDS, 'region'));
  fillSelect(cEls.type, 'All types', distinct(CARDS, 'cardType'));
  fillSelect(cEls.rarity, 'All rarities', distinct(CARDS, 'rarity'));
  fillSelect(hEls.region, 'All regions', distinct(CHARS, 'region'));
  fillSelect(hEls.kind, 'All kinds', distinct(CHARS, 'kind'));
  fillSelect(hEls.stage, 'All stages', distinct(CHARS, 'stage'));

  [['search', 'q'], ['region', 'region'], ['type', 'type'], ['rarity', 'rarity'], ['holo', 'holo']].forEach(function (p) {
    var el = cEls[p[0]];
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', function () {
      cState[p[1]] = el.tagName === 'INPUT' ? el.value.trim().toLowerCase() : el.value;
      renderCards();
    });
  });
  [['search', 'q'], ['region', 'region'], ['kind', 'kind'], ['stage', 'stage']].forEach(function (p) {
    var el = hEls[p[0]];
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', function () {
      hState[p[1]] = el.tagName === 'INPUT' ? el.value.trim().toLowerCase() : el.value;
      renderChars();
    });
  });

  document.getElementById('n-cards').textContent = CARDS.length;
  document.getElementById('n-chars').textContent = CHARS.length;

  var holoCount = CARDS.filter(H.isHolo).length;
  var regions = distinct(CARDS, 'region').filter(function (r) { return r.indexOf('&') === -1; }).length;
  document.getElementById('stats').innerHTML =
    '<div><b>' + CARDS.length + '</b><span>Cards in the set</span></div>' +
    '<div><b>' + holoCount + '</b><span>Holo</span></div>' +
    '<div><b>' + CHARS.length + '</b><span>Characters</span></div>' +
    '<div><b>' + regions + '</b><span>Regions</span></div>';

  renderCards();
  renderChars();
  selectTab(location.hash === '#characters' ? 1 : 0, false);
}());
