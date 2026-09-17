# PeerMatch — Claude Handoff

Last major handoff refresh: 2026-09-17

This file is the quickest way to take over PeerMatch work without repeating old debugging. Read this file, then `CLAUDE.md`, then `sw.js`, then only the live files relevant to the task.

## 1. Repository and deployment

- Repository: `shiduchim/match`
- Default branch: `main`
- GitHub Pages/PWA: `https://shiduchim.github.io/match/`
- `sw.js` is the source of truth for the current PWA `VERSION` and ordered live `SCRIPTS` list.
- `index.html` is mostly the shell. Do not assume a root JS file is live unless it appears in `sw.js -> SCRIPTS` or is imported by another live file.
- GitHub Pages workflow reads `VERSION` and `SCRIPTS` from `sw.js`, verifies every live file exists, and deploys that exact runtime.
- Runtime changes require a service-worker `VERSION` bump and a full close/reopen of the installed PWA on the phone.
- Docs-only changes do not require a version bump.

## 2. Current runtime state

Current intended runtime after this handoff: **v127**.

v127 is a hardening release, not a redesign. It specifically fixes:

1. **Emailed backup encoding correctness**
   - The normal saved backup remains a real `.zip`.
   - Email backup is a plain `.txt` wrapper because Android Chrome rejected the ZIP in Web Share on the user's device.
   - The `.txt` contains the exact ZIP bytes Base64-encoded. It is not encryption.
   - Restore accepts either `.zip` or the PeerMatch `.txt` wrapper.
   - v127 fixes a Base64 chunk-boundary bug: non-final `btoa()` chunks are now a multiple of 3 bytes, so large backups do not get invalid internal `=` padding.

2. **History deletion/reconciliation correctness**
   - Modern paired WhatsApp history uses `shareLinkId`.
   - Legacy unlinked history gets a conservative pair fingerprint based on profile, Shadchan, exact message and timestamp.
   - Deletion removes the matching old partner when possible and stores a tombstone so reconciliation cannot silently recreate it.
   - `dual-share-history-v100.js` no longer runs a forever `setInterval(sync, 4000)` loop. It reconciles at startup, before detail opens, and on focus/visibility return.
   - Repeated identical modern shares are distinct when they have different `shareLinkId`s; do not collapse them just because text/recipient match.

## 3. Product context

PeerMatch is a private/community shidduch relationship tracker. The current user is effectively the sole user. It tracks:

- Guys
- Girls
- Shadchanim
- profile text and profile media
- contacts
- attachments/PDFs
- referrals
- conversation/share history
- Shadchan-only waiting/reminder workflow
- Make Match workflow
- backup/restore

Important constraints:

- **FREE OPTIONS ONLY** unless the user explicitly asks otherwise.
- Browser/PWA first; no local Node/Git workflow is assumed for the user.
- NetSpark filtering can affect external PDF/OCR libraries.
- Kosher/basic phones matter; calls/SMS may be the only option on some contacts.
- Do not build reminders/follow-up pressure around Guys/Girls. Reminders are Shadchan-only unless the user asks otherwise.

## 4. UX preferences and invariants

The user wants practical, low-friction UI and dislikes extra confirmation layers.

Guy/Girl detail order should remain:

1. Header/name/photo/meta; Edit at top-right
2. Profile text
3. Looking for / To what age, when present
4. Attachment
5. Contacts
6. Quick details / other info
7. History
8. Added-to-PeerMatch date near bottom

Other stable preferences:

- `ב״ה` above Edit.
- Girl Photo immediately left of Edit.
- Avoid X/cross symbols for user decisions; use explicit **Yes / No**.
- Contact-action preferred order: **Call → Email → WhatsApp → SMS** when that UI is being revised.
- Waiting control: yellow active, gray inactive.
- Israeli phone display/call/SMS should stay local `0...` when recognized; WhatsApp uses international digits.
- Preserve `+1` and other international numbers.

## 5. Selection source of truth

Never infer selection from DOM order.

Use:

```js
window.pmGetSelected('guys')
window.pmGetSelected('girls')
window.pmGetSelected('shadchanim')
```

These are backed by the real closure-owned selection Sets in `peermatch-v11.js`.

This matters because Shadchan cards are grouped/reordered by later scripts and DOM-position reconstruction previously selected the wrong people.

## 6. Current profile fields

