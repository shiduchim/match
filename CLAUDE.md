# PeerMatch — Claude Code Project Brief

Start with **`CLAUDE_HANDOFF_V128.md`**. It is the detailed current handoff and should be treated as the primary takeover document.

PeerMatch is a browser/PWA shidduch relationship tracker. It tracks Guys, Girls, Shadchanim, profiles, contacts, referrals, history, reminders, attachments, sharing, Make Match, and backup/restore.

## Live runtime source of truth

`index.html` is mostly the shell. **`sw.js -> SCRIPTS` is the authoritative ordered live runtime list.** A root JS file that is not in `SCRIPTS` is historical/dead unless another live file explicitly imports it.

Load order matters. The codebase has wrappers around `openP`, `openS`, `renderP`, `renderS`, direct `.onclick` replacements, capture listeners, and MutationObservers. Before adding an override, identify the current owner and all competing live handlers.

## Current version

Current intended PWA/service-worker version: **v129**.

For runtime changes:

1. fetch current `main` and current file SHA;
2. inspect `sw.js`;
3. edit the true live owner;
4. bump `VERSION` in `sw.js`;
5. keep `SCRIPTS` ordering intentional;
6. verify GitHub Pages deployment;
7. tell the user to fully close/reopen the installed PWA.

Docs-only changes do not require a version bump.

## Data safety

- IndexedDB database: `PeerMatchDB`.
- Main collections: `data.guys`, `data.girls`, `data.shadchanim`.
- Preserve old records/unknown fields.
- Prefer additive changes.
- Use existing `save()`/load mechanisms.
- Never fabricate history or dates.
- Do not make destructive migrations casually.

## Product constraints

- **FREE OPTIONS ONLY** unless explicitly asked otherwise.
- Browser/PWA-first.
- NetSpark filtering is relevant.
- Current user is effectively the sole app user.
- Reminders/follow-up are Shadchan-only unless explicitly requested otherwise.
- Kosher/basic phones may only support Call/SMS.

## Selection source of truth

Never reconstruct selection from DOM position. Use:

```js
window.pmGetSelected('guys')
window.pmGetSelected('girls')
window.pmGetSelected('shadchanim')
```

from `peermatch-v11.js`.

## Guy/Girl detail order

1. Header/name/photo/meta + Edit top-right
1.5. Last call status banner, when a call-note exists (`v129-call-followup.js`)
2. Profile text
3. Looking for / To what age, when present
4. Attachment
5. Contacts
6. Quick details / other info
7. History
8. Added-to-PeerMatch date near bottom

The same banner appears in the Shadchan detail, immediately after its header, before the
Contact buttons row.

`profile-looking-for-v123.js` owns `lookingFor` and `lookingForMaxAge`. These fields are currently not automatically included in outgoing share text and are not part of ordinary list search. Ask before changing that behavior.

## Attachments / PDFs

`profile-pdf-ocr-v63.js` is the key attachment owner.

- Images can render in-app.
- PDFs/non-image attachments download directly for opening.
- PDF.js/Tesseract parsing may fail under NetSpark/offline and must never be required for attachment storage.

Outgoing rule: **if a Guy/Girl has an attached PDF, share the actual PDF rather than OCR/autofilled text; if the PDF is removed, fall back to normal text.**

Final PDF-sharing owner: `v124-pdf-share-fix.js`.

At v128, `v124-backup-pdf-share.js` is intentionally only a backup-screen UI shim. Do not restore old PDF or email-sharing ownership to it.

## Backup

`backup-v28.js` owns the real ZIP format.

- Save to phone/computer: real `PeerMatch_Backup_YYYY-MM-DD.zip`.
- Email backup: `PeerMatch_Backup_YYYY-MM-DD.txt` containing Base64 of the exact ZIP bytes because Android Chrome rejected ZIP Web Share on the user's device.
- The email `.txt` is **not encrypted**.
- Restore accepts ZIP or the PeerMatch TXT wrapper.
- v127 fixed Base64 chunk-boundary correctness for large backups.
- Email-backup owner: `v125-email-backup-direct.js`.

Do an end-to-end emailed-backup restore test after touching backup logic.

## WhatsApp

Android direct text paths intentionally prefer `whatsapp://` so exiting WhatsApp returns to PeerMatch instead of an `api.whatsapp.com` intermediary.

Current main owners:

- exactly one selected Shadchan + profile(s): `final-fixes-v107.js` / `window.pmRouteSelectedWhatsApp()`;
- one profile + multiple Shadchanim: `v119-multi-shadchan.js`;
- no preselected Shadchan: `v120-general-whatsapp.js`;
- Shadchan share/contact toolbar: `v121-shadchan-whatsapp.js`;
- Make Match: `make-match-v60-ui.js`;
- PDF-first profile sharing: `v124-pdf-share-fix.js`.

The v115 lesson: a capture-phase listener can beat the visually obvious button handler. Inspect window/document capture handlers when debugging.

### v128 queue isolation

Four legacy queue keys remain: `pmWaSendQueue`, `pmMultiShadWaQueue`, `pmGeneralWaQueueV120`, and `pmV124PdfSendQueue`.

