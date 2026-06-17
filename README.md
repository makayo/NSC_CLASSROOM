# NSC Classroom Translation Tool 🎧

Live multilingual captions and audio for ESL students in classroom settings at North Seattle College. The instructor speaks English — each student follows along in their own language on their classroom desktop, listening through headphones in real time. A downloadable translated study guide is generated at the end of class.

> **Companion project:** [OCE_TRANSLATOR](https://github.com/makayo/OCE_TRANSLATOR) — multilingual greeter kiosk for the OCE&E lobby. The two tools share the same nine-language list and NSC branding, but **not** a glossary — this tool's content covers Northstar Digital Literacy / computer-basics vocabulary (Wi-Fi, browser, app names, etc.), since the classroom curriculum is unrelated to the kiosk's OCE&E benefits/workforce domain.

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

| Language            | Native script      | Audio (TTS)                       |
| ------------------- | ------------------ | --------------------------------- |
| Spanish             | Español            | ✅ Standard on Windows            |
| Chinese (Mandarin)  | 中文（普通话）     | ✅ Standard on Windows            |
| Chinese (Cantonese) | 中文（廣東話）     | ✅ Standard on Windows            |
| Vietnamese          | Tiếng Việt         | ✅ Standard on Windows            |
| Arabic              | العربية            | ⚠️ Requires Arabic language pack  |
| Farsi               | فارسی              | ⚠️ Requires Farsi language pack   |
| Somali              | Soomaali           | ⚠️ Requires Somali language pack  |
| Amharic             | አማርኛ               | ⚠️ Requires Amharic language pack |
| Tagalog             | Filipino / Tagalog | ✅ Standard on Windows            |

Arabic and Farsi display right-to-left automatically, including the live caption screen, the settings drawer, and the downloaded study guide.

---

## Student experience

1. Sit at a classroom desktop → click the **"Translation — Click Here"** bookmark
2. Tap your language (big buttons, native script)
3. Follow along — captions update live, audio plays through headphones in your language if a voice is available on this computer (a notice appears if not, and captions keep working either way)
4. Adjust audio, volume, speed, text size, and dark/light appearance from the settings icon
5. At end of class: **Download study guide** → a timestamped translated transcript to keep, with key terms bolded

## Instructor experience

```bash
# Start the tool
cd NSC_CLASSROOM
npm start
```

Then open `http://localhost:3000/instructor` in Chrome (must be `localhost`, not a network IP — Chrome blocks microphone access on plain network addresses). Enter a course name, click **Start session**, tap the mic to begin, then teach normally — correct any speech-to-text mistakes by tapping a transcript line before it sends. Click **End session** when done to get the English master transcript.

---

## Repo structure

```
NSC_CLASSROOM/
├── README.md
├── docs/
│   ├── CLASSROOM_Spec_v1.md
│   └── ARCHITECTURE.md
├── server/
│   ├── server.js                 ← Node.js WebSocket + Express + translation hub
│   ├── config.example.js         ← copy to config.js and add your API key (gitignored)
│   └── lib/
│       ├── translate.js          ← Google Cloud Translation / Azure Translator wrapper
│       ├── glossary.js           ← protects key terms from mistranslation
│       └── session.js            ← in-memory session state
├── src/
│   ├── instructor/
│   │   └── instructor.html       ← instructor interface (single file)
│   ├── student/
│   │   └── student.html          ← student caption + audio interface (single file)
│   └── shared/
│       └── studyguide.js         ← study guide generator, shared by student.html
├── content/
│   ├── glossary.json             ← Northstar/computer-basics terms (NOT shared with OCE_TRANSLATOR)
│   ├── languages.json            ← language list, TTS locales, RTL flags (shared)
│   └── ui-strings.json           ← student UI labels in all 9 languages
├── package.json
└── .gitignore                    ← excludes config.js (API keys)
```

---

## One-time setup (IT required)

| Step | What                                                                            | Who              |
| ---- | ------------------------------------------------------------------------------- | ---------------- |
| 1    | Install Node.js v18+ on instructor desktop                                      | IT               |
| 2    | Open port 3000 on classroom network                                             | IT               |
| 3    | Approve translation API key (Google Cloud or Azure)                             | IT + developer   |
| 4    | Add bookmark "Translation — Click Here" → `http://[instructor-ip]:3000/student` | IT or instructor |
| 5    | Verify/install language packs for Arabic, Farsi, Somali, Amharic                | IT               |
| 6    | Pilot run with a small group before full class deployment                       | Instructor       |

---

## Privacy & policy compliance

| Concern               | How it's handled                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Student personal data | None collected — anonymous sessions, no login                                             |
| Audio recording       | Chrome STT runs locally — audio never transmitted                                         |
| Data persistence      | Session data cleared on End Session — nothing stored                                      |
| Translation API       | Receives anonymous English text only — no different from a student using Google Translate |
| Study guide           | Generated and stored on student's device only                                             |

---

## Build status

- [x] Spec complete (v1.0)
- [x] Architecture documented
- [x] Content scaffold (glossary, languages, UI strings)
- [x] Instructor guide (Word document for colleague)
- [x] Server build (`server/server.js` + `server/lib/`)
- [x] Instructor interface (`src/instructor/instructor.html`)
- [x] Student interface with TTS headphone audio (`src/student/student.html`)
- [x] Study guide generator (`src/shared/studyguide.js`)
- [x] End-to-end tested live: real speech → real translation → real captions/audio → real downloaded study guide
- [ ] IT approval (Node.js + port 3000 + API key)
- [ ] Windows language pack verification (Arabic, Farsi, Somali, Amharic TTS)
- [ ] Classroom pilot

---

## Future work

**Pending before classroom deployment**

- IT approval for Node.js, port 3000, and the translation API key on the real classroom network
- Verify Arabic, Farsi, Somali, and Amharic voices are installed on classroom desktops — Spanish, Mandarin, Cantonese, Vietnamese, and Tagalog should already work via standard Windows voices
- Run a small pilot before a full class session, and have native speakers spot-check the glossary translations and a sample study guide per language

**Known limitations to revisit**

- Google Cloud Translation has no dedicated Cantonese code, so `zh-HK` currently falls back to Traditional Mandarin grammar rather than true Cantonese. Azure Translator does support real Cantonese (`yue`) — worth switching `translationProvider` to Azure if Cantonese accuracy turns out to matter for these students
- The glossary's placeholder-token approach (used to protect terms like "Wi-Fi" or "Google Drive" from mistranslation) hasn't been stress-tested against real API output for non-Latin-script languages (Arabic, Farsi, Amharic, Chinese) — watch for mangled terms during the pilot
- The instructor page requires accessing the server via `localhost` for microphone access to work (a Chrome security rule, not a bug) — fine for the current one-device workflow, but would need a different approach (e.g. HTTPS) if the instructor ever wants to run the mic from a separate device than the one hosting the server

**Possible enhancements**

- Cache identical repeated sentences within a session to cut down on redundant translation API calls
- Support more than one simultaneous instructor connection gracefully (currently works, but with no "who's actually in control" indicator)
- Automated tests for the glossary/translation pipeline, rather than relying on manual end-to-end checks

---

## Related

- **[OCE_TRANSLATOR](https://github.com/makayo/OCE_TRANSLATOR)** — multilingual greeter kiosk for the NSC OCE&E lobby
- **NSC Classroom Instructor Guide** — plain-language Word document for the instructor (in `docs/`)

---

## Credits

Built by Mark Yosinao ([@makayo](https://github.com/makayo)) for North Seattle College.