Guy/Girl records include the normal fields plus optional v123 fields:

- `lookingFor`
- `lookingForMaxAge`

`profile-looking-for-v123.js` owns Add/Edit/persistence/detail rendering for those two fields.

User device testing confirmed Add/Edit/Cancel/persistence works in the installed PWA.

Current product decision still open: these two fields are **not currently included in outgoing share text** and are not part of the ordinary Guy/Girl list-search haystack. Do not silently change that without asking whether the user wants them public/shareable or internal-only.

## 7. Attachments and PDF behavior

`profile-pdf-ocr-v63.js` is the key attachment owner.

- Images can render in-app.
- PDFs/non-image attachments use direct download for opening because prior in-app/blob-window approaches failed on device.
- PDF.js and Tesseract are used for local parsing/OCR and may be unavailable under filtering/offline conditions.
- Attachment storage must not depend on OCR success.

### PDF-first outgoing profile rule

This is an explicit user requirement:

- If a Guy/Girl has an attached **PDF**, outgoing profile sharing should prefer/send the **actual PDF**, not the ugly OCR/autofilled text extracted from that PDF.
- If the PDF is later removed, PeerMatch should automatically fall back to the normal text-profile sharing behavior.

Current PDF-first runtime is in `v124-backup-pdf-share.js` plus the later owner/hardening in `v124-pdf-share-fix.js`.

Because browser deep links cannot both preselect one exact WhatsApp chat and reliably attach a local PDF, the PDF path uses native file sharing. Exact-recipient text sharing and media sharing are separate platform capabilities.

## 8. Backup / restore

`backup-v28.js` owns the real ZIP format and restore parser.

### Save to phone/computer

- Produces a real restore-compatible ZIP named like `PeerMatch_Backup_YYYY-MM-DD.zip`.
- Includes IndexedDB state plus photos/audio/attachments.

### Email backup

Current Android workaround:

- Email copy is named simply `PeerMatch_Backup_YYYY-MM-DD.txt`.
- It contains a short PeerMatch header followed by Base64 of the exact ZIP bytes.
- It can contain photos/PDFs/audio because those bytes are still inside the encoded ZIP.
- It is **not encrypted**. Base64 only makes the contents less obvious to a casual observer.
- Restore Backup accepts `.zip` and this `.txt` wrapper. The `.txt` is decoded back to a ZIP in memory and then passed to the normal restore path.

Why not email the ZIP directly? On the user's Android Chrome/PWA path, photos attached with Web Share but ZIP Web Share failed; Gmail either opened without the ZIP or the Web Share call rejected it. The text/plain wrapper is a compatibility workaround, not a security feature.

Important test after any backup change: create email backup -> send/save it -> download it back -> Restore Backup -> verify photos, PDFs, audio, Guys/Girls/Shadchanim, and history are intact.

## 9. WhatsApp routing and ownership

The biggest historical regression source is competing handlers. Always inspect all live owners before adding another.

### Exactly one selected Shadchan + selected Guy/Girl profile(s)

Shared routing decision:

```js
window.pmRouteSelectedWhatsApp()
```

implemented in `final-fixes-v107.js` after the v115 fix.

- one profile/message at a time
- direct Android `whatsapp://` text handoff
- optional photo follow-up with Yes/No
- history on profile + Shadchan sides

v115 routing and v116 text/photo flow were device-verified.

### One profile -> multiple selected Shadchanim

`v119-multi-shadchan.js`.

Sequence: Shadchan 1 text -> optional photo -> Shadchan 2 text -> optional photo -> etc.

### No Shadchan selected

`v120-general-whatsapp.js`.

- choose saved Shadchan, type recipient, or leave blank and choose inside WhatsApp
- Android uses direct `whatsapp://`
- text first, optional photo second

### Shadchan share/contact toolbar

`v121-shadchan-whatsapp.js` reinforces direct Android app opening.

### Make Match

`make-match-v60-ui.js`; v122 changed selection to `pmGetSelected()` and Android handoff to `whatsapp://`.

### Important remaining technical debt

There are still older/lower-level WhatsApp paths that historically used `wa.me`, notably ordinary Shadchan-detail compose, Guy/Girl Contacts WhatsApp, and inline phone-number WhatsApp. Do not assume every WhatsApp button uses the same owner. If the browser-style `api.whatsapp.com` screen reappears on one of those paths, trace that exact button before changing anything.

