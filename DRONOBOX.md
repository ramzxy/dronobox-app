# DronoBox App

A fork of the [Betaflight App](https://github.com/betaflight/betaflight-configurator) (2026.12.0) made by DroneTeam Twente for DronoBox build workshops. Participants get one guided tab that walks them through setting up the drone they just built. Instructors unlock the full Betaflight interface with a PIN.

Betaflight is GPL-3.0-or-later and so is this fork. The files listed below were changed or added by DroneTeam Twente, starting November 2026.

## What participants see

- A welcome page instead of the Betaflight landing page (no sponsors, community links or donation box).
- After connecting, only the **DronoBox** tab. It has seven steps, mirroring the DronoBox V2 manual ("Drone Bible"):
  1. **Wake it up**: tilt the drone until the bar fills (gyro check, 3D model).
  2. **Which way is forward?**: one button sets gyro alignment to CW 270° and saves.
  3. **Find level**: accelerometer calibration.
  4. **Safety check**: props off, a team member watching, then the battery. The motor test stays locked until all three are true.
  5. **Spin test**: pick a motor on a top-view map, hold to spin it, answer which way it turned. The expected direction is only revealed after answering. A wrong answer explains the wire swap.
  6. **Radio check**: stick tasks (throttle up/down, yaw, pitch, roll) with live channel bars.
  7. **Ready to fly**: pre-flight checklist and a plain-language list of what still blocks arming.
- English and Dutch.

Progress lives in `sessionStorage`, so it survives the reboot after saving, but the next group on the same laptop starts fresh once the browser is closed.

## Instructor mode

Sidebar → settings (gear) → **Instructor mode**, PIN `0063` (set in `src/dronobox/kit.ts`). This shows every Betaflight tab, the search, the login, and adds **Instructor tools** to the DronoBox tab:

- Reset this group's progress.
- Reset kit to the DronoBox baseline: runs a CLI batch and saves. **Empty until someone pastes a working kit's `diff all` into `baselineCli`.** Needs firmware 4.5.4 or newer.

The PIN keeps curious hands out of PID tuning. It is not security.

In a dev build (`npm run dev`) every step can be opened or skipped without the PIN.

## Defaults that differ from upstream

On a laptop's first run (`src/dronobox/init.ts`):

- Analytics opted out (upstream is opt-out, i.e. on).
- Auto-Connect on, so plugging in connects and the app reconnects after the alignment save.
- The first-run Options dialog is skipped.

## Files

New:

- `src/components/tabs/DronoBoxTab.vue`: the guided flow.
- `src/components/dronobox/`: `MotorMap`, `StickCheck`, `ArmingStatus`, `InstructorDialog`, `DronoBoxWelcome`, `DronoBoxLogo`.
- `src/composables/dronobox/useDronoBoxFc.ts`: all flight-controller traffic for the tab. It reuses upstream composables (`useMotorTesting`, `useMotorsData`, `useMspCliSession`, `useReboot`).
- `src/stores/dronobox.ts`: progress, motor answers, instructor lock.
- `src/dronobox/kit.ts`: kit facts (alignment, motor map, PIN, baseline, source URL).
- `src/dronobox/armingReasons.ts`, `src/dronobox/init.ts`.
- `locales/{en,nl}/dronobox.json`: strings in their own i18next namespace, so Crowdin updates to `messages.json` never conflict.

Changed upstream files (kept small to make rebasing easy):

- `src/components/sidebar/sidebar_items.ts`, `useVisibleTabs.ts`, `Sidebar.vue`: `workshop` flag, lock filter, instructor menu, search and login hidden while locked.
- `src/components/tabs/LandingTab.vue`: welcome page while locked.
- `src/js/tab_switch.ts`: open the DronoBox tab after connecting while locked.
- `src/js/vue_tab_registry.ts`, `src/stores/navigation.ts`: register and allow the tab.
- `src/js/localization.ts`: `dronobox` namespace.
- `src/js/main.ts`: apply first-run defaults.
- `src/App.vue`, `src/index.html`: DronoBox name and logo.

## Not done yet

- Not tried on a real DronoBox. The virtual flight controller resets its config on every connect, so the alignment save could only be checked up to the reboot.
- On firmware with MSP API 1.47+ (2025.12 and later) alignment goes through the CLI (`gyro_1_sensor_align`). On older firmware it goes through MSP. Check which firmware the kits run.
- `baselineCli` is empty.
- Remaining Betaflight branding: PWA icons (`src/images/pwa`), favicon, the yellow accent colour, the sponsor tile on the firmware flasher (instructor-only).
- Dutch strings need a read-through by a native speaker.
- The settings Options dialog is still reachable while locked (language, dark mode, but also expert mode and dev settings).

## Run

```bash
npm ci
npm run dev
```

Then open http://localhost:8080 in Chrome or Edge. Without a board, turn on Expert mode in Options to get "Connect (Virtual)". The virtual board forgets its settings on every connect; the DronoBox tab remembers the alignment it wrote so the flow can still be walked through.

## Hosting (Vercel + Cloudflare DNS)

`vercel.json` builds the static site (`npm run build`, output `src/dist`, install with `--ignore-scripts` so husky does not look for a git hooks folder). `vite.config.js` falls back to `VERCEL_GIT_COMMIT_SHA` because Vercel builds have no `.git`.

1. The code lives in the public fork [ramzxy/dronobox-app](https://github.com/ramzxy/dronobox-app) on branch `dronobox` (its default branch). `sourceUrl` in `src/dronobox/kit.ts` points there.
2. Import the repo in Vercel. Framework preset "Other"; `vercel.json` sets the rest. Node 24.
3. In Vercel, add the domain (e.g. `dronobox.droneteamtwente.nl`).
4. In Cloudflare DNS, add the CNAME Vercel shows (`cname.vercel-dns.com`) with the proxy **off** (grey cloud), so Vercel can issue the certificate.

Web Serial only works on HTTPS, which Vercel provides.
