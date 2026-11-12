# DronoBox App

A fork of the [Betaflight App](https://github.com/betaflight/betaflight-configurator) (2026.12.0) made by DroneTeam Twente for DronoBox build workshops. Participants get a guided, full-screen flow with a 3D model of the kit that takes itself apart to show the part each lesson is about. Instructors unlock the full Betaflight interface with a PIN.

Betaflight is GPL-3.0-or-later and so is this fork. The files listed below were changed or added by DroneTeam Twente, starting November 2026.

## What participants see

- A welcome page with the 3D DronoBox and its own Connect button (Betaflight's sidebar, status bar, sponsors and community links are hidden while the workshop lock is on).
- After connecting, nine lessons, mirroring the DronoBox V2 manual ("Drone Bible") and the 2026 workshop deck:
    1. **Parts**: the drone floats apart; pick a part to read what it is (facts from the kit's parts list).
    2. **Gyroscope**: the lid lifts, the flight controller rises out of the body, the gyro chip lights up and three axis rings follow the real drone. Then **Match the ghost**: a see-through drone takes five poses and the participant tilts the real drone to copy each one, against the clock.
    3. **Direction**: top view, an arrow sweeps 270° from the nose to where the board's arrow really points; one button sets CW 270° and saves.
    4. **Level**: a gravity arrow through the drone; calibration only unlocks once the drone has been flat and still for two seconds.
    5. **Motors**: the motors lift off their arms to show the ESCs and the three phase wires, then a sandbox: choose a direction per motor, take off, and watch it hover, spin or flip.
    6. **Safety**: the 3D props come off when "props off" is ticked; the battery slides in when one is detected. The motor test stays locked until all three are true.
    7. **Spin test**: hold to spin a real motor, say which way it turned; the direction is only revealed after answering.
    8. **Radio**: the receiver lifts out sending waves; the 3D drone tilts, turns and climbs with the real sticks.
    9. **Ready**: the drone hovers; pre-flight checklist and a plain-language list of what still blocks arming.
- The 3D view can be dragged in any direction and zoomed with the scroll wheel on every step.
- English and Dutch.

Progress lives in `sessionStorage`, so it survives the reboot after saving, but the next group on the same laptop starts fresh once the browser is closed. If the connection drops mid-flow, the welcome page says which step to carry on from.

## The 3D model

The printed frame (body, arms, lid, latches, ESC mounts) and the flight stack (F4V3S, Matek power board, standoffs, screws) come from the team's `DronoBoxV2.step`, meshed by `tools/dronobox/build_kit_mesh.py` into `src/public/dronobox/dronobox-v2.bin` (1.2 MB, about 110k triangles; the four arms and ESC mounts are one mesh turned four ways). The STEP file itself is not in this repo. Rebuild with:

```bash
pip install gmsh numpy
python tools/dronobox/build_kit_mesh.py DronoBoxV2.step src/public/dronobox/dronobox-v2.bin
```

Motors, propellers, ESCs, receiver and battery are not in the STEP; they are modelled in `src/dronobox/stage/kitParts.ts` to their datasheet sizes (X2807 motor with spoked bell, MR 8045 props with their real pitch twist, LittleBee 20A in heat shrink, RP2 receiver, Turnigy 3S 2200 with strap, XT60 and balance lead).

## Instructor mode

**Instructor mode** link on the welcome page, or the graduation-cap button in the lesson header; PIN `0063` (set in `src/dronobox/kit.ts`). This shows every Betaflight tab, the search and the login, and adds **Instructor tools**:

- Reset this group's progress.
- Reset kit to the DronoBox baseline: runs a CLI batch and saves. **Empty until someone pastes a working kit's `diff all` into `baselineCli`.** Needs firmware 4.5.4 or newer.

The PIN keeps curious hands out of PID tuning. It is not security.

In a dev build (`npm run dev`) every step can be opened or skipped without the PIN, and the welcome page has **Try it without a drone**, which connects Betaflight's built-in virtual flight controller.

## Defaults that differ from upstream

On a laptop's first run (`src/dronobox/init.ts`):

- Analytics opted out (upstream is opt-out, i.e. on).
- Auto-Connect on, so plugging in connects. A DronoBox save also turns it on for the session, so the app always comes back after the reboot.
- The first-run Options dialog is skipped.

## Files

New:

- `src/components/tabs/DronoBoxTab.vue`: the guided flow.
- `src/components/dronobox/`: `KitStageView` (3D canvas and part labels), `MotorMap`, `StickCheck`, `ArmingStatus`, `InstructorDialog`, `DronoBoxWelcome`, `DronoBoxLogo`.
- `src/dronobox/stage/`: `KitStage` (scene, camera shots, exploded views, overlays, sandbox flight), `kitParts` (bought parts and overlays), `kitMesh` (loader for the CAD mesh).
- `src/composables/dronobox/useDronoBoxFc.ts`: all flight-controller traffic for the tab. It reuses upstream composables (`useMotorTesting`, `useMotorsData`, `useMspCliSession`, `useReboot`).
- `src/stores/dronobox.ts`: progress, motor answers, instructor lock.
- `src/dronobox/kit.ts`: kit facts (alignment, motor map, PIN, baseline, source URL).
- `src/dronobox/sandbox.ts`, `armingReasons.ts`, `init.ts`, `dronobox.css`.
- `locales/{en,nl}/dronobox.json`: strings in their own i18next namespace, so Crowdin updates to `messages.json` never conflict.
- `tools/dronobox/build_kit_mesh.py`, `src/public/dronobox/dronobox-v2.bin`.

Changed upstream files (kept small to make rebasing easy):

- `src/components/sidebar/sidebar_items.ts`, `useVisibleTabs.ts`, `Sidebar.vue`: `workshop` flag, lock filter, instructor menu, search and login hidden while locked.
- `src/components/tabs/LandingTab.vue`: welcome page while locked.
- `src/js/tab_switch.ts`: open the DronoBox tab after connecting while locked.
- `src/js/vue_tab_registry.ts`, `src/stores/navigation.ts`: register and allow the tab.
- `src/js/localization.ts`: `dronobox` namespace.
- `src/js/main.ts`: apply first-run defaults.
- `src/App.vue`, `src/index.html`: DronoBox name and logo, full-window mode while locked.
- `vite.config.js`: Vercel commit fallback, cache the kit mesh for offline use.

## Not done yet

- Not tried on a real DronoBox. The virtual flight controller reports a constant attitude, so the live gyro lessons, the ghost game and the stillness check were only exercised in code and with simulated values.
- The attitude sign convention is copied from Betaflight's Setup tab; check on a real board that tilting the nose down tips the 3D nose down.
- On firmware with MSP API 1.47+ (2025.12 and later) alignment goes through the CLI (`gyro_1_sensor_align`). On older firmware it goes through MSP. Check which firmware the kits run.
- `baselineCli` is empty.
- Remaining Betaflight branding: PWA icons (`src/images/pwa`), favicon, the sponsor tile on the firmware flasher (instructor-only).
- Dutch strings need a read-through by a native speaker.

## Run

```bash
npm ci
npm run dev
```

Then open http://localhost:8080 in Chrome or Edge.

## Hosting (Vercel + Cloudflare DNS)

`vercel.json` builds the static site (`npm run build`, output `src/dist`, install with `--ignore-scripts` so husky does not look for a git hooks folder). `vite.config.js` falls back to `VERCEL_GIT_COMMIT_SHA` because Vercel builds have no `.git`.

1. The code lives in the public fork [ramzxy/dronobox-app](https://github.com/ramzxy/dronobox-app) on branch `dronobox` (its default branch, so pushes there deploy to production). `sourceUrl` in `src/dronobox/kit.ts` points there.
2. Vercel project `dronobox-app`, framework preset "Other"; `vercel.json` sets the rest. Node 24.
3. Domain `dronobox.droneteamtwente.nl`, added in Vercel.
4. In Cloudflare DNS, a CNAME `dronobox` to the target Vercel shows (`vercel domains inspect dronobox.droneteamtwente.nl`), proxy **off** (grey cloud), so Vercel can issue the certificate.

Web Serial only works on HTTPS, which Vercel provides.
