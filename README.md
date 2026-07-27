# Sub Rosa

Private habit and task tracking for consensual dominant/submissive (D/s) relationships.

## What it does

- **Habits & tasks** — recurring habits (daily / weekdays / X× per week), categories, streaks, completion history, today’s dashboard with “assigned to me” filter
- **Rules** — versioned rule library, category filters, optional partner acknowledgment, per-version ack roster, optional default-consequence link, encrypted rule bodies when the content key is unlocked
- **Rewards & punishments** — catalogs with categories, manual apply, history log, habit auto-reward on completion and auto-punishment on miss, rule default consequences, encrypted descriptions when the content key is unlocked
- **Points** — ledger, balance, reward store *(roadmap)*
- **Journal** — private or shared entries per post, prompts, streak rewards *(roadmap)*
- **Chat** — real-time messaging per relationship *(roadmap)*
- **Multi-partner** — fully separate data per relationship, with a workspace-style switcher

## Principles

- **Per-relationship isolation** — habits, rules, points, journal, and chat never leak across partners
- **Client-side E2EE** — sensitive freeform text is encrypted on device before storage; admins see ciphertext only
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
| Testing | Vitest + Testing Library + jsdom |

Designed to run at **$0/month** on Firebase Spark for personal/small-group use (no Cloud Storage in v1).

## Security model

Firestore Security Rules stop other users — they do **not** stop project admins. Sensitive content is encrypted client-side with a **per-relationship AES content key** (Web Crypto), wrapped with an Argon2id passphrase (separate from login) and transported between partners via **ECDH (P-256)** with safety-number verification. Unlocked keys live in IndexedDB; a recovery phrase can restore access. No server-side passphrase reset.

**Encrypt when the content key is unlocked:** journal bodies, chat messages, freeform rule/reward/punishment text. **Leave in plaintext for queries/stats:** IDs, timestamps, streak counts, point totals, habit completion booleans, rule titles/metadata.

If rule, reward, or punishment text was stored encrypted and the device key is locked, the UI shows a placeholder with an **Unlock in Settings** link.

## What’s built so far

| Area | Status |
| --- | --- |
| PWA shell (Vite/React/TS/Tailwind) | Done |
| Auth (email/password) + demo mode without Firebase | Done |
| Relationships, invite codes, workspace switcher | Done |
| E2EE content keys, passphrase wrap, ECDH delivery, safety numbers, recovery | Done |
| Habits CRUD, categories, streaks, history, dashboard today list | Done |
| Rules library, versions, acknowledgment, encrypted bodies | Done |
| Rewards & punishments catalogs, apply, history, habit/rule triggers | Done |
| Points / journal / chat / stats / FCM / safety UI | Not yet |

## Roadmap

| # | Branch | Focus |
| --- | --- | --- |
| 0 | `initialization` | README / project brief |
| 1 | `feat/scaffold-pwa` | Vite + React + TS + Tailwind + PWA shell |
| 2 | `feat/auth-relationships` | Auth, Relationship model, invite, switcher |
| 3 | `feat/e2ee` | Content key, passphrase wrap, ECDH, recovery, IndexedDB |
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

Requires **Node ≥ 20** (`.node-version` pins 22). Run tests with:

```bash
npm test
```

Build for production:

```bash
npm run build
npm run preview
```

Environment variables are documented in [`.env.example`](.env.example). Without Firebase credentials, the app can run in **demo mode** (local persistence) for UI development.

## Privacy

This app stores highly sensitive personal data. Do not log plaintext journal, chat, or rule bodies in crash reporting, analytics, or server logs. Prefer ciphertext-only server paths if Cloud Functions are added later.

## License

Copyright (C) 2026 strangetravels

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3.

See [LICENSE](LICENSE) for the full GNU AGPL v3 text.
