# Scan Cam Live

Live-camera capture page for Scan Lab, live at https://pollodiablo82.github.io/scancam-live/ (repo `PolloDiablo82/scancam-live`, GitHub Pages from `main` root). Artifact pages cannot open the camera or read motion sensors, so this one is hosted outside Claude. Run `python3 tools/secretscan.py <repo> --history` before every push. `mat.pdf` is made by `2dengine/tools/scanlab/mat/make_mat.py`.

v9 (2026-11-27, Adam: "I don't see my scoopy as a project that I can click on and then add detail shots"):
- **Your projects** on the start screen: the laptop's scan projects (Scan Lab engine 0.34, `lessons/projects.json`). They arrive through the Studio Board's **Open Scan Cam** button, whose link carries them after `#lab=` (base64url JSON `{at, projects: [{id, name, subject, kind, mode, recipe, detail, note}]}`), so nothing about them is in this public repo; the phone keeps them (`localStorage scancam-lab`) and the link data is removed from the address bar. Tap a project: **Detail shots** (the close-up part picker), **Hero shots** or **More rounds** start a follow-up scan with `addTo` = the project's scan id; the laptop combines it with everything it has. Close-up-only additions hide the ring coverage map.
- Why: "Add to an earlier scan" only lists sends from this phone since v6; the Scoopy was sent with v3.
- Tested in headless Chrome (fake camera): link -> projects listed and kept, address bar cleared, Detail shots -> part picker -> camera -> manifest `addTo` + `extra`, Back without shots returns to start, Hero shots on the bag, a broken link keeps the saved projects.

v8 and older: see below.

v7 (2026-11-26, Adam: "universal help in scanning", a house room by room, the 0.6 lens, a bag on a motor stand, polygon budget):
- **Recipes** on the start screen: Room, Vehicle, Furniture, Object, Building part, Turntable (by hand), Motor stand. Each sets the mode, kind, best lens, what coverage it needs and the tips. Last choice remembered.
- **Detail level**: Hero, Game, Background, Low-poly, Showcase (manifest `detail`). Sets how much the guide asks for (Low-poly/Background: middle + high rings; Hero/Showcase: every ring, the top and close-ups; turntable passes 1/2/3) and the laptop's build, finish and ship budget (`scanio.DETAIL`, `ship.py --profile auto`).
- **Real size** (optional): one measurement in cm (`size: {dim, cm}`; rooms: ceiling height). **Marker mat** for turntables: `mat.pdf` (A4 ArUco sheet, page 2 for long things), toggle `mat: true`.
- **Room mode** (inside out): walk along the walls facing into the room. The dial shows the directions you faced; rings Loop 1 (chest height, a little down), Loop 2 (head height, a little up), Middle (big rooms); the ring follows the tilt while filming and each video's ring is the one its tilt track spent most time in. Focus is not locked in rooms.
- **House projects**: a project with rooms (each = a room scan, follow-ups with `addTo`) and doorway clips between rooms (link scans: `project.link {from, to}`), saved on the phone (`localStorage scancam-projects`), with what is still missing and which rooms are not joined yet. **Finish house** sends `sc_<project>_<name>_project.json` (`type: project`, rooms with their scan ids, links, unjoined); the laptop builds the whole house once every room is in.
- **Lens sheet**: every back camera Chrome can open and zoom under 1x where the phone allows it; says plainly when the phone keeps its 0.6 for its own camera app (Xiaomi / Poco: Chrome only gets the main camera). Lens choice remembered per recipe; rooms zoom out by themselves when the phone allows it.
- **Import from camera app** (start screen, Done screen, each room): videos or photos filmed in the phone's own camera app (the 0.6 on a Poco) join the scan as a chosen ring/loop/pass with `imported: true` and `lens: wide|main`, under their own file names (a name Scan Cam can't use gets `sc_<id>_<subject>_imp<n>`). Big sends: Scan Cam saves its own files and lists the imported originals to send from LocalSend's Media.
- **Motor stand**: tap Front when the subject's front faces the camera and again one turn later (turn time T). Photo run: shoots whenever the subject is within 3.5 degrees of the middle of a 10-degree slot that has no sharp photo yet: 36 photos in one turn (more turns if the phone is slow or a shot blurs; stops after 2.5 turns), each with its `angle`. Video: films exactly one turn and stops (`turn {seconds, startAngle}`). Passes Level, High, Bottom (the bottom pass asks for Front again). Front re-aligns, Time turn measures again.
- Manifest v6 (`v: 6`): `recipe`, `detail`, `size`, `mat`, `project`, `turn`, photos `angle`, files `imported` / `lens`; the scan's `lens` describes the in-app camera (or `camera app` when everything was imported).
- Tested in headless Chrome (fake camera, simulated tilt, heading and share sheet, 38 checks: room loops by tilt, project with import and doorway, plan file, motor timing and runs, one-turn video, vehicle auto-shoot).

