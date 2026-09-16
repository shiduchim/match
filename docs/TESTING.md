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

## Attachment — PDF (v113 fix, pending device verification)

v111 tried an in-app PDF.js renderer; v112 tried share-then-download. Neither actually ran for Guy/Girl attachments — a separate, unrelated file (`whatsapp-import-v61.js`) was creating its own competing attachment box that always won and silently made both fixes dead code. v113 removes that competing box AND switches the PDF action to a guaranteed synchronous download (no share attempt). Use a known-good PDF that PeerMatch can parse/store.

- PDF is still attached after save and app restart.
- Tap Open PDF on a **Guy or Girl** profile (this is specifically the path that was broken — the v61 competing box only affected `openP`, not Shadchan detail).
- It must NOT navigate to `blob://localhost/...` and must NOT open an unavailable Chrome tab.
- It must NOT attempt to render inside PeerMatch and must NOT show an Android share sheet — it should download immediately.
- Confirm an alert appears saying the PDF was downloaded and where to find it.
- Open Android's Downloads (or the browser's downloads/notifications) and confirm the file is there with a sensible name, and that it opens correctly in a PDF viewer from there.
- The stored attachment is unaffected — reopen the same record and confirm Open PDF still works, repeatedly.
- Tap Open PDF on a **Shadchan** with a PDF attachment too (this path was not affected by the v61 bug, but confirm the same reliable-download behavior applies there as well, and that the compact header-tile placement/label is unchanged).
- Confirm image attachments are unaffected: Open attachment for an image still opens the in-app image viewer exactly as before, including its own Share/save button (which still offers Share first, then download).

Test on the installed Android PWA — this is specifically about Android's download behavior, so desktop Chrome is not representative.

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

## Selected profile -> selected Shadchan -> WhatsApp (v113 + v114 + v115 fix, pending device verification)

v113 removed two independent DOM-position-based selection reconstructions: `final-fixes-v107.js` now reads `window.pmGetSelected(k)` (the real Set from `peermatch-v11.js`) as the authoritative selection source. v114 restored `profile-share-v52.js`'s general-recipient WhatsApp path (Case A, see below — it was over-aggressively deleted at v113 and has been recovered and re-pointed at `window.pmGetSelected`), added a direct "send to selected Shadchan" path (Case B) that reuses the exact same helper (`window.pmWhatsAppUrl`) the ordinary Shadchan-detail WhatsApp button uses, routes between the two at the button's own creation site instead of a document-wide listener, and — for Case B with multiple selected profiles — sends them one at a time through a persistent tap-per-profile queue rather than merging them into one message.

