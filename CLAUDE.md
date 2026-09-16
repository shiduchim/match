# PeerMatch — Claude Code Project Brief

PeerMatch is a browser/PWA shidduch relationship tracker for one current user. It tracks Guys, Girls, Shadchanim, profiles, contacts, referrals, history, reminders, attachments, and sharing workflows.

## Read this first

This repo is NOT a normal single-file app. `index.html` is mostly the shell. `sw.js` contains the authoritative `SCRIPTS` array and injects those JavaScript files into navigation responses in exactly that order.

**The live runtime file list is `sw.js` -> `SCRIPTS`.** A root `.js` file that is not in that array should be treated as historical/dead unless another live file explicitly imports it.

Load order is critical. Many files monkey-patch globals such as `openP`, `openS`, `renderP`, and `renderS`, attach capture-phase click handlers, and run `MutationObserver`s. A later or earlier handler can silently override another patch.

Before adding a new override, find the current owner and remove/fix the conflicting behavior at the source. Prefer consolidation over another patch layer.

## Current version

Current PWA/service-worker version: **v123**.

Current `main` at the time of this update: `8a445f9da88d953bd3605c6b34c691598da63908` (`v123: refine Looking for layout under profile`).

Version source of truth: `const VERSION='...'` in `sw.js`.

For a runtime code change:
1. update the relevant live file(s),
2. bump `VERSION` in `sw.js`,
3. make sure any new runtime file is added to `SCRIPTS`,
4. preserve script ordering deliberately,
5. tell the user to fully close/reopen the installed PWA so the new service worker activates.

Documentation-only changes do not require a PWA version bump.

The GitHub Pages workflow now reads `VERSION` and `SCRIPTS` directly from `sw.js`, verifies that all live files exist, and deploys that exact runtime instead of maintaining a second hard-coded script list.

## Persistence / data safety

- Browser-local PWA data is important. Do not perform destructive migrations casually.
- IndexedDB database: `PeerMatchDB`.
- Known stores include `kv` and `inbox`.
- Main record collections are exposed through `data.guys`, `data.girls`, and `data.shadchanim`.
- Use the app's existing `save()`/load mechanisms unless a persistence change is explicitly required.
- Preserve old records and fields when adding new fields. Prefer additive changes.
- Never fabricate historical dates or history entries.

## Product constraints

- **FREE OPTIONS ONLY.** Do not propose paid APIs/services unless the user explicitly asks for them.
- PWA/browser-first. NetSpark filtering is relevant on the user's devices.
- The user is currently the only app user. Do not spend effort on team workflow, branch policy, permissions, or multi-user infrastructure unless asked.
- The user does not want to chase singles. Follow-up/reminder features should be **Shadchan-only** unless explicitly requested otherwise.
- Kosher/basic phones may have calls/SMS only; do not assume a browser exists on those devices.

## Important Guy/Girl UI invariants

Intended detail order is:
1. header with name/photo/meta and Edit at top-right,
2. profile text,
3. **Looking for / To what age** when present,
4. profile attachment,
5. contacts,
6. quick details / other profile information,
7. history/notes,
8. small `Added to PeerMatch: ...` line near the bottom.

`profile-looking-for-v123.js` owns the two new optional fields:
- `lookingFor`
- `lookingForMaxAge`

In Add/Edit, they appear immediately below Profile text. `Looking for` is multiline free text. `To what age` is optional and validates integer 18–99. Existing records without these fields remain valid.

Do not move Edit below the profile. `edit-buttons-v77.js` is the established owner of top-right Edit placement, including the small `ב״ה` above it. Girl Photo belongs immediately left of Edit.

Guy/Girl attachment placement is owned at creation time by `profile-pdf-ocr-v63.js`; Contacts placement is owned by `profile-contacts-v96.js`. Do not add a second observer just to move either one afterward.

## Phone rules

- Israeli numbers should be stored/displayed in local `0...` form when recognized.
- WhatsApp uses international digits (`972...`) via the existing helpers.
- Preserve +1/other international numbers rather than forcing them into Israeli format.
- Call/SMS should use the locally appropriate stored/displayed number.
- Existing helpers in `phone-links-v64.js` include `pmNormalizePhone`, `pmPhoneKey`, `pmPhoneType`, and `pmWhatsAppDigits`.

## Selection source of truth

Do not reconstruct selection from DOM card position/count.

`peermatch-v11.js` owns the real selection Sets and exposes them read-only through:

`window.pmGetSelected(k)`

Use that for `'guys'`, `'girls'`, and `'shadchanim'`.

The v115 debugging lesson remains important: a `window.addEventListener(..., true)` capture listener runs before listeners closer to the target. `profile-tools-v62.js` once intercepted every Guy/Girl WhatsApp click before the intended button handler. When auditing a click, check `window` capture listeners as well as `document` and direct `.onclick` handlers.

## Current WhatsApp behavior

