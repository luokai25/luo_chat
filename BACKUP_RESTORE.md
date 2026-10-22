# Backup and restore operations

Status: source recovery is in GitHub; a complete database/media backup and restore drill are NOT verified. The current connector cannot inspect provider backup retention, download a database backup, or verify Storage byte copies. No private user data was exported into this public repository.

## Required recovery coverage

| Component | Recovery source | Verification |
| --- | --- | --- |
| Frontend, APIs, functions and migrations | Versioned GitHub commit and Vercel deployment | Clean install/build and byte comparison |
| PostgreSQL data, Auth records, schema, grants and policies | Provider backup/PITR where available, plus a protected encrypted off-provider export | Restore into an isolated project and compare controlled records/counts |
| Storage file bytes | Separate encrypted copy of private bucket objects and metadata | Verify checksums and controlled private downloads after restore |
| Auth provider settings, redirect URLs, SMTP, function secrets and Vercel variables | Restricted operational vault | Reconfigure and test without writing secrets into GitHub or logs |
| Cron jobs, extensions and private worker configuration | Reviewed definitions plus vault-held credentials | Inspect jobs and run a controlled delivery/cleanup after restore |

A database backup does not include Storage object bytes. Existing migration files are incremental history, not a verified complete starting schema. The user-facing encrypted text snapshot excludes media and is not a disaster-recovery backup.

## Owner setup needed

1. Inspect the project's Database → Backups page and record the actual plan, last successful backup, retention, recovery point and recovery time. Do not assume Free includes downloadable managed backups/PITR.
2. Choose encrypted off-provider storage with restricted access and retention. Store database connection credentials and encryption keys in a private vault, never in this repository or an issue.
3. Use an authorized PostgreSQL 17-compatible backup client or the current Supabase supported backup workflow. Include application/private schemas and required Auth/Storage metadata; handle managed roles/schemas according to the restore target. Copy private bucket file bytes separately. A nonzero exit or missing component makes the backup incomplete.
4. Record only timestamps, encrypted artifact identifiers, byte sizes and checksums in an operational inventory. Alert on a missed daily backup. Proposed initial recovery targets are at most 24 hours of data loss and restoration within 4 hours; these are targets, not measured guarantees.
5. Restore into a separate project. Never rehearse restoration over production. Confirm RLS/grants, functions, configuration, indexes, Auth and bucket privacy. Test controlled sign-in, cross-user isolation, message retry, attachments and deletion. Record measured recovery duration and remaining gaps.
6. Repeat the drill after schema/configuration changes and at least quarterly. Backups are not considered verified until a restore succeeds.

Official references: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
