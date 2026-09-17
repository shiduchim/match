# PeerMatch — Final Claude Handoff (v128)

Date: 2026-09-17
Repository: `shiduchim/match`
Default branch: `main`
GitHub Pages/PWA: `https://shiduchim.github.io/match/`

This is the primary handoff for future Claude Code work. Read this file first, then `CLAUDE.md`, then `sw.js`. Treat `sw.js -> SCRIPTS` as the authoritative ordered live runtime. A root JavaScript file that is not in `SCRIPTS` is historical/dead unless another live file imports it.

## 1. Current runtime target

The v128 audit branch was created from v127 main (`b756f22d007d58d72a7df68ec4c20756688c524e`). v127 had already hardened history deletion/reconciliation and email-backup encoding. v128 is deliberately small: it removes a superseded handler layer, isolates competing WhatsApp queues, and restores the user's preferred contact-action order.

Runtime changes require a `sw.js` VERSION bump and a full close/reopen of the installed PWA. Docs-only changes do not.

## 2. What v128 changes

### A. `v124-backup-pdf-share.js` is now UI-only

Older v124 code did three jobs at once: created the Email backup button, bound PDF share buttons, and implemented an older ZIP-email flow. Later files already superseded the latter two jobs, so those old handlers remained as unnecessary competitors.

In v128 this file does only two UI tasks:

- rename the normal backup button to `Save backup to phone / computer`;
- insert the `Email backup` button placeholder (`#pmV124EmailBackup`).

Current owners after this cleanup:

- PDF-first profile sharing: `v124-pdf-share-fix.js`;
- email backup behavior: `v125-email-backup-direct.js`;
- real ZIP backup/restore format: `backup-v28.js`.

Do not move old PDF/email logic back into `v124-backup-pdf-share.js`.

### B. WhatsApp queue isolation

Four live queue systems still exist:

- `pmWaSendQueue` — selected profile(s) -> exactly one selected Shadchan (`final-fixes-v107.js`);
- `pmMultiShadWaQueue` — one profile -> multiple selected Shadchanim (`v119-multi-shadchan.js`);
- `pmGeneralWaQueueV120` — no selected Shadchan/general flow (`v120-general-whatsapp.js`);
- `pmV124PdfSendQueue` — PDF-first queue (`v124-pdf-share-fix.js`).

`v128-runtime-hardening.js` is a temporary bridge loaded last. It intercepts `localStorage.setItem` only for those exact four keys, clears the other three queues, and removes their stale bars. It also performs a one-time v128 stale-queue cleanup. It does not touch profile data or history.

This is intentionally narrow, but it is still a global `Storage.prototype.setItem` patch. Long-term cleanup should consolidate the four queue owners into one queue service and then delete `v128-runtime-hardening.js`. Do not add a fifth queue.

### C. Contact action order

`contact-actions-v56.js` now enforces the user's preferred order for Guy/Girl and Shadchan contact rows:

`Call -> Email -> WhatsApp -> SMS`

Keep this order when touching those controls.

## 3. Data safety rules

- IndexedDB database: `PeerMatchDB`.
- Main in-memory collections: `data.guys`, `data.girls`, `data.shadchanim`.
- Preserve unknown/legacy fields.
- Prefer additive changes and existing `save()` mechanisms.
- Never fabricate history or dates.
- Never use DOM card position as selection state.
- Selection source of truth is `window.pmGetSelected('guys'|'girls'|'shadchanim')` from `peermatch-v11.js`.
- Do not make destructive migrations casually.

## 4. Stable product/UX requirements

- FREE OPTIONS ONLY unless the user explicitly asks otherwise.
- Browser/PWA-first. NetSpark filtering can block public CDN dependencies.
- Reminders/follow-up are Shadchan-only unless explicitly requested otherwise.
- Kosher/basic phones matter; Call/SMS may be the only channels on some contacts.
- Avoid X/cross symbols for user decisions. Use explicit **Yes / No**.
- Waiting active = yellow; inactive = gray.
- `ב״ה` above Edit.
- Girl Photo immediately left of Edit.
- Contact action order: **Call -> Email -> WhatsApp -> SMS**.
- Israeli display/call/SMS should remain local when recognized; WhatsApp internationalizes. Preserve +1 and other international numbers.

Guy/Girl detail order:

1. Header/name/photo/meta + Edit top-right
2. Profile text
3. Looking for / To what age, when present
4. Attachment
5. Contacts
6. Quick details / other info
7. History
8. Added-to-PeerMatch date near bottom