Android direct-send paths intentionally prefer `whatsapp://` so closing WhatsApp returns to PeerMatch instead of leaving the `api.whatsapp.com` / “Share on WhatsApp” browser screen underneath.

### Profile(s), no Shadchan selected

Owned by `v120-general-whatsapp.js` after shared routing declines Case B.

- User may choose an existing Shadchan, type a recipient, or leave phone blank.
- With a phone, text opens directly to that number.
- With no phone, WhatsApp opens and the user chooses/searches the recipient there.
- Text is sent first.
- If the profile has a stored photo, returning to PeerMatch shows `Send <Name>’s photo?` with **Yes / No**.
- Profiles without a photo skip the second step.
- Multiple profiles are handled separately, never merged.

### Profile(s) + exactly one selected Shadchan

Routing decision is shared through `window.pmRouteSelectedWhatsApp()` in `final-fixes-v107.js` and is called by both the Guy/Girl toolbar and Shadchanim toolbar.

- Text goes directly to the selected Shadchan first.
- Share history is written on both profile and Shadchan sides.
- If a photo exists, returning to PeerMatch shows **Yes / No** for photo-only sharing.
- Multiple selected profiles are sent one at a time.

This direct selected-Shadchan flow was device-verified from v115 onward; the two-step text/photo flow was device-verified at v116.

### One profile + multiple selected Shadchanim

Owned by `v119-multi-shadchan.js`.

Sequence is Shadchan 1 text -> optional photo Yes/No -> Shadchan 2 text -> optional photo -> etc. History remains separate per recipient.

### Sharing selected Shadchan contact card(s)

Owned by `shadchan-share-v55.js` with Android direct-opening reinforcement in `v121-shadchan-whatsapp.js` so the old `api.whatsapp.com` screen is not left behind.

### Make Match -> WhatsApp

Owned by `make-match-v60-ui.js`. v122 changed Android WhatsApp handoff to `whatsapp://` and changed Make Match selection reading to authoritative `window.pmGetSelected(k)`.

### Platform limitation

A URL/deep link can preselect recipient + text but cannot reliably attach a local photo/PDF. `navigator.share({files})` can attach files but cannot reliably preselect the exact WhatsApp chat. PeerMatch therefore intentionally uses a two-step text-first, optional-photo-second flow where exact-recipient + media cannot be combined reliably.

## History deletion

`history-delete-v30.js` owns individual deletion UI.

WhatsApp profile-share history can exist on both the profile and Shadchan sides. v117 made linked deletion remove the mirrored pair so `dual-share-history-v100.js` does not recreate it. v122 tightened matching so unrelated records that happen to reuse the same timestamp-style activity ID are not accidentally removed. Prefer `shareLinkId` and explicit mirror fields over raw numeric ID equality across records.

## Attachment/PDF behavior

`profile-pdf-ocr-v63.js` is the single owner for Guy/Girl saved attachment opening and parsing.

- Images open in-app.
- PDFs/non-image attachments download directly and synchronously; do not reintroduce raw `window.open(blobUrl)` behavior.
- PDF.js/Tesseract are still used for local extraction/OCR when attaching files and can be blocked by NetSpark/offline conditions; attachment storage must not depend on parsing success.
- The v113 PDF download path was device-verified by the user.

Before touching attachments, search every LIVE file for `.pmV63Attachment`, `.pmAttachmentBox`, `profileAttachment`, `URL.createObjectURL`, and `window.open` to ensure a second owner has not been reintroduced.

## Current status / what still needs device confirmation

Most v115–v121 WhatsApp work was tested iteratively on the installed Android PWA and reported working.

The latest changes that should still be included in final regression testing are:
- v122 Make Match Android direct-return behavior after leaving WhatsApp,
- v122 cleanup/runtime deployment changes,
- v123 `Looking for` / `To what age` Add, Edit, Cancel, save, layout, and old-record compatibility.

Do not call those specific latest behaviors device-verified until the user actually tests them.

## Docs index

- `docs/ARCHITECTURE.md` — persistence, service worker, script loading, share target, attachments, PDF/OCR, runtime architecture.
- `docs/DECISIONS.md` — tested approaches and why choices were made.
- `docs/KNOWN_ISSUES.md` — current/resolved bug status and architectural risks.
- `docs/TESTING.md` — current manual regression checklist.

## Working style

- Inspect `sw.js` load order first.
- Search all LIVE scripts for a selector/function/event before adding another handler.
- Pay attention to capture listeners, `stopImmediatePropagation()`, global wrappers, and MutationObservers.
- Prefer consolidating ownership over adding another patch file.
- Keep changes narrow when debugging.
- Do not redesign unrelated UI while fixing a bug.
- Preserve existing working behavior.
- When uncertain whether a behavior is intentional, consult `docs/DECISIONS.md` and `docs/KNOWN_ISSUES.md` before changing it.
