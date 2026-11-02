# Healix frontend

React + Vite + TypeScript web app with a small Hono server in `server/`.

## Run (PowerShell)

```powershell
npm install
Copy-Item server\.env.example server\.env
npm run dev
```

Needs Node 20 or newer. Open http://localhost:5173. Useful pages: `/styleguide`, `/app`, `/hospital`.

For a production-style run (compressed, cached, one port):

```powershell
npm run build
npm run start
```

Then open http://localhost:8787.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Generates the theme, then runs Vite and the Node server together |
| `npm run build` | Theme, typecheck, production build |
| `npm run start` | Serves `dist/` and `/api` from the Node server |
| `npm run typecheck`, `lint`, `test` | Quality gates |
| `npx playwright test` | E2E and the landing screenshot diff (builds and serves the app first) |

## Structure

- `src/core`: tokens, API clients, i18n, domain logic, stores. No DOM, no `src/web` imports (enforced by ESLint).
- `src/web`: components, routes, styles. `theme.generated.css` is generated from `src/core/tokens.ts`.
- `server`: `/api/*`. `DATA_MODE=mock|live` and all keys live in `server/.env`.

## Data layer: mock or live

The browser only ever calls `/api/*` on the Node server. `DATA_MODE` in `server/.env` decides what answers:

| `DATA_MODE` | Behaviour |
|---|---|
| `mock` (default) | The built-in mock engine answers everything, with realistic latency (send `X-Fast-Demo: 1`, or turn on the fast demo toggle, to remove it) |
| `local` | A real backend inside this server: data is saved to disk, sign-in tokens are signed, the clock is real, queues start empty and staff control them. Reports are read by a built-in reader. See "Local mode" below |
| `live` | `/api/ai/*` is forwarded to `AI_URL/ai/*`, every other `/api/*` to `BACKEND_URL/*`, with the JWT passed through and SSE streamed untouched |

`GET /api/meta` tells the browser the mode. Mock responses are validated against the same Zod schemas as live ones (`src/core/api/schemas`).

### Demo accounts (mock mode, OTP is always `123456`)

