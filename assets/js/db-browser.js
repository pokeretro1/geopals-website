/* Geopals — generic database browser.
 *
 * Renders a search box, auto-generated filter dropdowns, a sort control and a
 * result grid for ANY dataset registered with GeopalsData. Adding a second
 * database to the site means: a new HTML page + a config object like the one
 * at the bottom of cards.js. No changes in here.
 *
 * Config:
 *   dataset      name registered with GeopalsData.register()
 *   searchFields fields matched by the search box
 *   facets       fields turned into dropdowns (auto-detected if omitted)
 *   title        field used as the tile heading
 *   subtitle     function(row) -> string under the heading
 *   image        true to show artwork on tiles
 *   detail       [[label, field|function], ...] rows in the detail dialog
 */
window.DbBrowser = (function () {
  'use strict';

  var MAX_FACET_VALUES = 40;   // above this a field is free text, not a category

  function start(cfg) {
    var els = {
      search:  document.getElementById('search'),
      filters: document.getElementById('filters'),
      sort:    document.getElementById('sort'),
      reset:   document.getElementById('reset'),
      count:   document.getElementById('count'),
      results: document.getElementById('results'),
      empty:   document.getElementById('empty'),
      dialog:  document.getElementById('detail'),
      dbody:   document.getElementById('detail-body'),
      dclose:  document.getElementById('detail-close')
    };

    var all = [], active = {}, searchTerm = '';

    GeopalsData.load(cfg.dataset).then(function (rows) {
      all = rows;
      buildFacets(rows);
      render();
    }).catch(function (err) {
      els.results.innerHTML = '';
      els.empty.hidden = false;
      els.empty.textContent = 'Could not load the data: ' + err.message;
      console.error(err);
    });

    /* ---- filters ---------------------------------------------------------- */

    function buildFacets(rows) {
      var fields = cfg.facets || detectFacets(rows);
      els.filters.innerHTML = '';

      fields.forEach(function (field) {
        var values = unique(rows, field);
        if (values.length < 2) return;         // a one-value dropdown filters nothing

        var label = document.createElement('label');
        label.textContent = humanize(field);

        var select = document.createElement('select');
        select.innerHTML = '<option value="">All</option>';
        values.forEach(function (v) {
          var opt = document.createElement('option');
          opt.value = v; opt.textContent = v;
          select.appendChild(opt);
        });
        select.addEventListener('change', function () {
          if (select.value) active[field] = select.value; else delete active[field];
          render();
        });

        label.appendChild(select);
        els.filters.appendChild(label);
      });
    }

    /* A field is a facet if it's a short string that repeats — i.e. a category
       rather than a description or a unique id. */
    function detectFacets(rows) {
      if (!rows.length) return [];
      return Object.keys(rows[0]).filter(function (field) {
        if (/^(id|name|title|description|text|flavour|flavor|notes|image|imageUrl|driveFileId)$/i.test(field)) return false;
        var values = unique(rows, field);
        if (!values.length || values.length > MAX_FACET_VALUES) return false;
        if (values.length === rows.length) return false;              // unique per row
        return values.every(function (v) { return v.length <= 40; });
      });
    }

    function unique(rows, field) {
      var seen = {};
      rows.forEach(function (r) {
        var v = r[field];
        if (v !== undefined && v !== null && String(v).trim() !== '') seen[String(v).trim()] = true;
      });
      return Object.keys(seen).sort(collate);
    }

    /* ---- filtering + sorting --------------------------------------------- */

    function matches(row) {
      for (var field in active) {
        if (String(row[field] || '').trim() !== active[field]) return false;
      }
      if (!searchTerm) return true;
      var fields = cfg.searchFields || Object.keys(row);
      return fields.some(function (f) {
        return String(row[f] || '').toLowerCase().indexOf(searchTerm) !== -1;
      });
    }

    function sorted(rows) {
      var parts = (els.sort ? els.sort.value : 'name-asc').split('-');
      var field = parts[0] === 'name' ? (cfg.title || 'name') : parts[0];
      var dir = parts[1] === 'desc' ? -1 : 1;
      return rows.slice().sort(function (a, b) {
        return collate(String(a[field] || ''), String(b[field] || '')) * dir;
      });
    }

    function collate(a, b) {
      return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
    }

    /* ---- rendering -------------------------------------------------------- */

    function render() {
      var rows = sorted(all.filter(matches));
      els.results.innerHTML = '';
      els.empty.hidden = rows.length > 0;
      var noun = cfg.noun || 'result';
      els.count.textContent = rows.length + ' ' + (rows.length === 1 ? noun : noun + 's') +
                              (rows.length !== all.length ? ' of ' + all.length : '');

      var frag = document.createDocumentFragment();
      rows.forEach(function (row) { frag.appendChild(tile(row)); });
      els.results.appendChild(frag);
    }

    function tile(row) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-tile';

      if (cfg.image !== false) {
        var img = document.createElement('img');
        img.className = 'card-img';
        img.loading = 'lazy';
        img.alt = String(row[cfg.title] || 'Card artwork');
        img.src = GeopalsData.imageUrl(row, 400) || 'assets/img/card-placeholder.svg';
        img.addEventListener('error', function () { img.src = 'assets/img/card-placeholder.svg'; });
        btn.appendChild(img);
      }

      var meta = document.createElement('div');
      meta.className = 'card-meta';

      var name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = row[cfg.title] || 'Untitled';
      meta.appendChild(name);

      var sub = document.createElement('div');
      sub.className = 'card-sub';
      if (cfg.subtitle) {
        sub.innerHTML = cfg.subtitle(row);
      } else {
        sub.textContent = row.set || '';
      }
      meta.appendChild(sub);

      btn.appendChild(meta);
      btn.addEventListener('click', function () { openDetail(row); });
      return btn;
    }

    function openDetail(row) {
      els.dbody.innerHTML = '';

      if (cfg.image !== false) {
        var img = document.createElement('img');
        img.alt = String(row[cfg.title] || '');
        img.src = GeopalsData.imageUrl(row, 800) || 'assets/img/card-placeholder.svg';
        img.addEventListener('error', function () { img.src = 'assets/img/card-placeholder.svg'; });
        els.dbody.appendChild(img);
      }

      var col = document.createElement('div');
      var h = document.createElement('h2');
      h.textContent = row[cfg.title] || 'Untitled';
      col.appendChild(h);

      var desc = cfg.description ? cfg.description(row) : row.description;
      if (desc) {
        var p = document.createElement('p');
        p.className = 'muted';
        p.textContent = desc;
        col.appendChild(p);
      }

      var dl = document.createElement('dl');
      (cfg.detail || []).forEach(function (pair) {
        var value = typeof pair[1] === 'function' ? pair[1](row) : row[pair[1]];
        if (value === undefined || value === null || String(value).trim() === '') return;
        var dt = document.createElement('dt'); dt.textContent = pair[0];
        var dd = document.createElement('dd'); dd.textContent = value;
        dl.appendChild(dt); dl.appendChild(dd);
      });
      col.appendChild(dl);
      els.dbody.appendChild(col);

      els.dialog.showModal();
    }

    /* ---- wiring ----------------------------------------------------------- */

    var debounce;
    els.search.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        searchTerm = els.search.value.trim().toLowerCase();
        render();
      }, 120);
    });

    if (els.sort) els.sort.addEventListener('change', render);

    els.reset.addEventListener('click', function () {
      active = {}; searchTerm = ''; els.search.value = '';
      els.filters.querySelectorAll('select').forEach(function (s) { s.value = ''; });
      render();
    });

    els.dclose.addEventListener('click', function () { els.dialog.close(); });
    els.dialog.addEventListener('click', function (e) {
      if (e.target === els.dialog) els.dialog.close();   // click the backdrop to dismiss
    });
  }

  function humanize(field) {
    return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  }

  return { start: start };
})();
