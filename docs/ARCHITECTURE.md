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

As of v113, `peermatch-v11.js` exposes `window.pmGetSelected(k)` — a thin read accessor over its existing internal `selectedItems(k)` — so other files can read the real, ID-based selection instead of reconstructing it. Prior to v113, two files (`final-fixes-v107.js` and `profile-share-v52.js`) each independently reconstructed selection by mapping checked DOM checkboxes back to a freshly-filtered `visible(k)` array **by position**, which silently breaks whenever the rendered list doesn't line up 1:1 with that array — e.g. `profile-tools-v62.js`'s `groupShadchanim()` hides referred-under Shadchan cards via a `.pmRefCollapsed` class without un-checking them, so a checked-but-hidden card still counts. `final-fixes-v107.js` now reads `window.pmGetSelected(k)` as the authoritative source; `profile-share-v52.js` had its competing selected-profile WhatsApp path removed entirely and no longer reads WhatsApp selection at all. See `docs/KNOWN_ISSUES.md` issue #2.

**Selected-profile WhatsApp send (v114):** the selected-profile WhatsApp button (`#pmWhatsApp-guys`/`#pmWhatsApp-girls`) routes between two intentional behaviors, both read through `window.pmGetSelected(k)`:
- **Case A** — no Shadchan selected (or 2+): `profile-share-v52.js`'s pre-existing `sendWhatsApp(k)` general-recipient path (pick any existing Shadchan or type a name/phone via `chooseWhatsAppRecipient()`, Web Share with photo first, `wa.me` fallback). Unchanged in behavior; only its selection reads were switched off DOM-position reconstruction.
- **Case B** — exactly one Shadchan selected (any number of profiles ≥1): `final-fixes-v107.js`'s `directWhatsApp(k)`, exposed as `window.pmSendSelectedWhatsApp(k)`.

`peermatch-v19.js` exposes `window.pmWhatsAppUrl(phone, text)` — the phone-normalization + `wa.me` URL construction extracted from `compose(x,'WhatsApp')`, the ordinary Shadchan-detail WhatsApp button's proven working code. Case B's `directWhatsApp(k)` calls this same helper (no separate `wa.me`-building code of its own). Case A keeps its own, deliberately different, local `waPhone()` — it falls back to a bare `https://wa.me/` (no number) when there's no recipient phone so WhatsApp's own contact picker can take over, which `window.pmWhatsAppUrl()` intentionally refuses to do.

Case B never merges multiple selected profiles into one WhatsApp message — Shadchanim don't want bundled profiles. `directWhatsApp(k)` sends the first profile immediately (the button tap is that profile's required tap) and persists a queue (`{k, shadchanId, ids, index}`) to `localStorage` (`pmWaSendQueue`); a bottom bar prompts "Send profile N of M" for each remaining profile, each needing its own explicit tap, one `wa.me` navigation, and one history-pair write. The queue is re-read from `localStorage` on every poll so it survives PeerMatch losing focus while WhatsApp is open. Case A already had its own, separate, pre-existing one-profile-at-a-time queue dialog (`renderWaQueue()`) for its general path — the two queues are not shared and should not be merged.

`profile-share-v52.js` — the actual owner/creator of the `#pmWhatsApp-guys`/`#pmWhatsApp-girls` button — binds that button's `.onclick` directly to this router **at the moment the button is created**, not via a document-wide capture-phase listener. This matters because that button has no stable node identity: `peermatch-v11.js`'s `ensureSelectionBar()` rebuilds the whole selection bar via `innerHTML=` on every checkbox toggle, destroying and recreating it, so binding must happen at the button's actual creation site (inside `polishBar()`) to survive that churn — a one-time bind anywhere else would be silently lost on the next toggle.

**v115 — the actual A/B decision is centralized, and the real reason v113/v114 never worked on-device:** `final-fixes-v107.js` exposes `window.pmRouteSelectedWhatsApp()` — reads `window.pmGetSelected('shadchanim')`; if not exactly one, returns `false` (caller runs its own default); otherwise reads `window.pmGetSelected('guys')`/`('girls')` — both non-empty alerts and returns `true`, exactly one non-empty calls `directWhatsApp(k)` (Case B) and returns `true`, neither non-empty returns `false`. Both `profile-share-v52.js`'s Guy/Girl WhatsApp button and `shadchan-share-v55.js`'s Shadchanim-tab WhatsApp button call this same function first and only run their own Case-A default when it returns `false` — the A/B decision cannot diverge between the two toolbars because there is exactly one place that makes it.

