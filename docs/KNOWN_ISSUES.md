# PeerMatch Known Issues

Status captured at app version **v112**.

This file describes issues the user has actually reported or that are strongly evidenced by current live code. Do not mark an issue fixed based only on code inspection; the installed Android PWA must be tested.

## 1. PDF attachment does not open

### Status: v111's in-app PDF.js viewer still failed on-device; v112 hands PDFs off to the OS instead, not yet device-tested

Do not mark this resolved from code reading alone — confirm on the installed Android PWA per `docs/TESTING.md`. This section describes the state **before** the v111 fix, then v111, then what changed at v112.

### User-visible behavior (prior to the v111 fix)

Photos opened correctly, but saved PDF attachments did not.

Earlier behavior opened Chrome to a temporary URL such as:

`blob://localhost/...`

Chrome then showed the page as unavailable.

### Root cause (traced before fixing)

Three live files all bound click behavior to the same `.pmV63Attachment button`, with only one of them correct, racing via independent `MutationObserver`s and idempotency flags blind to each other:
- `profile-pdf-ocr-v63.js` `detailAttachment()` always created the button with `onclick = () => window.open(URL.createObjectURL(x.profileAttachment), '_blank')` — the broken path, for both Guy/Girl and Shadchan.
- `attachment-v66.js` (internally stamped `v67`) `moveShadAttachment()`, Shadchan-only, independently re-bound the same button to its own broken `openBlob()` (`window.open('','_blank')` + `location.href=`, falling back to an `<a target=_blank>` click), guarded by `dataset.pmV67Attach`.
- `final-fixes-v107.js` `bindAttachment()` was the actual attempted fix: cloned the button and rebound it to an in-app PDF.js/image viewer (`openAttachment`), guarded by `dataset.pmV107Bound`, plus a page-wide capture-phase click interceptor as a safety net.

