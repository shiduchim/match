# PeerMatch Known Issues

Status target: **v127**.

Do not mark a behavior device-verified merely because code inspection or GitHub Pages deployment passed. Use `docs/TESTING.md` on the installed PWA.

## Resolved / regression-test only

### Saved PDF opening

Fixed and device-verified at v113. `profile-pdf-ocr-v63.js` is the intended saved-attachment owner. PDFs/non-image attachments download directly; do not reintroduce `window.open(blobUrl)`.

### Selected profile -> selected Shadchan -> WhatsApp

Root cause fixed at v115; text-first + optional-photo flow device-verified at v116. Selection must come from `window.pmGetSelected(k)`. Android direct text paths use `whatsapp://` to avoid leaving `api.whatsapp.com` underneath the PWA.

### Looking for / To what age

v123 Add/Edit/Cancel/persistence was later user-verified on the installed PWA.

### Make Match Android return behavior

v122 changed Make Match selection to `pmGetSelected()` and Android WhatsApp handoff to direct `whatsapp://`. User later reported this path working; keep as regression coverage.

## Current v127 items needing device regression

### 1. Email backup TXT attachment + roundtrip restore

Normal backup remains a real ZIP.

Email backup uses `PeerMatch_Backup_YYYY-MM-DD.txt`, containing Base64 of the exact ZIP bytes, because ZIP Web Share failed on the user's Android Chrome/PWA path.

v127 fixes a real encoding bug found during audit: the previous Base64 encoder chunked binary at `0x8000` bytes, which is not divisible by 3. Independent `btoa()` calls could therefore insert padding inside the concatenated Base64 stream. v127 uses a multiple-of-3 chunk size.

Required device test:

- Email backup appears as a real attachment in Gmail/share target.
- Send/download the `.txt`.
- Restore it.
- Verify photos, PDFs, audio, records and history survive.

The TXT wrapper is not encryption.

### 2. History deletion / resurrection

Before v127, two edge cases remained:

- old unlinked WhatsApp share pairs could be recreated by `dual-share-history-v100.js` after one side was deleted;
- repeated identical modern shares could be collapsed by old same-message duplicate logic even when they had different `shareLinkId`s.

v127 changes:

- deletion uses `shareLinkId` first;
- old unlinked pairs get a conservative profile/Shadchan/message/timestamp fingerprint;
- deleted pairs store bounded tombstones in `pmDeletedShareHistoryV127`;
- reconciliation respects tombstones;
- modern different `shareLinkId`s remain distinct;
- the old permanent `setInterval(sync, 4000)` loop was removed.

Required device tests are in `docs/TESTING.md`.

### 3. PDF-first profile sharing

Explicit requirement: if a Guy/Girl has an attached PDF, share the actual PDF instead of OCR/autofilled text; after PDF removal, fall back to normal text profile.

Current implementation is v124-era and should be tested on the installed device for both WhatsApp and Email, including PDF removal -> text fallback.

## Remaining architectural / product risks

### 4. Multiple WhatsApp queue implementations

Live/runtime queue keys include:

- `pmWaSendQueue`
- `pmMultiShadWaQueue`
- `pmGeneralWaQueueV120`
- `pmV124PdfSendQueue`

Normal use finishes one flow before starting another, but an unfinished queue plus a newly started different flow can still produce overlapping state/UI. Long-term fix should consolidate queue ownership rather than add another queue.

### 5. Lower-level WhatsApp paths may still use older `wa.me` behavior

The main selection-bar flows are direct on Android, but ordinary Shadchan-detail compose, Guy/Girl Contacts WhatsApp, and inline-phone WhatsApp historically use lower-level owners. Test those exact paths separately. If the browser intermediary returns, fix the true owner rather than adding a broad capture listener.

### 6. Looking-for fields are not shared/searchable by default

`lookingFor` and `lookingForMaxAge` are stored/displayed but are not currently added to normal outgoing share text and are not in the ordinary list-search haystack.

This is an unresolved product decision, not automatically a bug. Ask the user before changing whether these fields should be public/shareable or internal-only.

### 7. Third-party OCR/PDF parsing can be blocked

PDF.js/Tesseract are loaded from public CDNs. NetSpark/offline conditions can block parsing. Attachment storage must remain independent of parsing success.

### 8. Layered runtime architecture remains the main systemic risk

Many scripts wrap globals, replace `.onclick`, attach capture listeners, and run MutationObservers. A later patch can silently change ownership.

For any bug:

1. inspect `sw.js -> SCRIPTS`,
2. identify the actual live owner,
3. search all live scripts for the selector/function/storage key,
4. inspect `window` capture listeners,
5. prefer fixing/consolidating the owner over adding another patch layer.

## Stable deployment behavior

The GitHub Pages workflow now reads `VERSION` and `SCRIPTS` from `sw.js`, verifies every live file exists, and deploys that exact list. Service-worker cleanup is limited to old `peermatch-v*` caches.