## 5. Looking for / To what age

Owned by `profile-looking-for-v123.js`.
Fields:

- `lookingFor`
- `lookingForMaxAge`

Installed-PWA Add/Edit/Cancel/persistence was user-verified.

Open product decision: these fields are currently **not** included in outgoing share text and are not in ordinary Guy/Girl search. Ask the user before changing whether they should be public/shareable or internal-only.

## 6. Attachments and PDF-first sharing

`profile-pdf-ocr-v63.js` is the attachment owner for storage/parsing/opening.

- Attachment storage must not depend on OCR success.
- PDF.js/Tesseract may fail under NetSpark/offline.
- Images render in-app.
- Saved PDFs/non-image attachments use direct download for opening; do not reintroduce `window.open(blobUrl)`.

Explicit outgoing rule:

- if a Guy/Girl has an attached PDF, send/share the **actual PDF**, not the OCR/autofilled text;
- if the PDF is later removed, automatically fall back to the normal text profile.

Current final PDF-sharing owner is `v124-pdf-share-fix.js`. It must be loaded after older profile-share owners.

Platform limitation: a browser/PWA cannot reliably both preselect one exact WhatsApp chat and attach a local PDF. PDF sends therefore use native file sharing. Keep user prompts clear about the intended recipient.

## 7. Backup/restore

`backup-v28.js` owns the real backup format.

### Save to phone/computer

Produces a real restore-compatible ZIP:

`PeerMatch_Backup_YYYY-MM-DD.zip`

It includes IndexedDB state and stored photos/audio/attachments.

### Email backup

Owned by `v125-email-backup-direct.js` (the filename is historical; its current code is v127+).

On the user's Android Chrome/PWA path, ZIP Web Share failed even though photo/text attachment sharing works. Email backup therefore uses:

`PeerMatch_Backup_YYYY-MM-DD.txt`

That text file contains:

- header `PEERMATCH-BACKUP-TEXT-V1`;
- Base64 of the exact ZIP bytes.

It is **not encrypted**. Base64 only makes the binary contents less obvious to a casual observer.

Restore accepts either the normal `.zip` or this PeerMatch `.txt` wrapper. v127 fixed Base64 chunk-boundary correctness: encoder chunks must be divisible by 3 and decoder chunks by 4.

Do not claim this roundtrip device-verified until tested end-to-end:

email backup -> attachment visible -> send/save -> download -> Restore Backup -> verify Guys/Girls/Shadchanim, history, photos, PDFs, and audio.

## 8. WhatsApp routing owners

Do not assume every WhatsApp button has the same handler. Trace the exact path before editing.

Main selection-bar flows:

- exactly one selected Shadchan + selected profile(s): `final-fixes-v107.js` / `window.pmRouteSelectedWhatsApp()`;
- one profile + multiple Shadchanim: `v119-multi-shadchan.js`;
- no selected Shadchan/general: `v120-general-whatsapp.js`;
- Shadchan contact-card selection toolbar: `v121-shadchan-whatsapp.js`;
- Make Match: `make-match-v60-ui.js`;
- PDF-first: `v124-pdf-share-fix.js`.

Android main text flows intentionally use `whatsapp://` so returning from WhatsApp returns to PeerMatch rather than a browser `api.whatsapp.com` intermediary.

### Known lower-level inconsistency still open

Some lower-level paths still use older `wa.me` navigation and can potentially show the browser intermediary:

- ordinary Shadchan-detail WhatsApp compose in `peermatch-v19.js`;
- sender/contact compose in `profile-contact-v40.js`;
- Guy/Girl Contacts WhatsApp in `profile-contacts-v96.js`;
- inline phone-number WhatsApp in `inline-phone-actions-v92.js`.

Do not fix this by adding a broad capture listener. The v107->v115 regression was caused by capture-phase ownership. Preferred future solution: establish one shared Android-aware WhatsApp opener and update each true owner to call it.

## 9. History architecture

Important owners:

- `history-delete-v30.js` — deletion UI and paired removal;
- `dual-share-history-v100.js` — reconciliation/backfill.

v127 rules that must be preserved:

- modern pairs use the same `shareLinkId`;
- different `shareLinkId`s mean distinct repeated shares even if text/recipient are identical;
- legacy unlinked matching uses profile + Shadchan + exact text + timestamp fingerprint;
- deletion tombstones live under `pmDeletedShareHistoryV127`, bounded to 500;
- reconciliation respects tombstones;
- no global deletion by raw numeric activity ID;
- no permanent four-second reconciliation interval;
- deletion snapshots activities and rolls in-memory state back if `save()` fails.

