# PeerMatch Architecture Notes

## Runtime model

PeerMatch is a progressively patched browser/PWA application rather than a bundled framework app.

`index.html` is the page shell. The service worker (`sw.js`) owns the live runtime script list through its `SCRIPTS` array. On navigation, `withEnhancer()` reads the HTML and injects any missing script tags before `</body>` using the current service-worker version as a query string.

This means:
- `sw.js` load order is behaviorally significant.
- many root `.js` files are historical and do not execute at all.
- a filename with a higher version number is NOT automatically live.
- a script removed from `SCRIPTS` should be considered inactive unless another live script loads it explicitly.

Current documented runtime version when this file was created: v109.

## Service worker / caching

`sw.js` uses a cache named `peermatch-v<version>`.

On install it caches the shell and the live scripts. On activation it deletes older PeerMatch caches, claims clients, and navigates open windows to the same URL with `pmv=<VERSION>`.

Navigation requests are fetched with `cache:'no-store'`, with cached `index.html`/shell fallback when offline. Non-navigation GET requests are network-first with cache fallback.

Practical consequence: after runtime changes, bump the service-worker version and fully close/reopen the installed PWA. Merely refreshing a tab may not reproduce the same update path as the installed Android app.

## Data / persistence

Known IndexedDB database: `PeerMatchDB`, version 2.

Known object stores:
- `kv`
- `inbox`

The app exposes its main working collections through a global `data` object. Important arrays include:
- `data.guys`
- `data.girls`
- `data.shadchanim`

Records have accumulated fields over many versions. Do not replace records with a new minimal schema. Prefer adding fields while preserving old ones.

Common Guy/Girl fields seen across the current code include:
- `id`
- `name`
- `age`
- `text`
- image/media fields such as `profileImage`, `photo`, `profileMediaFull`, `profileMediaThumb`
- audio fields such as `profileAudio`, `profileAudioText`
- sender/contact legacy fields such as `source`, `sourceName`, `sourcePhone`, `sourcePhone2`
- newer contact fields such as `profilePhone`, `contact1Name`, `contact1Phone`, `contact2Name`, `contact2Phone`
- `profileAttachment`, `profileAttachmentName`, `profileAttachmentType`
- `tags`, relationship/status fields, and `activities`

Common Shadchan fields include:
- `id`
- `name`
- `phone`
- `email`
- `tags`
- referral/linkage fields
- profile/attachment fields where present
- `activities`

Always inspect the actual current record readers/writers before changing the schema.

## Creation timestamps / Added date

Most newer records use `Date.now()`-style IDs, which can often serve as a historical creation timestamp. `added-date-v109.js` was introduced to show a small "Added to PeerMatch" line near the bottom of Guy/Girl/Shadchan detail screens and to preserve/recover creation dates where reliable.

Do not fabricate dates for older records if no reliable timestamp exists.

## Global monkey-patching pattern

PeerMatch has many files that do patterns like:

```js
const priorP=window.openP;
window.openP=function(k,id){
  // extra behavior
  return priorP(k,id);
};
```

Similar wrapping exists for `openS`, `renderP`, and `renderS`.

Other scripts use `MutationObserver` to keep moving or redrawing DOM fragments. Others register document/window click listeners, sometimes in capture phase and sometimes calling `stopImmediatePropagation()`.

When debugging:
1. identify every LIVE file that touches the same function/selector/event,
2. map exact load order from `sw.js`,
3. map whether handlers are capture or bubble,
4. check whether a later wrapper calls the earlier wrapper,
5. check observers that may undo a one-time DOM move after the click handler appears correct.

## Core selection behavior

`peermatch-v11.js` introduced checkbox selection for Guys, Girls, and Shadchanim and keeps the authoritative selection sets in a closure:

- `selected.guys`
- `selected.girls`
- `selected.shadchanim`

Because the object is closure-owned, later scripts cannot safely read it unless the owner exposes an API. Later patches have attempted to reconstruct selection by inspecting checked DOM boxes and mapping list cards back to `data` records. This is fragile because Shadchan grouping/reordering scripts can change card order.

Preferred future fix: expose a small stable selection API from the real selection owner, or move selection into one explicit shared owner. Avoid additional DOM-index reconstruction layers.

## Android share target

The manifest defines PeerMatch as a share target. `sw.js` handles POST requests ending in `/share-target`.

Flow:
1. Android shares text/files to PeerMatch.
2. service worker reads `FormData` (`title`, `text`, `url`, `files`).
3. it writes a `pending` entry to IndexedDB `inbox`.
4. it redirects to the app with `?pmv=<VERSION>&shared=1`.
5. live import/UI scripts process the pending item.

