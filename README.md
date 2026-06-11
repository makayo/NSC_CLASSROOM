# NSC Classroom Translation Tool 🎧

Live multilingual captions and audio for ESL students in classroom settings at North Seattle College. The instructor speaks English — each student follows along in their own language on their classroom desktop, listening through headphones in real time. A downloadable translated study guide is generated at the end of class.

> **Companion project:** [OCE_TRANSLATOR](https://github.com/makayo/OCE_TRANSLATOR) — multilingual greeter kiosk for the OCE&E lobby. Same language set, shared glossary.

---

## What it does

```
Instructor speaks → Chrome STT (local, audio stays in the room)
→ English text → classroom WiFi → translated per student language
→ live captions on their desktop screen
→ spoken aloud through their headphones in their language
→ downloadable study guide at end of class
```

No personal data. No login. No audio recording. Nothing stored after the session ends.

---

## Languages

| Language | Native script | Audio (TTS) |
|---|---|---|
| Spanish | Español | ✅ Standard on Windows |
| Chinese (Mandarin) | 中文（普通话） | ✅ Standard on Windows |
| Chinese (Cantonese) | 中文（廣東話） | ✅ Standard on Windows |
| Vietnamese | Tiếng Việt | ✅ Standard on Windows |
| Arabic | العربية | ⚠️ Requires Arabic language pack |
| Farsi | فارسی | ⚠️ Requires Farsi language pack |
| Somali | Soomaali | ⚠️ Requires Somali language pack |
| Amharic | አማርኛ | ⚠️ Requires Amharic language pack |
| Tagalog | Filipino / Tagalog | ✅ Standard on Windows |

Arabic and Farsi display right-to-left automatically.

---

## Student experience

1. Sit at a classroom desktop → click the **"Translation — Click Here"** bookmark
2. Tap your language (big buttons, native script)
3. Plug in headphones
4. Follow along — captions update live, audio plays in your language
5. Adjust volume and speed with the on-screen controls
6. At end of class: **Download Study Guide** → a timestamped translated transcript to keep

---

## Instructor experience

```bash
# Start the tool
cd NSC_CLASSROOM/server
node server.js
```

Then open `src/instructor/instructor.html` in Chrome. Enter a course name, click **Start Session**, help students connect, then teach normally. Click **End Session** when done.

---

## Repo structure

```
NSC_CLASSROOM/
├── README.md                          ← this file
├── docs/
│   ├── CLASSROOM_Spec_v1.md           ← full spec (architecture, components, IT checklist)
│   └── ARCHITECTURE.md                ← system diagram, data flow, TTS design
├── server/
│   ├── server.js                      ← Node.js WebSocket + Express + translation
│   └── config.js                      ← API keys + port (GITIGNORED — never commit)
├── src/
│   ├── instructor/
│   │   └── instructor.html            ← instructor interface (single file)
│   ├── student/
│   │   └── student.html               ← student caption + audio interface (single file)
│   └── shared/
│       └── studyguide.js              ← in-browser study guide generator
├── content/
│   ├── glossary.json                  ← OCE&E domain terms, all 9 languages (shared with OCE_TRANSLATOR)
│   ├── languages.json                 ← language list, TTS locales, RTL flags
│   └── ui-strings.json                ← student UI labels in all 9 languages
└── .gitignore                         ← excludes config.js (API keys)
```

---

## One-time setup (IT required)

| Step | What | Who |
|---|---|---|
| 1 | Install Node.js v18+ on instructor desktop | IT |
| 2 | Open port 3000 on classroom network | IT |
| 3 | Approve translation API key (Google Cloud or Azure) | IT + developer |
| 4 | Add bookmark "Translation — Click Here" to student desktops | IT or instructor |
| 5 | Verify/install language packs for Arabic, Farsi, Somali, Amharic | IT |
| 6 | Pilot run with a small group before full class deployment | Instructor |

---

## Privacy & policy compliance

| Concern | How it's handled |
|---|---|
| Student personal data | None collected — anonymous sessions, no login |
| Audio recording | Chrome STT runs locally — audio never transmitted |
| Data persistence | Session data cleared on End Session — nothing stored |
| Translation API | Receives anonymous English text only — no different from a student using Google Translate |
| Study guide | Generated and stored on student's device only |

---

## Build status

- [x] Spec complete (v1.0)
- [x] Architecture documented
- [x] Content scaffold (glossary, languages, UI strings)
- [x] Instructor guide (Word document for colleague)
- [ ] IT approval (Node.js + port 3000 + API key)
- [ ] Server build (`server/server.js`)
- [ ] Instructor interface (`src/instructor/instructor.html`)
- [ ] Student interface with TTS headphone audio (`src/student/student.html`)
- [ ] Study guide generator (`src/shared/studyguide.js`)
- [ ] Windows language pack verification (Arabic, Farsi, Somali, Amharic TTS)
- [ ] Classroom pilot

---

## Related

- **[OCE_TRANSLATOR](https://github.com/makayo/OCE_TRANSLATOR)** — multilingual greeter kiosk for the NSC OCE&E lobby
- **NSC Classroom Instructor Guide** — plain-language Word document for the instructor (in `docs/`)

---

## Credits

Built by Mark Yosinao ([@makayo](https://github.com/makayo)) for North Seattle College.