## 10. Deployment

GitHub Pages workflow is intentionally source-of-truth driven:

- parses VERSION and SCRIPTS from `sw.js`;
- verifies every listed file exists;
- deploys that exact set;
- service worker removes only old `peermatch-v*` caches.

Do not hard-code a second runtime list in the workflow.

There is also an `android/` native wrapper/project in the repository. Do not confuse it with the PWA runtime. For PWA behavior, `sw.js -> SCRIPTS` remains authoritative.

## 11. Device verification baseline

Already device-verified by the user:

- v110 layout baseline;
- v113 PDF direct download/opening behavior;
- v115 selected-profile -> selected-Shadchan routing;
- v116 text-first + optional-photo flow and direct Android return;
- v123 Looking for / To what age Add/Edit/Cancel/persistence;
- v122 Make Match -> WhatsApp return behavior later reported working.

Not yet device-verified after the v127/v128 hardening:

- ZIP backup save;
- Gmail/share target actually receives the email `.txt` attachment;
- downloaded email `.txt` restores completely;
- fresh and old history deletions remain deleted after focus/reopen;
- same unchanged profile sent twice to the same Shadchan remains two entries;
- PDF-first WhatsApp/Email, then PDF removal -> text fallback;
- v128 queue isolation;
- v128 contact action order;
- v128 removal of superseded v124 handlers causes no regression.

## 12. Minimum regression test after v128

1. Fully close/reopen installed PeerMatch and confirm v128 loads.
2. Open Backup. Save ZIP to device.
3. Email backup. Confirm `PeerMatch_Backup_YYYY-MM-DD.txt` is actually attached.
4. Send/save the TXT, download it, restore it, and verify photos/PDF/audio/history.
5. Share a profile with an attached PDF by WhatsApp and Email; confirm actual PDF is shared.
6. Remove the PDF and confirm the same profile shares as normal text.
7. Start one WhatsApp send flow, then start a different type of flow before finishing. Confirm only one queue/prompt remains.
8. Confirm contact row order is Call, Email, WhatsApp, SMS.
9. Delete a fresh linked WhatsApp history entry, switch away/back/open detail, confirm it stays deleted.
10. Delete an old pre-link entry and repeat.
11. Send the same unchanged profile to the same Shadchan twice and confirm two separate history records remain.

## 13. Safe development procedure

For every runtime change:

1. Fetch current `main` SHA and target file SHA.
2. Read `sw.js` first.
3. Search all live scripts for the selector/function/storage key involved.
4. Identify the true current owner and capture-phase listeners.
5. Prefer editing/consolidating the owner over adding another patch layer.
6. Use a small branch.
7. Review the actual diff, not just commit messages.
8. Bump `sw.js VERSION` exactly once per runtime release.
9. Confirm all SCRIPTS files exist.
10. Merge fast-forward when safe.
11. Verify GitHub Pages succeeds.
12. Tell the user to fully close/reopen the installed PWA.
13. Never call a behavior device-verified until the user tests it.

## 14. Recommended cleanup priorities for next month

Do these only when the user wants cleanup; do not destabilize working flows for aesthetics.

1. Consolidate the four WhatsApp queue implementations into one owner/service, then remove `v128-runtime-hardening.js`.
2. Replace remaining lower-level Android `wa.me` owners with the same shared direct opener used by working main flows.
3. Reduce layered `openP/openS/renderP/renderS` wrappers and MutationObserver ownership where a single owner can replace them.
4. Decide with the user whether `lookingFor` / `lookingForMaxAge` should be included in search and outgoing shares.
5. Keep dead historical files out of `sw.js`; do not mass-delete them unless there is a clear repository-cleanup goal.

## 15. First prompt for Claude

Use this at the start of a new Claude session:

> Read `CLAUDE_HANDOFF_V128.md`, `CLAUDE.md`, and `sw.js` before changing anything. Treat `sw.js -> SCRIPTS` as the only live PWA runtime list. Preserve the v127 history and backup safety rules and the v128 ownership cleanup. Use `pmGetSelected()` for selection. Do not add another WhatsApp queue or broad capture listener. Before editing, identify the current live owner(s), explain the regression risks briefly, then make the smallest change and review the actual diff. Do not call anything device-verified unless I test it on my phone.
