import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/isyweb-widget?project=XXXX
 *
 * Serves the public widget.js script that the agency embeds on their dev site.
 * The script:
 *  1. Detects whether it is loaded inside an Isyweb iframe.
 *  2. If yes, listens for postMessage commands from the parent and exposes
 *     DOM-anchor utilities (compute selector / xpath / text snippet for an
 *     element under the cursor).
 *  3. If no (e.g. someone visits the dev site directly), it does nothing —
 *     no UI, no tracking.
 *
 * Tier 1 of the 3-tier embed strategy.
 */

const WIDGET_JS = `
(function () {
  'use strict';

  // Bail out if not inside Isyweb iframe context
  try {
    if (window.parent === window) return;
  } catch (e) { return; }

  var IS_DEBUG = ${process.env.NODE_ENV !== "production"};
  var TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'https://isytask-web.vercel.app'
  ];

  function log() {
    if (IS_DEBUG) console.log.apply(console, ['[Isyweb]'].concat([].slice.call(arguments)));
  }

  // Build a unique CSS selector for an element (best-effort)
  function getSelector(el) {
    if (!el || el === document.body) return 'body';
    if (el.id) return '#' + CSS.escape(el.id);
    var path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var sel = el.tagName.toLowerCase();
      if (el.classList && el.classList.length) {
        sel += '.' + Array.from(el.classList).slice(0, 2).map(CSS.escape).join('.');
      }
      var parent = el.parentNode;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (c) { return c.tagName === el.tagName; });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(el) + 1;
          sel += ':nth-of-type(' + idx + ')';
        }
      }
      path.unshift(sel);
      el = el.parentNode;
      if (path.length > 8) break;
    }
    return path.join(' > ');
  }

  function getXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '//*[@id="' + el.id + '"]';
    var path = [];
    while (el && el.nodeType === 1) {
      var idx = 1;
      var sib = el.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.nodeName === el.nodeName) idx++;
        sib = sib.previousSibling;
      }
      path.unshift(el.nodeName.toLowerCase() + '[' + idx + ']');
      el = el.parentNode;
    }
    return '/' + path.join('/');
  }

  function getTextSnippet(el) {
    var text = (el.textContent || '').trim().replace(/\\s+/g, ' ');
    return text.slice(0, 80);
  }

  // ── Modes ──

  var pickMode = false;
  var hoverEl = null;
  var hoverOverlay = null;

  function ensureHoverOverlay() {
    if (hoverOverlay) return hoverOverlay;
    hoverOverlay = document.createElement('div');
    hoverOverlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #0a8cba;background:rgba(10,140,186,0.12);z-index:2147483646;transition:all 0.08s;border-radius:4px;display:none;';
    document.body.appendChild(hoverOverlay);
    return hoverOverlay;
  }

  function setHover(el) {
    hoverEl = el;
    var ov = ensureHoverOverlay();
    if (!el) { ov.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    ov.style.display = 'block';
    ov.style.left = r.left + 'px';
    ov.style.top = r.top + 'px';
    ov.style.width = r.width + 'px';
    ov.style.height = r.height + 'px';
  }

  function onMouseMove(e) {
    if (!pickMode) return;
    setHover(e.target);
  }
  function onClick(e) {
    if (!pickMode) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    var rect = el.getBoundingClientRect();
    sendToParent('ELEMENT_PICKED', {
      selector: getSelector(el),
      xpath: getXPath(el),
      textSnippet: getTextSnippet(el),
      tag: el.tagName.toLowerCase(),
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      // viewport coords + scroll offset
      pageX: e.pageX,
      pageY: e.pageY,
      scroll: { x: window.scrollX, y: window.scrollY },
    });
    setPickMode(false);
  }

  function setPickMode(on) {
    pickMode = !!on;
    document.body.style.cursor = on ? 'crosshair' : '';
    if (!on) setHover(null);
  }

  function sendToParent(type, data) {
    try {
      window.parent.postMessage({ source: 'isyweb-widget', type: type, data: data }, '*');
    } catch (e) { log('postMessage error', e); }
  }

  function onScroll() {
    sendToParent('SCROLL', {
      x: window.scrollX,
      y: window.scrollY,
      h: document.documentElement.scrollHeight,
      vh: window.innerHeight,
      vw: window.innerWidth,
    });
  }

  function onResize() {
    sendToParent('VIEWPORT', {
      w: window.innerWidth,
      h: window.innerHeight,
      docH: document.documentElement.scrollHeight,
    });
  }

  // ── Screenshot capture using html2canvas (lazy-loaded) ──
  var h2cPromise = null;
  function loadH2C() {
    if (h2cPromise) return h2cPromise;
    h2cPromise = new Promise(function (resolve, reject) {
      if (typeof window.html2canvas === 'function') return resolve(window.html2canvas);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return h2cPromise;
  }

  async function captureScreenshot(reqId) {
    try {
      var h2c = await loadH2C();
      // Hide our own hover overlay during capture
      var ov = hoverOverlay; if (ov) ov.style.display = 'none';
      var canvas = await h2c(document.body, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scale: 1,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      sendToParent('SCREENSHOT_DATA', { reqId: reqId, dataUrl: dataUrl, w: canvas.width, h: canvas.height });
    } catch (e) {
      log('screenshot failed', e);
      sendToParent('SCREENSHOT_ERROR', { reqId: reqId, error: String(e && e.message || e) });
    }
  }

  // ── Message handler from parent ──
  window.addEventListener('message', function (ev) {
    var msg = ev.data;
    if (!msg || msg.source !== 'isyweb-parent') return;
    log('msg from parent', msg.type);
    if (msg.type === 'PICK_ELEMENT') setPickMode(true);
    else if (msg.type === 'CANCEL_PICK') setPickMode(false);
    else if (msg.type === 'PING') sendToParent('PONG', { url: location.href, title: document.title });
    else if (msg.type === 'GET_VIEWPORT') onResize();
    else if (msg.type === 'CAPTURE_SCREENSHOT') captureScreenshot(msg.data && msg.data.reqId);
  });

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  // Announce ready
  sendToParent('READY', {
    url: location.href,
    title: document.title,
    viewport: { w: window.innerWidth, h: window.innerHeight, docH: document.documentElement.scrollHeight },
  });
  log('ready');
})();
`;

export async function GET(req: NextRequest) {
  // We accept ?project=XXX for future per-project config injection
  // (not needed in MVP — widget is identical for all projects)
  return new NextResponse(WIDGET_JS, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
