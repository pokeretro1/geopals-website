/* Geopals - the Cards database.
 *
 * This whole file is configuration. Everything it does is implemented in
 * db-browser.js, so a second database (regions, sets, tournaments, stockists)
 * is a copy of cards.html plus a file that looks like this one.
 *
 * The fields below mirror the "Data Base" sheet of Geopals_Final.xlsx. That
 * spreadsheet is the master; data/cards.js is generated from it by
 * tools/import-xlsx.ps1 in the command centre repo.
 */

GeopalsData.register('cards', {
  /* Rows are loaded by the <script src="data/cards.js"> tag on the page, so
     the site works with no web server. To drive it from a published Google
     Sheet instead, swap this for:
        source: { kind: 'csv', url: 'https://docs.google.com/.../pub?output=csv' }
     and drop that <script> tag. Nothing else changes. */
  source: { kind: 'global', name: 'GEOPALS_CARDS' }
});

DbBrowser.start({
  dataset: 'cards',
  noun: 'card',
  title: 'name',
  image: true,

  /* Ability text is searchable on purpose - players look for effects
     ("move forward", "berry") far more than they look for card names. */
  searchFields: [
    'name', 'id', 'cardType', 'region', 'style', 'stage', 'illustrator',
    'passiveName', 'passiveText', 'activeName', 'activeText'
  ],

  facets: ['cardType', 'region', 'rarity', 'stage', 'style', 'holo', 'illustrator'],

  subtitle: function (row) {
    var rarity = String(row.rarity || '');
    var cls = /^(S|A|Infinity)$/i.test(rarity) ? 'pill pill-rare' : 'pill pill-common';
    var out = '';
    if (rarity) out += '<span class="' + cls + '">' + rarity + '</span>';
    if (row.holo) out += '<span class="pill pill-holo">Holo</span>';
    out += (row.cardType || '');
    if (row.region) out += ' &middot; ' + row.region;
    return out;
  },

  /* Shown as a paragraph above the field table in the detail dialog. */
  description: function (row) {
    if (row.activeText) return row.activeText;
    return row.passiveText || '';
  },

  detail: [
    ['Card no.',    'id'],
    ['Type',        'cardType'],
    ['Region',      'region'],
    ['Rarity',      'rarity'],
    ['Stage',       'stage'],
    ['Style',       'style'],
    ['Max stamina', 'maxStamina'],
    ['Passive', function (r) {
      if (!r.passiveName && !r.passiveText) return '';
      return r.passiveName ? r.passiveName + ' — ' + r.passiveText : r.passiveText;
    }],
    ['Active', function (r) {
      if (!r.activeName && !r.activeText) return '';
      var cost = r.activeCost ? ' (cost ' + r.activeCost + ')' : '';
      return r.activeName ? r.activeName + cost + ' — ' + r.activeText : r.activeText;
    }],
    ['Art style',   'artType'],
    ['Border',      'borderColour'],
    ['Illustrator', 'illustrator']
  ]
});
