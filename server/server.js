// server/server.js
//
// Start with: node server.js
//
// Serves the instructor and student interfaces, plus a WebSocket hub that:
//   1. Receives English transcript text from the instructor
//   2. Protects glossary terms (Wi-Fi, Google, Zoom, Windows, ...) from mangling
//   3. Calls the translation API once per distinct student language
//   4. Broadcasts translated captions to each language group
//   5. Keeps everything in memory only — nothing persists after End Session
//
// See docs/ARCHITECTURE.md and docs/CLASSROOM_Spec_v1.md for the full design.

const path = require('path');
const os = require('os');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const qrcode = require('qrcode');

let config;
try {
  config = require('./config');
} catch (err) {
  console.error(
    '\nMissing server/config.js.\n' +
      'Copy server/config.example.js to server/config.js and add your translation API key.\n'
  );
  process.exit(1);
}

const { translateText } = require('./lib/translate');
const { loadGlossary, protectGlossaryTerms, restoreGlossaryTerms } = require('./lib/glossary');
const sessionLib = require('./lib/session');
const { session } = sessionLib;

const ROOT = path.join(__dirname, '..');
const glossaryTerms = loadGlossary(path.join(ROOT, 'content', 'glossary.json'));

// ---------------------------------------------------------------------------
// HTTP / static files
// ---------------------------------------------------------------------------

const app = express();

app.use('/content', express.static(path.join(ROOT, 'content')));
app.use('/shared', express.static(path.join(ROOT, 'src', 'shared')));

app.get('/instructor', (req, res) => {
  res.sendFile(path.join(ROOT, 'src', 'instructor', 'instructor.html'));
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(ROOT, 'src', 'student', 'student.html'));
});

app.get('/', (req, res) => {
  res.redirect('/student');
});

const httpServer = http.createServer(app);

// ---------------------------------------------------------------------------
// WebSocket hub
// ---------------------------------------------------------------------------

const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

const instructorSockets = new Set();

function safeSend(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToInstructors(message) {
  for (const ws of instructorSockets) safeSend(ws, message);
}

function broadcastToLang(lang, message) {
  for (const [ws, info] of session.students.entries()) {
    if (info.lang === lang) safeSend(ws, message);
  }
}

function broadcastToAllStudents(message) {
  for (const ws of session.students.keys()) safeSend(ws, message);
}

function sendStudentUpdate() {
  broadcastToInstructors({
    type: 'student_update',
    count: session.students.size,
    breakdown: sessionLib.getLanguageBreakdown(),
  });
}

async function handleFinalTranscript(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;

  const langs = sessionLib.getDistinctLanguages();
  const time = sessionLib.formatTime();
  const ts = Date.now();
  const { processedText, matches } = protectGlossaryTerms(trimmed, glossaryTerms);
  const translations = {};
  const termsByLang = {};

  await Promise.all(
    [...langs].map(async (lang) => {
      try {
        const raw = await translateText(processedText, lang);
        translations[lang] = restoreGlossaryTerms(raw, matches, lang);
      } catch (err) {
        console.error(`Translation failed for "${lang}":`, err.message);
        translations[lang] = trimmed; // fall back to English rather than nothing
        broadcastToInstructors({ type: 'translation_error', lang, message: err.message });
      }
      // Resolved glossary term strings for this language, so the student
      // page can bold them in the live caption and the study guide.
      termsByLang[lang] = matches.map((m) => (m.translations && m.translations[lang]) || m.en);
    })
  );

  session.transcript.push({ time, ts, en: trimmed, translations });

  for (const lang of langs) {
    broadcastToLang(lang, { type: 'caption', time, ts, text: translations[lang], terms: termsByLang[lang] });
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get('role');
  ws.role = role;

  if (role === 'instructor') {
    instructorSockets.add(ws);
    safeSend(ws, { type: 'student_update', count: session.students.size, breakdown: sessionLib.getLanguageBreakdown() });
  } else if (role === 'student') {
    const lang = url.searchParams.get('lang');
    sessionLib.addStudent(ws, lang);
    sendStudentUpdate();
    if (session.active) {
      safeSend(ws, { type: 'session_started', courseName: session.courseName });
      if (session.micPaused) safeSend(ws, { type: 'mic_paused' });
    } else {
      safeSend(ws, { type: 'waiting' });
    }
  } else {
    ws.close(1008, 'role query param required (instructor|student)');
    return;
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (ws.role === 'instructor') {
      switch (msg.type) {
        case 'start_session': {
          sessionLib.startSession(msg.courseName);
          broadcastToAllStudents({ type: 'session_started', courseName: session.courseName });
          safeSend(ws, { type: 'session_ack', sessionId: session.id });
          sendStudentUpdate();
          break;
        }
        case 'transcript': {
          if (msg.isFinal) handleFinalTranscript(msg.text);
          break;
        }
        case 'pause_mic': {
          session.micPaused = true;
          broadcastToAllStudents({ type: 'mic_paused' });
          break;
        }
        case 'resume_mic': {
          session.micPaused = false;
          broadcastToAllStudents({ type: 'mic_resumed' });
          break;
        }
        case 'end_session': {
          broadcastToAllStudents({ type: 'session_ended' });
          sessionLib.endSession();
          sendStudentUpdate();
          break;
        }
        default:
          break;
      }
    } else if (ws.role === 'student') {
      switch (msg.type) {
        case 'join':
        case 'change_language': {
          sessionLib.setStudentLanguage(ws, msg.lang);
          sendStudentUpdate();
          if (session.active) {
            safeSend(ws, { type: 'session_started', courseName: session.courseName });
            if (session.micPaused) safeSend(ws, { type: 'mic_paused' });
          } else {
            safeSend(ws, { type: 'waiting' });
          }
          break;
        }
        default:
          break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.role === 'instructor') {
      instructorSockets.delete(ws);
    } else if (ws.role === 'student') {
      sessionLib.removeStudent(ws);
      sendStudentUpdate();
    }
  });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

httpServer.listen(config.port, () => {
  const ip = getLocalIp();
  const studentUrl = `http://${ip}:${config.port}/student`;
  const instructorUrl = `http://${ip}:${config.port}/instructor`;

  console.log('\nNSC Classroom Translation Tool');
  console.log('================================');
  console.log(`Instructor: ${instructorUrl}`);
  console.log(`Student bookmark: ${studentUrl}\n`);

  qrcode.toString(studentUrl, { type: 'terminal', small: true }, (err, qrString) => {
    if (!err) console.log(qrString);
  });
});
