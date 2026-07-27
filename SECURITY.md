# Security

Sub Rosa stores highly sensitive personal relationship data. Please use this document for
responsible disclosure and known-product limitations.

## Reporting a vulnerability

If you believe you have found a security issue, email **security@strangetravels.dev**
(or open a private GitHub security advisory on this repository).

Please include:

- A clear description of the issue and impact
- Steps to reproduce (or a proof of concept)
- Whether the issue is already being exploited (if known)

Do **not** open a public issue that includes exploit details. We will acknowledge reports
and aim to provide a status update within a few business days.

## Security model (summary)

- **Firebase Security Rules** limit what other end-users can read/write.
- **Client-side E2EE** protects sensitive freeform content (journal, chat, and selected
  rule/reward/punishment text) from project admins who can bypass Security Rules.
- **Device passcode** is a local UI lock only; it is not a substitute for the encryption
  passphrase or account password.

See the README for the full encryption and key-management model.

## Known limitations

- **PWAs cannot block screenshots** the way some native apps can (there is no web
  equivalent of Android `FLAG_SECURE`). Treat a device left unlocked as a disclosure risk;
  enable the app passcode and auto-lock.
- **Discreet mode** changes the in-browser title, sidebar brand, and favicon. The install
  prompt / home-screen name still comes from the PWA manifest and may require reinstall to
  look fully generic.
- **Firebase client config** (`apiKey`, `projectId`, etc.) is public by design. Do not
  commit Admin SDK keys, service-account JSON, or Cloud Function secrets.

## Prefer encrypted data at rest

Prefer ciphertext-only storage for sensitive freeform text. Do not log plaintext journal,
chat, or rule bodies in crash reporting, analytics, or server logs.
