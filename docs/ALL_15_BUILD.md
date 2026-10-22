# Luo Chat 15.0.0 release record

## Delivered

All 15 feature areas requested for this release are implemented. See [`RELEASE_15.md`](../RELEASE_15.md) for the user-facing behavior, bounds, and acceptance limits, and [`FEATURES.md`](../FEATURES.md) for the wider product capability ledger.

The production deployment is `dpl_2G34jFELaQezEBbSUu3ozXLNAump` (READY). Verification record: [`verification/v15.0.0-release.json`](../verification/v15.0.0-release.json).

- 159 tests pass locally, after a clean install, and in the hosted build.
- 213 frontend production outputs match byte for byte after a clean `npm ci --ignore-scripts` install.
- Live HTML, JavaScript, CSS, and service worker hashes match the verified build.
- Hosted rollback fixtures cover private data ownership, drawing and call permissions, album metadata, push queue permissions, mute filtering, and attachment authorization. The fixtures did not read real user content or send real push notifications.
- Frontend production package audit and pinned push-function dependency fixture each reported zero known vulnerabilities at verification time.

## Known external acceptance gates

- Calls use STUN without a provisioned TURN relay; restrictive network connectivity and real two-device calling need acceptance.
- Physical-device closed-app push and screen-reader/accessibility acceptance were not performed.
- The encrypted export covers selected accessible chat text and private organization documents, not media or full database disaster recovery.
- Frontend build reproducibility does not prove backend restore or Edge Function bundler reproducibility.
- Hosted OAuth/recovery configuration, account deletion/session controls, leaked-password protection, and the Google Safe Browsing warning remain separate open release/security gates.

No application keys or deployment secrets belong in this record or the source archive. The local `.env.push-bootstrap` file is intentionally excluded.


## 15.0.1 follow-up

Four confirmed reliability areas were fixed; see `RELEASE_15_0_1.md`. Production `dpl_4eEWDsrjo3Nga7maspZfQRRaaMza` is READY with 170 local/clean/hosted tests, 213 matching clean frontend files, and live asset hashes verified. Eleven new regression tests include nine failures reproduced against the previous source. Existing network/device/security gates remain unchanged.


## 15.0.2 follow-up

Call handling now keeps incoming retries separate, closes declined UI before its remote response, restores camera controls, isolates stale poll/SDP work, binds Start to the selected conversation and reinforces screen-lock cleanup. Known conversation names appear in the call UI. Production `dpl_9kFUxVinHaUjJzik4i7e32n8FTWr` is READY; 177 tests pass locally, in a clean install and in Vercel, with 213 matching frontend outputs. Seven new cases fail against the previous source. No backend/account/service configuration changed.


## 15.1.0 bug and design review

See `AUDIT_15_1.md`. Fixed mobile settings/menu containment, modal feedback/names and focus, settings snapshots/session transitions, lookup races and stale channel state. 189 local, clean-install and Vercel tests pass; 213 frontend outputs match after a clean install. Browser fixture checks cover 42 views/four widths and three selected accessibility surfaces with no final findings. Live core asset hashes match. Production `dpl_8PVeVyZM59nNTtirSxJfQ8Jf8Nrr` is READY. No backend/provider/account configuration changed; prior external/security gates remain open.
