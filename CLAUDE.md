# PeerMatch — Claude Code Project Brief

PeerMatch is a browser/PWA shidduch relationship tracker for one current user. It tracks Guys, Girls, Shadchanim, profiles, contacts, referrals, history, reminders, attachments, and sharing workflows.

## Read this first

This repo is NOT a normal single-file app. `index.html` is mostly the shell. `sw.js` contains the authoritative `SCRIPTS` array and injects those JavaScript files into navigation responses in exactly that order.

**The live runtime file list is `sw.js` -> `SCRIPTS`.** A root `.js` file that is not in that array should be treated as historical/dead unless another live file explicitly imports it.

Load order is critical. Many files monkey-patch globals such as `openP`, `openS`, `renderP`, `renderS`, attach capture-phase click handlers, and run `MutationObserver`s. A later or earlier handler can silently override another patch.

Before adding a new override, find the current owner and remove/fix the conflicting behavior at the source. The project has accumulated too many layered patches already.

## Current version

Current PWA/service-worker version at the time this file was written: **v109**.

Version source of truth: `const VERSION='...'` in `sw.js`.

For a runtime code change:
1. update the relevant live file(s),
2. bump `VERSION` in `sw.js`,
3. make sure any new runtime file is added to `SCRIPTS`,
4. preserve script ordering deliberately,
5. tell the user to fully close/reopen the installed PWA so the new service worker activates.

Documentation-only changes do not require a PWA version bump.

## Persistence / data safety

- Browser-local PWA data is important. Do not perform destructive migrations casually.
- IndexedDB database: `PeerMatchDB`.
- Known stores include `kv` and `inbox`.
- Main record collections are exposed through the existing global `data` object, including `data.guys`, `data.girls`, and `data.shadchanim`.
- Use the app's existing `save()`/load mechanisms unless a persistence change is explicitly required.
- Preserve old records and fields when adding new fields. Prefer additive migration.
- Never fabricate historical dates or history entries.

## Product constraints

- **FREE OPTIONS ONLY.** Do not propose paid APIs/services unless the user explicitly asks for them.
- PWA/browser-first. NetSpark filtering is relevant on the user's devices.
- The user is currently the only app user. Do not spend effort on team workflow, branch policy, permissions, or multi-user infrastructure unless asked.
- The user does not want to chase singles. Follow-up/reminder features should be **Shadchan-only** unless explicitly requested otherwise.
- Kosher/basic phones may have calls/SMS only; do not assume a browser exists on those devices.

## Important UI invariants

For Guy/Girl detail pages, intended vertical order is:
1. header with name/photo/meta and Edit at top-right,
2. profile text,
3. profile attachment,
4. contacts,
5. quick details / other profile information,
6. history/notes,
7. small `Added to PeerMatch: ...` line near the bottom.

Do not move the Edit button below the profile. Edit belongs top-right in the header. `edit-buttons-v77.js` has historically owned this placement, including the small `ב״ה` above it.

Girl detail: the Photo control belongs immediately left of Edit.

Attachment must not jump into the top-right/header tools area on a Guy/Girl detail page.

Contacts must not be moved above the profile text.

## Phone rules

- Israeli numbers should be stored/displayed in local `0...` form when recognized.
- WhatsApp deep links should use international digits (`972...`) via the existing normalization helpers.
- Preserve +1/other international numbers rather than forcing them into Israeli format.
- Call/SMS should use the locally appropriate stored/displayed number.
- Existing helpers in `phone-links-v64.js` include `pmNormalizePhone`, `pmPhoneKey`, `pmPhoneType`, and `pmWhatsAppDigits`.

## WhatsApp product behavior

Incoming: Android Share -> PeerMatch share target -> IndexedDB `inbox` -> import flow.

Outgoing selected-profile workflow should be:
1. user checks one Guy/Girl profile,
2. user checks one Shadchan,
3. selection survives switching tabs,
4. user taps WhatsApp from the selected-profile toolbar,
5. WhatsApp opens directly to that selected Shadchan,
6. selected profile text is prefilled,
7. send/open action is recorded on BOTH the profile history and Shadchan history before handoff.

Do not create a second competing selection system. The original selection state in `peermatch-v11.js` is closure-owned and, as of **v113**, exposed read-only via `window.pmGetSelected(k)` (returns the real records for `'guys'`/`'girls'`/`'shadchanim'`). Any code that needs "what's selected" must call this — never reconstruct it from DOM card position/count. Two files used to do exactly that and it silently broke whenever the Shadchan list was reordered/grouped/collapsed: `final-fixes-v107.js` now uses `window.pmGetSelected(k)` as the authoritative selection source; `profile-share-v52.js` had its competing selected-profile WhatsApp path removed entirely and no longer reads WhatsApp selection at all. See `docs/KNOWN_ISSUES.md` issue #2.

