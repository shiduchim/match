# PeerMatch Known Issues

Status captured at app version **v123**.

This file should describe current risks and previously reported bugs accurately. Do not mark a newly changed runtime behavior device-verified based only on code inspection; use `docs/TESTING.md` and the installed Android PWA.

## 1. PDF attachment opening — resolved / regression-test only

### Status: fixed at v113 and device-verified

The real bug was a competing Guy/Girl attachment owner in `whatsapp-import-v61.js` that created `.pmAttachmentBox` first and prevented the intended `profile-pdf-ocr-v63.js` path from ever running. v113 removed that competing saved-detail box.

Current behavior:
- `profile-pdf-ocr-v63.js` is the single owner for Guy/Girl saved attachment opening.
- Images open in-app.
- PDFs and other non-image attachments download directly and synchronously.
- Do not reintroduce `window.open(blobUrl)` for PDFs.
- PDF.js/Tesseract remain only for attachment parsing/OCR and may fail under NetSpark/offline conditions without affecting stored files.

If this regresses, search every LIVE file from `sw.js -> SCRIPTS` for `.pmV63Attachment`, `.pmAttachmentBox`, `profileAttachment`, `URL.createObjectURL`, and `window.open` before adding another fix.

## 2. Selected profile -> selected Shadchan -> WhatsApp — resolved / regression-test only

### Status: root cause fixed at v115; direct route and later two-step flow device-verified

The decisive bug was a `window`-level capture listener in `profile-tools-v62.js` that intercepted Guy/Girl WhatsApp clicks before the button's intended handler could run. v115 removed WhatsApp from that listener and centralized Case-B routing in `window.pmRouteSelectedWhatsApp()`.

Current rules:
- Selection source of truth is `window.pmGetSelected(k)` from `peermatch-v11.js`; never reconstruct from DOM card order.
- Guy/Girl and Shadchanim toolbars both call the same shared router first.
- Exactly one selected Shadchan + selected Guy/Girl profile(s): direct selected-Shadchan flow.
- Both Guys and Girls selected at once: clear alert, no guessing.
- Multiple profiles: one profile per message, never merged.
- v116 added text-first then optional photo-only **Yes / No** behavior and was device-verified.

When debugging clicks, always inspect `window.addEventListener(..., true)` capture listeners as well as document/button handlers.

## 3. General profile WhatsApp sharing — current behavior

### Status: implemented through v120; regression-test after unrelated share changes

When Guy/Girl profile(s) are selected with no Shadchan preselected:
- recipient chooser may use an existing Shadchan, typed recipient, or blank phone,
- blank phone is allowed so WhatsApp can open for manual recipient choice,
- text goes first,
- optional profile photo is offered afterward with **Yes / No** only when a photo exists,
- multiple profiles are handled separately.

`v120-general-whatsapp.js` owns this current Case-A flow. The superseded `v118-general-whatsapp.js` was removed from runtime/repo cleanup.

## 4. One profile -> multiple Shadchanim

### Status: implemented at v119; regression-test after routing changes

`v119-multi-shadchan.js` handles one Guy/Girl profile sent sequentially to multiple selected Shadchanim:

Shadchan 1 text -> optional photo Yes/No -> Shadchan 2 text -> optional photo -> etc.

History must remain separate per Shadchan. Profiles without photos skip the photo step.

## 5. Android “Share on WhatsApp” browser intermediary

### Status: fixed on several flows; newest Make Match path still needs final device confirmation

The unwanted screen is the `api.whatsapp.com` / “Share on WhatsApp” page that remained underneath WhatsApp and appeared when the user exited the app.

Current Android direct paths intentionally use `whatsapp://` where appropriate so PeerMatch remains underneath:
- selected profile -> selected Shadchan,
- general profile sharing,
- one profile -> multiple Shadchanim,
- Shadchan contact/profile sharing (`v121-shadchan-whatsapp.js`),
- Make Match -> WhatsApp (`make-match-v60-ui.js`, changed at v122).

The v122 Make Match direct-return behavior should still be explicitly tested on the installed Android PWA before calling that specific path device-verified.

If the browser intermediary reappears, search all LIVE scripts for `wa.me`, `api.whatsapp.com`, `whatsapp://`, `pmWhatsAppUrl`, and WhatsApp-related `location.href` assignments, then trace the actual winning handler.

