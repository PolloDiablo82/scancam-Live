# Scan Cam Live

Live-camera capture page for Scan Lab, live at https://pollodiablo82.github.io/scancam-live/ (repo `PolloDiablo82/scancam-live`, GitHub Pages from `main` root). Artifact pages cannot open the camera or read motion sensors, so this one is hosted outside Claude. Run `python3 tools/secretscan.py <repo> --history` before every push.

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
