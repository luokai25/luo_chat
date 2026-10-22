# Luo Chat 15.1.1 — tools reliability

Reviewed 21 October 2026. Black-and-gold styling and the existing supplied app icon are preserved.

## Confirmed fixes

| Priority | Defect | File-level fix |
| --- | --- | --- |
| P1 | Fast edits to different private folder checkboxes could each save an older folder list, losing a confirmed edit. Pending edits could continue after signout. | `src/suite.js`: serialize this device's folder writes, calculate changes from the latest confirmed state, invalidate stale reads, and cancel queued writes when the initiating account generation changes. A request already sent to the server cannot be cancelled. |
| P1 | An encrypted backup used the password field's later value after asynchronously loading history, even if the two password fields no longer matched. | `src/suite.js`: validate and capture the submitted password before fetching data. Restore also captures its password before reading the selected file. |
| P2 | Restore and export could overlap because only export acquired the backup operation lock. | `src/suite.js`: share the lock across export and restore; release only the initiating operation's lock. |
| P2 | A delayed tools failure could display a previous account's error after signout. | `src/suite.js`: apply failure feedback only to the initiating account generation, attached control and unlocked app. |
| P2 | Background notification status could arrive after navigating to another tools page and overwrite its status. | `src/suite.js`: recheck the view scope after awaiting the browser's subscription status. |

Six regression tests in `tests/ui.test.mjs` exercise these failures. Each fails against the saved 15.1.0 suite implementation and passes with this patch. The encryption test decrypts the actual generated backup with the submitted password and rejects the later edited password.

## Verification

Release results and deployment evidence are recorded in `verification/v15.1.1-release.json` after the release completes. No hosted backend acceptance, physical-device test or new accessibility certification is implied. This patch adds no dependencies or provider configuration.

## Limits and remaining work

- Folder writes are serialized within one running app instance. Simultaneous edits on multiple devices/tabs still require a server-side versioned mutation design; this patch does not implement distributed conflict resolution.
- Encrypted export remains a selected-chat text/organization snapshot, not a complete database/media disaster-recovery backup. Restore is not atomic across multiple archive sections; interrupted restores may leave partial private copies.
- Hosted recovery/deletion acceptance, strict access-token revocation, breached-password protection, Google provider activation, full backup/restore, TURN and physical-device calls/push remain open as previously documented.
- No new official host-specific evidence of Google Safe Browsing clearance was obtained. Deployment success is not clearance.

## Connections

No additional connector is needed for these code fixes. Render is optional for a separate backend service and is not required to replace Vercel/Supabase. Production transactional email and browser error monitoring remain useful infrastructure priorities; a plugin directory search returned no Resend or Sentry match during this run. No provider account, paid resource or email send was created.
