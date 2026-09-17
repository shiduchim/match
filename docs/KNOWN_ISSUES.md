# PeerMatch Known Issues

Status target: **v128**.

Do not mark behavior device-verified from code review or CI alone. Test the installed PWA.

## Stable / regression-only

- Saved PDF opening: device-verified at v113; `profile-pdf-ocr-v63.js` remains the attachment owner.
- Selected profile -> selected Shadchan -> WhatsApp: routing fixed at v115; text-first + optional-photo flow device-verified at v116.
- Looking for / To what age: v123 Add/Edit/Cancel/persistence user-verified.
- Make Match Android return behavior: user later reported the v122 direct-return path working.

## v127/v128 items still needing installed-device regression

### Email backup TXT roundtrip

Normal backup remains a real ZIP. Email backup is `PeerMatch_Backup_YYYY-MM-DD.txt`, containing Base64 of the exact ZIP bytes because ZIP Web Share failed on the user's Android Chrome/PWA path.

v127 fixed Base64 chunk boundaries. Required test: attachment appears in Gmail/share target -> send/save -> download -> Restore Backup -> verify records, history, photos, PDFs and audio.

The TXT wrapper is not encrypted.

### History deletion / repeated shares

v127 added `shareLinkId`-first matching, conservative legacy fingerprints, bounded tombstones (`pmDeletedShareHistoryV127`), rollback on failed save, and removed the old 4-second forever reconciliation interval.

Required tests:

- fresh linked deletion stays deleted after focus/detail reopen;
- old pre-link deletion stays deleted;
- same unchanged profile sent twice to same Shadchan remains two distinct history pairs;
- deleting one repeated pair leaves the other.

### PDF-first profile sharing

If a Guy/Girl has an attached PDF, send the actual PDF instead of OCR/autofilled text. If PDF is removed, fall back to normal text.

v128 removes an obsolete competing PDF handler from `v124-backup-pdf-share.js`; `v124-pdf-share-fix.js` is the final PDF share owner. Test WhatsApp and Email plus PDF-removal -> text fallback.

### v128 WhatsApp queue isolation

Four legacy queue keys still exist. `v128-runtime-hardening.js` prevents them from coexisting and clears stale v127-and-earlier queue state once.

This is a temporary bridge. Long-term, consolidate the four queue systems and remove the global `Storage.prototype.setItem` interception rather than adding another queue.

### Contact action order

v128 restores the requested order in Guy/Girl and Shadchan contact rows:

**Call -> Email -> WhatsApp -> SMS**

Device-regression test both detail screens.

## Remaining architectural / product risks

### Lower-level WhatsApp paths still use older `wa.me`

Main selection-bar flows use direct Android `whatsapp://`, but these lower-level paths can still use `wa.me` and may show the browser intermediary:

- Shadchan detail WhatsApp compose (`peermatch-v19.js`);
- sender/contact compose (`profile-contact-v40.js`);
- Guy/Girl Contacts WhatsApp (`profile-contacts-v96.js`);
- inline phone-number WhatsApp (`inline-phone-actions-v92.js`).

Future fix: one shared Android-aware opener called by each real owner. Do not add a broad capture listener.

### Looking-for fields are not shared/searchable by default

`lookingFor` and `lookingForMaxAge` are stored/displayed but not added to outgoing share text or ordinary list search. This is a product decision, not automatically a bug. Ask the user before changing.

### Layered runtime architecture

Many scripts wrap `openP`, `openS`, `renderP`, `renderS`, replace `.onclick`, and run MutationObservers. Before a change:

1. inspect `sw.js -> SCRIPTS`;
2. identify the actual live owner;
3. search all live scripts for the selector/function/storage key;
4. inspect capture-phase listeners;
5. prefer owner consolidation over another patch layer.

### Third-party OCR/PDF parsing

PDF.js/Tesseract are CDN-loaded and may be blocked by NetSpark/offline conditions. Attachment storage must remain independent of parsing success.

## Deployment

The Pages workflow reads VERSION/SCRIPTS from `sw.js`, verifies the live files exist, and deploys that exact runtime. Service-worker cache cleanup is limited to old `peermatch-v*` caches.
