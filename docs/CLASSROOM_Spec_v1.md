# NSC Classroom Translation Tool — Master Spec (v1.0)

**Project:** Live multilingual translation tool for classroom/lecture settings at North Seattle College.
**Companion project:** OCE_TRANSLATOR (multilingual greeter kiosk, OCE&E lobby)
**Purpose of this document:** (1) Architecture reference, (2) content spec, (3) build checklist.
**Status:** v1.0 — spec complete, awaiting IT approval for Node.js install and translation API access.

---

## 1. Problem Statement

The instructor teaches Basic Technology Skills to ESL students who speak multiple languages. Students cannot fully follow English-language instruction. The tool provides live translated captions on each student's classroom desktop in their chosen language, and produces a downloadable study guide in their language at the end of class.

---

## 2. Design Principles

- **Instructor-managed:** the instructor starts and stops the session. Students connect before class with his assistance.
- **Desktop-first:** students use the classroom desktops already in front of them. No smartphone required.
- **No personal data:** anonymous sessions only. No names, no student IDs, no login. Nothing stored after the session ends.
- **Study guide is student-owned:** transcript downloads to the student's device. Nothing persists server-side.
- **Offline-capable network:** runs entirely on the classroom's local WiFi. Only the translation API call leaves the building — anonymous English text only, no different from a student using Google Translate.
- **Single install:** Node.js on the instructor's desktop, once, by IT. Everything else runs in any browser.
- **Shared vocabulary:** the OCE&E verified glossary (DSHS, EBT, WorkSource, ctcLink, TANF, BFET etc.) is pre-processed before translation so domain-specific terms render correctly in every language.

---

## 3. Languages

Same nine as the OCE_TRANSLATOR kiosk:

| Code | Language | Script | Direction | TTS locale |
|---|---|---|---|---|
| es | Spanish | Latin | LTR | es-MX |
| zh-CN | Chinese (Mandarin) | Simplified | LTR | zh-CN |
| zh-HK | Chinese (Cantonese) | Traditional | LTR | zh-HK |
| vi | Vietnamese | Latin | LTR | vi-VN |
| ar | Arabic | Arabic | RTL | ar-SA |
| fa | Farsi | Arabic | RTL | fa-IR |
| so | Somali | Latin | LTR | so-SO |
| am | Amharic | Ethiopic | LTR | am-ET |
| tl | Tagalog | Latin | LTR | fil-PH |

RTL layout (Arabic, Farsi) applies to the student caption screen.

---

## 4. System Architecture

```
┌─────────────────────────────────────────────┐
│           CLASSROOM DESKTOP (instructor)     │
│                                              │
│  instructor.html ──► Chrome Web Speech API  │
│  (microphone)        (English STT, local)    │
│         │                                   │
│         ▼                                   │
│    server.js (Node.js + WebSocket)          │
│    - receives English text                  │
│    - applies glossary pre-processing        │
│    - calls translation API per language     │
│    - broadcasts to connected students       │
│    - in-memory only, no persistence         │
└──────────────┬──────────────────────────────┘
               │ local WiFi (WebSocket)
               │ ws://[instructor-ip]:3000
    ┌──────────┼──────────┐
    ▼          ▼          ▼
student     student    student
desktop 1   desktop 2  desktop 3
(Spanish)  (Mandarin) (Vietnamese)
```

**Data flow:** instructor voice → Chrome STT (stays local, never transmitted) → English text → WebSocket → server → glossary filter → translation API → translated text → each student's browser.

**What leaves the building:** anonymous English text sentences to the translation API. No audio. No names. No identifying information.

---

## 5. Components

### 5a. Server (`server/server.js`)

- Node.js + `ws` (WebSocket library) + `express` (serve static files)
- Single command to start: `node server.js`
- Auto-detects local IP and displays it + QR code in the terminal on startup
- Manages session state: course name, connected students (by language, anonymous), active/inactive
- Translation: calls Google Translate API (free tier) or Azure Cognitive Services — configurable in `server/config.js`
- Glossary pre-processing: loads `content/glossary.json`, substitutes known terms before API call
- In-memory only: session data cleared on stop or process exit
- Broadcasts to all students, or to a specific language group
- Emits session-end event that triggers study guide prompt on all student screens

