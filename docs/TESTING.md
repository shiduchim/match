# PeerMatch Manual Regression Checklist — v128

CI/deployment success is not device verification. Test the installed Android PWA after fully closing and reopening it.

## Before testing

- Confirm `sw.js` VERSION is 128.
- Confirm `v128-runtime-hardening.js` is last in `sw.js -> SCRIPTS`.
- Confirm every listed live script exists.
- Fully close/reopen PeerMatch.

## Smoke

- App opens without errors.
- Guys/Girls/Shadchanim render.
- Existing data remains present.
- Search and checkbox selection work.
- Details open/close normally.
- Add/Edit saves.
- No duplicated detail blocks after repeated opens.

## Layout / contacts

For Guy and Girl details verify:

1. Header/photo/meta + Edit top-right
2. Profile text
3. Looking for / To what age
4. Attachment
5. Contacts
6. Quick details / other info
7. History
8. Added date

Also verify `ב״ה`, Girl Photo placement, Waiting colors, and contact action order:

**Call -> Email -> WhatsApp -> SMS**

Check Shadchan contact row uses the same order.

## Looking for / To what age

Previously user-verified; regression only:

- Add/edit/save works.
- Cancel does not persist.
- Clear + Save persists clear.
- Blank values allowed.
- 18–99 integer validation works.
- Old records without fields still open.

## Attachment opening

- Images remain after restart and open in-app.
- PDFs remain attached and download directly when opened.
- Do not accept a broken blob/browser tab as success.

## PDF-first outgoing profile

1. Choose Guy/Girl with attached PDF.
2. Share via WhatsApp; confirm actual PDF is shared, not OCR/autofilled profile text.
3. Repeat via Email.
4. Test one profile -> multiple Shadchanim when PDF is attached.
5. Remove PDF and Save.
6. Share again; confirm normal text profile is used.

## WhatsApp main flows

### One selected Shadchan + profile(s)

- Correct Shadchan opens.
- Android returns to PeerMatch, not `api.whatsapp.com`.
- Text goes first.
- Photo prompt uses explicit Yes/No only when photo exists.
- Multiple profiles send separately.
- Profile and Shadchan history each receive one linked entry per send.

### One profile -> multiple Shadchanim

- Each Shadchan gets a separate sequence.
- Optional photo handled per recipient.
- History stays separate per recipient.

### No Shadchan selected

- Saved Shadchan, typed recipient, and blank-recipient/manual-choice cases work.
- Text first, optional photo second.

### Queue isolation — v128

This is new and must be tested:

1. Begin one WhatsApp flow but do not finish its queue/prompt.
2. Change selection and begin a different WhatsApp flow type.
3. Confirm only one queue/prompt remains.
4. Close/reopen PeerMatch and confirm stale pre-v128 queue bars do not return.
5. Confirm no profile/history data changed merely because queue state was cleared.

## Lower-level WhatsApp paths

Test separately because they still have older owners:

- Shadchan detail -> WhatsApp compose
- Guy/Girl sender/contact -> WhatsApp
- Guy/Girl Contacts -> WhatsApp
- inline clickable phone -> WhatsApp

If the browser `Share on WhatsApp` intermediary appears, record exactly which path. Do not fix by adding a broad capture listener.

## Make Match

- Uses actual selected Guy/Girl/Shadchan.
- Android returns to PeerMatch.
- Match history lands on correct records.

## History deletion — v127 hardening

### Fresh linked share

1. Send one profile to one Shadchan.
2. Confirm event exists on both sides.
3. Delete one side.
4. Confirm both linked entries disappear.
5. Wait, switch away/back, and reopen both details.
6. Confirm the event does not return.

### Old/pre-link history

Repeat on an older unlinked share if available. Confirm it stays deleted after focus/detail reopen.

### Repeated identical send

1. Send same unchanged profile to same Shadchan twice.
2. Confirm two entries on both sides.
3. Delete only one pair.
4. Confirm the other remains.

## Backup — ZIP to phone/computer

- Tap `Save backup to phone / computer`.
- Confirm a real `PeerMatch_Backup_YYYY-MM-DD.zip` downloads.
- Keep this ZIP before doing destructive restore tests.

## Backup — Email TXT roundtrip

High-priority device test:

1. Open Backup and wait for preparation.
2. Tap Email backup.
3. Choose Gmail/email target.
4. Confirm an actual `PeerMatch_Backup_YYYY-MM-DD.txt` attachment is present.
5. Send/save it.
6. Download the TXT back.
7. Restore that TXT in PeerMatch.
8. Verify Guys, Girls, Shadchanim, history, photos, PDFs and audio survive.

The TXT is Base64 of the exact ZIP bytes. It is not encryption.

Use a backup containing at least one photo or PDF so the Base64 path crosses multiple chunks.

## Incoming Android Share -> PeerMatch

- Share text, image, PDF into PeerMatch.
- Pending import consumed once.
- No duplicate on reopen.
- File survives even if OCR/parsing fails.

## Shadchan reminders / waiting / dates

- Reminder controls remain Shadchan-only.
- Waiting active yellow / inactive gray.
- Editing does not reset waiting unexpectedly.
- Added date does not change on edit.

## Deployment / service worker

- GitHub Pages deploy succeeds.
- Workflow derives VERSION/SCRIPTS from `sw.js`.
- Full close/reopen activates v128.
- Only old `peermatch-v*` caches are removed.
- Existing IndexedDB data remains readable.

## Completion report

Before calling v128 complete, record:

- deployment status;
- which of the above tests were actually done on the installed PWA;
- what remains untested.