v6 (2026-11-26, code review):
- Fixed: after the first video the Lock button did nothing, and a second scan in the same session kept the first scan's frozen exposure, white balance and focus (the heading log overwrote the camera track). New scan now unlocks.
- Extra close-ups focus freely (exposure and white balance stay locked), so close-ups are sharp.
- Done while recording waits for the video before showing the Done screen (Send was greyed out).
- One camera-analysis loop (each Extra close-ups started another), idle while the camera screen is hidden.
- Manifest v5: every file's `bytes`; the laptop waits for exact sizes, so a stalled transfer is never built as a short video.
- **Add to an earlier scan**: on the start screen (recent sends are remembered on the phone), or by filming more after Send (Back to camera, Fill the gaps, Extra close-ups). It goes out as a follow-up scan with its own id and `addTo: <first scan id>`; nothing is sent twice, and the laptop combines it with everything it already has for that scan.

v5 (2026-11-26):
- **Coverage map** on the Done screen: the four rings as a dial, green = angles covered, red = angles a required ring missed (Vehicle and Object need Low, Middle and High; Top is optional), plus a checklist of the close-ups a vehicle needs (Mirror detail, Steering column, Underside, Exhaust). **Fill the gaps** goes back to the camera on the ring that misses most. The manifest gets `coverage` (per ring done/of, close-ups, missing list).
- While filming with Auto on, the ring follows the phone's tilt: level or tilted up = Low, a little down = Middle, well down = High, nearly straight down = Top. Each video records `track` in the manifest: `[seconds, heading from front, tilt]` about twice a second, so the laptop knows which angles each part of the video saw.
- Why: the first full Scoopy video was one chest-height circle; only 64 % of the scooter was ever seen and the underside, engine and fork were guessed.

v4 (2026-11-26):
- **Extra close-ups** (Adam's idea): on the done screen, `+ Extra close-ups` asks which part (chips: Mirror detail, Steering column, Wheels, Lights, Logo, Underside, Seat, Exhaust, or type a name) and opens the camera with auto-shoot off for hand-shot close-ups (photos or a short video). Files are named `..._x-<part>_...`, carry `extra` in the manifest, and the manifest lists `extras`. Scan Lab adds them to the same scan and always gives them depth maps (detail views).
- Big scans (over 250 MB) skip the share menu, which loses big files on Android ("Failed to open .../cache/..."): Send saves them to Downloads and says to send them from the LocalSend app.

v3 (2026-11-26):
- Two modes on the start screen. **Walk around**: you circle the subject. **Turntable**: the phone stays still and the subject turns (bags, shoes, small things); it shoots by itself each time the picture has changed since the last shot and has been still for 0.4 s (48x36 grey thumbnail difference). **Next pass** = the subject on its side for the bottom. Photos are named `..._T<pass><nn>_...`; the manifest says `mode: "turntable"` and Scan Lab then masks the background out before matching.
- Denser guide: 36 slices a ring (10 degrees) on Low / Middle / High plus a Top ring of 12 (phone over the subject, pointing down). Order Middle -> High -> Low -> Top.
- Full-sensor stills (`ImageCapture.takePhoto` with the camera's largest `imageWidth`), video at 40 Mbit/s.
- Lock: exposure, white balance and focus are locked at their current values on the first shot or recording (or with the Lock button), so every frame of a scan has the same brightness and colour. What can be locked depends on the phone (Chrome's `exposureMode` / `whiteBalanceMode` / `focusMode` `manual`); the chip says what got locked; recorded in the manifest as `lock`.
- Send: Android share menu -> LocalSend -> Laptop Scan Lab.

Older notes:
- Back camera full screen (`getUserMedia`, ideal 3840x2160; video-frame grab as fallback for stills).
- Guide: compass heading of the back camera from `deviceorientation` (W3C formula), first shot sets the front.
- Auto-shoot (walk around): new slice + steady (`devicemotion` rotation rate under 18 deg/s for 400 ms) + sharpness at least 0.7 x the recent median, held 250 ms; at least 400 ms between shots. Vibrates on each shot.
- Tested in headless Chrome with a fake camera and simulated orientation/motion events.
