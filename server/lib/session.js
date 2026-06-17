// server/lib/session.js
//
// All session state lives in memory only, as required by the spec
// (no personal data, nothing persisted after the session ends).
// Restarting the server or clicking "End Session" wipes this clean.

const crypto = require('crypto');

function createEmptySession() {
  return {
    id: null,
    courseName: null,
    startTime: null,
    active: false,
    micPaused: false,
    // ws -> { lang: string|null }
    students: new Map(),
    // { time, en, translations: { [lang]: text } }[]
    transcript: [],
  };
}

const session = createEmptySession();

function startSession(courseName) {
  session.id = crypto.randomBytes(3).toString('hex');
  session.courseName = courseName || 'Untitled session';
  session.startTime = new Date().toISOString();
  session.active = true;
  session.micPaused = false;
  session.transcript = [];
  return session;
}

function endSession() {
  session.active = false;
  session.micPaused = false;
  session.courseName = null;
  session.startTime = null;
  session.transcript = [];
  // Connections stay open (students may be reused for the next session);
  // only the session content is cleared.
}

function addStudent(ws, lang) {
  session.students.set(ws, { lang: lang || null });
}

function removeStudent(ws) {
  session.students.delete(ws);
}

function setStudentLanguage(ws, lang) {
  if (session.students.has(ws)) {
    session.students.get(ws).lang = lang;
  } else {
    addStudent(ws, lang);
  }
}

function getLanguageBreakdown() {
  const breakdown = {};
  for (const { lang } of session.students.values()) {
    if (!lang) continue;
    breakdown[lang] = (breakdown[lang] || 0) + 1;
  }
  return breakdown;
}

function getDistinctLanguages() {
  return new Set(
    [...session.students.values()].map((s) => s.lang).filter(Boolean)
  );
}

function formatTime(date) {
  const d = date || new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

module.exports = {
  session,
  startSession,
  endSession,
  addStudent,
  removeStudent,
  setStudentLanguage,
  getLanguageBreakdown,
  getDistinctLanguages,
  formatTime,
};