**v115 is the fix that actually makes any of this reachable.** The user reported the v114 behavior still didn't work — a previously-untraced file, `profile-tools-v62.js`, ran a `window`-level (not `document`-level) capture-phase click listener that always intercepted the Guy/Girl WhatsApp button first, before v114's own button binding could ever run, and diverted it to an unrelated bare-`wa.me` share ignoring any selected Shadchan. `profile-tools-v62.js`'s listener no longer matches WhatsApp at all (only Email/SMS, unchanged). Separately, `shadchan-share-v55.js`'s own WhatsApp button (on the Shadchanim tab's own selection bar) is now routed through the same shared decision function, `window.pmRouteSelectedWhatsApp()`, so pressing WhatsApp from either tab behaves identically. Test with several known profiles and one known Shadchan with a valid WhatsApp number, on **both** the Guys/Girls tab and the Shadchanim tab.

- **First confirm the ordinary Shadchan-detail WhatsApp button still works exactly as before** (open a Shadchan, tap WhatsApp, type a message, tap Continue) — this is the reference behavior Case B reuses; if this regresses, the shared helper broke something.
- **This is the critical regression check for v115:** select exactly one Guy (or Girl) and exactly one Shadchan, then press WhatsApp from the **Guy/Girl tab's own selection toolbar**. WhatsApp must open directly to that Shadchan's number with the profile prefilled — not a bare WhatsApp contact picker. This is the exact scenario that failed after v114 and must be re-verified first before any other test in this section is meaningful.
- Repeat the same check pressing WhatsApp from the **Shadchanim tab's own selection toolbar** instead (same Guy + same Shadchan both still selected) — must produce the identical result.
- Select one Guy **and** one Girl at the same time, plus one Shadchan, and press WhatsApp from either tab — expect a clear alert asking to select only Guys or only Girls, not both; nothing should send silently or guess which profile to use.
- Confirm Email and SMS for selected Guys/Girls (with the language-flag-filter dialog) still work exactly as before — `profile-tools-v62.js`'s listener for those two channels was intentionally left untouched.

### Case A — profile(s) selected, no Shadchan selected (must be unchanged)

- Select one or more profiles, select **no** Shadchan.
- Press WhatsApp from the selected-profile toolbar.
- The existing recipient-choice dialog appears (pick an existing Shadchan or type a name/phone) exactly as before v113/v114 — this must not have regressed or been replaced by the direct-send path.
- Confirm the existing "share multiple profiles one at a time" queue dialog still appears when 2+ profiles are selected, and Web-Share-with-photo-then-`wa.me`-fallback behavior is unchanged.
- Confirm SMS-for-selected-profiles still works unchanged (shares this file with the restored/changed code — verify no regression).

### Case A (Shadchanim tab) — Shadchan(s) selected, no Guy/Girl selected (must be unchanged)

- Select one or more Shadchanim, select **no** Guy or Girl.
- Press WhatsApp from the Shadchanim tab's own selection toolbar.
- The pre-existing "share this Shadchan's own contact card" behavior runs exactly as before (single Shadchan sends immediately; 2+ Shadchanim show the existing one-at-a-time queue dialog) — this must not have been replaced by the direct-send-to-Shadchan path.

### Case B — exactly one Shadchan selected (single profile)

- Select exactly one profile and exactly one Shadchan.
- Press WhatsApp from selected-profile toolbar.
- WhatsApp opens the selected Shadchan's chat/number directly — no recipient picker dialog (that dialog belongs to Case A only).
- Profile text is prefilled.
- The phone is normalized correctly for WhatsApp — compare against how the *same* Shadchan's number resolves via the ordinary Shadchan-detail WhatsApp button; they must produce identical digits since both go through `window.pmWhatsAppUrl`.
- Before handoff, profile history receives exactly one send/open entry; Shadchan history receives exactly one corresponding entry; no duplicates.
- No bottom "Send profile N of M" bar appears for a single profile — that queue UI is only for 2+ profiles.
- Returning to PeerMatch does not corrupt selection state.
- Toggle several checkboxes on and off a few times (to exercise the selection-bar rebuild), then press WhatsApp — it must still fire reliably; this is the specific instability (`ensureSelectionBar()`'s `innerHTML=` rebuild destroying/recreating the button) the v114 direct-binding change targets.
- No photo/image is attached by this flow yet (deferred by design) — confirm the message is text-only and no share sheet/file picker appears.

### Case B — exactly one Shadchan selected (multiple profiles, new v114 queue)

- Select **three** profiles and exactly one Shadchan.
- Press WhatsApp: the first profile's WhatsApp chat opens immediately (this tap is that profile's one required tap) — confirm the message contains **only that one profile's text**, never all three merged.
- Confirm exactly one history entry pair (profile + Shadchan) was written for that first profile only so far.
- Return to PeerMatch (e.g. app-switch back). A bottom bar should read "Send profile 2 of 3 to <Shadchan name>".
- Confirm no second `wa.me` navigation happened automatically — it must wait for an explicit tap on the bar's Send button.
- Tap Send: WhatsApp opens again with only profile 2's text; history gets exactly one new pair for profile 2.
- Repeat for profile 3; after it sends, the bottom bar disappears (queue empty).
- Confirm total history: each of the 3 profiles has exactly one send entry, the Shadchan has exactly 3 received entries (one per profile), never one merged entry.
- Test **losing focus while WhatsApp is open mid-queue**: after profile 1 sends and the bar shows "2 of 3", background/switch away from PeerMatch for a while (or fully close and reopen the installed PWA) before returning — the bar must still show "2 of 3" and Send must still work correctly, not have lost or duplicated the queue.
- Test **Cancel** on the bar: confirm it clears the queue and no further profiles from that batch are sent.
- Test reopening a detail screen or toggling other checkboxes while the queue bar is showing — it must persist (re-created by the same polish cycle that reinforces `keepEditTop()`), not disappear or get stuck behind other UI.

### Alerts (Case B edge cases)

Confirm a clear `alert()` appears rather than nothing happening or the wrong Shadchan being used:
- no Shadchan selected with 1 profile selected — this is Case A, not an alert (see above);
- more than one Shadchan selected — expect "Select only one Shadchan..." alert;
- selected Shadchan has no phone — expect the "needs a phone number" alert, and no queue is created.

Specifically retest Case B with a **referred/grouped Shadchan** selected while collapsed (see "Referral/grouped Shadchan list" below) — this was the concrete mechanism identified for why the old DOM-position approach could pick the wrong Shadchan or miscount.

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
- Check a Shadchan, then collapse the group it belongs to (hiding its card): confirm the WhatsApp selected-send flow still targets that same Shadchan correctly (this is the specific stale-checked-but-hidden scenario `docs/KNOWN_ISSUES.md` issue #2 identifies as the likely concrete trigger for the old bug).

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
