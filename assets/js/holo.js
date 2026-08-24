/* Geopals - the animated holo, shared.
 *
 * The look is specified by
 * knowledge/process/core/card-template/tools/holo-masks.md, section
 * "Animating the holo on screen", and the values live in assets/css/holo.css.
 * This file only decides WHEN to build the layers and how they follow the
 * pointer. It is deliberately the only copy: two copies of a recipe is how the
 * recipe starts disagreeing with itself.
 *
 * Dependency-free and ES5-ish, to match the rest of the site.
 */
window.GeopalsHolo = (function () {
  'use strict';

  var PATTERN = 'assets/img/cosmos-holo.jpg';
  var state = {};   /* card id -> 'ok' | 'no' | 'pending' */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ⚠ Any URL handed to CSS through a custom property MUST be absolute.
     A relative url() inside a custom property is resolved against the
     STYLESHEET that reads it, not against the page, so 'assets/...' becomes
     'assets/css/assets/...' and 404s. The failure is silent and total: a
     mask-image that will not load masks the element away completely, so every
     effect layer disappears at once and the card falls back to looking plain.
     Cost an hour on 2026-08-08. */
  function assetUrl(path) {
    try { return new URL(path, document.baseURI).href; }
    catch (e) { return path; }
  }

  /* If the browser cannot mask, the layers would render across the whole card,
     over the character and the ability text. Worse than no effect. */
  var CAN_MASK = (function () {
    if (typeof CSS === 'undefined' || !CSS.supports) return false;
    return CSS.supports('mask-image', 'url(a.png)') ||
           CSS.supports('-webkit-mask-image', 'url(a.png)');
  }());

  function isHolo(row) { return !!String(row.holo || '').trim(); }
  function maskPath(row) { return 'assets/cards/holo-mask/Card_' + row.id + '.png'; }
  function flatPath(row) { return 'assets/cards/flat/Card_' + row.id + '.jpg'; }

  /* There is no published field saying which masks exist, so find out by loading
     one. A card without a mask keeps its still picture and we never ask again.
     "Detect and report, never block", applied to a missing asset. */
  function ready(row, done) {
    var id = row.id;
    if (!CAN_MASK) { done(false); return; }
    if (state[id] === 'ok') { done(true); return; }
    if (state[id] === 'no') { done(false); return; }
    state[id] = 'pending';
    var pending = 2, failed = false;
    function settle(ok) {
      if (!ok) failed = true;
      if (--pending) return;
      state[id] = failed ? 'no' : 'ok';
      done(!failed);
    }
    var m = new Image(); m.onload = function () { settle(true); }; m.onerror = function () { settle(false); };
    var f = new Image(); f.onload = function () { settle(true); }; f.onerror = function () { settle(false); };
    m.src = maskPath(row);
    f.src = flatPath(row);
  }

  function buildStack(row, parScale) {
    var stack = document.createElement('div');
    stack.className = 'holo-stack';
    stack.style.setProperty('--m', 'url("' + assetUrl(maskPath(row)) + '")');
    stack.style.setProperty('--pat', 'url("' + assetUrl(PATTERN) + '")');
    stack.style.setProperty('--par', String(parScale));
    stack.innerHTML =
      '<img class="holo-base" alt="" src="' + esc(flatPath(row)) + '">' +
      '<div class="holo-fx holo-cosmos"></div>' +
      '<div class="holo-fx holo-glint"></div>' +
      '<div class="holo-fx holo-spec"></div>' +
      '<div class="holo-fx holo-glare"></div>';
    return stack;
  }

  /* Tilting a real foil card slides the pattern against the artwork, and the two
     depths slide by different amounts. That disagreement is the whole illusion
     of depth, so both are driven off the pointer. */
  function trackTilt(host, stack) {
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      stack.style.setProperty('--ry', ((px - .5) * 24).toFixed(2) + 'deg');
      stack.style.setProperty('--rx', ((py - .5) * -18).toFixed(2) + 'deg');
      stack.style.setProperty('--px', (px * 100).toFixed(1) + '%');
      stack.style.setProperty('--py', (py * 100).toFixed(1) + '%');
      stack.style.setProperty('--parx', ((px - .5) * -44).toFixed(1) + 'px');
      stack.style.setProperty('--pary', ((py - .5) * -34).toFixed(1) + 'px');
      stack.style.setProperty('--parx2', ((px - .5) * 70).toFixed(1) + 'px');
      stack.style.setProperty('--pary2', ((py - .5) * 54).toFixed(1) + 'px');
    });
    host.addEventListener('pointerleave', function () {
      ['--rx', '--ry'].forEach(function (v) { stack.style.setProperty(v, '0deg'); });
      stack.style.setProperty('--px', '50%');
      stack.style.setProperty('--py', '40%');
      ['--parx', '--pary', '--parx2', '--pary2'].forEach(function (v) { stack.style.setProperty(v, '0px'); });
    });
  }

  /* ⚠ A foil card must LOOK foiled before anyone touches it. The first version
     built the layers on hover, which meant a phone never showed foil at all and
     a laptop showed a grid of flat cards until you went hunting. The resting
     state is now the printed recipe, and hover is what starts the light moving. */
  var TOUCH = window.matchMedia && matchMedia('(hover: none)').matches;
  var observer = null;

  function watcher() {
    if (typeof IntersectionObserver === 'undefined') return null;
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var s = e.target._stack;
          if (s) s.classList.toggle('rest', !e.isIntersecting);  /* off screen: stop the light */
        });
      }, { rootMargin: '250px' });
    }
    return observer;
  }

  function attachTile(trigger, host, row, parScale) {
    if (!isHolo(row)) return;

    /* ⚠ Built straight away, NOT on an IntersectionObserver.
       attachTile is called while the tile is still detached, and observing a
       detached element does not reliably fire once it is added to the page, so
       the layers never got built and every card showed its flat face. A resting
       stack has its animations paused and costs almost nothing. */
    var wantPlay = false;
    ready(row, function (ok) {
      if (!ok || host._stack) return;
      var s = buildStack(row, parScale == null ? .45 : parScale);
      s.className += ' rest';           /* foiled, but the light is not moving yet */
      host.appendChild(s);
      host._stack = s;
      trackTilt(host, s);
      if (wantPlay) s.classList.remove('rest');

      /* On touch there is no hover to ask with, so the light runs while the
         tile is on screen. Deferred a frame so the tile is in the page first. */
      if (TOUCH) {
        var io = watcher();
        if (io) requestAnimationFrame(function () { io.observe(host); });
        else s.classList.remove('rest');
      }
    });

    if (TOUCH) return;

    function play() { wantPlay = true;  if (host._stack) host._stack.classList.remove('rest'); }
    function stop() { wantPlay = false; if (host._stack) host._stack.classList.add('rest'); }
    trigger.addEventListener('pointerenter', play);
    trigger.addEventListener('pointerleave', stop);
    trigger.addEventListener('focus', play);   /* tabbing gets the same card as hovering */
    trigger.addEventListener('blur', stop);
  }

  /* Detail view: build once, over the still frame that is already there. */
  function attachDetail(host, row, parScale) {
    if (!isHolo(row) || !host) return;
    ready(row, function (ok) {
      if (!ok || !host.isConnected) return;
      var stack = buildStack(row, parScale == null ? 1 : parScale);
      host.appendChild(stack);
      trackTilt(host, stack);
    });
  }

  return {
    assetUrl:     assetUrl,
    isHolo:       isHolo,
    canMask:      function () { return CAN_MASK; },
    buildStack:   buildStack,
    trackTilt:    trackTilt,
    attachTile:   attachTile,
    attachDetail: attachDetail
  };
}());
