# Luo Chat 15.0.1 — reliability fixes

Release date: 21 October 2026. The black-and-gold design, supplied app icon, 200 Luo Family stickers and all 15 feature areas from version 15 remain.

## What changed

| Area | Confirmed defect in 15.0.0 | Fix |
|---|---|---|
| Shared drawing | Switching boards while a load was pending could leave loading stuck. Switching while saving could keep drawing disabled. The old canvas could remain visible. | Reset load/save state for the new board, clear its canvas immediately, start a fresh load, and ignore responses from the old board. |
| Private imports | Changing the selected file or date order, or failing to preview a replacement file, could leave an older preview importable. A delayed file read could restore stale content. | Invalidate the preview on each selection change and before parsing; bind async results to the selected file, date order and preview generation. Import requires a new valid preview. |
| Dashboard | Pending reminders, assigned tasks or schedules could be omitted because older/completed/other-user rows consumed the query limit before client filtering. | Filter owner/assignee and pending state in the query before applying limits. |
| Device notifications | Enable waiting for permission or subscription could finish after Off. A failed server cleanup could prevent disabling browser delivery. | Cancel superseded intents, serialize browser subscription changes and signout cleanup, unsubscribe locally before server cleanup, and report partial cleanup accurately. |

## Verification

- 170 tests pass locally and after a clean lockfile install.
- All 213 frontend production outputs match byte for byte after the clean install.
- New regression checks were also run against the saved 15.0.0 source: nine checks fail there and pass with these fixes. Two additional account-transition checks continue to pass.
- No database schema, Auth provider, TURN service, domain or push-worker configuration changed in this patch.
- Release evidence and live checks are recorded in `verification/v15.0.1-release.json`.

## How to use it

Refresh the app normally when the browser allows access. Open **Luo tools** above the inbox or in the chat menu. To change an import file/date order, preview again. A drawing board now loads independently when selected. The notification Off control cancels an unfinished Enable request; if server cleanup fails, it explains that browser alerts are off while server cleanup remains pending.

## Remaining limits

Calls still need a configured TURN relay for reliable use across restrictive networks, plus real two-device testing. Real closed-app push and screen-reader/physical-device acceptance remain unverified. Encrypted exports cover selected chat text and private organization documents, not media/full database recovery. Existing hosted recovery/deletion/session, OAuth, leaked-password protection and full backup/restore gates remain open. See `RELEASE_15.md` and `PROJECT_CHECKLIST.md` for the wider scope.

There is no official Google Safe Browsing clearance evidence in this release. A successful deployment or HTTP response does not clear the reported phishing warning. Do not bypass it.

## Production result

- Target: production; state: READY.
- Deployment: `dpl_4eEWDsrjo3Nga7maspZfQRRaaMza`.
- Framework: vanilla JavaScript PWA; source upload (no Git commit).
- Hosted build: 170 tests passed, zero failed; Vercel reported build completion in 38 seconds.
- Live HTML, app JavaScript, CSS and service worker hashes match the local verified build.
- Call configuration still returns 401 without authentication and 405 for unsupported methods.
- A 15-minute error/fatal Vercel runtime-log query for this deployment returned no groups. This is limited function/daemon visibility, not browser/Supabase monitoring or a security certification. Monitoring/drain configuration was not changed.