`v128-runtime-hardening.js`, loaded last, temporarily guarantees only one can exist at a time and clears stale old queue state once. It intercepts `Storage.prototype.setItem` only for those exact keys. This is a bridge, not the desired long-term architecture. Future cleanup should consolidate the four owners and remove this hardener rather than adding a fifth queue.

### Known lower-level inconsistency

These paths can still use older `wa.me` behavior: ordinary Shadchan-detail compose, sender/contact compose, Guy/Girl Contacts WhatsApp, and inline-phone WhatsApp. Trace and fix the actual owner; do not add a broad capture listener.

## Call status updates

`v129-call-followup.js` adds a post-call status-update popup (typed note and/or a recorded
audio note) for Guys, Girls, and Shadchanim.

- It never intercepts or replaces a Call/`tel:` handler. It only watches, passively (no
  `preventDefault`/`stopPropagation`), for a click on a button whose exact text is `Call`,
  then watches `visibilitychange` for the app regaining focus (the OS dialer closing).
- It records which profile/Shadchan was open via its own `openP`/`openS` wrapper, the same
  pattern other files use.
- Saved notes are stored as a new activity type, `call-note` (`text`, optional `audio` Blob,
  `answered` boolean, optional `durationApproxSec`), rendered by `acts()` in `audio-v24.js`
  (the current live owner of activity rendering) so the full call-note history stays under
  Profile/Shadchan History, unchanged in position.
- `v129-call-followup.js` also renders a "Last call status" banner directly above the
  Profile text (Guy/Girl) or above the Contact buttons (Shadchan). It is computed live from
  the most recent `call-note` activity — there is no separate persisted field — so it always
  matches History and automatically updates if a `call-note` entry is later deleted.
- No web/PWA API reports true call state (answered/declined/busy) — that is OS telephony
  state a page never sees. `answered` is only a guess from how long the app was backgrounded
  (>= 15s defaults to "Yes"), always shown as an editable Yes/No choice before saving. Do not
  present it as a verified fact elsewhere in the UI.
- When the call was to a Shadchan with an existing "Call today/tomorrow" reminder
  (`workflow-v103.js`, `x.callReminderDate`), the popup offers a "Cancel follow-up" button.
  It calls `window.pmCallReminderInfo`/`window.pmClearCallReminder`, exported by
  `workflow-v103.js` for this purpose, rather than duplicating its clear logic. This does not
  add reminders for Guys/Girls — reminders stay Shadchan-only.
- Pending call state is kept in memory and in `localStorage['pmCallFollowupV129']` (survives
  an Android WebView reload while the dialer was open); it is unrelated to the four legacy
  WhatsApp queue keys and is not touched by `v128-runtime-hardening.js`.
- Make Match's own "Contact" call button (`make-match-v60-ui.js`) is not covered yet — its
  button is labeled "Contact", not "Call".

## History

Important files:

- `history-delete-v30.js`
- `dual-share-history-v100.js`

v127 hardening that must be preserved:

- modern pairs use `shareLinkId`;
- legacy pair deletion uses profile/Shadchan/message/timestamp fingerprint;
- deletion stores bounded tombstones in `pmDeletedShareHistoryV127`;
- repeated identical modern shares with different links stay distinct;
- no permanent 4-second reconciliation interval;
- failed deletion saves roll in-memory activity state back.

Do not revert to raw numeric activity-ID matching across records.

## Stable user-facing preferences

- Avoid X/cross symbols for choices; use explicit **Yes / No**.
- Contact action order: **Call -> Email -> WhatsApp -> SMS**.
- Waiting active yellow / inactive gray.
- `ב״ה` above Edit.
- Girl Photo immediately left of Edit.
- Israeli phone display/call/SMS local when recognized; WhatsApp internationalized; preserve +1/other international numbers.

## Device verification

Previously device-verified:

- v110 layout baseline
- v113 PDF direct download/opening
- v115 selected-Shadchan routing
- v116 text-first + optional-photo direct flow
- v123 Looking for / To what age Add/Edit/Cancel/persistence
- v122 Make Match -> WhatsApp return behavior later reported working

Fresh regression required after v127/v128:

- save ZIP backup;
- email TXT backup is actually attached;
- download emailed TXT and restore it completely;
- fresh and old history deletion do not reappear;
- same unchanged profile sent twice to same Shadchan remains two pairs;
- PDF-first share then PDF removal -> text fallback;
- v128 queue isolation;
- v128 contact order;
- no regression from removing obsolete v124 handler ownership;
- v129 call status-update popup: appears after Call -> hang up -> return to PeerMatch, for
  Guy/Girl Contacts calls, Shadchan detail calls, and the inline phone-number picker; typed
  note and recorded audio note both save and display correctly in History.

## Working style

- Read `CLAUDE_HANDOFF_V128.md` first.
- Inspect `sw.js` before coding.
- Search all live owners for the behavior.
- Prefer changing/consolidating the owner to adding another monkey patch.
- Keep fixes narrow and preserve working behavior.
- Review actual diffs, not commit messages only.
- Do not call a new behavior device-verified until the user tests it.