This was needed because v113's and v114's fixes, though correct, were never actually reachable: `profile-tools-v62.js` ran a **`window`-level** capture-phase `click` listener (`window.addEventListener('click', fn, true)`) matching `button[id^="pmWhatsApp-"]` for `guys`/`girls`, which — being registered on `window` rather than `document` or the button itself — fires before the event can reach any listener closer to the target, including a directly-assigned `.onclick`. It always won, always called `stopImmediatePropagation()`, and routed to its own bare `https://wa.me/?text=...` (no phone) via `shareProfileOne()`. No fix applied to the button or to a `document`-level listener could ever have out-prioritized a `window`-level capture listener — this is why the user's "SAME PROBLEM" report after v114 was accurate despite the v114 code being correct in isolation. Fixed by removing `pmWhatsApp-`/`WhatsApp` from that listener's selector/regex in `profile-tools-v62.js` (its Email/SMS interception, which turned out to be the real live owner for those two channels on the Guy/Girl bar, is unchanged). See `docs/KNOWN_ISSUES.md` issue #2 for the full trace, including a **6th** file (`shadchan-share-v55.js`) that had a related but separate bug on the Shadchanim tab's own WhatsApp button.

**Lesson for future selection/click work:** a "grep every live file" search for a selector must include `window.addEventListener`, not just `document.addEventListener` — a `window`-scoped capture listener beats every other listener location by definition, and this file's listener escaped three prior fix rounds because that specific search wasn't done.

**Any new code that needs "what's currently selected" must call `window.pmGetSelected(k)` — never re-derive it from DOM card position/count.** That was the actual root cause of the WhatsApp selection bug, not a one-off mistake worth re-inventing per caller.

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

`profile-pdf-ocr-v63.js` is the single live owner for saved attachments end to end: parsing (text extraction for the Add/Edit form) AND opening the saved attachment from Guy/Girl/Shadchan detail (`openPmAttachment`, consolidated here at v111). Do not add attachment-opening logic to any other file — search `sw.js`'s `SCRIPTS` array for `.pmV63Attachment`/`profileAttachment` first.

It loads PDF.js from cdnjs and Tesseract.js from jsDelivr, through a shared `loadScript()`/`pdfLib()` pair. As of v112, `pdfLib()` is used **only** by `pdfText()` for local text extraction (parsing/OCR when a PDF is attached) — it is no longer used anywhere in the opening/viewing path. For PDF input, parsing tries selectable text first and can fall back to rendering PDF pages to canvas and OCR'ing them. Screenshot/image input can also be OCR'd.

`openPmAttachment(x)` is the saved-attachment viewer/handoff, split by type:
- **Images** render directly via an object URL in `<img>`, inside a full-screen in-app overlay (`#pmAttachmentViewer`) with a Share/Save button (`shareOrDownloadAttachment`) — unchanged behavior.
- **PDFs (and anything non-image)**, as of v113, download directly and synchronously via `downloadAttachment(x, blob)`: a real `File`/named `<a download>` click, no `navigator.share()` attempt, followed by an `alert()` confirming the download and where to find it. v112 tried share-then-download for these; v111 tried an in-app PDF.js renderer. Both were superseded — see `docs/DECISIONS.md` for why.

Never `window.open(blobUrl)`, never a new tab, never a Blob URL navigation for opening an attachment — that produced a broken `blob://localhost/...` page on Android and is why the v111/v112/v113 changes happened. The saved attachment itself is never touched by any of this — a failed download only shows an `alert()`, it never deletes data.

**Important:** `.pmV63Attachment` is not the only class name this history has used for a saved-attachment box. `whatsapp-import-v61.js` (live) independently built a competing `.pmAttachmentBox` with its own broken `window.open(blobUrl)` handler, and — because it scheduled its box via `setTimeout(...,0)` versus `profile-pdf-ocr-v63.js`'s `setTimeout(...,30)` — it always won the race for Guy/Girl attachments, silently making v111's and v112's fixes dead code for that path until this was traced and removed at v113. Before touching attachment code, grep every LIVE file (cross-reference `sw.js`'s `SCRIPTS`) for both `.pmV63Attachment` and `.pmAttachmentBox`, not just the former.

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
