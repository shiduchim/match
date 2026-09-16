# PeerMatch Decisions Log

This file records conclusions and constraints that are not obvious from git diffs alone. It is intentionally terse and focuses on **why**.

## Runtime / architecture

- The app evolved through many incremental patch files. `sw.js` -> `SCRIPTS` is the only reliable indicator of what runs. Do not infer runtime ownership from filename/version alone.
- Prefer fixing/removing the real conflicting owner rather than adding another MutationObserver, capture handler, or wrapper. Several bugs persisted because a later patch only outran an older handler temporarily.
- Runtime changes require a service-worker version bump. Documentation-only changes do not.
- Current user is the only active user, so do not over-engineer multi-user release workflow unless asked.

## Cost / infrastructure

- User explicitly wants **free options only**. Do not spend time evaluating paid APIs/services unless the user asks.
- Keep PeerMatch PWA/browser-first until a native capability is actually necessary.
- A future shared/cloud database may be useful, but it should not be introduced casually because current data is private and browser-local.

## Singles vs. Shadchan follow-up

- User does **not** want the system nudging him to chase singles.
- Reminder/call-follow-up features belong on Shadchanim only unless explicitly requested otherwise.
- `workflow-v103.js` added Shadchan-oriented Call today / Call tomorrow / Clear reminders behavior.

## Profile detail layout

Chosen Guy/Girl detail order:

1. Header (name/photo/meta; Edit top-right)
2. Profile text
3. Attachment
4. Contacts
5. Quick details / other information
6. History / notes
7. Added date near bottom

Reasons:
- Profile itself is the primary information and should be read first.
- Attachment supports the profile, so it belongs directly under profile text, not in header tools.
- Contacts are important but secondary to the actual profile.
- Edit must remain easy to find and must not be pushed into body content.

`edit-buttons-v77.js` has historically owned top-right Edit placement and the small `ב״ה` above it. Do not move Edit below the profile.

Girl Photo belongs immediately left of Edit.

## Contacts

- Guy/Girl profiles may have Profile phone + Contact 1 + Contact 2 data.
- Contact 1 should sync with legacy sender/source fields for compatibility.
- Contact name should auto-fill from a matching Shadchan when possible by phone, without overwriting explicit user-entered names.
- Israeli phone display should be local `0...`; WhatsApp deep links should use `972...`.
- Preserve international numbers that are not Israeli.

## WhatsApp: incoming

- PWA cannot silently monitor WhatsApp chats.
- Supported incoming workflow is explicit Android **Share -> PeerMatch**.
- Whole conversation import should be done through WhatsApp Export Chat -> PeerMatch where appropriate.

## WhatsApp: outgoing selected profile

Desired behavior is deliberate:
- select profile(s),
- select exactly one Shadchan,
- switch tabs without losing either selection,
- press WhatsApp,
- open that Shadchan's chat directly with profile text prefilled,
- log the handoff on both profile and Shadchan histories.

Do not ask for the Shadchan again when exactly one Shadchan is already selected.

