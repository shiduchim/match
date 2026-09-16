# PeerMatch Known Issues

Status captured at app version **v110**.

This file describes issues the user has actually reported or that are strongly evidenced by current live code. Do not mark an issue fixed based only on code inspection; the installed Android PWA must be tested.

## 1. PDF attachment still does not open

### User-visible behavior

Photos open correctly, but saved PDF attachments still do not.

Earlier behavior opened Chrome to a temporary URL such as:

`blob://localhost/...`

Chrome then showed the page as unavailable.

### What is known

- The PDF is generally being stored and parsed; the failure is in viewing/opening, not necessarily file storage.
- `profile-pdf-ocr-v63.js` is live and already loads PDF.js for PDF parsing/text extraction.
- `final-fixes-v107.js` is live and includes an in-app PDF.js renderer, but user testing after the v108/v109 sequence still reported PDF opening as broken.
- `attachment-v66.js` (internally stamped `v67`) contains an older `openBlob()` path and Shadchan attachment button logic (`moveShadAttachment()`) that can open Blob URLs in a new window/tab. (Corrected: earlier revisions of this document misattributed this to `ui-fixes-v73.js`, which contains no attachment logic.)
- `profile-pdf-ocr-v63.js` historically created saved-attachment detail buttons that opened an object URL in a new tab.
- Historical `attachment-view-v104.js` and `pdf-open-fix-v106.js` remain in the repo but are NOT in the current `sw.js` `SCRIPTS` array and therefore should not be assumed live.

### Desired fix

There should be one owner for saved attachment opening.

For PDF:
- render in-app,
- do not use `window.open(blobUrl)`, target `_blank`, or navigate the whole PWA to a Blob URL,
- preferably reuse already-loaded `window.pdfjsLib` when available,
- preserve a graceful Share/Save fallback.

For image attachments:
- keep the currently working in-app image behavior.

### Debugging note

Search every LIVE script for:
- `URL.createObjectURL`
- `window.open`
- `_blank`
- `.pmV63Attachment`
- `profileAttachment`

Then trace event order, including capture-phase document listeners and cloned/replaced buttons.

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