| Who | Phone |
|---|---|
| Sunita Patil (58, Kothrud, Marathi, with her mother's profile) | `9876500001` |
| Front desk, Karve Road Care Clinic (hospital dashboard) | `9000000001` |

The mock clock starts at 10:10 IST on the current date every time the server starts, so the demo numbers are the same at any hour.

### Regenerating the data

```powershell
npm run seed            # hospitals, doctors, patients, 14 days of history (fixed seed, reproducible)
npm run reports:render  # sample lab report PNGs and the value bounding boxes
```

Both write into `server/mock/data/` and the results are committed.

### Endpoints that are not in the contract table

The brief did not list these, so they are assumptions to confirm with the backend and AI owners. The mock implements them and the clients call them:

| Endpoint | Used for |
|---|---|
| `GET /me`, `GET/POST /profiles` | Signed-in user and family profiles |
| `GET /doctors/{id}`, `GET /doctors/{id}/slots` | Booking screen |
| `GET /tokens/mine`, `GET /tokens/{id}` | Home ticket and token screen |
| `GET /tokens/{id}/swap-candidates`, `GET /tokens/{id}/swap-requests/latest` | Swap picker and pending state |
| `GET/POST /reports`, `GET /reports/{id}`, `GET /reports/{id}/image`, `POST /reports/{id}/confirm` | Upload, the mandatory review step, original image |
| `GET /dashboard/pre-alerts` | Emergency pre-alerts on the hospital dashboard |
| `GET /emergency/nearest?lat=&lng=` | Nearest emergency department with distance and travel time, shown on the emergency screen before anything is shared |
| `GET/POST /mock/simulator/*` | Mock only: replay a day, stop, reset, speed |

Shapes chosen where the brief was open: `follow_up_questions` items may be a string or `{ question, options }`; wait `reasons` are `{ code, label, minutes }`; every AI envelope field except `language` is optional so the UI falls back to local copy.

## Voice and language (Sarvam AI)

Voice and language features go through the Node server only. The browser never sees the key, and nothing in `VITE_*` is used.

| Route | Does |
|---|---|
| `POST /api/sarvam/stt` | Speech to text. Multipart `audio` (16 kHz mono WAV from the browser), `language`, `purpose` |
| `POST /api/sarvam/tts` | Text to speech. Long text is split by sentence (under 2,000 characters per call) and returned as base64 WAV chunks |
| `POST /api/sarvam/translate` | Translation, cached. Falls back to the original text if Sarvam is slow or down |
| `POST /api/sarvam/transliterate` | Latin-script Hindi to Devanagari |
| `POST /api/sarvam/lid` | Language identification. Falls back to a local guess |

Calls time out after 8 seconds (`SARVAM_TIMEOUT_MS`), and each client address is limited to 30 voice requests a minute (`SARVAM_RATE_LIMIT_PER_MINUTE`). `GET /api/meta` includes `sarvam_mode`:

| `sarvam_mode` | When | What the page does |
|---|---|---|
| `live` | `SARVAM_API_KEY` is set | Mic, listen, translate, transliterate and language checks all use Sarvam |
| `mock` | No key and `DATA_MODE=mock` | The mic returns canned transcripts for the demo phrases so the demo works offline. Listen and the Devanagari toggle stay hidden |
| `off` | No key and `DATA_MODE=live` | The mic and listen are hidden, typing works as normal |

There is no browser speech fallback, by design. Model IDs and voice names live in `server/.env` and are never hard-coded: `SARVAM_STT_MODEL`, `SARVAM_TTS_MODEL`, `SARVAM_TRANSLATE_MODEL`, `SARVAM_TTS_SPEAKER_EN`, `SARVAM_TTS_SPEAKER_HI`, `SARVAM_TTS_SPEAKER_MR`. If the key is set but a needed model is empty, the server answers `sarvam_not_configured` rather than guessing.

Every Sarvam field name sits in one file, `server/sarvam/wire.ts`. It was written from the project brief without access to docs.sarvam.ai, so check it against the current API reference before the first live call. The items to check are:

- Speech to text: multipart fields `file`, `model`, `mode`, `language_code` (sent as `unknown` for auto-detect), and the response fields `transcript` and `language_code`.
- Text to speech: the request sends `language_code` (confirmed against the TTS REST guide), plus `text`, `model`, `pace` and optional `speaker`. The response is read as `audios[]`.
- Translate: `input`, `source_language_code` (`auto` when unknown), `target_language_code`, optional `model`. The response is read as `translated_text`.
- Transliterate: `input`, `source_language_code`, `target_language_code`. The response is read as `transliterated_text`.
- Language identification: `input`. The response is read as `language_code`.
- Model IDs: confirm current names, for example the speech-to-text and text-to-speech models listed in the brief.

Consent: before the first recording or read-aloud the page shows one line ("Your voice is sent to Sarvam AI to turn it into text.") with an Allow button. Allowing sets the `voice` consent for the session and, when signed in, records it with the backend.

### Note for the AI service owner

Sarvam's hosted chat model (`sarvam-105b`) is a possible fallback behind your `LLMClient` if local hardware is too slow on demo day. That decision is yours. The frontend does not call any Sarvam chat model.

## Emergency

The Emergency button is in the top bar of the landing page and opens `/emergency`, a public page that needs no sign-in: a large `tel:102` button, `tel:112`, the nearest emergency department (from the device location when allowed) and a link to sign in so the hospital can be alerted with the patient's details. Signed-in users are sent to `/app/emergency`, where a 160 px hold-to-activate button (2 seconds, release cancels) lists exactly what will be shared (name, age, reason, live location) and then sends it with `POST /emergency`. A red flag from triage (`urgency: "emergency"` or any `red_flags`) replaces the whole screen with the same view.

The ambulance number is set to 102 as requested. Note that 108 is the national emergency ambulance number in most states and 102 is the patient-transport and maternity service in many of them, so check the number for your region. It is one string per language (`emergency.call102`) in `src/core/i18n/messages/*/app.json` plus the `tel:` link in `src/web/components/signature/EmergencyScreen.tsx`.

## Messages

Strings live in `src/core/i18n/messages/<language>/<group>.json`, split into groups so a route only loads what it shows: `common` (every screen), `landing`, `app` (patient screens), `hospital`, and `styleguide` (English only). Each lazy route in `src/web/routes/router.tsx` declares its groups and loads them in parallel with its code. Hindi and Marathi sections that need a native speaker's check carry `"_review": true`.

## Sessions

Per the brief, only language and elder mode persist in `localStorage`. The sign-in token and the active profile id are kept in `sessionStorage`, so a reload keeps you signed in and closing the tab signs you out. Nothing else is stored: the profile, its health conditions and the consents are fetched again from the server on reload (`GET /me`, `GET /consent`). If the token is rejected or the server is slow (4 seconds), the app signs out and starts onboarding.

## Doctors, booking and the token

- Every doctor in the demo data has their own fee, consultation minutes, observed minutes, qualifications, short bio and focus areas, and their own best times to visit, so no two cards read the same. `npm run seed` regenerates the data deterministically.

- **Find a doctor** (`/app/doctors`) starts with a booking form: a specialty dropdown, a date (today to six days ahead), a preferred time (any, morning, afternoon, evening) and the purpose of the visit. "Find doctors" shows the list for that specialty below the form, ranked from `POST /match`, with a filters panel (fee, distance, language). Opening the page from a triage result fills the form and shows the list straight away.
- **Booking** asks for confirmation first and picks the free time closest to the chosen date and window, telling the patient when it had to move (for example "No time was free in your preferred slot"). The purpose is stored with the booking and shown on the token. In demo mode the first attempt for Sunita loses the race (`409 slot_taken` with `next_free_slot`); every attempt uses a new idempotency key. Slots are offered for seven days.
- **Token** (`/app/token/:id`) is a boarding-pass style card with the token number, the doctor and room, and who is being served. Below it: a ring counting down to "Leave home in N min", the queue drawn as dots with "You" at the end, the wait reasons (+ and - minutes), a four-step visit timeline, the visit details with a directions link, and the swap panel (at most 3 requests, one pending, 5-minute countdown, token numbers only). A wait that changes by more than 15 minutes raises an alert.
- With no token yet, the Token tab shows a clearly labelled, working **sample preview** driven by the demo queue so patients can see what they will get. Swaps are hidden in the sample.
- Add `?fast=1` to any URL to remove mock latency and bring the incoming swap forward to 3-4 seconds (demo mode only).

## Reports

- `/app/reports` lists earlier reports as cards. `/app/reports/upload` takes a photo, a PDF, a Word file or a text file (up to 50 MB) once the `reports` consent is on, then calls `POST /reports` and `POST /ai/reports/process` and polls `GET /ai/jobs/{id}` every second with "Reading your report…" and "Checking values…".
- **What can be read:** photos (PNG, JPG, WebP, GIF, BMP, TIFF), PDFs with text, scanned PDFs (the pages are drawn and read like photos, up to 8 pages), Word `.docx` and plain text. Phone photos in HEIC format are not supported; export them as JPG. A document with none of the 18 tests Healix knows is still kept: it opens with a note saying no standard values were found, can be confirmed, and the chatbot answers questions from its text.
- `/app/reports/:id/review` is mandatory. The original image sits beside the extracted values; values the reader was unsure about (confidence under 0.8) get a watch tint and a marker over the image. "Confirm values" calls `POST /reports/{id}/confirm`.
- `/app/reports/:id` is Explain. It only loads after confirmation; otherwise the API's `409 review_required` sends the person back to review. Flagged tests get a card with a `RangeBar` built from the report's own range, a trend sparkline when older values exist and the repeated-test note. Normal values are one line. The Parchi can be saved as a text file or shared.
- The picture is fetched with the sign-in header and shown from a blob, so it also works when the backend requires the token. In mock mode the upload sends only the file name and type, because the mock cycles through three prepared reports.

## Healix AI: the report assistant

`/app/assistant` answers doubts about the patient's own uploaded reports and nothing else. It streams `POST /ai/assistant/chat` over SSE (`token`, `citations`, `refusal`, `done`).

**How it works (retrieval over the report):**

1. When a report is confirmed, its text (the words read from the PDF or photo, plus the confirmed values and their ranges) is split with a **recursive chunker** (`server/rag/chunker.ts`: paragraphs, then lines, then sentences, then words, then characters, about 480 characters per chunk with 60 characters of overlap).
2. Each chunk becomes a vector (`server/rag/embedder.ts`, a local hashed word and character embedding, no outside service) and is saved in the **vector store** (`server/rag/store.ts`). In local mode the store is the file `server/data/local/vectors.json`; in demo mode it lives in memory. The index re-syncs itself whenever the question arrives, so a corrected or newly confirmed report is picked up and a removed one is dropped.
3. A question is embedded the same way and the closest chunks of that person's reports are fetched (cosine similarity). If nothing in the reports is related and the question is not about a known test or term, the fixed refusal sentence is returned and Groq is never called. Questions about medicines or doses are always refused.
4. With `GROQ_API_KEY` and `GROQ_MODEL` set in `server/.env`, the chunks and the question go to Groq (`server/rag/groq.ts`) with instructions to answer only from the excerpts, never diagnose or mention medicines, and cite with `[1]`, `[2]`. The reply is checked for diagnosis wording and doses before it is shown; if it fails the check, or Groq is down, the built-in answer is used instead. Tapping a `[n]` opens the exact report excerpt.
5. With no key, the same retrieval runs and answers come from the reviewed glossary (`server/mock/glossary.ts`) or by quoting the closest part of the report.

`GET /api/meta` reports `assistant_mode` as `groq` or `local`. The key stays on the server and is never sent to the browser.

- **Small talk and general health words:** greetings, thanks, "what can you do" and everyday health questions are answered. With Groq on, Groq decides what is unrelated; without it, greetings still work and glossary terms are explained.
- **Guardrail:** anything clearly unrelated to health or reports, and any question about medicines or doses, gets one fixed sentence ("I can only answer doubts related to the report.").
- The glossary covers 18 tests and 5 terms in four languages, and adds the patient's own latest value ("In your report, HbA1c is 7.9 %, which is above the usual range").
- Voice input, Listen and the Devanagari toggle for Hinglish work when Sarvam is live. Hindi and Marathi wording needs a native speaker's check.

## Community

`/app/community` is a Reddit-style space: six topics (diabetes, heart health, women's health, seniors and carers, mind and sleep, food and fitness), posts with up and down votes, replies, search, and New or Top sorting. Everyone appears under a stable nickname such as "Calm Heron", never a real name. A new post or reply is refused when it contains a phone number, an email address, a link or a medicine dose, with a message saying why. Posters can delete their own posts, anyone can report a post (three reports hide it), and posting is rate-limited. The seed content is dummy text, including a few Hindi and Marathi posts. It is saved with everything else in local mode. The home screen has a Community box next to My reports, Find a doctor and Healix AI.

## Family profiles

Sign-up step 4 asks for the signed-in person's own details first (name, age, sex, health conditions, language, large text), then shows a small plus button that opens a form with all the same details for a family member (plus relation). The same form edits people later in Settings (`PUT /profiles/{id}`). A slim bar at the top of every patient screen shows whose care is being managed (just the name and age). People are switched with the buttons on Home, and switching changes everything at once: the greeting, reports, tokens, triage details (age, sex, conditions), booking, the emergency share list and large-text mode.

## Landing page

A tall top bar with a large logo, the section links, a red Emergency button, the language picker at the top right and Sign in. The hero has the symptom box (typed or spoken) and a Try the demo button. Below it: "How it works" in six steps, each with a small picture; the features section with the report assistant highlighted and the nine features (symptom check, doctors and booking, live token, report reader, community, language and voice, family profiles, large text, emergency); and the hospital dashboard teaser.

## Hospital dashboard

Sign in with the staff demo phone (or press "See the dashboard" on the landing page in mock mode). `/hospital` has an overview, interactive live queues (search, status filters and sorting; click a doctor to open their queue with the patients, then Call next, Complete, add a walk-in, skip a no-show, pause for a break or add delay, all updated over SSE), analytics (predicted against actual wait, model error 3.9 min against 9.0 min for the simple formula, patients per hour, each chart with a text table for screen readers), booking modes, the queue simulator ("Replay a day in 2 minutes", or about 12 seconds with `?fast=1`) and emergency pre-alerts that slide in from the right. Booking modes give each doctor their own explanation, built from that doctor's specialty, consultation time, queue and delay. The analytics charts say in a note at the bottom when they are showing sample data.

## Settings and large-text mode

`/app/settings`: language, large-text mode, a switch for every permission (turning one off calls `DELETE /consent/{id}` and takes effect at once), family profiles, privacy note and sign out. Large-text mode makes type 25% bigger, simplifies the home screen to the big actions, slows speech and starts reading results aloud when Sarvam is live, with a stop button on every Listen control.

## Demo script

`tests/e2e/demo.spec.ts` runs the whole script in about 25 seconds in mock mode:

1. Marathi mic fills "जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून", triage says soon, the reasoning trail plays.
2. Top pick Dr. Meera Kulkarni (about 25 min), "Just taken" on the first try, rebook the next time.
3. Token A-23, "Leave home in" N min, reasons, an incoming swap from A-24, accept.
4. Upload the sample report, fix the one low-confidence value, Explain with the HbA1c trend 7.9 to 7.1, the repeated cholesterol test and the parchi.
5. Healix AI explains what HbA1c means with the patient's own value, then answers a metformin dose question with the fixed sentence.
6. "chest pain and sweating" opens the emergency screen.
7. Hospital: live queues, replay a day, a booking mode flips to pessimistic, the accuracy chart.

## Tests

| Command | What it covers |
|---|---|
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | ESLint, including the rule that `src/core` never imports `src/web` |
| `npm test` | Unit tests: domain logic, components, the mock server, the Sarvam module, locale parity and banned wording |
| `npm run test:local` | End to end in local mode: sign-up with the code, a real report photo, booking, and the front desk calling a patient |
| `npx playwright test` | End to end, with axe checks on every screen, keyboard-only paths and phone-width overflow checks |

Run one Playwright file with `npx playwright test tests/e2e/reports.spec.ts`. The Playwright server runs with no Sarvam key, so tests never call Sarvam.

## Accessibility and performance

Real buttons and links, labelled inputs, `aria-live` on queues, chat and progress, 44 px touch targets, visible focus rings, focus returned to the opener after a dialog closes, a unique page title per screen, and a reduced-motion override for every animation. Axe finds no serious issues on any screen, including all patient screens in Marathi with large-text mode on. Lighthouse on the production build (mobile profile, simulated slow 4G): landing and app 100 accessibility, 100 best practices, 100 SEO, performance 82 to 87 (largest paint about 4 s on the throttled profile, no layout shift). The server compresses responses and caches hashed assets for a year.

## Local mode (a real backend, no teammates needed)

Set `DATA_MODE=local` in `server/.env` and run `npm run dev` (or `npm run build` then `npm run start`). Everything the app needs is served by this one process:

- **Saved data:** people, family profiles, permissions, bookings, tokens, swaps, reports and alerts are written to `server/data/local/state.json` (about a second after each change and again on exit), and uploaded reports to `server/data/local/uploads`. Back this folder up. It is ignored by Git.
- **Sign-in:** one 6-digit code from `AUTH_CODE` for everyone, because no text-message provider is connected. Tokens are signed and expire after 12 hours. The signing key is created on first start in the data folder. Treat this as a hackathon-grade gate and connect an SMS provider before any public use.
- **Hospital staff:** the phone numbers in `STAFF_PHONES` sign in at `/hospital/login`, each tied to one hospital. They can only call and complete patients of their own hospital.
- **Queues are real:** they start empty and move only when staff press Call next and Complete. The wait estimate learns each doctor's real consultation time from those presses, and the dashboard charts and error figures are built from real waits once there are at least five (until then they show demo data, labelled).
- **No scripted demo moments:** no fake "slot just taken", no invented incoming swap, no simulator, no preloaded patients or reports.
- **Reports are read for real, on this machine:** photos (PNG, JPEG, WebP) go through offline text recognition (Tesseract), PDFs with a text layer are read directly. The reader finds about 18 common tests (HbA1c, glucose, cholesterol, blood count, vitamins, thyroid, kidney, liver), repairs dropped decimal points, takes the reference range printed on the report, and gives each value a confidence. Anything it is unsure about is highlighted in the mandatory review step. Scanned PDFs without text are not supported yet and are turned away kindly.
- **Explanations** use rule-based wording in all four languages, with extra detail for HbA1c, fasting glucose, cholesterol and vitamin D. Triage is the built-in rule engine. Healix AI looks answers up in a reviewed glossary (`server/mock/glossary.ts`) and personalises them with the patient's own confirmed values. The community starts with dummy posts and then holds real ones, saved with everything else.
- **Doctors and hospitals** are still the six synthetic Pune hospitals in `server/mock/data`. Swap in your own list there.
- The built-in tests for this mode run with `npm test` (server project) and `npm run test:local` (a real browser against a fresh local server on port 8788).

## Troubleshooting keys (Groq and Sarvam)

1. Open `server/.env` and check the key lines are filled in, with no quotes and no spaces around `=`. A fresh copy of `.env.example` has empty keys, so copy your old `.env` over it or paste the keys again.
2. Run `npm run check:keys`. It tests each key and model against the real service from your computer and says which line to fix. It never prints a key.
3. After any change to `server/.env`, stop `npm run dev` with Ctrl+C and start it again. The server reads the file only when it starts.
4. When the server starts it prints whether Groq and Sarvam are on. When a Groq or Sarvam call fails it prints the reason, for example `Groq returned 401: Invalid API Key`. If it says the port is already in use, an older copy is still running; close it.
5. `http://localhost:8787/api/meta` shows `assistant_mode` (`groq` or `local`) and `sarvam_mode`.

`npm run test:groq` runs the chatbot end to end against a stand-in Groq server, so the app side can be verified without a key.

## Going live

1. Put every key and URL in `server/.env`, never in a `VITE_*` variable:
   ```
   DATA_MODE=live
   BACKEND_URL=http://localhost:8000
   AI_URL=http://localhost:8001
   SARVAM_API_KEY=...
   SARVAM_STT_MODEL=
   SARVAM_TRANSLATE_MODEL=
   ```
2. Fill the Sarvam model IDs after checking the API reference (see the unverified fields above). Text to speech is already aligned with the REST guide.
3. Check the endpoints in the table above against the real backend and AI service, and generate types from their `openapi.json` if they have one.
4. Mock mode stays available any time by setting `DATA_MODE=mock`.

## Known gaps

- Sarvam speech to text, translate, transliterate and language identification field names are unverified (`server/sarvam/wire.ts`).
- Report upload sends only the file name and type in mock mode. The real backend needs a way to receive the file.
- Hindi and Marathi copy carries `"_review": true` and needs a native speaker's check.
- The staff sign-in is a demo shortcut in mock mode only.
