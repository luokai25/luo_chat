# Selective Social web release

Base: the currently live production backup commit `e4edcb2e6fa93b6aac043b32d396b9630d2e7e93`, deployment `dpl_EH3fshqmL6qgbW5zWZCpgKVyQ2pm`.

This branch adds only Social and its client-side dependencies, navigation/lifecycle hooks, stylesheet and offline cache entry. Social is the fifth mobile navigation item after the four existing items. It provides Friends/Public feeds, Clips, photo posts/albums, comments, reactions, saves, profile links and the existing Social tools. The Notes interface is excluded.

Production authentication markup, recovery/OAuth helpers, calls, Stories, profile connections, settings, project configuration, dependencies and lockfile remain identical to the live backup. `tests/social-release-scope.test.mjs` checks the sensitive files and authentication markup against their hashes from that backup. No database migration or APK-specific sign-in code is included. No Luo Core chat cat is included.

Validation: full build and regression tests, dependency audit, credential-pattern scan, and browser checks at 320/390/768/1440 px with synthetic backend data and locally generated video. Hosted authenticated two-user media playback remains separate from the synthetic browser checks.

Rollback target: the deployment above. Do not promote the Android development branch to the production website.
