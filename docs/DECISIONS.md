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

Important platform limitation:
- `wa.me/<phone>?text=...` can target a phone + text but cannot attach a local binary file.
- Web/native Share can include a file but cannot reliably preselect the exact WhatsApp recipient.

Do not pretend those two behaviors can be combined reliably by a browser URL.

## Selection state

The original checkbox selection was introduced in `peermatch-v11.js` and lives in closure-owned Sets. Later attempts to infer selected records from DOM checkboxes/card positions are fragile because Shadchan grouping/reordering changes DOM order.

Preferred direction: one persistent selection owner/API, not parallel selection systems.

## PDF / screenshot import

- Profile PDF/screenshot attachment parsing is valuable because many shidduch profiles arrive as documents/images.
- `profile-pdf-ocr-v63.js` intentionally keeps the attachment even if text extraction/OCR fails.
- Extracted text should fill only empty fields so user-entered data is not overwritten.
- PDF.js handles PDF parsing. Tesseract is used for OCR fallback.
- Photos/screenshots and PDFs are different: an image Blob can render directly in `<img>`, while Android/PWA PDF viewing needs a proper renderer.

## PDF opening

The `window.open(blobUrl)` approach was tested and failed on the installed Android PWA: Chrome opened a `blob://localhost/...` page and reported it unavailable.

Decision: do not use new-tab Blob URLs for PDFs. Use one in-app PDF viewer owner, ideally reusing PDF.js already used by parsing.

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