(Corrected: earlier revisions of this document misattributed the `openBlob()`/Shadchan-attachment logic to `ui-fixes-v73.js`, which contains no attachment code at all — it's `attachment-v66.js`.)

Historical `attachment-view-v104.js` and `pdf-open-fix-v106.js` remain in the repo with their own copies of this same broken pattern but are NOT in the current `sw.js` `SCRIPTS` array — not live, do not edit expecting behavior to change.

### What changed at v111

Consolidated to one owner: `profile-pdf-ocr-v63.js`'s `openPmAttachment(x)`, reusing the file's own existing `pdfLib()` PDF.js loader (the same one already used for attachment text extraction — no second CDN loader was introduced). `detailAttachment()` now wires the button directly to `openPmAttachment` at creation time instead of creating it broken and relying on a second script to fix it after the fact.

Removed/neutralized:
- `profile-pdf-ocr-v63.js`: the inline `window.open(blobUrl,'_blank')` onclick — replaced with a call to `openPmAttachment`.
- `attachment-v66.js`: the `openBlob()` function and its rebind of the button's `onclick` — deleted entirely. `moveShadAttachment()` still repositions the box into the Shadchan header and sets its compact label; it no longer touches click behavior.
- `final-fixes-v107.js`: `bindAttachment()`, the capture-phase attachment click interceptor, `openAttachment()`, `typeOf()`/`blobOf()`/`pdfLib()`/`closeViewer()`, and the `PDF_JS`/`PDF_WORKER` constants — all deleted (this logic now lives solely in `profile-pdf-ocr-v63.js`). The file's WhatsApp direct-send (`directWhatsApp`) and Edit-top reinforcement (`keepEditTop`) are untouched.

Behavior preserved/added:
- Images still render directly via `<img src="objectURL">`, unchanged.
- PDFs render in-app via PDF.js, page-by-page, onto canvases — never a new tab, never a raw Blob URL navigation.
- If PDF.js itself fails to load (e.g. NetSpark/network blocking the cdnjs request), the viewer shows an explicit message that the viewer could not load and to check the connection, distinct from a generic render failure — it does not fall back to opening a Blob URL.
- The saved attachment is never deleted or altered by a failed preview; Share/Save (native share sheet, or a download link) remains available regardless of preview success.

### What changed at v112

The user reported the v111 in-app PDF.js viewer **still fails** on their installed Android PWA. Rather than layer another fix on top of the renderer, the renderer was removed for PDFs: `openPmAttachment(x)` no longer attempts to render a PDF in-app at all. For any non-image attachment (PDF, or any other type) it now goes straight to `shareOrDownloadAttachment(x, blob, type)`:
1. builds a real `File` from the saved Blob using its original filename and MIME type,
2. tries `navigator.share({files:[file]})` (gated by `navigator.canShare`) so Android's native share sheet can hand the file to any installed PDF-capable app,
3. if sharing is unavailable or the type isn't shareable, falls back to a named `<a download>` click, which Chrome's download manager writes to Android's Downloads folder as a real file — never a `window.open`/navigation to a `blob:` URL.

`pdfLib()` (the PDF.js loader) is untouched and still used by `pdfText()` for local text extraction when a PDF is attached — PDF.js is no longer used anywhere in the *opening* path.

Images are unaffected: `openPmAttachment` still opens them in the same in-app full-screen viewer as before (its own Share/Save button now calls the same `shareOrDownloadAttachment` helper instead of duplicating that logic inline).

The `.pmV63Attachment button` click still routes through `detailAttachment()` → `openPmAttachment()` exclusively — no other live file binds a handler to it; ownership is unchanged from v111.

### Debugging note (for any future attachment work)

Before adding any new attachment-related code, search every LIVE script (cross-reference `sw.js`'s `SCRIPTS` array) for `.pmV63Attachment`, `profileAttachment`, `URL.createObjectURL`, and `window.open` to confirm `profile-pdf-ocr-v63.js` is still the only one binding a click handler to the saved-attachment button.

## 2. Selected profile -> selected Shadchan -> WhatsApp is still not fixed

### Required behavior

1. Check one Guy or Girl profile.
2. Check one Shadchan.
3. Switching between tabs must not clear either selection.
4. Tap WhatsApp in the selected-profile toolbar.
5. WhatsApp should open directly to the selected Shadchan's number with selected profile text prefilled.
6. Record the action in both histories before handoff.

### Current conflict

`peermatch-v11.js` owns the original selected Sets inside a closure. Later scripts cannot directly read them.

`profile-share-v52.js` has its own WhatsApp capture handler and selected-Shadchan logic. It can call `stopImmediatePropagation()`.

`final-fixes-v107.js` also registers a capture-phase click handler and attempts to determine selected records by inspecting checked DOM boxes and stamping cards with record IDs.

That DOM mapping is fragile because Shadchan grouping/referral scripts reorder, indent, hide, and decorate cards. The visible card order may not safely equal raw `data.shadchanim` order.

The previous attempt to solve this by loading `final-fixes-v107.js` before `profile-share-v52.js` did not solve the user's actual workflow.

### Preferred fix direction

Do not add another click interceptor.

Instead:
- establish one shared/persistent selection owner,
- expose selected record IDs from the core selection layer or refactor the core owner so later toolbar actions use the real Sets,
- make the selected-profile WhatsApp action use that API,
- remove/disable competing selected-recipient handlers,
- keep history logging single-owner to avoid duplicate entries.

### Platform limitation

Direct `wa.me` can preselect recipient + text but not attach a local PDF/photo. Native sharing can attach a file but cannot reliably preselect the exact WhatsApp chat. Do not treat that as an app bug.

## 3. Attachment block can move back toward the header/top-right

### Status: source-level fix applied at v110, not yet device-tested

`profile-pdf-ocr-v63.js`'s `detailAttachment()` used to default to inserting the Guy/Girl saved-attachment box `beforebegin` the first of `.sectionTitle` / `#v19EditProfile` (the Edit button) / `.v19Contact` — landing it near the header by default. `profile-under-layout-v85.js` then reactively relocated it after the fact on every DOM mutation, racing against that default.

As of v110, `detailAttachment()` takes an `isShad` flag and, for Guy/Girl (`isShad` false), inserts directly after `.v19ProfileAudio` (or the profile-text card, or `.v19Head` as a last resort) at creation time. `profile-under-layout-v85.js` no longer repositions anything — it only adds a cosmetic class to the already-correctly-placed attachment box. The Shadchan-detail attachment path (`isShad` true) is unchanged.

Do not mark this resolved from code reading alone — confirm on the installed Android PWA per `docs/TESTING.md`.

### User-visible behavior (prior to the v110 fix)

After layout fixes, the saved attachment/Open attachment UI reappeared in the top-right/header area instead of remaining below the profile text.

### Desired Guy/Girl detail order

- header / Edit
- profile text
- attachment
- contacts
- quick details / other info
- history
- added date near bottom

### Known sources of layout contention

- `ux-v65.js` moves the **form** attachment control (`#pmV63Attach`) into top tools — unrelated to saved-detail placement, do not confuse the two.
- `attachment-v66.js` (internally stamped `v67`) moves a saved **Shadchan detail** `.pmV63Attachment` into `.v19ShadHead` via `moveShadAttachment()`. (Earlier revisions of this document incorrectly attributed this to `ui-fixes-v73.js`, which contains no attachment logic — it's a translation/contact-heading file. `attachment-v66.js` is the correct file.)
- `profile-contacts-v96.js` used to default to inserting Contacts `beforebegin` the profile card (above the profile text); as of v110 it inserts `afterend` the attachment (or profile text/audio if there's no attachment) at creation time, same pattern as the attachment fix above.

Do not assume the same selector refers to the same UI context; distinguish Add/Edit form controls, Guy/Girl saved detail, and Shadchan saved detail.

### Preferred fix direction (applied at v110)

Assign one creation-time owner per detail context instead of a second script repairing placement after the fact. Done for Guy/Girl attachment (`profile-pdf-ocr-v63.js`) and Contacts (`profile-contacts-v96.js`). Shadchan-detail attachment placement (`attachment-v66.js`) and the PDF-opening handler itself are unchanged — still open, see issue #1.

## 4. Contacts ordering has regressed in the past

`profile-contacts-v96.js` originally inserts the Contacts box before the profile card. Later layout code moves it under the attachment.

This has previously caused Contacts to appear above Profile when a layout observer loses the race.

Desired order is Profile -> Attachment -> Contacts.

A stable fix should change the source owner or consolidate the layout rather than relying indefinitely on another observer to move Contacts after each mutation.

## 5. Edit placement must not regress

Edit must remain top-right on Guy/Girl detail. A previous layout patch accidentally moved it into the body below the profile.

`edit-buttons-v77.js` is the historical owner. `final-fixes-v107.js` also contains `keepEditTop()` as reinforcement.

Desired appearance includes `ב״ה` above Edit as previously established.

## 6. Contact 1 Israeli +972 normalization had a regression

User previously reported pasted profile Contact 1 retaining `972` rather than converting to local Israeli format.

`contact-phone-fix-v105.js` was added to normalize Profile/Contact 1/Contact 2 and legacy fields. Treat this as something to regression-test after profile-form changes; do not assume every parser path feeds the same field.

## 7. Third-party PDF/OCR libraries can be blocked

PDF.js and Tesseract are currently loaded from public CDNs in the parsing layer. NetSpark or offline conditions may block them.

Do not make attachment storage dependent on successful parsing. The existing design intentionally keeps the file when parsing/OCR fails.

## 8. Layered script architecture itself is a risk

This is not a single bug, but it is the main source of regressions:
- global wrappers stack,
- multiple capture handlers compete,
- `stopImmediatePropagation()` changes behavior based on registration order,
- MutationObservers repeatedly reapply layout,
- dead historical files look deceptively current.

When fixing the open issues, consolidation is preferable to another `v110-fix.js` unless there is a compelling short-term reason.

## Recently added and not yet broadly regression-tested

### v109 — Added date

`added-date-v109.js` adds an "Added to PeerMatch" line near the bottom of Guy/Girl/Shadchan details and attempts to preserve/recover real creation time.

Verify that:
- it appears low on the detail page,
- it does not jump above history or into the header,
- old records are not incorrectly stamped as newly added today,
- edits do not change the original creation date.
