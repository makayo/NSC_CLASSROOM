# NSC Classroom Translation Tool — Architecture

## Overview

A real-time multilingual translation system for classroom use. The instructor speaks English; each student receives live translated captions and audio in their chosen language on their classroom desktop, with headphone audio via text-to-speech. A downloadable study guide is generated at the end of class.

```
┌─────────────────────────────────────────────────────────────┐
│                 INSTRUCTOR DESKTOP (Chrome)                  │
│                                                              │
│  instructor.html                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐    │
│  │  Web Speech API │───▶│  English transcript (live)   │    │
│  │  (microphone)   │    │  Manual correction (tap line)│    │
│  │  LOCAL — audio  │    │  Confidence indicator        │    │
│  │  never leaves   │    │  Pause / Resume mic          │    │
│  │  this machine   │    └──────────────┬───────────────┘    │
│  └─────────────────┘                   │ English text only  │
└───────────────────────────────────────┼─────────────────────┘
                                        ▼
┌───────────────────────────────────────────────────────────────┐
│                    server.js  (Node.js)                        │
│                                                                │
│  1. Receives English text via WebSocket                        │
│  2. Glossary pre-processing                                    │
│     (DSHS, EBT, WorkSource, ctcLink → verified translations)  │
│  3. Translation API call (Google / Azure) per unique language  │
│     in the session — one call per language, not per student    │
│  4. Broadcasts translated text to each language group          │
│  5. In-memory only — cleared on session end                    │
│                                                                │
│  Serves: instructor.html · student.html · studyguide.js        │
│  Port: 3000 (local WiFi only)                                  │
└────────────────────────┬──────────────────────────────────────┘
                         │ WebSocket  ws://[instructor-ip]:3000
                         │ Local classroom WiFi only
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Student 1  │ │  Student 2  │ │  Student 3  │
   │  (Spanish)  │ │  (Mandarin) │ │  (Tagalog)  │
   │             │ │             │ │             │
   │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
   │ │ Caption │ │ │ │ Caption │ │ │ │ Caption │ │
   │ │ screen  │ │ │ │ screen  │ │ │ │ screen  │ │
   │ └────┬────┘ │ │ └────┬────┘ │ │ └────┬────┘ │
   │      │      │ │      │      │ │      │      │
   │ ┌────▼────┐ │ │ ┌────▼────┐ │ │ ┌────▼────┐ │
   │ │Web TTS  │ │ │ │Web TTS  │ │ │ │Web TTS  │ │
   │ │(Spanish)│ │ │ │(zh-CN)  │ │ │ │(Tagalog)│ │
   │ │🎧 audio │ │ │ │🎧 audio │ │ │ │🎧 audio │ │
   │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │
   └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Data flow detail

```
1. AUDIO (instructor desktop only)
   Instructor voice → Chrome Web Speech API
   → English text string
   [AUDIO NEVER LEAVES THE INSTRUCTOR'S MACHINE]

2. TEXT TRANSMISSION (local WiFi)
   English text → WebSocket → server.js
   [Only anonymous English text crosses the network]

3. GLOSSARY PRE-PROCESSING (server, in-memory)
   "WorkSource" → WorkSource (protected, not mangled by translator)
   "EBT"        → EBT
   "ctcLink"    → ctcLink
   [content/glossary.json, verified translations]

4. TRANSLATION (server → API → server)
   English → Google Translate / Azure (one call per language in session)
   → Spanish text, Mandarin text, Tagalog text, etc.
   [Anonymous text only — no names, no student data]

5. BROADCAST (server → student browsers)
   Spanish text → Spanish students only
   Mandarin text → Mandarin students only
   [WebSocket, local WiFi]

6. DISPLAY + AUDIO (student browser)
   Translated text → caption screen (replacing-chunks display)
   Translated text → Web Speech Synthesis API → headphone audio
   [Both happen locally in the student's browser]

7. STUDY GUIDE (student browser, end of class)
   Accumulated translated sentences → formatted HTML → download
   [Generated entirely in the student's browser — server never sees it]
```

---

## Component responsibilities

| Component | File | Responsibility |
|---|---|---|
| Server | `server/server.js` | WebSocket hub, translation API, glossary, session management |
| Config | `server/config.js` | API keys, port (gitignored — never committed) |
| Instructor UI | `src/instructor/instructor.html` | Mic, transcript, session control, student dashboard |
| Student UI | `src/student/student.html` | Language pick, captions, TTS audio, study guide trigger |
| Study guide | `src/shared/studyguide.js` | In-browser transcript formatter and download generator |
| Glossary | `content/glossary.json` | Verified OCE&E domain terms, all 9 languages |
| Languages | `content/languages.json` | Language list, codes, TTS locales, RTL flags |
| UI strings | `content/ui-strings.json` | Student UI labels translated into all 9 languages |

---

## Audio / TTS architecture (headphones)

Each student's browser runs Web Speech Synthesis independently:

```javascript
// Triggered when a new translated sentence arrives
const utterance = new SpeechSynthesisUtterance(translatedText);
utterance.lang = student.ttsLocale;   // e.g. "es-MX", "zh-CN", "fil-PH"
utterance.rate = 0.9;                 // Slightly slower for comprehension
window.speechSynthesis.speak(utterance);
```

**Student controls:**
- 🎧 Toggle — enable/disable audio (default: ON if headphones detected, OFF otherwise)
- Volume slider — 0–100%
- Speed slider — 0.5× to 1.5× (slower for lower-literacy students)
- The current sentence is highlighted on screen as it is being spoken
- If a new sentence arrives before the previous one finishes speaking, the old utterance is cancelled and the new one starts — captions and audio stay in sync

**TTS voice availability:**
Depends on Windows language packs installed on the classroom desktop. English, Spanish, Chinese (Mandarin), and Vietnamese voices are standard on Windows 11. Arabic, Farsi, Somali, and Amharic may require additional language packs — IT should verify and install as needed.

**RTL languages (Arabic, Farsi):**
TTS works regardless of direction. The caption display flips right-to-left automatically via the `dir` attribute.

---

## Translation efficiency

To minimize API cost and latency, the server groups students by language and makes one API call per unique language per sentence, regardless of how many students share that language:

```
If 3 students chose Spanish and 2 chose Mandarin:
  → 2 API calls per sentence (one for es, one for zh-CN)
  → not 5 calls
```

---

## Session state (in-memory, never persisted)

```javascript
session = {
  id: "abc123",
  courseName: "Basic Technology Skills",
  startTime: "2026-06-11T10:00:00",
  students: {
    "ws-001": { lang: "es", connected: true },
    "ws-002": { lang: "zh-CN", connected: true },
  },
  transcript: [
    { time: "10:04", en: "WorkSource can help you...", translations: { es: "WorkSource puede ayudarle..." } }
  ]
}
// Cleared completely on session end or server restart
```

---

## Network requirements

| Requirement | Detail |
|---|---|
| Protocol | WebSocket (ws://) over local WiFi |
| Port | 3000 (instructor desktop → student desktops, inbound) |
| Subnet | All devices must be on the same classroom WiFi network |
| Internet | Required for translation API calls only |
| Bandwidth | Low — text only, ~1–5 KB per sentence |
| Offline fallback | If translation API is unreachable, English text is shown with an error notice |

---

## Security notes

- Server binds to `0.0.0.0:3000` — accessible to anyone on the same WiFi network. For a classroom environment this is acceptable; for a shared building network, IT may want to restrict by subnet.
- No authentication on student connections — intentional, to avoid login friction for ESL students. Sessions are anonymous.
- API key stored in `server/config.js`, which is gitignored. Never committed to the repo.
- Translation API receives only English text. No student language, no session ID, no identifying information is sent.

---

## Dependencies

| Package | Purpose | Version |
|---|---|---|
| `ws` | WebSocket server | ^8.x |
| `express` | Serve static files | ^4.x |
| `axios` | Translation API HTTP calls | ^1.x |
| `qrcode` | Generate session QR code in terminal | ^1.x |
| Node.js | Runtime | v18+ |
| Chrome | Web Speech API (STT + TTS) | Current |

No frontend build step — all HTML/JS/CSS is vanilla, single-file, runs directly in the browser.
