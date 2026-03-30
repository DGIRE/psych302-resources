/**
 * PSYCH 302 — Lightweight Privacy-Preserving Analytics
 * =====================================================
 * Sends anonymous, aggregate usage events to a Google Sheet
 * via a Google Apps Script web app endpoint.
 *
 * Tracked fields (NO personally identifiable information):
 *   timestamp_utc  — ISO 8601 UTC timestamp
 *   event_date     — YYYY-MM-DD date string
 *   page_path      — window.location.pathname
 *   page_title     — document.title
 *   event_name     — one of: page_view, click_nav, click_pdf,
 *                    click_external_tool, click_notebooklm,
 *                    click_drive, click_slides, click_demo,
 *                    click_canvas
 *   target_label   — visible text of the clicked element (truncated to 120 chars)
 *   target_url     — href of the clicked link (empty for page_view)
 *   referrer       — hostname of document.referrer, or "direct"
 *   device_type    — desktop | mobile | tablet
 *   browser_family — Chrome | Safari | Firefox | Edge | Other
 *   session_id     — random anonymous ID stored in sessionStorage (resets each tab)
 *   site_version   — static version string for this deployment
 *
 * Expected JSON payload sent to endpoint:
 * {
 *   "timestamp_utc": "2026-03-29T22:15:00.000Z",
 *   "event_date": "2026-03-29",
 *   "page_path": "/index.html",
 *   "page_title": "PSYCH 302: Neuroscience of the Mind",
 *   "event_name": "page_view",
 *   "target_label": "",
 *   "target_url": "",
 *   "referrer": "canvas.uw.edu",
 *   "device_type": "desktop",
 *   "browser_family": "Chrome",
 *   "session_id": "s_a1b2c3d4e5",
 *   "site_version": "1.0"
 * }
 *
 * To remove: delete this file and remove the <script> tag from each HTML page.
 */
(function () {
  'use strict';

  // ── Configuration ──
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbyKkkM3WBfGOzI_XgNm03zsIX2Nl8wd6HO3VZnPDRbVp68YMYc5gc6h28TOQaoa4qkvWw/exec';
  var SITE_VERSION = '1.0';

  // ── Session ID (anonymous, resets per tab) ──
  function getSessionId() {
    try {
      var id = sessionStorage.getItem('_p302_sid');
      if (!id) {
        id = 's_' + Math.random().toString(36).substring(2, 12);
        sessionStorage.setItem('_p302_sid', id);
      }
      return id;
    } catch (e) {
      return 's_' + Math.random().toString(36).substring(2, 12);
    }
  }

  // ── Device detection ──
  function getDeviceType() {
    var ua = navigator.userAgent || '';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  // ── Browser detection ──
  function getBrowserFamily() {
    var ua = navigator.userAgent || '';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    return 'Other';
  }

  // ── Referrer hostname ──
  function getReferrerHost() {
    try {
      if (!document.referrer) return 'direct';
      return new URL(document.referrer).hostname || 'direct';
    } catch (e) {
      return 'direct';
    }
  }

  // ── Classify a click into an event name ──
  function classifyClick(href, el) {
    if (!href) return null;
    var lower = href.toLowerCase();

    // PDF downloads
    if (lower.indexOf('.pdf') !== -1) return 'click_pdf';

    // NotebookLM
    if (lower.indexOf('notebooklm.google.com') !== -1) return 'click_notebooklm';

    // Google Slides / PPTX presentations
    if (lower.indexOf('docs.google.com/presentation') !== -1) return 'click_slides';

    // Google Drive (video previews, deep dive podcasts, etc.)
    if (lower.indexOf('drive.google.com') !== -1) return 'click_drive';

    // Canvas LMS
    if (lower.indexOf('canvas.uw.edu') !== -1) return 'click_canvas';

    // Interactive demos (internal)
    if (lower.indexOf('interactive-demos') !== -1) return 'click_demo';

    // Other external (PubMed, Colab, YouTube, etc.)
    if (lower.indexOf('://') !== -1 && lower.indexOf(location.hostname) === -1) return 'click_external_tool';

    // Internal navigation
    if (lower.indexOf('.html') !== -1) return 'click_nav';

    return null;
  }

  // ── Get readable label from an element ──
  function getLabel(el) {
    var text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text && el.title) text = el.title;
    if (!text && el.getAttribute('aria-label')) text = el.getAttribute('aria-label');
    return text.substring(0, 120);
  }

  // ── Send event (fire-and-forget) ──
  function send(eventName, targetLabel, targetUrl) {
    try {
      var now = new Date();
      var payload = {
        timestamp_utc: now.toISOString(),
        event_date: now.toISOString().substring(0, 10),
        page_path: location.pathname,
        page_title: document.title,
        event_name: eventName,
        target_label: targetLabel || '',
        target_url: targetUrl || '',
        referrer: getReferrerHost(),
        device_type: getDeviceType(),
        browser_family: getBrowserFamily(),
        session_id: getSessionId(),
        site_version: SITE_VERSION
      };

      // Use sendBeacon if available (survives page unload), otherwise fetch
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, body);
      } else {
        fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) {
      // Fail silently — analytics must never disrupt the site
    }
  }

  // ── Track page view ──
  send('page_view', '', '');

  // ── Track link clicks (delegation on document) ──
  document.addEventListener('click', function (e) {
    try {
      // Walk up from click target to find nearest <a>
      var el = e.target;
      while (el && el.tagName !== 'A') {
        el = el.parentElement;
      }
      if (!el || !el.href) return;

      var eventName = classifyClick(el.href, el);
      if (!eventName) return;

      send(eventName, getLabel(el), el.href);
    } catch (e) {
      // Fail silently
    }
  }, true); // Use capture phase so we see clicks before navigation

})();