## 6. Guy/Girl detail layout — mostly stabilized

### Status: attachment/contacts placement fixed at source; v123 adds a new block that still needs final device regression testing

Current intended order:
1. header / Edit,
2. profile text,
3. Looking for / To what age (when present),
4. attachment,
5. contacts,
6. quick details / other info,
7. history,
8. Added to PeerMatch near bottom.

Established owners:
- Edit/header: `edit-buttons-v77.js` (with reinforcement elsewhere),
- Guy/Girl saved attachment creation/placement: `profile-pdf-ocr-v63.js`,
- Contacts creation/placement: `profile-contacts-v96.js`,
- Looking for / To what age: `profile-looking-for-v123.js`.

Do not add a new observer just to repair placement after the fact unless the source owner truly cannot own creation-time placement.

The v123 block should be tested for duplicate creation, correct placement after all later wrappers/observers run, and correct Add/Edit/Cancel persistence.

## 7. History deletion / mirrored share recreation

### Status: fixed at v117 and tightened at v122; regression-test old and new records

WhatsApp profile-share history may exist on both profile and Shadchan sides. If only one side is deleted, `dual-share-history-v100.js` can otherwise recreate it.

Current deletion logic in `history-delete-v30.js` removes the selected entry and true linked/mirrored partner using:
- `shareLinkId` for newer shares,
- `mirroredFromProfileActivityId` / `mirroredFromShadchanActivityId` for older mirrored records.

v122 specifically tightened matching so an unrelated record that happens to have the same timestamp-style numeric activity ID is not removed.

Regression test both:
- deleting a linked WhatsApp share does not reappear,
- unrelated history with the same numeric ID on another record remains untouched.

## 8. Contact 1 Israeli +972 normalization — regression-test item

`contact-phone-fix-v105.js` normalizes Profile/Contact 1/Contact 2 and legacy fields. Profile import/parser changes can bypass assumptions, so continue testing +972 / 00972 / local Israeli and +1 numbers after profile-form work.

## 9. Third-party PDF/OCR libraries can be blocked

PDF.js and Tesseract are loaded from public CDNs in the parsing layer. NetSpark or offline conditions may block them.

Attachment storage must remain independent of successful parsing/OCR. A parser failure must never remove the attached file.

## 10. Layered script architecture remains the main systemic risk

This is not a single active bug, but it is the biggest regression source:
- global wrappers stack,
- capture handlers compete,
- `stopImmediatePropagation()` changes control flow,
- MutationObservers may run on broad DOM changes,
- historical root files can look deceptively current even when not live.

For runtime work:
1. inspect `sw.js -> SCRIPTS`,
2. identify the current owner,
3. search all LIVE files for the selector/function/event,
4. check `window` capture listeners,
5. prefer changing the real owner instead of layering another override.

## 11. v122 runtime/deployment cleanup — current regression-test item

v122:
- removed superseded v118 runtime,
- stopped loading obsolete Make Match observers/scripts,
- made Make Match use authoritative ID-based selection,
- limited service-worker cleanup to old `peermatch-v*` caches,
- changed GitHub Pages deployment to read live `VERSION`/`SCRIPTS` from `sw.js` and verify all runtime files exist.

GitHub Pages deployment passed, but deployment success does not prove app behavior. Continue smoke-testing offline shell, existing data, selection, Make Match, and current WhatsApp flows.

## 12. v123 Looking for / To what age — newest feature

### Status: implemented; final installed-PWA regression testing still needed

`profile-looking-for-v123.js` adds optional Guy/Girl fields:
- `lookingFor`
- `lookingForMaxAge`

Expected behavior:
- Add/Edit fields appear directly below Profile text.
- Looking for is multiline free text.
- To what age is optional integer 18–99.
- Existing values prefill on Edit.
- Cancel must not mutate the saved record.
- Clearing saved values and saving must persist the clear.
- Existing records without either field remain valid.
- Detail block appears below profile text and before attachment.
- Repeated open/edit/save cycles must not create duplicate blocks.

Current main at the time this status was written includes commit `8a445f9da88d953bd3605c6b34c691598da63908` (`v123: refine Looking for layout under profile`).
