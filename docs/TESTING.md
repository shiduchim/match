# PeerMatch Manual Regression Checklist

PeerMatch has no comprehensive automated regression suite. Because many live scripts monkey-patch the same UI/functions, a runtime fix is not complete until the installed PWA is manually checked.

Use this checklist selectively for small changes and more fully for layout/share/runtime changes.

## Before testing

- Confirm `sw.js` `VERSION` was bumped for runtime changes.
- Confirm any new runtime file is intentionally present in `sw.js` `SCRIPTS`.
- Confirm dead/historical files were not edited expecting live behavior to change.
- Fully close PeerMatch on Android, reopen it, and confirm the new service worker/version loads.
- Test the installed PWA, not only desktop browser preview.

## Smoke test

- App opens without error.
- Guys, Girls, and Shadchanim lists render.
- Existing records remain present.
- Search still filters correctly.
- Checkboxes still work.
- Detail screens open/close normally.
- Add/Edit forms can save.
- No obvious duplicate blocks appear after opening the same profile repeatedly.

## Guy/Girl detail order

For both one Guy and one Girl, verify:

1. header / photo / meta / Edit at top-right,
2. profile text,
3. Looking for / To what age when present,
4. saved attachment,
5. contacts,
6. quick details / other information,
7. history/notes,
8. Added to PeerMatch low on the page.

Also verify:
- `ב״ה` remains in its established header/Edit area,
- Girl Photo remains immediately left of Edit,
- scrolling or waiting a moment does not cause an observer to move sections,
- reopening the same detail twice does not duplicate any block.

## v123 — Looking for / To what age

Test Add Guy, Add Girl, Edit Guy, and Edit Girl.

- `Looking for` appears directly under Profile text and is multiline free text.
- `To what age` appears beside it and is optional.
- blank values save normally.
- 18 and 99 are accepted.
- invalid values below 18, above 99, or non-integer are blocked.
- existing values prefill on Edit.
- changing values then Save persists them.
- clearing an existing value then Save persists the clear.
- changing values then Cancel leaves the saved record unchanged.
- existing older profiles with neither field still open and save normally.
- after Save, detail shows the block below Profile and before Attachment.
- repeated open/edit/save cycles do not create duplicate form/detail blocks.

## Attachment — image

- Existing image remains saved after restart.
- Open attachment displays image in-app.
- No broken new browser tab opens.
- Close viewer works.
- Detail order remains correct afterward.

## Attachment — PDF

The v113 direct-download path was device-verified; keep it as a regression test.

- PDF remains attached after save/restart.
- Open PDF does not navigate to `blob://localhost/...`.
- It downloads directly rather than opening a broken browser tab.
- Alert explains that the PDF was downloaded.
- File appears in Android Downloads with a sensible name and opens normally.
- Reopening the profile and downloading again still works.
- Image attachment behavior remains unaffected.

## Add/Edit attachment form

- Attach PDF/screenshot opens file picker.
- Remove works.
- File name/status displays.
- Parsing/OCR fills only empty fields.
- Existing typed fields are not overwritten.
- Save keeps attachment even if OCR/parser fails.

## Contacts and phone normalization

For Guy/Girl:
- Profile phone persists.
- Contact 1 and Contact 2 names/phones persist.
- Legacy sender/source synchronization still works.
- Contacts appear below Attachment.
- Contact actions target the correct number.

Phone cases:
- `+972 50...` -> local `050...` display/storage where recognized.
- `00972...` -> local form.
- local `05x...` remains local.
- WhatsApp converts Israeli local mobile to `972...`.
- +1/other international numbers are preserved.

## Core selection persistence

- Check one Guy; switch tabs; check one Shadchan; both stay selected.
- Repeat with Girl.
- Search/filtering does not remap selection to another record.
- Grouped/collapsed Shadchan cards preserve the real selected record.
- Any sharing code uses `window.pmGetSelected(k)`, not DOM card position.

## WhatsApp — profile(s) + one selected Shadchan

This flow was device-verified from v115/v116; keep as regression test.

- Select exactly one Guy or Girl + exactly one Shadchan.
- Press WhatsApp from the Guy/Girl toolbar: exact selected Shadchan opens with profile text.
- Repeat from the Shadchanim toolbar: behavior is identical.
- Returning from WhatsApp reveals PeerMatch, not `api.whatsapp.com` / “Share on WhatsApp”.
- If profile has photo, PeerMatch asks `Send <Name>’s photo?` with **Yes / No**.
- Yes shares photo only; No skips it.
- No-photo profile does not show the photo question.
- Profile history and Shadchan history each get the correct paired entry.

For multiple profiles + one Shadchan:
- profiles send one at a time,
- no merged profile message,
- each profile gets its own optional photo step,
- queue survives returning from WhatsApp,
- Cancel clears remaining queue.