Incoming WhatsApp strategy therefore relies on Android's explicit Share action. PeerMatch cannot silently monitor a user's ordinary WhatsApp inbox from a PWA.

## Attachments, PDF, OCR

`profile-pdf-ocr-v63.js` is the single live owner for saved attachments end to end: parsing (text extraction for the Add/Edit form) AND, as of v111, opening the saved attachment from Guy/Girl/Shadchan detail (`openPmAttachment`). Do not add attachment-opening logic to any other file — search `sw.js`'s `SCRIPTS` array for `.pmV63Attachment`/`profileAttachment` first.

It loads PDF.js from cdnjs and Tesseract.js from jsDelivr, through a shared `loadScript()`/`pdfLib()` pair that both the text-extraction path and the viewer path reuse (one loader, cached, not duplicated per feature). For PDF input it tries selectable text first and can fall back to rendering PDF pages to canvas and OCR'ing them. Screenshot/image input can also be OCR'd.

`openPmAttachment(x)` is the saved-attachment viewer: images render directly via an object URL in `<img>`; PDFs render page-by-page onto canvases via `pdfLib()`, in a full-screen in-app overlay (`#pmAttachmentViewer`) with a Share/Save fallback button. Never `window.open(blobUrl)`, never a new tab, never a Blob URL navigation — that produced a broken `blob://localhost/...` page on Android and is why this consolidation happened. If `pdfLib()` itself fails to load (CDN/network blocked), the viewer shows an explicit "could not load" message rather than silently falling back to the old broken behavior; if PDF.js loads but a specific file fails to render, a separate generic message is shown. Either way the saved attachment itself is untouched.

Historical files such as `attachment-view-v104.js` and `pdf-open-fix-v106.js` exist in the repo but are not live in the `SCRIPTS` list — they contain their own copies of the old broken `window.open(blobUrl)` pattern; do not edit them expecting behavior to change unless intentionally reintroduced.

`final-fixes-v107.js` no longer contains any attachment-viewing code (removed at v111 when it was consolidated into `profile-pdf-ocr-v63.js`). It still owns direct selected-profile-to-Shadchan WhatsApp send (`directWhatsApp`) and reinforces top-right Edit placement (`keepEditTop`) — unrelated to attachments, left as is.

`attachment-v66.js` (internally stamped `v67`) still repositions the Shadchan saved-attachment box into the compact `.v19ShadHead` header tile and sets its short label, but as of v111 no longer binds its own click handler — clicking it runs the same `openPmAttachment` that `profile-pdf-ocr-v63.js` wired in at creation time.

## Phone normalization

`phone-links-v64.js` is the main phone helper layer.

Public helpers include:
- `window.pmNormalizePhone`
- `window.pmPhoneKey`
- `window.pmPhoneType`
- `window.pmWhatsAppDigits`

Desired behavior:
- Israeli `+972` / `00972` numbers normalize to local `0...` display/storage form when recognized.
- WhatsApp links convert recognized Israeli local numbers back to `972...` digits.
- Israeli landlines are treated differently from mobile/VoIP for SMS.
- non-Israeli international numbers should not be mangled.

`contact-phone-fix-v105.js` adds further normalization for Profile/Contact 1/Contact 2 fields and legacy source fields.

## Detail page composition

Guy/Girl detail is assembled by older core rendering, then many later scripts decorate/move sections.

Desired final order is documented in `CLAUDE.md` and `docs/TESTING.md`.

Files historically involved in detail layout include:
- `profile-display-v48.js`
- `ux-v65.js`
- `ui-fixes-v73.js`
- `edit-buttons-v77.js`
- `girl-photo-v83.js`
- `profile-under-layout-v85.js`
- `profile-contacts-v96.js`
- `stable-details-v93.js`
- `final-fixes-v107.js`

Do not assume each file still owns the behavior implied by its filename; inspect `sw.js` and current code.

## Histories

Most actions are stored on a record's `activities` array. Different versions introduced different activity shapes/types. Preserve compatibility rather than normalizing old history destructively.

For selected profile -> Shadchan sharing, the intended invariant is that both sides receive a history entry linked to the same action. `dual-share-history-v100.js` exists to help reconcile/mirror this behavior, while `final-fixes-v107.js` also directly writes both sides for its own route.

Before changing history logic, check for duplicate logging across these layers.

## Browser/device constraints

Primary runtime is an installed Android PWA plus ordinary browser access. NetSpark filtering may block or alter third-party CDN/network behavior, so a feature that depends on a CDN should fail gracefully.

The app is intentionally browser-local today. Do not introduce a paid backend or hosted service without explicit request.
