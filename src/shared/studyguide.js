// src/shared/studyguide.js
//
// Generates the end-of-class study guide entirely in the student's browser
// from the session's accumulated captions. The server never sees this —
// it's built from data the student's own page already received.
//
// Each caption entry looks like: { time: "10:04", ts: 1750000000000,
// text: "translated sentence", terms: ["Wi-Fi", "Google Drive", ...] }
//
// Consecutive entries less than PARAGRAPH_GAP_MS apart are folded into the
// same paragraph (no blank line between them); longer pauses start a new
// paragraph, matching "natural paragraph breaks where the instructor
// paused > 4 seconds" from the spec.

(function () {
  'use strict';

  const PARAGRAPH_GAP_MS = 4000;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Returns `text` as escaped HTML with any matching glossary terms
   * wrapped in <strong>. Longest terms are matched first so e.g.
   * "Google Drive" doesn't get partially swallowed by a "Google" match.
   */
  function applyBold(text, terms) {
    let escaped = escapeHtml(text);
    if (!terms || !terms.length) return escaped;

    const unique = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
    unique.forEach((term) => {
      const escTerm = escapeHtml(term);
      if (!escTerm) return;
      const re = new RegExp(escapeRegExp(escTerm), 'gi');
      escaped = escaped.replace(re, (match) => `<strong>${match}</strong>`);
    });
    return escaped;
  }

  function groupParagraphs(entries) {
    const paragraphs = [];
    let current = null;
    let lastTs = null;

    entries.forEach((entry) => {
      const gap = lastTs === null ? Infinity : entry.ts - lastTs;
      if (!current || gap > PARAGRAPH_GAP_MS) {
        current = { time: entry.time, parts: [] };
        paragraphs.push(current);
      }
      current.parts.push(applyBold(entry.text, entry.terms));
      lastTs = entry.ts;
    });

    return paragraphs.map((p) => ({ time: p.time, html: p.parts.join(' ') }));
  }

  /**
   * meta: {
   *   courseName, date, duration, languageNative, languageName, dir,
   *   strings: { study_guide_header, prepared_by, end_of_transcript }
   * }
   */
  function buildHtmlDocument(meta, entries) {
    const paragraphs = groupParagraphs(entries);
    const dir = meta.dir === 'rtl' ? 'rtl' : 'ltr';
    const s = meta.strings || {};

    const bodyHtml = paragraphs
      .map(
        (p) =>
          `<p class="line"><span class="line-time">${escapeHtml(p.time)}</span>${p.html}</p>`
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en" dir="${dir}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(s.study_guide_header || 'Study guide')} — ${escapeHtml(meta.courseName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#1b2230; --muted:#5b6472; --rule:#d8dadf; --accent:#8a6a2e; --paper:#ffffff;
  }
  *{ box-sizing:border-box; }
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:'Inter', system-ui, sans-serif;
    padding:3rem 1.5rem;
  }
  .sheet{ max-width:40rem; margin:0 auto; }
  .eyebrow{
    font-family:'Barlow Condensed', sans-serif; font-weight:600;
    text-transform:uppercase; letter-spacing:0.12em; font-size:0.78rem; color:var(--muted);
  }
  h1{
    font-family:'Barlow Condensed', sans-serif; font-weight:700;
    font-size:1.9rem; margin:0.25rem 0 0.9rem;
  }
  .meta-line{ color:var(--muted); font-size:0.92rem; margin-bottom:1.6rem; line-height:1.6; }
  hr{ border:none; border-top:1px solid var(--rule); margin:1.4rem 0; }
  .line{ line-height:1.65; font-size:1.02rem; margin:0 0 1.1rem; }
  .line-time{
    font-family:'Inter', system-ui, sans-serif; font-weight:600; color:var(--muted);
    font-size:0.78rem; margin-inline-end:0.6rem; vertical-align:2px;
  }
  .line strong{ color:var(--accent); font-weight:700; }
  .footer{ color:var(--muted); font-size:0.85rem; margin-top:1.8rem; }
  .print-btn{
    margin-top:2rem; padding:0.7rem 1.3rem; border-radius:8px; border:1px solid var(--rule);
    background:transparent; font-family:inherit; font-size:0.9rem; cursor:pointer; color:var(--ink);
  }
  @media print{ .print-btn{ display:none; } body{ padding:0; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="eyebrow">North Seattle College</div>
    <h1>${escapeHtml(meta.courseName)}</h1>
    <div class="meta-line">
      ${escapeHtml(meta.date)}${meta.duration ? ' · ' + escapeHtml(meta.duration) : ''}<br/>
      ${escapeHtml(s.study_guide_header || 'Language')}: ${escapeHtml(meta.languageNative)}${meta.languageName ? ' (' + escapeHtml(meta.languageName) + ')' : ''}
    </div>
    <hr/>
    ${bodyHtml || `<p class="line" style="color:var(--muted)">—</p>`}
    <hr/>
    <div class="footer">
      ${escapeHtml(s.end_of_transcript || 'End of session transcript.')}<br/>
      ${escapeHtml(s.prepared_by || 'Prepared by NSC Classroom Translation Tool')}
    </div>
    <button class="print-btn" onclick="window.print()">Print</button>
  </div>
</body>
</html>`;
  }

  function download(meta, entries) {
    const html = buildHtmlDocument(meta, entries);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCourseName = (meta.courseName || 'class').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.download = `${safeCourseName}-study-guide-${meta.languageCode || 'en'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPrintWindow(meta, entries) {
    const html = buildHtmlDocument(meta, entries);
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to print the study guide.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  window.StudyGuide = { escapeHtml, applyBold, groupParagraphs, buildHtmlDocument, download, openPrintWindow };
})();