## WhatsApp — profile(s), no Shadchan selected

Current owner is `v120-general-whatsapp.js`.

- Recipient dialog appears.
- Existing Shadchan can be chosen.
- Name/phone can be typed.
- Phone may be left blank; WhatsApp opens for manual recipient choice.
- With a phone, exact recipient opens directly.
- Returning from WhatsApp reveals PeerMatch, not the browser intermediary.
- Text is first; optional photo Yes/No follows only if a photo exists.
- Multiple profiles are sent separately.

## WhatsApp — one profile + multiple Shadchanim

Current owner is `v119-multi-shadchan.js`.

- Select one profile and two or more Shadchanim.
- Shadchan 1 gets text first.
- Return -> optional photo Yes/No.
- Then Shadchan 2 text -> optional photo, etc.
- Profiles without photos skip photo step.
- History remains separate for each recipient.
- Returning from WhatsApp does not expose `api.whatsapp.com`.

## WhatsApp — Shadchan contact/profile sharing

- Select one Shadchan with no Guy/Girl selected.
- Share Shadchan contact/profile via WhatsApp.
- Android opens WhatsApp directly.
- Exiting WhatsApp reveals PeerMatch, not the blue `Share on WhatsApp` browser page.
- Multiple Shadchan contact cards still use the intended separate-share behavior.

## Make Match -> WhatsApp — v122 final device check

This is the newest Android deep-link change that still needs explicit final device confirmation.

- Select exactly one Guy and one Girl; optionally one Shadchan.
- Open Make Match.
- Recipient selector matches the real selected records.
- WhatsApp opens the intended recipient with the message.
- Exit WhatsApp.
- PeerMatch should be underneath; `api.whatsapp.com` / “Share on WhatsApp” must not appear.
- Match history is written to the correct Guy/Girl/Shadchan records.
- SMS/Email/Contact actions remain unchanged.

## Ordinary Shadchan detail WhatsApp

- Open a Shadchan detail.
- Tap WhatsApp, type message, Continue.
- Correct Shadchan number opens.
- Message is recorded once.
- Returning to PeerMatch behaves normally.

## Guy/Girl contact-person WhatsApp

- Open a Guy/Girl profile with a contact person.
- Tap the contact-person WhatsApp action.
- Correct phone opens.
- No unwanted browser intermediary remains after exiting WhatsApp.

## History deletion — v117/v122

Test both new and older share history.

- Delete a normal unrelated history entry: only that entry disappears.
- Delete a mirrored profile<->Shadchan WhatsApp share: both true linked copies disappear.
- Wait/reopen app: deleted mirrored share does not reappear via `dual-share-history-v100.js`.
- If two unrelated records happen to contain the same numeric/timestamp-style activity ID, deleting one must not delete the other.
- Older mirror records using `mirroredFromProfileActivityId` / `mirroredFromShadchanActivityId` still delete as a pair.

## Incoming Android Share -> PeerMatch

- Share plain profile text to PeerMatch.
- Share image to PeerMatch.
- Share PDF to PeerMatch.
- Pending item is consumed only once.
- Import does not duplicate on reopen.
- Text/file are not lost if parsing fails.

## Shadchan detail / reminders

- Edit works.
- Phone/contact actions target correct record.
- Referral/group information renders.
- Shadchan attachment opens correctly.
- Call today / Call tomorrow / Clear reminder remain Shadchan-only.
- Added date remains low on detail page.

## Waiting status

- Waiting control remains near intended actions.
- active state is yellow/distinct.
- inactive state is gray/neutral.
- opening/editing profile does not reset it unexpectedly.

## Added date

New records:
- date matches creation time reasonably,
- editing later does not change it.

Older records:
- recoverable timestamp from ID is plausible,
- unrecoverable old record is not falsely labeled as added today,
- date remains low on detail page.

## GitHub Pages / service worker — v122 regression test

- GitHub Pages deploy succeeds.
- Deploy workflow reads VERSION/SCRIPTS from `sw.js`.
- Every live runtime file exists.
- App shell loads after deployment.
- Installed PWA updates after full close/reopen.
- Old `peermatch-v*` caches are removed.
- Unrelated origin caches are not removed.
- Offline shell still opens where expected.
- Existing IndexedDB data remains readable.

## Backup / restore

Before any persistence migration or broad refactor:
- create/export a backup,
- verify a backup file is produced,
- do not test destructive restore on the only valuable dataset without a safe copy.

## Final check before declaring a change finished

State exactly:
- which live owner changed,
- which conflicting old behavior was removed/disabled,
- which device/browser was tested,
- whether installed-PWA testing passed,
- what remains untested.

Do not say a runtime behavior is device-verified merely because CI/deployment passed or the code path looks correct.
