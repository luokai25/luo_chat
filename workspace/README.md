# Luo Workspace

Private black-and-gold operator console for the Luo Chat ecosystem.

## Deployed dashboard

- Cloudflare Worker: `luo-workspace`, account subdomain `luo-chat-ops`
- Dashboard URL: https://luo-workspace.luo-chat-ops.workers.dev/
- The Cloudflare Workers control plane has confirmed a production deployment and an enabled public subdomain. External HTTP probes from this execution environment cannot access the workers.dev domain, so real-browser login/visual testing remains a separate acceptance check.
- Separate Vercel project `luo-workspace` was created for future Git-connected use, but Vercel reached its free daily deployment quota and this project has not been deployed there.

The workspace is a separate app, not a replacement for Luo Chat production.

## Authorization and privacy

- The HTML shell is publicly downloadable. Account data is not.
- Sign in using the **Luo Chat account email/password**, NOT PayPal credentials.
- Supabase Auth holds the session. `public.luo_workspace_snapshot()` enforces `auth.uid()` membership in a private `luo_workspace.admin_users` allowlist.
- The production migration `luo-workspace-owner-only.sql` is installed and one confirmed owner account was authorized in the private table. The owner identity is deliberately not published in this repository.
- Only the authenticated role can call this function; anonymous callers cannot.
- Browser code contains only a public Supabase publishable key. Never embed service-role, PayPal REST, GitHub PAT, Vercel PAT or Resend API secrets.
- The chart, directory and counts come directly from production PostgreSQL data. No chat contents are exposed; the recent owner-only account view includes emails and last successful sign-ins.
- Online-now presence is not yet available. 'Engaged last 24h/7d' means distinct authenticated sign-ins or actual message senders, not current online sessions.

## Panels

Overview: account count, engaged people, messages, conversations, 14-day signups, recent accounts, project signals and CI runs.

People: recent account directory with client-side name/email filtering, login timestamps and a link to Supabase account administration.

Activity: chats, groups, message traffic, stories, calls, friendships, moderation and notification counts.

Engineering: public GitHub Actions release history, site and auth health signals, and Vercel deployment administration links.

Billing: approved regular prices of $12/$24/$30, PayPal merchant links, and explicit release blockers. No revenue or transaction totals are invented. Billing remains OFF.

Integrations: direct management destinations for Supabase production and staging, GitHub, Vercel, PayPal, Resend, Cloudflare, and Luo Chat.

## Architecture

- `index.html`, `style.css`, `app.js`: static browser client; Supabase JS is loaded from a pinned jsDelivr ESM URL.
- `api/status.js`: read-only status proxy for separate Vercel project.
- `cloudflare-worker-template.js`: production Cloudflare classic Worker template. Build by replacing the assignments `const html=__HTML__;`, `const css=__CSS__;`, `const app=__APP__;` with JSON-encoded source contents, then deploy as a classic service worker.
- `vercel.json`: optional independent Vercel project deployment, with security headers and `rootDirectory: workspace` in project settings.
- `luo-workspace-owner-only.sql`: audited, idempotent owner-only Postgres RPC migration.

## Operations

- Refresh manually with the top-right control.
- The GitHub public Actions endpoint is rate-limited and can temporarily show unavailable. This never affects private Supabase data.
- Use provider-specific consoles to modify accounts, payment subscriptions or deployments; the first live release is **read-only by design**.
- Before adding direct management actions, require owner authorization, auditable server-side permission checks, CSRF defense, rate limits, and independent confirmation for destructive actions.
- Do not make PayPal charge/revenue claims until real merchant subscription reconciliation is connected and the previously exposed Live secret is rotated.
- Keep the site `noindex`, disable caching of login and account information, and never include personal user data in public `/api/status`.


## Workspace v2 (additive, 26 October 2026)

The original six pages, owner sign-in, black-and-gold theme, and Cloudflare hostname remain unchanged.

Three additional views:
- **Growth insights**: 30-day UTC daily account signups, messages, stories and last known sign-ins. Latest-sign-in per account is *not* all login events, and there is no reliable online-now or website-visitor counter.
- **Financial intelligence**: connected PayPal merchant-account invoice count/status, limited date-range transaction search and disputes, plus the approved Standard/Pro/Maximum pricing. A paid invoice is **not** proof of a paid Luo Chat AI subscription, and real agent revenue/subscriber counts are **unknown** until payment reconciliation is implemented.
- **Connector intelligence**: scoped and timestamped snapshots from GitHub, Vercel, Resend, Cloudflare and PayPal.

