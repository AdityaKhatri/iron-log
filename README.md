<div align="center">

<svg width="70" height="56" viewBox="0 0 140 112" xmlns="http://www.w3.org/2000/svg">
  <rect x="0"   y="14" width="14" height="84"  fill="#e8e8e8" />
  <rect x="20"  y="0"  width="14" height="112" fill="#e8e8e8" />
  <rect x="38"  y="34" width="8"  height="44"  fill="#888" />
  <rect x="48"  y="48" width="44" height="16"  fill="#ff5a1f" />
  <rect x="94"  y="34" width="8"  height="44"  fill="#888" />
  <rect x="106" y="0"  width="14" height="112" fill="#e8e8e8" />
  <rect x="126" y="14" width="14" height="84"  fill="#e8e8e8" />
</svg>

# IRON LOG

**Plan workouts. Track sessions. See progress.**

A local-first PWA for strength athletes — no account required, no subscription, no cloud lock-in.

[![Deploy](https://github.com/AdityaKhatri/iron-log/actions/workflows/deploy.yml/badge.svg)](https://github.com/AdityaKhatri/iron-log/actions/workflows/deploy.yml)

</div>

---

## What it does

IronLog is a mobile-first workout tracker that lives entirely on your device. Plan your training week, log sessions in the gym, and watch your lifts trend upward over time — all without handing your data to a third party.

### Plan
Build reusable workout templates with named groups (Warm-up, Main, Accessory, Cool-down) and exercise blocks with target sets, reps, weight, and rest. Arrange your schedule on a calendar — drag workouts between days, add notes, and see what's done vs. what's coming.

### Log
Start any planned workout or go freestyle. Sets are logged inline — weight and reps for strength, time for holds and stretches, distance for cardio. Mark sets complete, skip blocks, add exercises mid-session. The timer runs in the background. When you're done, the session is saved automatically.

### Track
View your history by date or filter by workout type. See per-exercise charts: top set weight, estimated 1RM (Epley formula), and total volume over time. Track bodyweight alongside your lifts. Personal records are highlighted.

### Exercises
A built-in library covers the common movements across all categories (muscle, warmup, stretching, cardio, cooldown). Each exercise has a muscle group, equipment tag, and optional YouTube video linked directly in the app. Add your own custom exercises or import a CSV to bulk-update the library.

### Profile & Sync
Set your name, date of birth, height, and preferred unit (kg/lb). Optionally back up everything to Google Drive — one JSON file stored in your app's private Drive folder, invisible to the rest of Drive. Restore from backup on a new device.

---

## Tech

| Layer | Choice |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 8 |
| Storage | IndexedDB (no Dexie, hand-rolled wrapper) |
| Charts | Chart.js |
| Sync | Google Drive appDataFolder via GIS token model |
| Hosting | GitHub Pages |
| Offline | Service worker (cache-first shell) |

No external state library. No ORM. No backend. Everything runs in the browser.

---

## Local development

```bash
git clone https://github.com/AdityaKhatri/iron-log.git
cd iron-log
npm install
npm run dev
```

The app works fully without Google Drive — sync is opt-in. To enable it locally:

```bash
cp .env.example .env
# paste your Google OAuth client ID into .env
```

See [Google Drive setup](#google-drive-setup) below for how to get that client ID.

---

## Google Drive setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Google Drive API**
3. Configure the OAuth consent screen (External) — add scopes:
   - `drive.appdata`
   - `userinfo.email`
   - `userinfo.profile`
4. Create an **OAuth 2.0 Client ID** (Web application type)
5. Add authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://<your-username>.github.io` (production)
6. Copy the client ID into `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   ```
7. For the GitHub Pages deployment, add `VITE_GOOGLE_CLIENT_ID` as a repository secret under **Settings → Secrets and variables → Actions**

---

## Deployment

Pushing to `main` triggers a GitHub Actions workflow that builds the app and deploys it to GitHub Pages automatically.

To enable it in your fork:
1. Go to **Settings → Pages**
2. Set source to **GitHub Actions**
3. Add the `VITE_GOOGLE_CLIENT_ID` secret if you want Drive sync enabled in production

---

## Data model

Six IndexedDB stores: `exercises`, `workouts`, `plan`, `sessions`, `bodyweight`, `meta`. Every record carries an `updatedAt` timestamp — this is what makes Drive sync possible without a server. Merge conflicts resolve by last-write-wins per record.

Sessions are self-contained snapshots: exercise names are denormalized into the session record, so renaming an exercise never corrupts history.

---

## License

MIT
