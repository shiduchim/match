# PeerMatch — Claude Handoff

The current detailed handoff is **`CLAUDE_HANDOFF_V128.md`**.

Read in this order before changing code:

1. `CLAUDE_HANDOFF_V128.md`
2. `CLAUDE.md`
3. `sw.js`

Treat `sw.js -> SCRIPTS` as the authoritative live PWA runtime list. Do not assume an older root JavaScript file is live merely because it exists in the repository.

The v128 handoff includes the current runtime owners, backup/PDF/history rules, WhatsApp queue ownership, known lower-level `wa.me` paths, device-verification status, regression checklist, and the recommended first prompt for a new Claude session.

Do not call a behavior device-verified until the user tests it on the installed phone/PWA.