A compact extra-connector summary also appears beneath the existing Overview KPIs.

The additive SQL migration, \`luo-workspace-insights-v2.sql\`, adds a private \`luo_workspace.connector_snapshots\` table and a new \`public.luo_workspace_insights()\` RPC, both protected by the *same owner-only allowlist* as the original Workspace snapshot. It **does not modify** Luo Chat messages, account passwords, human subscriptions, billing payments, or production checkout.

**Freshness contract:**
- Supabase analytics are live at every Workspace Refresh.
- GitHub Actions and Luo Chat public health are queried on the read-only status endpoint.
- PayPal, Vercel deployment counts, Resend and Cloudflare summaries are **last-synced snapshots**, saved after a connected-service read. They do not update just because the browser Refresh button was pressed.
- Connector snapshot collection windows are explicit; figures are not global totals unless the provider says so. No provider API secrets are stored in the browser or the public Worker.
- Source records, recipient emails, invoice content, credentials and transaction details are *never exposed* in the public status endpoint.

The Cloudflare Worker template includes the fourth static asset \`/insights.js\`. Rebuild the template with \`index.html\`, \`style.css\`, \`app.js\`, and \`insights.js\` before deploying. The UI uses text nodes for untrusted provider data, not HTML injection.

Monitoring infrastructure, visitors, email deliveries, recurring payments and agent entitlement checks can be expanded into true refreshable provider feeds later only through authenticated backend integrations. Do not call a one-off plugin lookup a permanent live API connection.

## Multilingual discoverability monitoring

The product view includes a public-configuration panel for the five localized marketing and agent discovery guides, sitemap, and API documentation. It distinguishes configured public URLs from verified search impressions or indexed pages. The latter require an actual Search Console integration and are deliberately shown as *not connected*. The existing owner-only product telemetry remains authoritative; dashboard markup does not fabricate agent accounts or traffic. Cloudflare Workspace deployment is separate from Luo Chat's Vercel release and must be rolled out independently.

## Owner controls (27 October update)

The **Owner controls** page manages an exact release commit, scheduled release hold, agent registration/checkout/API/posts/chat switches, paginated account search, account suspension/restoration and a reasoned audit log. All actions use owner-allowlisted Postgres RPCs. Browser code contains only the public Supabase key. No new deployment credential is required for the existing scheduled retry.

Production migration: `supabase/migrations/20261027173403_workspace_owner_operator_controls.sql`. Private tables have RLS and no anonymous/authenticated direct grants. Existing account RLS policies are restrictive. Existing authenticated security-definer entry points are guarded without changing their OIDs/grants; their original definitions are retained privately for controlled rollback. Supabase's managed `authenticator` role cannot be edited by the connected operator, so this implementation does not depend on a global PostgREST hook. Guard future authenticated definer functions as they are added.

Suspension sets an Auth ban, adds a database access restriction, revokes agent API keys and expires agent session leases. Owner accounts cannot be suspended. Restoration preserves independent Auth restrictions and paid entitlement requirements and does not revive revoked keys. It does not cancel PayPal renewals, recall downloaded/public files or erase financial records. No customer account was suspended during development.

`LUO_WORKSPACE_CONTROLS_ENABLED=true` is configured for the next main app Production build. Its agent gateway reads switches per request and fails closed for the controlled services if settings are unavailable. Payment webhooks always retain the original environment so renewals/refunds/cancellations can be reconciled. Build approval checks require the exact approved SHA, fixed release branch, no hold and the provider retry time, before and after the core build. UI “Queue” records the exact approved commit for the scheduled automation; it does not claim to start an immediate Vercel deployment. Direct immediate deploy/cancel/rollback remain in Vercel.

Financial reporting uses a transaction-ID-deduplicated, provider-confirmed PayPal cash ledger starting with the updated webhook. Missing fee/net evidence remains unknown. Gross receipts, fee percentage, paid conversion, plan percentages and projected MRR are distinguished. Refund/reversal events require financial reconciliation before presenting net as settled. Merchant-wide invoice snapshots and plan prices are not receipts. The current counter is not a historical all-time merchant statement.

Build the self-contained Worker with `node scripts/build-workspace-worker.mjs`. It includes previously omitted revenue/product modules plus `operations.js` and public `/launch/` pages. Preserve existing secret bindings on uploads. The private root remains noindex; only `/launch/` is allowed in robots.txt. Do not expose any private account/analytics API on public launch routes.
