# Resend authentication email migration

Status on 2026-10-23: **prepared, not activated**. The connected Resend account has no sending domains. Cloudflare has no DNS zones and Vercel has no registered custom domains available to verify. A sender domain controlled by the owner is required before production delivery can move to Resend. The existing provider is unchanged.

The Vercel hostname remains valid for the website and authentication redirects. It cannot serve as the Resend sender: Vercel owns `vercel.app`, so the project cannot publish the required sender-verification DNS records beneath its free hostname. Resend requires a domain the sender owns: https://resend.com/docs/dashboard/domains/introduction.

## Integration

Use Supabase Auth's supported custom SMTP configuration. The current `luo-auth` Edge Function continues to call native signup, recovery and confirmation resend APIs. Supabase creates and validates the authentication links; Resend transports the messages. No new browser-facing email sender, recipient selector or custom token-generation path is needed. SMTP also covers other native Auth email flows when those flows are enabled.

The non-secret plan is `integrations/resend/smtp-plan.json`. Branded, mobile-friendly templates are in `integrations/resend/templates`, with subjects in `auth-templates.json`. They use only native `{{ .ConfirmationURL }}` or `{{ .Token }}` placeholders and do not include user metadata, private chats, external images or analytics links. These files are prepared assets; committing them does not update hosted Auth settings.

## Activation

1. Select the owner's sending domain or a dedicated transactional subdomain. Do not use Gmail, `resend.dev`, `vercel.app` or another provider's shared domain as the production sender.
2. Add the exact domain to Resend. Use the DNS records returned by Resend; never copy example DKIM values or overwrite an existing SPF policy blindly. Verify sending capability. Check the existing DMARC policy before making any change.
3. Create a sending-only Resend API key restricted to that verified domain. Keep it server-side. Configure the hosted `luo-chat` project's SMTP with host `smtp.resend.com`, port `465`, username `resend`, password set to that key, a verified sender address, and sender name `Luo Chat`.
4. Change only SMTP/template settings. Preserve confirmations, secure email change, redirects, account/session settings and existing quotas. Do not bulk-push incomplete local Auth configuration over the hosted project. Keep click/link tracking disabled for authentication messages.
5. Install the matching subjects and HTML through hosted Auth email settings or a narrow Management API patch. There are no Management API credentials or SMTP settings tools available through the current Supabase connector; an authenticated configuration path is still required. Never commit a Supabase access token or Resend key.
6. Use one owner-controlled test mailbox to verify signup confirmation, confirmation resend, recovery and single-use/expired link behavior. Confirm delivery in Resend and that recovery returns to the existing Luo Chat password flow. Test suppression/rate-limit/provider failure responses without sending to real users in bulk.
7. Only mark Resend primary after configuration and real delivery are verified. Retain the previous provider settings securely for rollback. Rolling back must not disable confirmations or loosen redirect/account restrictions.

## Reliability change

The Edge Function now returns 429 with bounded retry advice for upstream email throttling, and generic 503 for network failures, provider outages and unauthorized-sender configuration. It no longer labels these conditions as a successful reset/resend request or an ordinary signup validation error. Unknown-account recovery/resend results remain generic to avoid account enumeration. Errors never contain raw provider details, emails, passwords or tokens, and no automatic send retry is introduced.

## References

- https://resend.com/docs/send-with-supabase-smtp
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email-templates
