# PeerMatch Manual Regression Checklist

PeerMatch has no comprehensive automated regression suite. Because many live scripts wrap the same functions/buttons, runtime work is not complete until the installed PWA is tested.

## Before testing

- Confirm `sw.js` `VERSION` was bumped for runtime changes.
- Confirm all intended live files are in `sw.js -> SCRIPTS`.
- Confirm dead/historical files were not edited expecting live behavior to change.
- Fully close the installed PWA and reopen it.
- Test the installed Android PWA, not only desktop preview.

## Smoke

- App opens without errors.
- Guys/Girls/Shadchanim render.
- Existing records are present.
- Search/checkbox selection still works.
- Details open/close normally.
- Add/Edit saves.
- No duplicated detail blocks after repeated opens.

## Guy/Girl detail order

For both a Guy and Girl:

1. Header/photo/meta + Edit top-right
2. Profile text
3. Looking for / To what age, when present
4. Attachment
5. Contacts
6. Quick details / other info
7. History
8. Added date near bottom

Also verify `ב״ה` and Girl Photo placement remain correct.

## Looking for / To what age — v123

Already user-verified, but keep as regression coverage:

- Add/edit/save works.
- Cancel does not persist changes.
- Clear + Save persists clear.
- Blank values are allowed.
- 18–99 integer validation works.
- Old records without fields still work.
- Repeated edit/open does not duplicate blocks.

## Attachment opening

### Image

- Existing image remains after restart.
- Opens in-app.
- Close works.

### PDF

- Existing PDF remains attached.
- Open PDF downloads directly, not via broken `blob://` tab.
- Downloaded filename is sensible.
- Reopen/download again still works.

## PDF-first outgoing profile rule — v124+

Explicit product requirement:

1. Choose profile with attached PDF.
2. Share by WhatsApp.
3. Confirm actual PDF file is shared; OCR/autofilled profile text is not substituted for it.
4. Repeat by Email.
5. Remove PDF attachment from profile and Save.
6. Share again.
7. Confirm normal text-profile sharing is used after PDF removal.

Also test one profile -> multiple Shadchanim if PDF is present.

## Contacts / phones

- Profile/Contact 1/Contact 2 persist.
- Correct number is targeted by Call/SMS/WhatsApp.
- Israeli `+972` / `00972` normalize appropriately.
- local Israeli mobile remains local for display/call/SMS.
- WhatsApp converts local Israeli mobile to `972...`.
- +1/other international numbers are preserved.

## Selection source of truth

- Select Guy/Girl and Shadchan across tabs; selection persists.
- Search/reorder/grouping never remaps selection to another record.
- Sharing uses `window.pmGetSelected(k)`.

## WhatsApp — one selected Shadchan + profile(s)

Device-verified baseline from v115/v116; regression-test:

- Correct selected Shadchan opens.
- Android returns to PeerMatch, not `api.whatsapp.com`.
- Text goes first.
- Photo prompt is explicit **Yes / No** only when photo exists.
- Multiple profiles send separately.
- Profile and Shadchan history each get one linked entry per send.

## WhatsApp — no Shadchan selected

Owner: `v120-general-whatsapp.js`.

- Existing Shadchan can be selected, recipient can be typed, or phone left blank.
- Correct recipient opens when number supplied.
- Blank phone opens WhatsApp for manual recipient choice.
- Text first, optional photo second.
- Multiple profiles remain separate.

## WhatsApp — one profile -> multiple Shadchanim

Owner: `v119-multi-shadchan.js`.

- One profile + 2+ Shadchanim.
- Each Shadchan receives a separate send sequence.
- Optional photo is Yes/No per recipient.
- History stays separate per recipient.

## Shadchan share/contact + Make Match

- Shadchan share toolbar opens direct Android WhatsApp as intended.
- Make Match uses actual selected Guy/Girl/Shadchan.
- Exiting WhatsApp returns to PeerMatch, not browser intermediary.
- Match history lands on correct records.

The user later reported the v122 Make Match return behavior working; keep it as regression coverage rather than an unverified item.

## Ordinary lower-level WhatsApp paths

These are separate from the main selection-bar flows and should be tested independently:

- Shadchan detail -> WhatsApp compose
- Guy/Girl Contacts -> WhatsApp
- inline clickable phone -> WhatsApp

If one shows the browser `Share on WhatsApp` intermediary, trace that exact handler; do not assume the main toolbar owner controls it.

## History deletion — v127

Test **fresh modern shares** and **old/pre-link history**.

### Fresh modern share

1. Send one profile to one Shadchan.
2. Verify profile + Shadchan history each contain the event.
3. Delete from one side.
4. Verify both linked sides disappear.
5. Wait 5+ seconds.
6. Switch away/back to app.
7. Open both details again.
8. Confirm deleted event does not return.

### Old/pre-link share

Repeat deletion on an older share without modern `shareLinkId`, if available. Confirm it does not return after focus/detail reopen.

### Repeated identical send

1. Send the same unchanged profile to the same Shadchan twice.
2. Confirm two separate profile-side entries.
3. Confirm two separate Shadchan-side entries.
4. Delete only one pair.
5. Confirm the other pair remains.

### Collision protection

Unrelated records that happen to reuse the same numeric activity ID must not be deleted together.

## Backup — save to phone/computer

- Tap Save backup to phone/computer.
- Real `PeerMatch_Backup_YYYY-MM-DD.zip` is produced.
- Keep this ZIP as the safest manual backup copy before destructive tests.

## Backup — Email backup v127

This is a high-priority device test.

1. Open Backup screen and wait for preparation to finish.
2. Tap Email backup.
3. Choose Gmail/email app.
4. Confirm there is an actual attached file named like `PeerMatch_Backup_YYYY-MM-DD.txt`.
5. Send it to yourself.
6. Download the attachment back to the phone/computer.
7. Open Restore Backup and choose the downloaded `.txt`.
8. Confirm PeerMatch recognizes it as an emailed backup.
9. Restore only when a safe secondary backup exists.
10. Verify Guys, Girls, Shadchanim, history, photos, PDFs and audio survive.

The `.txt` is Base64 of the exact ZIP bytes; it is not encryption.

## Backup roundtrip integrity — v127 bug regression

v126 originally encoded independent Base64 chunks using a chunk size not divisible by 3, which could insert `=` padding in the middle of large backups. v127 changes the encoder chunk size to a multiple of 3.

For a meaningful test, use a backup containing at least one photo or PDF so the file is large enough to cross multiple encoding chunks.

## Incoming Android Share -> PeerMatch

- Share text, image and PDF into PeerMatch.
- Pending import is consumed once.
- No duplicate on reopen.
- File survives even if parsing/OCR fails.

## Shadchan reminders / waiting / added date

- Reminder controls remain Shadchan-only.
- Waiting active yellow / inactive gray.
- Editing does not reset waiting unexpectedly.
- Added date does not change on edit.

## GitHub Pages / service worker

- Deploy succeeds.
- Workflow reads VERSION/SCRIPTS from `sw.js`.
- Every live runtime file exists.
- Full PWA close/reopen activates the new version.
- Only old `peermatch-v*` caches are removed.
- Existing IndexedDB data remains readable.

## Final completion statement

Before calling work finished, state:

- which live owner changed,
- which conflicting/legacy behavior was removed or constrained,
- deployment status,
- exact installed-PWA tests performed,
- what remains untested.

CI success is not device verification.