### 5b. Instructor interface (`src/instructor/instructor.html`)

**Single HTML file, no build step.**

Sections:
- **Setup panel** (before session): course name input, Start Session button
- **Live panel** (during session): 
  - Large mic button (Start/Pause listening)
  - Live English transcript scrolling in real time
  - Connected students count + language breakdown (e.g., "3 Spanish · 1 Vietnamese · 2 Tagalog")
  - Confidence indicator (shows when STT confidence is low — instructor can repeat)
  - End Session button
- **Post-session panel**: Download English master transcript button

**Speech recognition:** Chrome Web Speech API (`webkitSpeechRecognition`), continuous mode, English. Audio processed entirely in the browser — never sent to the server. Only the resulting text is transmitted.

**Instructor controls:**
- Pause/resume the mic (e.g., during student questions or side conversations)
- Manual correction: tap a transcript line to edit it before it goes out (catches STT errors on technical terms)
- Force-send: send the current line immediately without waiting for a pause

### 5c. Student interface (`src/student/student.html`)

**Single HTML file, no build step. Opened via bookmark on classroom desktops.**

Screens:
1. **Language picker** — nine large buttons in native script, same design language as the kiosk. Browser localStorage saves the choice so it's pre-selected next time.
2. **Waiting screen** — "Waiting for class to start…" in the student's language. Shown until the instructor starts the session.
3. **Live caption screen** — the main view:
   - Current sentence displayed large (replacing-chunks mode — readable from a distance)
   - Recent history toggle: tap to see the last 10 sentences scrolling below
   - Language chip showing current language (tappable to switch mid-session)
   - Font size controls (A− / A+) — accessibility for varying screen distances
   - Pause indicator if the instructor has paused the mic
4. **Session ended screen** — "Class is over. Download your study guide below."
   - **Download Study Guide** button → generates and downloads the transcript
   - **Print** button → browser print dialog, optimized print stylesheet

**Caption display:** replacing-chunks (current sentence shown large, replaced on next), with a 3-second fade transition so students can finish reading before it changes.

**Audio / headphones:** Each student can listen to the translated captions through headphones using the browser's built-in text-to-speech (Web Speech Synthesis API). Controls:
- 🎧 Audio toggle — ON by default when headphones are detected, OFF for open speakers
- Volume slider (0–100%)
- Speed slider (0.5× to 1.5×) — slower speed improves comprehension for lower-literacy students
- The sentence currently being spoken is highlighted on screen
- New sentences cancel the previous utterance so audio and captions stay in sync

**RTL:** Arabic and Farsi sessions flip the layout right-to-left automatically.

### 5d. Study guide (`src/shared/studyguide.js`)

Generated entirely in the student's browser from the accumulated session transcript. No server involvement.

**Format:**
```
North Seattle College
Basic Technology Skills
[Course name entered by instructor]
[Date]  [Session duration]
Language: [Student's language in their script]
─────────────────────────────────────────
[10:04]  [Translated sentence 1]

[10:06]  [Translated sentence 2]

[10:11]  [Translated sentence 3]
─────────────────────────────────────────
End of session transcript.
Prepared by NSC Classroom Translation Tool.
```

- Timestamped by sentence
- Natural paragraph breaks where the instructor paused > 4 seconds
- Proper nouns / glossary terms highlighted (bold) so students know they are key terms
- Clean print stylesheet: no buttons, no UI chrome, just the content
- Available as: browser print (→ PDF via system print dialog) or direct HTML download

### 5e. Shared content (`content/`)

Shared with OCE_TRANSLATOR. Contains:
- `glossary.json` — OCE&E/workforce domain terms with verified translations in all nine languages
- `languages.json` — language list, codes, directions, TTS locales
- `ui-strings.json` — student UI labels in all nine languages ("Waiting for class to start", "Download Study Guide", "Class is over", etc.)

---

## 6. Session flow