A `wa.me` URL can preselect a phone and text, but cannot reliably attach a local binary photo/PDF. Native share can attach files but cannot reliably preselect the exact WhatsApp chat. Preserve that distinction.

## Attachment/PDF behavior

Photos/images can be shown directly from Blob/object URLs inside the app and currently work.

PDF attachments are stored and parsed. **v111's in-app PDF.js viewer and v112's share-then-download both appeared to fail on the user's installed Android PWA — but neither actually ran**: a previously-untraced 4th file, `whatsapp-import-v61.js`, built its own competing `.pmAttachmentBox` with a hard-coded broken `window.open(blobUrl)` handler and always won a `setTimeout` race against `profile-pdf-ocr-v63.js`'s box, for Guy/Girl attachments only. **v113** removed that competing box (attachment opening is now confirmed to have exactly one live owner) and, since the user no longer needs an app-chooser and just wants reliability, also dropped the `navigator.share()` attempt for PDFs: `profile-pdf-ocr-v63.js`'s `openPmAttachment` now downloads PDFs directly and synchronously (`downloadAttachment`), with a clear "PDF downloaded — open it from Downloads" alert. Do not consider this fixed until tested on the installed Android PWA — see `docs/KNOWN_ISSUES.md` issue #1 for the full trace and what still needs verification.

Do not open PDFs in a new tab using `window.open(blobUrl)` or equivalent, do not reintroduce in-app PDF rendering, and do not reintroduce an automatic `navigator.share()` attempt ahead of the PDF download, without a specific reason to revisit v113's decision. Before touching attachment code at all, grep every LIVE file (cross-reference `sw.js`'s `SCRIPTS`) for **both** `.pmV63Attachment` and `.pmAttachmentBox` — the latter is the class name that hid the real bug through two prior fix attempts.

`profile-pdf-ocr-v63.js` still uses PDF.js (`pdfLib()`) for PDF text extraction/OCR when a PDF is attached — that part is unaffected. It is the single owner for both parsing and opening; do not add a competing handler in another file.

## Current open problems

Read `docs/KNOWN_ISSUES.md` before touching attachments, WhatsApp selection, or detail layout.

The three active regressions reported immediately before this documentation was created were:
- PDF attachment still does not open.
- selected profile -> selected Shadchan -> WhatsApp still does not work reliably.
- attachment placement can move back toward the top-right/header area instead of staying under profile text.

Current status (see `docs/KNOWN_ISSUES.md` for full detail on each): attachment/contacts layout placement was fixed at the source at v110, verified on the installed Android PWA. PDF opening went through v111 (in-app viewer) and v112 (share-then-download) without ever actually running, due to an unrelated competing file (`whatsapp-import-v61.js`) always winning first; v113 removed that competitor and switched to a guaranteed synchronous download, pending device verification — do not assume it is fixed. The WhatsApp selected-send issue was root-caused to DOM-position-based selection reconstruction (in `final-fixes-v107.js` and `profile-share-v52.js`, not `workflow-v103.js` — that was a misattribution) and fixed at v113 by exposing `peermatch-v11.js`'s real selection via `window.pmGetSelected(k)`, pending device verification.

## Docs index

- `docs/ARCHITECTURE.md` — read when changing persistence, service worker, script loading, share target, attachments, PDF/OCR, or runtime architecture.
- `docs/DECISIONS.md` — read before redesigning existing behavior; records tested approaches, constraints, and why certain choices were made.
- `docs/KNOWN_ISSUES.md` — read before debugging. It distinguishes current bugs from intentional behavior and identifies known conflicts.
- `docs/TESTING.md` — read before declaring a runtime fix complete. There is no meaningful automated regression suite, so manual PWA checks matter.

## Working style

- Inspect `sw.js` load order first.
- Search all LIVE scripts for a selector/function/event before adding another handler.
- Pay attention to capture listeners, `stopImmediatePropagation()`, global wrappers, and MutationObservers.
- Prefer consolidating ownership over adding another patch file.
- Keep changes narrow when debugging.
- Do not redesign unrelated UI while fixing a bug.
- Preserve existing working behavior.
- When uncertain whether a behavior is intentional, consult `docs/DECISIONS.md` and `docs/KNOWN_ISSUES.md` before changing it.
