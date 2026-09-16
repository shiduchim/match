# PeerMatch Known Issues

Status captured at app version **v114**.

This file describes issues the user has actually reported or that are strongly evidenced by current live code. Do not mark an issue fixed based only on code inspection; the installed Android PWA must be tested.

## 1. PDF attachment does not open

### Status: real root cause found and fixed at v113 (dead code from a 4th competing file); download is now guaranteed-reliable; not yet device-tested

Do not mark this resolved from code reading alone — confirm on the installed Android PWA per `docs/TESTING.md`. This section describes the state **before** the v111 fix, then v111, then v112, then the v113 root-cause fix.

### The actual root cause (found at v113, explains why v111 and v112 had no effect)

Neither the v111 nor the v112 fix ever ran for Guy/Girl attachments. A **4th** file nobody had traced yet — `whatsapp-import-v61.js` (live, loaded before `profile-pdf-ocr-v63.js`) — wrapped `openP` to build its own competing `.pmAttachmentBox` via `attachmentDetail(k,id)`, scheduled with `setTimeout(...,0)`. `profile-pdf-ocr-v63.js`'s wrapper schedules its own box (`.pmV63Attachment`) with `setTimeout(...,30)`, and guards against a duplicate by checking for `.pmAttachmentBox` OR `.pmV63Attachment` first. Since `0ms` always fires before `30ms`, `whatsapp-import-v61.js`'s box was created *first*, every time, and `profile-pdf-ocr-v63.js`'s guard then always saw `.pmAttachmentBox` already present and returned immediately — so `detailAttachment()`/`openPmAttachment()` (all of v111's and v112's work) never executed at all. The button the user was actually tapping the whole time was `whatsapp-import-v61.js`'s own, with its own hard-coded `onclick = () => window.open(URL.createObjectURL(x.profileAttachment), '_blank', 'noopener')` — the exact broken pattern every prior fix attempt thought it had eliminated. (This only affected Guy/Girl: `whatsapp-import-v61.js` does not wrap `openS`/Shadchan the same way.) Its default insertion point (`beforebegin` `#v19EditProfile`) happened to land close to the v110-correct position because, at the `0ms` mark, `edit-buttons-v77.js` had not yet relocated `#v19EditProfile` into the header — which is why the v110 layout fix still looked correct on-device despite this being a completely different, never-before-traced box.

Fixed at v113: `attachmentDetail()` and the `openP` wrap that called it were deleted from `whatsapp-import-v61.js` (its unrelated ZIP-import and referral-by features are untouched). `profile-pdf-ocr-v63.js`'s guard was simplified to check only `.pmV63Attachment`.

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

### What changed at v113 (reliability fix, on top of the root-cause fix above)

Even with the dead-code bug fixed, v112's "try `navigator.share()`, fall back to download" pattern for PDFs carried a latent risk: `await navigator.share(...)`'s native OS dialog can consume the tap's user-activation before the code falls through to the `<a download>` click that follows it in the same function — some Android/Chrome builds will then silently drop that download since it's no longer considered user-initiated. The user confirmed they no longer need the "let Android offer an app chooser" behavior and just want reliable access to the file, so PDFs (and any other non-image attachment) now skip `navigator.share()` entirely and go straight to a synchronous, guaranteed `<a download>` click — no `await` before it, so no activation gap — followed by an explicit `alert()`: "PDF downloaded — open it from your Android Downloads…". `shareOrDownloadAttachment()` (share-then-download) is kept only for the image viewer's own Share/save button, which is a fresh standalone tap with no risk of this pattern.

The `.pmV63Attachment button` click still routes through `detailAttachment()` → `openPmAttachment()` exclusively — confirmed no other live file binds a handler to it (see debugging note below).

### Debugging note (for any future attachment work)