```
BEFORE CLASS
Instructor: opens instructor.html → enters course name → clicks Start Session
Server:     generates session, displays IP + QR in terminal
Instructor: confirms bookmark on student desktops / assists students connecting
Students:   open bookmark → language picker → waiting screen

DURING CLASS
Instructor: clicks Start Listening → speaks normally
Server:     receives text → glossary filter → translation API → broadcast
Students:   captions update in real time in their language
            (instructor can pause mic during student Q&A)

END OF CLASS
Instructor: clicks End Session
Server:     broadcasts session-end event → clears all data
Students:   "Class is over" screen → Download Study Guide
            (instructor walks students through the download as a class exercise)
Instructor: optionally downloads English master transcript
```

---

## 7. Technical requirements

| Requirement | Detail |
|---|---|
| Instructor desktop OS | Windows 10/11 (classroom standard) |
| Browser | Chrome (required for Web Speech API) |
| Node.js | v18+ — one-time install on instructor desktop |
| npm packages | `ws`, `express`, `node-qrcode`, `axios` |
| Translation API | Google Cloud Translation (free tier: 500,000 chars/month) or Azure Cognitive Services |
| TTS (student audio) | Web Speech Synthesis API — built into Chrome, no install; requires Windows language packs for Arabic, Farsi, Somali, Amharic |
| Student headphones | Standard 3.5mm or USB — classroom desktops should have headphone jacks; verify before deployment |
| API key storage | `server/config.js` (gitignored) — instructor desktop only |
| Student desktops | Any modern browser (Chrome preferred) |
| Network | Classroom WiFi — instructor and student desktops on same subnet |
| Persistence | None — in-memory session data only |
| Ports | 3000 (WebSocket + static file server) |

---

## 8. IT approval checklist

Before deployment, the following require IT sign-off:

- [ ] Node.js v18+ installed on instructor desktop(s)
- [ ] Port 3000 open on classroom network (inbound from student desktops to instructor desktop)
- [ ] Translation API key approved (Google Cloud or Azure) — anonymized text only, no PII
- [ ] Bookmark added to student desktop browsers: `http://[instructor-ip]:3000/student`
- [ ] Chrome set as default browser on student desktops (Web Speech API requirement)
- [ ] Windows language packs installed for Arabic, Farsi, Somali, and Amharic (required for TTS audio in those languages)
- [ ] Student desktops have functioning headphone jacks or USB audio

---

## 9. Repo structure

```
NSC_CLASSROOM/
├── docs/
│   └── CLASSROOM_Spec_v1.md          # This document
├── server/
│   ├── server.js                     # Node.js WebSocket + Express server
│   └── config.js                     # API keys + port config (gitignored)
├── src/
│   ├── instructor/
│   │   └── instructor.html           # Instructor interface (single file)
│   ├── student/
│   │   └── student.html              # Student caption interface (single file)
│   └── shared/
│       └── studyguide.js             # Study guide generator
├── content/
│   ├── glossary.json                 # OCE&E domain terms, all 9 languages
│   ├── languages.json                # Language list + metadata
│   └── ui-strings.json               # UI labels in all 9 languages
├── .gitignore                        # Excludes config.js (API keys)
└── README.md
```

---

## 10. Open items (pre-build)

| # | Item | Owner |
|---|---|---|
| 1 | IT approval: Node.js install + port 3000 + API key | Colleague + IT dept |
| 2 | Translation API choice: Google Cloud vs Azure | Colleague preference |
| 3 | Course name(s) for study guide header | Colleague |
| 4 | Which classroom(s) / desktop count | Colleague |
| 5 | Confirm Chrome is available on student desktops | Site visit |

---

## 11. Relationship to OCE_TRANSLATOR

| | OCE_TRANSLATOR (kiosk) | NSC_CLASSROOM (this) |
|---|---|---|
| Setting | Lobby, one visitor at a time | Classroom, 10–30 students simultaneously |
| Direction | One-way: kiosk → visitor | One-way: instructor → students |
| Duration | 1–3 minute sessions | 50–90 minute class sessions |
| Translation | Pre-verified static strings | Live machine translation + glossary layer |
| Storage | Local SQLite tally (usage counts) | None (study guide on student device only) |
| Network | Fully offline | Local WiFi + translation API |
| Install | None (single HTML file) | Node.js on instructor desktop |
| Shared | Language list, glossary, NSC branding | same |

---

*Document v1.0 — spec complete. Build begins after IT approval items resolved.*
