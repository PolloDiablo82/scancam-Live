# Loop Maker Live (GitHub Pages Live-Mic Companion)

Standalone HTTPS copy of `soundcard/loopmaker/index.html` + `soundcard.js` for live microphone **Hum to beat** on Android/iOS Chrome (since `claude.ai` artifacts block `getUserMedia`).

## How it works
1. Live at https://pollodiablo82.github.io/scancam-Live/loopmaker/ . Source of truth: `Desktop/soundcard/loopmaker-live/` on the laptop (copy of `soundcard/loopmaker/index.html` + `soundcard.js`); update it there and copy it here.
2. Hum live to the beat on your phone in Step 4, add a beat in Step 5, then tap **Open in Game Studio ->** in Step 6: it copies your loop and opens **Game Studio** (https://claude.ai/artifact/RC3oJ9EE4zhAGMgfaNRNYL); there, open **Music**, Step 6, tap **Paste JSON** and paste it (artifacts drop `#loop=` hashes and block `prompt()`) for **Elaborate with Claude** and **Save to Library**.
3. Before pushing publicly, run `python -P ../2dengine/tools/secretscan.py .` (no secrets or recordings live here).
