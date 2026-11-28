# Loop Maker Live (GitHub Pages Live-Mic Companion)

Standalone HTTPS copy of `soundcard/loopmaker/index.html` + `soundcard.js` for live microphone **Hum to beat** on Android/iOS Chrome (since `claude.ai` artifacts block `getUserMedia`).

## How it works
1. Live at https://pollodiablo82.github.io/scancam-Live/loopmaker/ . Source of truth: `Desktop/soundcard/loopmaker-live/` on the laptop (copy of `soundcard/loopmaker/index.html` + `soundcard.js`); update it there and copy it here.
2. Hum (melody, counter or bass) in Step 4 and pick or beatbox a beat in Step 5. In Step 6 pick a length and shape, tap **Auto-arrange** (free, on the phone: calm / fight / boss), name it, pick **Save to** (Library only or a game; the list comes from opening this page once via Game Studio's Open Live Mic Hum), then **Send to Game Studio**: it shares `gsloop_<name>_<time>.json` over LocalSend to the laptop's `2dengine/photos/_inbox/`, and the installed Game Studio app files it in the Music library (`songs`) within a minute and moves the file to `_inbox/_music/`. Sent songs also stay in this phone's library. Claude polish = open the song in Game Studio and tap Elaborate.
3. Before pushing publicly, run `python -P ../2dengine/tools/secretscan.py .` (no secrets or recordings live here).
