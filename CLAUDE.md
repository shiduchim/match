# PeerMatch — Claude Code Project Brief

Start with **`CLAUDE_HANDOFF.md`**. It contains the detailed current handoff, recent bug history, device-verification status, and safe development procedure.

PeerMatch is a browser/PWA shidduch relationship tracker. It tracks Guys, Girls, Shadchanim, profiles, contacts, referrals, history, reminders, attachments, sharing, Make Match, and backup/restore.

## Live runtime source of truth

`index.html` is mostly the shell. **`sw.js -> SCRIPTS` is the authoritative ordered live runtime list.**

A root JS file that is not in `SCRIPTS` is historical/dead unless another live file explicitly imports it.

Load order matters. The codebase has many wrappers around `openP`, `openS`, `renderP`, `renderS`, direct `.onclick` replacements, capture listeners, and MutationObservers. Before adding an override, identify the current owner and all competing live handlers.

## Current version

Current intended PWA/service-worker version: **v127**.

For runtime changes:

1. fetch current `main` and current file SHA,
2. inspect `sw.js`,
3. edit the true live owner,
4. bump `VERSION` in `sw.js`,
5. keep `SCRIPTS` ordering intentional,
6. verify GitHub Pages deployment,
7. tell the user to fully close/reopen the installed PWA.

Docs-only changes do not require a version bump.

## Data safety

- IndexedDB database: `PeerMatchDB`.
- Main collections: `data.guys`, `data.girls`, `data.shadchanim`.
- Preserve old records/unknown fields.
- Prefer additive changes.
- Use existing `save()`/load mechanisms.
- Never fabricate history or dates.
- Do not make destructive migrations casually.

## Product constraints

- **FREE OPTIONS ONLY** unless explicitly asked otherwise.
- Browser/PWA-first.
- NetSpark filtering is relevant.
- Current user is effectively the sole app user.
- Reminders/follow-up are Shadchan-only unless explicitly requested otherwise.
- Kosher/basic phones may only support Call/SMS.

## Selection source of truth

Never reconstruct selection from DOM position.

Use:

```js
window.pmGetSelected('guys')
window.pmGetSelected('girls')
window.pmGetSelected('shadchanim')
```

from `peermatch-v11.js`.

## Guy/Girl detail order

1. Header/name/photo/meta + Edit top-right
2. Profile text
3. Looking for / To what age, when present
4. Attachment
5. Contacts
6. Quick details / other info
7. History
8. Added-to-PeerMatch date near bottom

`profile-looking-for-v123.js` owns:

- `lookingFor`
- `lookingForMaxAge`

These fields are currently **not** automatically included in outgoing share text and are not part of ordinary list search. Ask before changing that product behavior.

## Attachments / PDFs

`profile-pdf-ocr-v63.js` is the key attachment owner.

- Images can render in-app.
- PDFs/non-image attachments download directly for opening.
- PDF.js/Tesseract parsing may fail under NetSpark/offline and must never be required for attachment storage.

Explicit outgoing rule: **if a Guy/Girl has an attached PDF, share the actual PDF rather than the OCR/autofilled text; if the PDF is removed, fall back to the normal text profile.**

Current PDF-first code is in `v124-backup-pdf-share.js` plus later ownership/hardening in `v124-pdf-share-fix.js`.

## Backup

`backup-v28.js` owns the real ZIP format.

- Save to phone/computer: real `PeerMatch_Backup_YYYY-MM-DD.zip`.
- Email backup: `PeerMatch_Backup_YYYY-MM-DD.txt` containing Base64 of the exact ZIP bytes because Android Chrome rejected ZIP Web Share on the user's device.
- The email `.txt` is **not encrypted**.
- Restore accepts ZIP or the PeerMatch TXT wrapper.
- v127 fixes Base64 chunk-boundary correctness for large backups.

Do an end-to-end emailed-backup restore test after touching backup logic.

## WhatsApp

Android direct text paths intentionally prefer `whatsapp://` so exiting WhatsApp returns to PeerMatch instead of an `api.whatsapp.com` intermediary.

Current main owners:

- exactly one selected Shadchan + profile(s): `final-fixes-v107.js` / `window.pmRouteSelectedWhatsApp()`
- one profile + multiple Shadchanim: `v119-multi-shadchan.js`
- no preselected Shadchan: `v120-general-whatsapp.js`
- Shadchan share/contact toolbar reinforcement: `v121-shadchan-whatsapp.js`
- Make Match: `make-match-v60-ui.js`
- PDF-first profile sharing: `v124-pdf-share-fix.js`

The v115 lesson: a `window.addEventListener(..., true)` capture listener can beat the visually obvious button handler. Inspect window/document capture handlers when debugging.

Some lower-level WhatsApp paths still have older `wa.me` behavior. Trace the exact button before modifying them. Queue consolidation is also still technical debt; see `CLAUDE_HANDOFF.md`.

## History

Important files:

- `history-delete-v30.js`
- `dual-share-history-v100.js`

v127 hardening:

- modern pairs use `shareLinkId`,
- legacy pair deletion uses a profile/Shadchan/message/timestamp fingerprint,
- deletion stores bounded tombstones in `pmDeletedShareHistoryV127`,
- repeated identical modern shares with different links stay distinct,
- the old permanent 4-second reconciliation interval is removed.

Do not revert to raw numeric activity-ID matching across records.

## Stable user-facing preferences

- Avoid X/cross symbols for choices; use explicit **Yes / No**.
- Preferred contact action order when revising that UI: **Call → Email → WhatsApp → SMS**.
- Waiting active yellow / inactive gray.
- `ב״ה` above Edit.
- Girl Photo immediately left of Edit.
- Israeli phone display/call/SMS local when recognized; WhatsApp internationalized; preserve +1/other international numbers.

## Device verification

Previously device-verified:

- v110 layout baseline
- v113 PDF direct download/opening behavior
- v115 selected-Shadchan routing
- v116 text-first + optional-photo direct flow
- v123 Looking for / To what age Add/Edit/Cancel/persistence
- v122 Make Match -> WhatsApp return behavior later reported working

Fresh regression still required after v127:

- save ZIP backup,
- email TXT backup is actually attached,
- download emailed TXT and restore it,
- verify photos/PDF/audio/history survive,
- fresh and old history deletion do not reappear,
- same unchanged profile sent twice to same Shadchan remains two separate history entries,
- PDF-first share then PDF removal -> text fallback.

## Working style

- Read `CLAUDE_HANDOFF.md` first.
- Inspect `sw.js` before coding.
- Search all live owners for the behavior.
- Prefer changing the owner to adding a new monkey patch.
- Keep fixes narrow.
- Preserve working behavior.
- Review actual diffs, not commit messages only.
- Do not call a new behavior device-verified until the user tests it.
