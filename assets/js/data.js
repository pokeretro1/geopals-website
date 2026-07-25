/* Geopals — data layer.
 *
 * Every database on this site loads through here, so the UI never needs to know
 * where the rows actually came from. Three sources are supported:
 *
 *   { kind: 'global', name: 'GEOPALS_CARDS' }   read an array already on the page
 *                                               (loaded by a <script> tag — works
 *                                               with no web server, even file://)
 *   { kind: 'json',   url: 'data/cards.json' }  fetch JSON (needs http/https)
 *   { kind: 'csv',    url: '...pub?output=csv' } fetch a published Google Sheet
 *
 * Switching a dataset from a hand-maintained file to a live Google Sheet is a
 * one-line change to its `source` — no UI code moves.
 */
window.GeopalsData = (function () {
  'use strict';

  var datasets = {};

  /** Register a dataset. `fields` is optional metadata used by the UI. */
  function register(name, config) {
    datasets[name] = config;
  }

  /** Load a registered dataset. Returns a Promise for an array of plain objects. */
  function load(name) {
    var config = datasets[name];
    if (!config) return Promise.reject(new Error('Unknown dataset: ' + name));
    var src = config.source;

    if (src.kind === 'global') {
      var rows = window[src.name];
      if (!Array.isArray(rows)) {
        return Promise.reject(new Error(
          'Expected window.' + src.name + ' to be an array. Is data/*.js loaded before this script?'
        ));
      }
      return Promise.resolve(rows.slice());
    }

    if (src.kind === 'json') {
      return fetch(src.url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + src.url);
        return r.json();
      });
    }

    if (src.kind === 'csv') {
      return fetch(src.url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + src.url);
        return r.text();
      }).then(parseCsv);
    }

    return Promise.reject(new Error('Unknown source kind: ' + src.kind));
  }

  /* ---- CSV -------------------------------------------------------------- */

  /* Small RFC-4180-ish parser: handles quoted fields, embedded commas,
     doubled quotes and CRLF. First row is treated as the header. */
  function parseCsv(text) {
    var rows = [], row = [], field = '', inQuotes = false, i = 0;
    text = text.replace(/^﻿/, '');           // strip BOM

    while (i < text.length) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);

    if (!rows.length) return [];
    var header = rows.shift().map(function (h) { return h.trim(); });
    return rows.map(function (cells) {
      var obj = {};
      header.forEach(function (key, idx) {
        if (key) obj[key] = (cells[idx] || '').trim();
      });
      return obj;
    });
  }

  /* ---- images ----------------------------------------------------------- */

  /* Card art lives in Google Drive. A Drive *share link* will not render in an
     <img> tag; the file id pulled out of it will, via the lh3 host below —
     which also takes a width, so the grid doesn't download full-size art.
     Accepts a full share URL or a bare file id. */
  function driveImageUrl(idOrUrl, width) {
    if (!idOrUrl) return '';
    var id = String(idOrUrl).trim();
    var m = id.match(/\/d\/([A-Za-z0-9_-]{20,})/) ||        // .../file/d/<id>/view
            id.match(/[?&]id=([A-Za-z0-9_-]{20,})/);        // ...open?id=<id>
    if (m) id = m[1];
    if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) return '';
    return 'https://lh3.googleusercontent.com/d/' + id + (width ? '=w' + width : '');
  }

  /* Best available image for a row, in order of preference:
       1. the web-sized JPEGs built into this repo (fast, cached, free)
       2. an explicit URL on the row
       3. a Google Drive file id
     Card art is built by the command centre's build-images.ps1 into two sizes;
     anything at or below 500px wide gets the thumbnail. */
  function imageUrl(row, width) {
    if (width && width <= 500 && row.thumb) return row.thumb;
    if (row.image) return row.image;
    if (row.thumb) return row.thumb;
    if (row.imageUrl) return row.imageUrl;
    return driveImageUrl(row.driveFileId || '', width);
  }

  return {
    register: register,
    load: load,
    parseCsv: parseCsv,
    driveImageUrl: driveImageUrl,
    imageUrl: imageUrl
  };
})();
