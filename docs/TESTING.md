# PeerMatch Manual Regression Checklist

PeerMatch has no comprehensive automated regression suite. Because many live scripts monkey-patch the same UI/functions, a fix is not complete until the installed PWA is manually checked.

Use this checklist selectively for small changes and more fully for architecture/layout/share changes.

## Before testing

- Confirm `sw.js` `VERSION` was bumped for runtime changes.
- Confirm any new runtime file is intentionally present in `sw.js` `SCRIPTS`.
- Confirm dead/historical files were not edited by mistake.
- Fully close PeerMatch on Android, reopen it, and verify the new `?pmv=<version>`/service-worker update has taken effect.
- Test the installed PWA, not only desktop browser preview.

## Smoke test

- App opens without error.
- Guys list renders.
- Girls list renders.
- Shadchanim list renders.
- Existing records remain present.
- Search still filters lists.
- Checkboxes still work.
- Opening and closing a detail screen works.
- Add/Edit forms can still save.

## Guy/Girl detail layout

For both one Guy and one Girl:

- Header appears at top.
- Name is visible.
- Photo behavior is unchanged.
- Edit is top-right, not in body content.
- `ב״ה` remains in the established header/Edit area if that feature is active.
- Girl Photo control remains immediately left of Edit.
- Profile text appears before attachment.
- Saved attachment appears directly below profile text.
- Contacts appear below attachment.
- Quick details / other information appears below Contacts.
- History/notes appears below the above sections.
- `Added to PeerMatch` appears low on the page, not near the header.
- Scrolling does not cause an observer to move attachment or Contacts to a different position after a moment.

Reopen the same detail twice to catch observer/wrapper race conditions.

## Attachment — image

Use an existing image/screenshot attachment and, if needed, add a new test image.

- Attachment remains saved after closing/reopening app.
- Open attachment displays the image in-app.
- No broken new browser tab is opened.
- Close viewer works.
- Share/save fallback still works if present.
- Detail layout remains Profile -> Attachment -> Contacts after opening/closing image.

## Attachment — PDF (v111 fix, pending device verification)

Use a known-good PDF that PeerMatch can parse/store.

- PDF is still attached after save and app restart.
- Tap Open PDF/Open attachment.
- PDF displays **inside PeerMatch**.
- It must NOT navigate to `blob://localhost/...`.
- It must NOT open an unavailable Chrome tab.
- Multi-page PDF can scroll through pages.
- Viewer Close returns to the same detail record.
- Share/save fallback works if preview cannot render.
- NetSpark/network failure of PDF.js is handled visibly and does not delete the stored attachment.

Test on the installed Android PWA, because desktop Chrome success is not sufficient.

## Add/Edit attachment form

For Guy/Girl and Shadchan forms where applicable:

- Attach PDF/screenshot button still opens the file picker.
- Remove works.
- File name/status displays.
- Parsing/OCR may fill only empty fields.
- Existing typed fields are not overwritten by extracted text.
- Save keeps the attachment even if OCR/parser fails.
- Form attachment control placement should not be confused with saved-detail attachment placement.

## Contacts

For Guy/Girl:

- Profile phone field persists.
- Contact 1 name/phone persist.
- Contact 2 name/phone persist.
- Legacy sender/source fields still synchronize as intended.
- Contacts detail block appears below attachment.
- Contact actions open the correct number.
- Editing a profile does not duplicate Contacts blocks.

## Israeli phone normalization

Test at least:

- `+972 50 ...` -> local `050...` display/storage where recognized.
- `00972...` -> local form.
- local `05x...` remains local.
- WhatsApp helper converts local Israeli mobile to `972...`.
- Israeli landline is not offered invalid SMS behavior if existing UI suppresses it.
- +1/other non-Israeli number is not rewritten as Israeli.
- Pasting a profile with Contact 1 phone using +972 does not leave raw `972` in Contact 1 after save.

## Core selection persistence

This is critical for the WhatsApp selected-recipient workflow.

- Check one Guy.
- Switch to Shadchanim.
- Check one Shadchan.
- Switch back to Guys.
- Guy must still show selected.
- Switch back to Shadchanim.
- Shadchan must still show selected.
- Repeat with Girl.
- Search/filtering should not silently remap a selected checkbox to a different record.
- Referral/grouped/collapsed Shadchan cards must map selection to the correct actual Shadchan record.

## Selected profile -> selected Shadchan -> WhatsApp (critical current bug)

Test with one known profile and one known Shadchan with a valid WhatsApp number.

- Select profile.
- Select exactly one Shadchan.
- Press WhatsApp from selected-profile toolbar.
- App must NOT ask to choose/re-enter the recipient if exactly one Shadchan is selected.
- WhatsApp opens the selected Shadchan's chat/number.
- Profile text is prefilled.
- The phone is normalized correctly for WhatsApp.
- Before handoff, profile history receives one send/open entry.
- Shadchan history receives the corresponding one entry.
- No duplicate history entries are created by competing handlers.
- Returning to PeerMatch does not corrupt selection state.

Also test:
- no Shadchan selected,
- more than one Shadchan selected,
- selected Shadchan has no phone,
so error/choice behavior is intentional rather than accidental.

## Incoming Android Share -> PeerMatch

- Share plain profile text to PeerMatch.
- App opens/imports pending share.
- Share an image to PeerMatch.
- Share a PDF to PeerMatch.
- Pending item is consumed only once.
- Imported profile does not duplicate on reopen.
- Text/file are not lost if parsing fails.

## Shadchan detail

- Edit works.
- Phone/contact actions still target correct record.
- Referral/group information still renders.
- Shadchan attachment, if present, opens through the intended single attachment viewer.
- Call today / Call tomorrow / Clear reminder behaviors remain Shadchan-only.
- Added date is low on detail page.

## Referral/grouped Shadchan list

- Parent/child/referral visual grouping still works.
- Expand/collapse still works.
- Checkbox on a child selects that child, not its parent or a data-index neighbor.
- Search results keep record identity correct.
- WhatsApp selected-recipient flow still chooses the exact checked record.

## History

- Text note saves.
- Audio note saves where browser permissions allow.
- Existing old activity entries still render.
- WhatsApp/SMS/Email/Call history isn't duplicated after one action.
- Profile <-> Shadchan mirrored share history refers to the correct counterpart.
- Deleting/clearing unrelated UI does not erase history.

## Waiting status

Where active:

- Waiting control remains near intended actions.
- active waiting state is visually distinct (yellow as previously chosen).
- inactive state is gray/neutral.
- opening/editing profile does not reset waiting unexpectedly.

## Added date — v109

Test a newly created Guy, Girl, and Shadchan:

- date matches creation time reasonably.
- editing later does not change original date.

Test older records:

- recoverable timestamp from record ID shows plausible original date.
- unrecoverable old record is not falsely labeled as added today.
- date remains at bottom/low in detail layout.

## Backup / restore

Before any persistence migration or broad refactor:

- create/export a backup using the existing backup feature,
- verify a backup file is produced,
- do not test destructive restore on the only valuable dataset unless a safe copy exists.

## Offline / flaky network

- App shell still opens from service-worker cache when offline where expected.
- Existing local records remain readable.
- features requiring external CDNs fail gracefully.
- failed PDF/OCR engine loading does not remove attachment.

## Final check before declaring a bug fixed

For each reported bug, state exactly:
- which live owner was changed,
- which conflicting old behavior was removed/disabled,
- which device/browser was tested,
- whether installed-PWA testing passed,
- what was not tested.

Do not say "fixed" merely because the code path looks correct.