Before adding any new attachment-related code, search every LIVE script (cross-reference `sw.js`'s `SCRIPTS` array) for `.pmV63Attachment`, `.pmAttachmentBox` (the class the v61 competitor used — confirm nothing recreates it), `profileAttachment`, `URL.createObjectURL`, and `window.open` to confirm `profile-pdf-ocr-v63.js` is still the only one binding a click handler to the saved-attachment button. This bug survived two prior fix attempts (v111, v112) specifically because that search wasn't done broadly enough the first time — `.pmAttachmentBox` is a different class name from `.pmV63Attachment` and is easy to miss.

## 2. Selected profile -> selected Shadchan -> WhatsApp

### Status: fixed at v113 (real selection Sets) and v114 (shared proven wa.me launch, direct button binding, two-case A/B routing preserved, multi-profile send queue); not yet device-tested

Do not mark this resolved from code reading alone — confirm on the installed Android PWA per `docs/TESTING.md`.

**Correction:** earlier notes (and a prior status report) named `workflow-v103.js` as one of the two competing DOM-reconstruction files. That was a misattribution — `workflow-v103.js` is unrelated (paste-profile/call-reminders code, no WhatsApp-selection logic at all). The actual second file was **`profile-share-v52.js`**, whose file-level comment happened to say "v103," which is what caused the mix-up.

**Explicitly audited and confirmed at v113** (not just inferred from the misattribution above): `workflow-v103.js` has no `document.addEventListener('click', ...)` at all, no `#pmWhatsApp-` reference, no `visible()`/`checked()`/`tracked` selection-reconstruction helper, and no `.pmListCheck`/`list.children` card-position mapping. Its only capture-phase listeners are on `input`/`paste` events (for phone/name auto-cleanup as the user types), and every `.onclick` in the file targets an element it creates itself (its own Paste button, call-reminder buttons, the calls badge/dialog) — none of it touches selection or WhatsApp. It was never a second owner of this flow and required no changes. If this bug resurfaces, do not re-suspect `workflow-v103.js` without new evidence — this file has been cleared.

### Required behavior

There are two intentional, distinct behaviors behind the same button, routed by whether a Shadchan is selected — see "What changed at v114" below for why this matters and was almost collapsed into one path by mistake.

**Case A — profile(s) selected, no Shadchan selected:** keep the pre-existing general WhatsApp/share behavior (lets the user pick any recipient, an existing Shadchan or typed name/phone).

**Case B — exactly one Shadchan selected, with one or more Guy/Girl profiles selected:**

1. Check one or more Guy/Girl profiles.
2. Check exactly one Shadchan.
3. Switching between tabs must not clear either selection.
4. Tap WhatsApp in the selected-profile toolbar.
5. WhatsApp should open directly to the selected Shadchan's number with the first selected profile's text prefilled.
6. Record the action in both histories (that profile's and the Shadchan's) before handoff.
7. If more than one profile was selected, they are **never merged into a single WhatsApp message** — Shadchanim don't want bundled profiles. Instead, after the first one is sent, PeerMatch shows a persistent "Send profile 2 of 3" prompt; each further profile requires its own explicit tap before the next `wa.me` navigation, and its own history entry pair, repeating until the queue is empty.

### Root cause (traced before fixing)

`peermatch-v11.js` owns the real selection state in a closure-private `selected={guys:new Set(),girls:new Set(),shadchanim:new Set()}`, updated by record ID whenever a checkbox is toggled — this is always correct regardless of how the list is displayed. Nothing exposed it, so two other live files each independently **reconstructed** "what's checked" from DOM card position instead of reading it, and both owned a capture-phase click listener on the same `button[id^="pmWhatsApp-"]`:
- `final-fixes-v107.js`'s `checked(k)`/`stampCards(k)` stamped `data-pmRecordId` onto `[...list.children]` by index against a freshly-filtered `visible(k)` array, then read back checked boxes by that stamp.
- `profile-share-v52.js`'s `selectedShadchan()`/`itemForCheckbox()` did the same index-against-`visible(k)` mapping independently, with no fallback to the real Sets at all for the Shadchan side.

Both assume the *n*-th `.card` in the DOM corresponds to the *n*-th item in a freshly-recomputed `visible(k)`. That assumption is unsafe in this codebase on principle — the Shadchan list has grouping/collapsing (`profile-tools-v62.js`'s `groupShadchanim()`, which hides referred-under cards via a `.pmRefCollapsed` class without un-checking them) and multiple other scripts touching the same list — so a **checked-but-now-collapsed/hidden** Shadchan card can still be counted, while a freshly-checked visible one is missed, producing exactly the "doesn't reliably open the right chat" symptom. Since `final-fixes-v107.js` loads first and always got first refusal on the click (via `stopImmediatePropagation()` when its own miscount happened to read as "exactly 1"), `profile-share-v52.js`'s parallel reconstruction (with its own `chooseWhatsAppRecipient()` manual-entry dialog as a fallback) would only ever run when v107's independent miscount didn't land on exactly 1 — two unsynchronized fragile paths, not one.

### What changed at v113

- `peermatch-v11.js`: exposes `window.pmGetSelected(k)`, returning the real Set-backed selection (`selectedItems(k)` — a function that already existed internally, now just readable from outside). No second selection system was created.
- `final-fixes-v107.js`: `directWhatsApp(k)` now reads `window.pmGetSelected(k)` and `window.pmGetSelected('shadchanim')` directly instead of `checked()`. Alerts clearly when 0 or 2+ Shadchanim are selected instead of silently doing nothing or falling through to a different handler. `checked()`/`stampCards()`/`visible()` (the DOM-reconstruction code) and the `data-pmRecordId` stamping are deleted — confirmed nothing else in the codebase read that attribute. The click listener now unconditionally owns `#pmWhatsApp-guys`/`#pmWhatsApp-girls` (it's the sole handler now, so it no longer needs to "peek" at counts before deciding whether to yield to a fallback).
- `profile-share-v52.js`: `sendWhatsApp()`, `selectedShadchan()`, `chooseWhatsAppRecipient()`, `shareOneWhatsApp()`, `closeWaQueue()`/`renderWaQueue()`, and the WhatsApp branch of its click listener are deleted entirely. Its SMS path (`sendSms`, `shareOneSms`, the SMS queue dialog, `selectedItems`/`tracked` checkbox-tracking) and its `polishBar()` (which still *creates* both the WhatsApp and SMS buttons — v107 needs that button to exist) are untouched.
- At v113, the `wa.me` navigation and phone normalization inside `final-fixes-v107.js` were left as its own `waPhone()` (trying `pmWhatsAppDigits` first, with an inline fallback) — a **separate implementation** from the one the ordinary Shadchan-detail WhatsApp button actually uses. The profile-text message body and the paired one-entry-per-side history write (`saveShare`) were unchanged.

### What changed at v114

The user reported that the ordinary Shadchan-detail WhatsApp button (`peermatch-v19.js`'s `compose(x,'WhatsApp')`) already works reliably on their Android phone, and asked for the selected-profile flow to reuse that exact proven mechanism instead of maintaining a second implementation.

Root cause of why the two buttons weren't on the same path: `#v19Wa` (Shadchan-detail) is bound once, directly, on a freshly-rendered element right after `openS()` renders it — nothing else ever touches that node. The selected-profile `#pmWhatsApp-guys`/`#pmWhatsApp-girls` button has no such stable identity: `peermatch-v11.js`'s `ensureSelectionBar()` rebuilds the *entire* selection bar via `bar.innerHTML=` on every single checkbox toggle (it's invoked from `renderP()`/`renderS()`), destroying and recreating the bar's children; the WhatsApp/SMS buttons are then re-added asynchronously afterward by `profile-share-v52.js`'s `polishBar()`, debounced through `requestAnimationFrame`. A button with that lifecycle can't be reliably bound with a single one-time `.onclick=` done anywhere else — which is exactly why `final-fixes-v107.js` had resorted to a document-wide capture-phase delegated listener. That's a workaround for node instability, not a bug by itself, but it does mean this flow's reliability depended on winning a capture-phase race against every other document-level click listener in the codebase (SMS, Email, phone-normalization's own listener, etc.) — the kind of layered-patch fragility this project's architecture notes flag repeatedly.

**Important correction made mid-implementation:** the first pass at this fix made the selected-profile WhatsApp button *always* require exactly one selected Shadchan, which would have silently deleted Case A (profile-only, no Shadchan selected → general share/pick-any-recipient) — a pre-existing, intentional behavior the user explicitly did not want touched. The `profile-share-v52.js` section below reflects the corrected two-case design, not that first pass.

Changes:
- `peermatch-v19.js`: extracted the proven phone-normalization + `wa.me` URL construction out of `compose()`'s inline WhatsApp branch into `window.pmWhatsAppUrl(phone, text)` — one shared helper, using the exact same `normalizePhone()` already in this file. `compose()` itself now calls this helper instead of inlining the URL; its behavior (activity write, message body, navigation) is otherwise byte-identical to before.
- `final-fixes-v107.js`: `directWhatsApp(k)` (Case B) now calls `window.pmWhatsAppUrl(sh.phone, text)` instead of its own `waPhone()`/manual `'https://wa.me/'+...` string-building — `waPhone()` is deleted. It is exposed as `window.pmSendSelectedWhatsApp` so the button owner (`profile-share-v52.js`) can call it directly. **The document-wide capture-phase click listener for `#pmWhatsApp-guys`/`#pmWhatsApp-girls` is deleted** — this file no longer listens for that click at all. It also no longer sends every selected profile in one merged message: `directWhatsApp` now builds a small queue (`{k, shadchanId, ids, index}`) persisted to `localStorage` under `pmWaSendQueue`, sends only the first profile immediately (the button tap itself is that profile's one required tap), and a bottom bar (`renderQueueBar()`, re-asserted on every existing `keepEditTop()` polish tick) prompts "Send profile N of M to <Shadchan>" for each remaining profile — each needs its own explicit "Send" tap, which performs exactly one `wa.me` navigation and one `saveShare()` history-pair write before advancing. Using `localStorage` (read fresh on every poll) rather than only an in-memory variable means the prompt survives PeerMatch losing focus while WhatsApp is open, and survives a full app reopen if navigation away from the tab reloads the page.
- `profile-share-v52.js`: this is the file that had its **entire Case A implementation deleted** at v113 (see "What changed at v113" above) — that turned out to be too aggressive; the user clarified Case A is intentional, pre-existing, wanted-as-is behavior, not redundant code. It has been **restored** (recovered from the pre-v113 git history) as `sendWhatsApp()`, `chooseWhatsAppRecipient()`, `shareOneWhatsApp()`, `closeWaQueue()`/`renderWaQueue()`, and its own local `waPhone()` (Case A's phone helper intentionally differs from `window.pmWhatsAppUrl()`: Case A falls back to a bare `https://wa.me/` with no number when there's no recipient phone, letting WhatsApp's own contact picker take over, where Case B intentionally refuses and alerts instead) — with its selection-reading switched from the old tracked-Set/DOM-position code to `window.pmGetSelected(k)`, consistent with the rest of this fix. The now-fully-dead old reconstruction helpers (`tracked` Set, `visible()`, `itemForCheckbox()`, `selectedCount()`, old `selectedItems()`, `visibleShadchanim()`, old `selectedShadchan()`) and the checkbox-tracking/`pmClear-` branches of its click listener were removed — nothing reads them anymore now that `pmGetSelected` is authoritative. `polishBar()` (the button's actual owner/creator) binds `.onclick` directly at creation time to a small router: **exactly one Shadchan selected → `window.pmSendSelectedWhatsApp(k)`** (Case B, regardless of profile count — multi-profile queuing is `final-fixes-v107.js`'s job, not re-implemented here); **anything else (no Shadchan, or 2+ Shadchanim) → `sendWhatsApp(k)`** (Case A, unchanged general path, itself still queuing multiple selected profiles one at a time through its own pre-existing `renderWaQueue()` dialog since a single chosen recipient may still get several separate profiles).
- History (`saveShare` in `final-fixes-v107.js`; `recordShare` in `profile-share-v52.js` for Case A, unchanged), and photo/image handling (untouched in both paths for the direct flow — Case B's selected-send flow remains text-only; attaching the stored photo was explicitly deferred by the user to a later, separate pass) are otherwise exactly as they were. Case A's existing Web-Share-with-photo-then-`wa.me`-fallback behavior was never touched.
- Ordinary Shadchan-detail Call/SMS/Email/WhatsApp behavior is unchanged other than the internal refactor above — `compose()`'s control flow and every other branch are untouched.

### Platform limitation (unchanged)

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