Decision (v114, implemented): the selected-send flow must reuse the exact phone-normalization + `wa.me` launch code that the ordinary Shadchan-detail WhatsApp button already uses and is confirmed working on the installed Android PWA (`peermatch-v19.js`'s `compose(x,'WhatsApp')`), rather than maintaining a second, separately-written implementation. That logic is now `window.pmWhatsAppUrl(phone, text)`, defined once in `peermatch-v19.js` and called from both `compose()` and `final-fixes-v107.js`'s `directWhatsApp()` — do not write a second `wa.me` URL builder for this direct path anywhere. Photo/image attachment for this flow is explicitly deferred: get direct recipient + profile text working and verified first; the existing stored photo is left alone for now rather than risking the text path while trying to also attach an image (`wa.me` can't reliably preselect a recipient *and* attach a local file in one action — see the platform limitation below).

**Important correction (still v114):** the selected-profile WhatsApp button hides two genuinely distinct, both-intentional behaviors, not one. Do not collapse them into a single "direct send" path:
- **Case A** — profile(s) selected, no Shadchan selected: keep the pre-existing general WhatsApp/share behavior (lets the user pick any recipient — an existing Shadchan or a typed name/phone). This is not redundant code; it was almost deleted by mistake during this same v114 pass and was restored.
- **Case B** — exactly one Shadchan selected (with one or more profiles selected): the new direct "send to this Shadchan" path described above.

Routing: `profile selected + no selected Shadchan` → Case A. `exactly one selected Shadchan` (any profile count ≥1) → Case B. The router lives in `profile-share-v52.js`'s `polishBar()`, at the button's own creation site (see "Selection state" below).

Further correction (still v114, after the above): when Case B has **more than one** selected profile, they must never be merged into a single WhatsApp message — Shadchanim do not want bundled profiles. Instead `final-fixes-v107.js`'s `directWhatsApp()` sends the first profile immediately (the tap that opened the flow) and keeps a small persistent send queue (`localStorage` key `pmWaSendQueue`: `{k, shadchanId, ids, index}`) for the rest. A bottom bar prompts "Send profile N of M to <Shadchan>"; each remaining profile requires its own explicit tap before its own single `wa.me` navigation and its own history-pair write. Using `localStorage` (re-read on every UI poll, not just an in-memory variable) is deliberate: the queue must survive PeerMatch losing focus while WhatsApp is open, per explicit requirement. Do not batch or auto-advance multiple sends without an intervening tap — Android/WhatsApp accepting each handoff reliably depends on it being a genuine user-initiated navigation.

**Decision (v115): the A/B decision must be made in exactly one shared function, not re-implemented per toolbar.** The user reported the direct-send flow still didn't work after v114 despite the v114 code being correct — the actual reason was that `profile-tools-v62.js` ran a `window`-level (not `document`-level) capture-phase click listener that always intercepted the Guy/Girl WhatsApp button first and diverted it to an unrelated bare-`wa.me` share, meaning v113's and v114's button-level fixes had never been reachable at all. Separately, the Shadchanim tab's own WhatsApp button (`shadchan-share-v55.js`) had never considered Guy/Girl selection either — a second, differently-shaped way to hit the same complaint depending on which tab's button was pressed. Fix: `final-fixes-v107.js` exposes `window.pmRouteSelectedWhatsApp()` as the single place that decides "is this Case B?" (exactly one selected Shadchan, and Guys XOR Girls selected — not both, which gets a clear alert instead of a guess). Both `profile-share-v52.js`'s and `shadchan-share-v55.js`'s WhatsApp buttons call this first and only run their own Case-A default when it returns `false`. Do not let either toolbar re-implement or duplicate this decision locally again — that duplication is exactly how the two toolbars could (and did) diverge.

**Decision (v115): a selector/listener audit for a shared button must include `window.addEventListener`, not just `document.addEventListener`.** A capture-phase listener registered on `window` fires before the event can reach any listener registered on `document` or on the target element itself, including a directly-bound `.onclick` — it is not a matter of registration order or script load order, it is structural to how DOM event capture works. `profile-tools-v62.js`'s listener escaped three separate fix rounds (v107 era through v114) because every prior audit searched for `document.addEventListener` and direct `.onclick`/`stopImmediatePropagation()` patterns without checking `window`-scoped listeners specifically. Future audits of "what handles this click" must check all three scopes (`window`, `document`, and the element itself).

Also decided at v114: the selected-profile WhatsApp button must be bound directly at its own creation site (in `profile-share-v52.js`'s `polishBar()`, which is the button's actual owner/creator) rather than via a document-wide capture-phase listener in a different file. The button has no stable DOM identity — `peermatch-v11.js`'s `ensureSelectionBar()` rebuilds the whole selection bar via `innerHTML=` on every checkbox toggle — so the bind must happen wherever the button is actually (re)created to survive that churn; a capture-phase delegated listener was a workaround for the same instability, but it also made this flow depend on winning a capture-phase race against every other document-level click listener in the codebase. Binding at the creation site removes that dependency entirely.

Important platform limitation:
- `wa.me/<phone>?text=...` can target a phone + text but cannot attach a local binary file.
- Web/native Share can include a file but cannot reliably preselect the exact WhatsApp recipient.

Do not pretend those two behaviors can be combined reliably by a browser URL.

## Selection state

The original checkbox selection was introduced in `peermatch-v11.js` and lives in closure-owned Sets. Later attempts to infer selected records from DOM checkboxes/card positions are fragile because Shadchan grouping/reordering changes DOM order.

Decision (v113, implemented): `peermatch-v11.js` exposes `window.pmGetSelected(k)` as the one persistent selection API — a thin accessor over the Set it already owned, not a new/second selection system. `final-fixes-v107.js`'s independent DOM-position reconstruction for the WhatsApp-selected-send flow was deleted and switched to this API. `profile-share-v52.js`'s competing selected-profile WhatsApp path (its own separate DOM-position reconstruction) was deleted entirely rather than switched — it no longer reads WhatsApp selection at all. See `docs/KNOWN_ISSUES.md` issue #2 and `docs/ARCHITECTURE.md`'s "Core selection behavior" for the trace and what changed.

Any future feature needing "what's selected" should call `window.pmGetSelected(k)`, never re-derive it.

Related, v114: any future feature needing to open WhatsApp to a *specific known number* with prefilled text should call `window.pmWhatsAppUrl(phone, text)` (defined in `peermatch-v19.js`), never re-derive its own phone-normalization/`wa.me`-building logic. This does not apply to `profile-share-v52.js`'s Case A general-recipient path, which intentionally keeps its own `waPhone()` because it must support the no-known-number/bare-`wa.me` case that `pmWhatsAppUrl()` deliberately refuses. See "WhatsApp: outgoing selected profile" above.

## PDF / screenshot import

- Profile PDF/screenshot attachment parsing is valuable because many shidduch profiles arrive as documents/images.
- `profile-pdf-ocr-v63.js` intentionally keeps the attachment even if text extraction/OCR fails.
- Extracted text should fill only empty fields so user-entered data is not overwritten.
- PDF.js handles PDF parsing. Tesseract is used for OCR fallback.
- Photos/screenshots and PDFs are different: an image Blob can render directly in `<img>`, while Android/PWA PDF viewing needs a proper renderer.

## PDF opening

The `window.open(blobUrl)` approach was tested and failed on the installed Android PWA: Chrome opened a `blob://localhost/...` page and reported it unavailable.

Decision (v111, superseded): do not use new-tab Blob URLs for PDFs. Use one in-app PDF viewer owner, ideally reusing PDF.js already used by parsing. Implemented as `profile-pdf-ocr-v63.js`'s `openPmAttachment()`.

**v111's in-app PDF.js viewer was also tested on the installed Android PWA and still failed.**

Decision (v112, current): stop trying to render PDFs in-app at all. A PWA holding a Blob only in memory/IndexedDB (no server URL, no filesystem path) has exactly two reliable browser-native ways to hand it to Android without a `blob:` navigation:
1. Web Share API with files (`navigator.share({files:[file]})`, gated by `navigator.canShare`) — lets Android's native share sheet offer any installed app that handles the MIME type. This is the primary path.
2. A named `<a download>` click — routed through the browser's download manager (not the navigation/rendering stack), landing in Android's Downloads folder. This is the fallback when sharing is unavailable or declined by the platform.

There is no more reliable option short of uploading to a real server and opening an `https://` URL, which conflicts with the free/local-only/privacy constraints and was not requested. `pdfLib()`/PDF.js stays in `profile-pdf-ocr-v63.js` for text extraction only — it is no longer used to open/render a PDF.

**v112's share-then-download was never actually reached: a separate, previously-untraced bug (a 4th file, `whatsapp-import-v61.js`, building its own competing `.pmAttachmentBox` and winning a `setTimeout(0)` vs `setTimeout(30)` race) made `profile-pdf-ocr-v63.js`'s whole `detailAttachment()`/`openPmAttachment()` path dead code for Guy/Girl attachments through v111 and v112.** See `docs/KNOWN_ISSUES.md` issue #1 for the full trace.

Decision (v113, current): now that the dead-code bug is fixed and the code actually runs, also drop the `navigator.share()` attempt for PDFs and go straight to the synchronous download (option 2 above), because awaiting `navigator.share()`'s native dialog can consume the tap's user-activation before the code falls through to the download, silently breaking the fallback on some Android/Chrome builds. The user confirmed they don't need the "let Android offer an app chooser" behavior — just reliable file access — so removing that risk entirely was preferred over trying to detect/work around the activation-loss case. `shareOrDownloadAttachment()` (share-then-download) is kept only for the image viewer's own Share/save button, a fresh standalone tap where this risk doesn't compound with anything upstream.

Do not reintroduce in-app PDF rendering, and do not reintroduce an automatic `navigator.share()` attempt ahead of the PDF download, without a specific reason to revisit this — the in-app renderer failed twice on the user's actual device, and the share-then-download pattern was never even verified to run due to the unrelated v61 bug, so treat its "reliability" as unproven, not proven-then-abandoned.

## Attachment placement

Old code moved attachment controls/blocks into top tools/header areas for compactness. The user rejected this for detail pages.

Decision: on Guy/Girl **detail**, attachment belongs below profile text. Do not let a MutationObserver move it back to the header.

Form controls for attaching a new PDF/screenshot may still be compact; do not confuse form layout with saved-detail layout.

## Photos

Photos currently open successfully because the app can create an object URL and render the image directly in-app.

Girl list photos were intentionally hidden in some UI iterations while keeping a click-only Photo control on detail. Preserve current intended UI unless asked to redesign.

## Audio

PeerMatch can record microphone audio/voice notes/profile audio through browser APIs where supported.

A PWA cannot record normal cellular call audio. The acceptable workflow is a post-call voice memo, not pretending to capture the phone call itself.

## History

- History is important; actions should be saved before handing off to external apps when feasible.
- Selected profile -> Shadchan sharing should appear on both sides.
- Avoid duplicate history entries when multiple legacy sharing layers are active.

## Waiting state

Waiting status is intended to be visually obvious but not intrusive: active waiting state yellow, inactive/normal state gray. Preserve placement near contact/action controls unless explicitly redesigned.

## Added date — v109

User requested an "Added to PeerMatch" date for Shadchanim, Guys, and Girls, placed low on the detail screen rather than near the header.

For older data, use a recoverable real creation timestamp (often a `Date.now()`-style record ID) when reliable. Do not label today's migration date as the original creation date.

## Translation

Profile translation support has existed, but it is secondary to preserving the original profile. Never replace or destroy original text during translation.

## Shadchan referrals

Referral/grouping features reorder or nest Shadchan list cards. Any feature mapping a checkbox's list position to `data.shadchanim[index]` must account for that or, preferably, avoid positional mapping entirely.

## Basic/kosher phone consideration

Some relevant contacts may use phones with calls/SMS only and no browser/WhatsApp. Do not make critical contact data depend exclusively on a web link or WhatsApp.
