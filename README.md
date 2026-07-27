# Sub Rosa

Private habit and task tracking for consensual dominant/submissive (D/s) relationships.

## What it does

- **Habits & rules** — recurring tasks, category colors, streaks, versioned rule library with acknowledgment
- **Rewards, punishments & points** — catalogs, manual or auto assignment, ledger and reward store
- **Journal** — private or shared entries per post, prompts, streak rewards
- **Chat** — real-time messaging per relationship
- **Multi-partner** — fully separate data per relationship, with a workspace-style switcher

## Principles

- **Per-relationship isolation** — habits, rules, points, journal, and chat never leak across partners
- **Client-side E2EE** — journal and chat are encrypted on device before Firestore; admins see ciphertext only
- **Consent & safety** — safeword/pause, mutual rule acknowledgment, easy exit, data export
- **PWA distribution** — installable web app (no app-store review risk for adult/kink-adjacent themes)

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| PWA | `vite-plugin-pwa` |
| Backend | Firebase Auth + Firestore + FCM |
| Hosting | Vercel or Netlify (free tier) |
| Charts | Recharts |

Designed to run at **$0/month** on Firebase Spark for personal/small-group use (no Cloud Storage in v1).

## Security model

Firestore Security Rules stop other users — they do **not** stop project admins. Sensitive content is encrypted client-side with a **per-relationship key** (Web Crypto), exchanged via QR at pairing and stored in IndexedDB. Optional recovery phrase; no server-side key reset. Encrypt: journal bodies, chat messages, freeform rule/reward/punishment text. Leave operational fields (IDs, timestamps, streak counts, point totals) in plaintext for queries and stats.

## v1 scope

**In scope:** auth & pairing, E2EE, habits, rules, rewards/punishments, points, journal, chat, stats, notifications, passcode/discreet mode, safety/consent, PWA polish.

**Deferred:** photo proof (needs Cloud Storage / Blaze), deep gamification (ranks, mystery box, quests), voice memos, home-screen widgets, calendar view, partner status, scheduled rulesets.

## Roadmap

| # | Branch | Focus |
| --- | --- | --- |
| 0 | `initialization` | README / project brief |
| 1 | `feat/scaffold-pwa` | Vite + React + TS + Tailwind + PWA shell |
| 2 | `feat/auth-relationships` | Auth, Relationship model, invite, switcher |
| 3 | `feat/e2ee` | Web Crypto keys, QR exchange, IndexedDB |
| 4 | `feat/habits` | Habits CRUD, streaks, today’s dashboard |
| 5 | `feat/rules` | Rules library, versions, acknowledgment |
| 6 | `feat/rewards-punishments` | Catalogs, apply, history, habit triggers |
| 7 | `feat/points` | Ledger, balance, reward store |
| 8 | `feat/journal` | Private/shared encrypted journal + prompts |
| 9 | `feat/chat` | Realtime encrypted chat |
| 10 | `feat/stats` | Analytics charts |
| 11 | `feat/notifications` | FCM + reminder types |
| 12 | `feat/security-customization` | Passcode, discreet mode, themes, export |
| 13 | `feat/safety-consent` | Safeword/pause, mutual ack, exit, rate limits |
| 14 | `feat/pwa-polish` | Deploy, security rules, getting started |

## Local development

```bash
npm install
cp .env.example .env   # fill in Firebase web config
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

Environment variables are documented in [`.env.example`](.env.example). Without Firebase credentials, the app can run in **demo mode** (local persistence) for UI development.

## Privacy

This app stores highly sensitive personal data. Do not log plaintext journal or chat content in crash reporting, analytics, or server logs. Prefer ciphertext-only server paths if Cloud Functions are added later.

## License

Copyright (C) 2026 strangetravels

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3.

See [LICENSE](LICENSE) for the full GNU AGPL v3 text.