There are also multiple persisted WhatsApp queue keys (`pmWaSendQueue`, `pmMultiShadWaQueue`, `pmGeneralWaQueueV120`, `pmV124PdfSendQueue`). Normal use finishes one flow before starting another, but queue-overlap remains an architectural cleanup opportunity. Consolidate rather than adding a fifth queue.

## 10. History architecture

Modern profile-share history should have one profile-side entry and one Shadchan-side entry linked by the same `shareLinkId`.

Important live files:

- `history-delete-v30.js` — Delete UI and paired removal
- `dual-share-history-v100.js` — reconciliation/backfill for incomplete/legacy history
- `history-recipient-v96.js` and later styling files — display/recipient metadata

v127 rules:

- Matching `shareLinkId` wins.
- Explicit `mirroredFromProfileActivityId` / `mirroredFromShadchanActivityId` remain supported.
- Legacy pair matching uses profile + Shadchan + exact text + timestamp fingerprint.
- Deletion writes tombstones under localStorage key `pmDeletedShareHistoryV127`.
- Keep the tombstone list bounded; current max is 500.
- Do not revert to global deletion by raw numeric activity ID; different records can reuse timestamp-style IDs.
- Do not reintroduce the old 4-second infinite sync loop.

## 11. Known architecture risks

1. **Layered monkey patches**
   - Many scripts wrap `openP`, `openS`, `renderP`, `renderS`.
   - MutationObservers can race.
   - Capture-phase listeners can preempt direct handlers.

2. **Button ownership**
   - Later scripts may replace `.onclick` set by earlier scripts.
   - The v107→v115 WhatsApp bug was caused by a `window` capture listener, not the visually obvious button owner.

3. **Multiple queue implementations**
   - See WhatsApp section above.

4. **Third-party OCR/PDF dependencies**
   - Parsing can fail under NetSpark/offline. Stored attachments must survive.

5. **Email/WhatsApp file sharing is device-specific**
   - `navigator.share({files})` behavior varies by MIME type and target app.
   - Never infer "photos work, therefore ZIP/PDF works" without testing that exact MIME type on the device.

## 12. Device verification status

Device-verified by the user:

- v110 layout baseline
- v113 direct PDF download/opening behavior
- v115 selected-profile -> selected-Shadchan routing
- v116 text first + optional photo, direct return to PeerMatch
- v123 Looking for / To what age Add/Edit/Cancel/persistence
- v122 Make Match -> WhatsApp return behavior was later reported working

Needs fresh installed-PWA regression after v127:

- ZIP save to phone/computer
- Email `.txt` backup attachment actually appears in Gmail/share target
- Download emailed `.txt` and restore it successfully
- Restore includes photos, PDFs, audio and history
- Delete a fresh linked WhatsApp share; wait/focus/open detail; confirm it does not return
- Delete an old pre-link WhatsApp share; confirm it does not return
- Send the same unchanged profile to the same Shadchan twice; confirm both sends remain separate in history
- PDF-first WhatsApp/Email on a profile with attached PDF; then remove PDF and verify text fallback

## 13. Safe development procedure

For every runtime change:

1. Fetch current `main` and current file SHAs.
2. Read `sw.js` and confirm the file is live.
3. Search all live scripts for the selector/function/storage key involved.
4. Identify the actual current owner before editing.
5. Prefer editing the owner over adding another override.
6. Work on a small branch.
7. Review the real diff.
8. Bump `sw.js VERSION` exactly once for the runtime release.
9. Confirm every script in `SCRIPTS` exists.
10. Merge fast-forward when appropriate.
11. Confirm GitHub Pages succeeds.
12. Tell the user to fully close/reopen the installed PWA.
13. Do not call a behavior device-verified until the user tests it.

## 14. First prompt to use with Claude

When starting a new Claude session, use something close to:

> Read `CLAUDE_HANDOFF.md`, `CLAUDE.md`, and `sw.js` first. Treat `sw.js -> SCRIPTS` as the only live runtime list. Do not add another patch layer until you identify the current owner of the behavior. Preserve all v127 data/backup/history behavior, use `pmGetSelected()` for selection, keep Android direct WhatsApp behavior where already working, and make only narrow changes. Before editing, tell me which live files own the requested behavior and what regression risks you see.

That prompt is intentionally short; the detail belongs in this file so it stays version-controlled.
