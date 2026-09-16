# PeerMatch — Claude Code Project Brief

PeerMatch is a browser/PWA shidduch relationship tracker for one current user. It tracks Guys, Girls, Shadchanim, profiles, contacts, referrals, history, reminders, attachments, and sharing workflows.

## Read this first

This repo is NOT a normal single-file app. `index.html` is mostly the shell. `sw.js` contains the authoritative `SCRIPTS` array and injects those JavaScript files into navigation responses in exactly that order.

**The live runtime file list is `sw.js` -> `SCRIPTS`.** A root `.js` file that is not in that array should be treated as historical/dead unless another live file explicitly imports it.

Load order is critical. Many files monkey-patch globals such as `openP`, `openS`, `renderP`, `renderS`, attach capture-phase click handlers, and run `MutationObserver`s. A later or earlier handler can silently override another patch.

Before adding a new override, find the current owner and remove/fix the conflicting behavior at the source. The project has accumulated too many layered patches already.

## Current version

Current PWA/service-worker version at the time this file was written: **v115**.

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

Outgoing selected-profile workflow is **two intentional behaviors, routed identically regardless of which selection toolbar's WhatsApp button is pressed** (Guy/Girl tab or Shadchanim tab) — do not collapse them into a single path, and do not let the two toolbars decide the routing differently:

- **Case A** — profile(s) selected with no Shadchan selected (Guy/Girl tab), or Shadchan(s) selected with no Guy/Girl selected (Shadchanim tab): keep each tab's existing general/contact-share behavior.
- **Case B** — exactly one Shadchan selected, with one or more Guy/Girl profiles selected (of one kind — Guys only, or Girls only; both at once gets a clear "choose one kind" alert instead of a guess):
  1. user checks one or more Guy/Girl profiles (Guys only, or Girls only),
  2. user checks exactly one Shadchan,
  3. selection survives switching tabs,
  4. user taps WhatsApp — from the Guy/Girl toolbar **or** the Shadchan toolbar, either must work identically,
  5. WhatsApp opens directly to that selected Shadchan with the first selected profile's text prefilled,
  6. send/open action is recorded on BOTH that profile's history and the Shadchan's history before handoff,
  7. if more than one profile is selected, they are sent **one at a time, never merged into a single message** — Shadchanim don't want bundled profiles. A persistent "Send profile N of M" prompt requires its own explicit tap per remaining profile before each further `wa.me` handoff, and the queue survives PeerMatch losing focus while WhatsApp is open (`final-fixes-v107.js`, `localStorage` key `pmWaSendQueue`).

Do not create a second competing selection system. The original selection state in `peermatch-v11.js` is closure-owned and, as of **v113**, exposed read-only via `window.pmGetSelected(k)` (returns the real records for `'guys'`/`'girls'`/`'shadchanim'`). Any code that needs "what's selected" must call this — never reconstruct it from DOM card position/count.

The A/B routing decision itself must live in exactly one place: as of **v115**, `final-fixes-v107.js` exposes `window.pmRouteSelectedWhatsApp()`, and both `profile-share-v52.js`'s (Guy/Girl) and `shadchan-share-v55.js`'s (Shadchanim) WhatsApp buttons call it first, falling back to their own tab's Case-A default only when it returns `false`. Do not re-implement this decision locally in either file again.

**v115 lesson, keep in mind for any future click-handling work:** a `window.addEventListener('click', fn, true)` (capture phase, registered on `window`) always fires before any listener closer to the target — including a `document`-level capture listener or a directly-bound `.onclick` on the element itself — regardless of script load order. `profile-tools-v62.js` had exactly such a listener intercepting the Guy/Girl WhatsApp button and silently defeating three rounds of otherwise-correct fixes (v107 through v114) before this was traced. When auditing "what handles this click," check `window`-level listeners specifically, not just `document`-level ones. See `docs/KNOWN_ISSUES.md` issue #2.

A `wa.me` URL can preselect a phone and text, but cannot reliably attach a local binary photo/PDF. Native share can attach files but cannot reliably preselect the exact WhatsApp chat. Preserve that distinction. Photo/image attachment for the Case B direct-send flow is deferred — it is text-only for now.

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

Current status (see `docs/KNOWN_ISSUES.md` for full detail on each): attachment/contacts layout placement was fixed at the source at v110, verified on the installed Android PWA. PDF opening went through v111 (in-app viewer) and v112 (share-then-download) without ever actually running, due to an unrelated competing file (`whatsapp-import-v61.js`) always winning first; v113 removed that competitor and switched to a guaranteed synchronous download, pending device verification — do not assume it is fixed. The WhatsApp selected-send issue went through a similar pattern: v113 root-caused DOM-position-based selection reconstruction (in `final-fixes-v107.js` and `profile-share-v52.js`, not `workflow-v103.js` — that was a misattribution) and exposed `peermatch-v11.js`'s real selection via `window.pmGetSelected(k)`; v114 switched the direct-send path to the same proven `wa.me` launch helper as the working Shadchan-detail button, bound directly at the button's creation site, restored the pre-existing general-recipient path (Case A, mistakenly deleted entirely at v113), and added a one-tap-per-profile send queue. **None of v113's or v114's button-level work was actually reachable**: v115 found that `profile-tools-v62.js` ran a `window`-level capture-phase click listener that always intercepted the Guy/Girl WhatsApp button first and diverted it elsewhere — a `window`-scoped listener beats any listener closer to the target regardless of load order, so no fix at the button or `document` level could ever have worked. v115 removed WhatsApp from that listener's match, added a single shared `window.pmRouteSelectedWhatsApp()` routing function used by both the Guy/Girl and Shadchanim toolbars so they can't diverge, and fixed a related but separate bug where the Shadchanim tab's own WhatsApp button ignored Guy/Girl selection entirely. All of this is pending device verification — this is the first version of this fix that has a plausible mechanism for actually running on tap.

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
