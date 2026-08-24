/* Geopals - card gallery.
 *
 * Leads with the card artwork rather than a data table. Reads the same
 * window.GEOPALS_CARDS that data/cards.js defines, so nothing else in the
 * publishing chain changes: publish.ps1 -> data/cards.js -> this page.
 *
 * Deliberately dependency-free and ES5-ish, to match the rest of the site and
 * to keep working on GitHub Pages with no build step.
 */
(function () {
  'use strict';

  var ROWS = (window.GEOPALS_CARDS || []).slice();

  /* Region accent colours. Mirrors the printed cards; a combined region
     ("Ocean & Ice") falls back to the first one named. */
  var REGION_DOT = {
    Volcanic: '#e2603a',
    Desert:   '#d9a05a',
    Forest:   '#4c9b52',
    Ocean:    '#2f7fc4',
    Ice:      '#79c4de',
    Mountain: '#9a8d7d',
    Mystic:   '#b087bb',
    Shadow:   '#6a5b8a'
  };
  function regionColour(region) {
    if (!region) return '#3a4557';
    var first = String(region).split('&')[0].trim();
    return REGION_DOT[first] || '#3a4557';
  }

  var FACETS = [
    ['cardType', 'Type'],
    ['region',   'Region'],
    ['rarity',   'Rarity'],
    ['stage',    'Stage'],
    ['style',    'Style']
  ];

  var SEARCH_FIELDS = [
    'name', 'id', 'cardType', 'region', 'style', 'stage', 'illustrator',
    'passiveName', 'passiveText', 'activeName', 'activeText'
  ];

  var RARITY_ORDER = { C: 0, B: 1, A: 2, S: 3, SS: 4, Infinity: 5 };

  var els = {
    search:  document.getElementById('search'),
    filters: document.getElementById('filters'),
    sort:    document.getElementById('sort'),
    clear:   document.getElementById('clear'),
    count:   document.getElementById('count'),
    grid:    document.getElementById('grid'),
    empty:   document.getElementById('empty'),
    modal:   document.getElementById('modal'),
    modalIn: document.getElementById('modal-in')
  };

  var state = { q: '', facet: {}, sort: 'id-asc' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function numericId(v) {
    var n = parseInt(String(v), 10);
    return isNaN(n) ? 9999 : n;
  }

  /* ---------- holo ----------
   * Implemented once in assets/js/holo.js and shared with the home page, so the
   * recipe cannot drift into two versions. Loaded before this file.
   */
  var H = window.GeopalsHolo;
  function isHolo(row) { return H.isHolo(row); }

  /* ---------- filters ---------- */

  function buildFilters() {
    FACETS.forEach(function (f) {
      var field = f[0], label = f[1];
      var seen = {};
      ROWS.forEach(function (r) { if (r[field]) seen[r[field]] = true; });
      var values = Object.keys(seen).sort();
      if (!values.length) return;

      var wrap = document.createElement('label');
      wrap.appendChild(document.createTextNode(label));
      var sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Filter by ' + label.toLowerCase());
      sel.innerHTML = '<option value="">All</option>' +
        values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
      sel.addEventListener('change', function () {
        state.facet[field] = sel.value;
        render();
      });
      wrap.appendChild(sel);
      els.filters.appendChild(wrap);
    });

    /* Holo is a yes/no, not a list. */
    var hw = document.createElement('label');
    hw.appendChild(document.createTextNode('Holo'));
    var hs = document.createElement('select');
    hs.setAttribute('aria-label', 'Filter by holo');
    hs.innerHTML = '<option value="">All</option><option value="yes">Holo only</option><option value="no">Non-holo</option>';
    hs.addEventListener('change', function () { state.facet.__holo = hs.value; render(); });
    hw.appendChild(hs);
    els.filters.appendChild(hw);
  }

  function matches(row) {
    if (state.q) {
      var hay = SEARCH_FIELDS.map(function (f) { return row[f] || ''; }).join(' ').toLowerCase();
      if (hay.indexOf(state.q) === -1) return false;
    }
    for (var k in state.facet) {
      if (!state.facet[k]) continue;
      if (k === '__holo') {
        var isHolo = !!String(row.holo || '').trim();
        if (state.facet.__holo === 'yes' && !isHolo) return false;
        if (state.facet.__holo === 'no' && isHolo) return false;
        continue;
      }
      if (String(row[k] || '') !== state.facet[k]) return false;
    }
    return true;
  }

  function sortRows(rows) {
    var s = state.sort;
    return rows.sort(function (a, b) {
      if (s === 'name-asc')  return String(a.name).localeCompare(String(b.name));
      if (s === 'name-desc') return String(b.name).localeCompare(String(a.name));
      if (s === 'rarity-desc') {
        var ra = RARITY_ORDER[a.rarity] == null ? -1 : RARITY_ORDER[a.rarity];
        var rb = RARITY_ORDER[b.rarity] == null ? -1 : RARITY_ORDER[b.rarity];
        if (ra !== rb) return rb - ra;
      }
      if (s === 'region-asc') {
        var c = String(a.region || '').localeCompare(String(b.region || ''));
        if (c) return c;
      }
      return numericId(a.id) - numericId(b.id);
    });
  }

  /* ---------- gallery ---------- */

  function tile(row) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gal-card';
    btn.setAttribute('aria-label', 'Open ' + (row.name || 'card') + ' details');

    var holo = String(row.holo || '').trim() ? '<span class="gal-holo">HOLO</span>' : '';
    var sub = [row.cardType, row.region].filter(Boolean).join(' · ');

    btn.innerHTML =
      '<div class="gal-shot">' +
        '<img loading="lazy" alt="' + esc(row.name) + ' card" src="' + esc(row.thumb || row.image) + '">' +
        '<span class="gal-no">' + esc(row.id) + '</span>' + holo +
      '</div>' +
      '<div class="gal-meta">' +
        '<div class="gal-name">' + esc(row.name) + '</div>' +
        '<div class="gal-sub"><span class="dot" style="background:' + regionColour(row.region) + '"></span>' + esc(sub) + '</div>' +
      '</div>';

    btn.addEventListener('click', function () { openCard(row); });

    /* Tiles stay still until touched. Ninety-three animating at once costs
       battery and scroll smoothness and gains nothing, because a viewer can
       only look at one card. It also means the assets load for the card being
       hovered rather than all thirty-three up front. */
    H.attachTile(btn, btn.querySelector('.gal-shot'), row, .45);

    return btn;
  }

  function render() {
    var rows = sortRows(ROWS.filter(matches));
    els.grid.innerHTML = '';
    rows.forEach(function (r) { els.grid.appendChild(tile(r)); });
    els.empty.hidden = rows.length > 0;
    els.count.textContent = rows.length + (rows.length === 1 ? ' card' : ' cards');
  }

  /* ---------- detail ---------- */

  function abilityBlock(tag, name, cost, text) {
    if (!name && !text) return '';
    var costHtml = cost ? ' <span class="ability-cost">cost ' + esc(cost) + '</span>' : '';
    return '<div class="ability">' +
      '<div class="ability-tag">' + tag + '</div>' +
      (name ? '<div class="ability-name">' + esc(name) + costHtml + '</div>' : '') +
      (text ? '<p>' + esc(text) + '</p>' : '') +
      '</div>';
  }

  function statRow(label, value) {
    if (!value) return '';
    return '<tr><th>' + label + '</th><td>' + esc(value) + '</td></tr>';
  }

  /* The character's burst artwork, where one exists.
   *
   * ⚠ characterNumber is NOT the card id. Card 85 Beakabou is character 43.
   * The register's characterImage column is a Drive path with spaces in it and
   * is no use as a URL, so the file is addressed by number instead.
   *
   * Only 48 of the 103 cards are characters at all, and not every one has a
   * design filed, so the block is added after the image proves it loads rather
   * than being written into the markup and left broken. */
  function showCharacter(row, slot) {
    if (!slot) return;
    var n = String(row.characterNumber == null ? '' : row.characterNumber).trim();
    if (!n) return;

    var src = H.assetUrl('assets/character/' + n + '.jpg');
    var probe = new Image();
    probe.onload = function () {
      if (!slot.isConnected) return;
      slot.innerHTML =
        '<figure class="gal-char">' +
          '<div class="gal-char-plate" style="--c:' + regionColour(row.region) + '">' +
            '<img alt="' + esc(row.name) + ' character design" src="' + esc(src) + '">' +
          '</div>' +
          '<figcaption>Character ' + esc(n) + ' &middot; ' + esc(row.name) + '</figcaption>' +
        '</figure>';
    };
    probe.src = src;
  }

  function openCard(row) {
    var pills = '';
    if (row.rarity) {
      var rare = /^(S|SS|A|Infinity)$/i.test(row.rarity);
      pills += '<span class="pill ' + (rare ? 'pill-rare' : '') + '">Rarity ' + esc(row.rarity) + '</span>';
    }
    if (String(row.holo || '').trim()) pills += '<span class="pill pill-holo">Holo</span>';
    if (String(row.firstEdition) === 'true') pills += '<span class="pill">1st edition</span>';
    if (row.stage) pills += '<span class="pill">' + esc(row.stage) + '</span>';

    var kicker = [row.cardType, row.region].filter(Boolean).join(' · ');

    /* The still frame is always laid down first. The effect is built on top of
       it only once its own assets have loaded, so a missing mask degrades to
       exactly the picture the site ships today. */
    var art = isHolo(row)
      ? '<div class="gal-modal-art-wrap" id="holo-host">' +
          '<img class="holo-still" alt="' + esc(row.name) + ' card" src="' + esc(row.image || row.thumb) + '">' +
        '</div><p class="gal-holo-hint">Move your pointer across the card</p>'
      : '<img class="gal-modal-art" alt="' + esc(row.name) + ' card" src="' + esc(row.image || row.thumb) + '">';

    els.modalIn.innerHTML =
      '<div>' + art + '<div id="char-slot"></div></div>' +
      '<div>' +
        '<h2>' + esc(row.name) + '</h2>' +
        '<p class="gal-modal-kicker"><span class="dot" style="background:' + regionColour(row.region) + '"></span>' +
          esc(kicker) + ' &middot; No. ' + esc(row.id) + '</p>' +
        '<div class="pillbox">' + pills + '</div>' +
        abilityBlock('Ability', row.passiveName, '', row.passiveText) +
        abilityBlock('Active', row.activeName, row.activeCost, row.activeText) +
        '<table class="gal-stats">' +
          statRow('Max stamina', row.maxStamina) +
          statRow('Style', row.style) +
          statRow('Set', row.setCode && row.setSize ? row.setCode + ' · ' + row.id + '/' + row.setSize : '') +
          statRow('Art type', row.artType) +
          statRow('Border colour', row.borderColour) +
          statRow('Character no.', row.characterNumber) +
          statRow('Illustrator', row.illustrator) +
        '</table>' +
      '</div>';

    H.attachDetail(document.getElementById('holo-host'), row, 1);

    showCharacter(row, document.getElementById('char-slot'));

    if (typeof els.modal.showModal === 'function') els.modal.showModal();
    else els.modal.setAttribute('open', '');
  }

  /* ---------- wiring ---------- */

  function start() {
    if (!ROWS.length) {
      els.empty.hidden = false;
      els.empty.textContent = 'No card data loaded.';
      return;
    }
    buildFilters();

    var t;
    els.search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = els.search.value.trim().toLowerCase(); render(); }, 120);
    });
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); });
    els.clear.addEventListener('click', function () {
      state.q = ''; state.facet = {}; state.sort = 'id-asc';
      els.search.value = '';
      els.sort.value = 'id-asc';
      Array.prototype.forEach.call(els.filters.querySelectorAll('select'), function (s) { s.value = ''; });
      render();
    });
    els.modal.addEventListener('click', function (e) {
      if (e.target === els.modal) els.modal.close();
    });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('gal-close')) els.modal.close();
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
