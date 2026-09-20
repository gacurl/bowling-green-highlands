# Break-glass Admin Password Recovery

This procedure exists only to restore Admin access after the farm owner has
explicitly authorized recovery. It is not the normal password-change method,
and it does not give a developer or maintainer standing authority over the
Admin credential.

Normal password changes belong to the authenticated owner workflow tracked in
Issue #236. This guide does not implement that capability.

## Security boundaries

Break-glass recovery has no public forgot-password page, email reset, reset
token, permanent maintainer password, or hidden developer backdoor. It occurs
only after owner authorization and must not leave temporary maintainer access
in place.

Never put an Admin credential in GitHub, source code, screenshots, logs,
tickets, chat transcripts, URLs, or documentation. Enter a replacement value
only in the protected hosting configuration.

## Recovery procedure

1. Receive explicit recovery authorization from the farm owner.
2. Access the protected production hosting or configuration environment.
   Vercel is the current host, but the procedure remains the same on another
   server-capable host.
3. Replace `ADMIN_PASSWORD` with the temporary recovery credential and set
   `BGH_ADMIN_RECOVERY_MODE` to `enabled` directly in
   the protected configuration without copying it into source code, notes, or
   communication records.
4. Restart or redeploy the application so the running application loads the
   replacement value.
5. Confirm that the previous credential no longer signs in.
6. In a browser that was authenticated before recovery, open a protected Admin
   route. Confirm that the previous session is redirected to Admin login. Also
   confirm that protected Admin routes remain inaccessible when signed out.
7. Restore access only long enough to return Admin control to the owner.
8. Hand password control back to the owner. When the authenticated owner
   password-change capability tracked in Issue #236 is available, the owner
   uses it to establish their own Admin password; Issue #228 does not implement
   that workflow.
9. Set `BGH_ADMIN_RECOVERY_MODE` back to `disabled`, restart or redeploy, and
   remove any temporary maintainer access. The application and hosting
   configuration must not retain a maintainer password, bypass, or backdoor.

Do not delete or edit the owner credential file to enter recovery mode. A
malformed or unreadable credential file fails closed rather than enabling the
deployment credential.

Recovery mode is separate from first-time bootstrap. First-time setup uses
`BGH_ADMIN_BOOTSTRAP_MODE`; this recovery procedure must not be used as the
normal initialization path.

## Emergency exposure

If compromise is suspected, obtain the owner's authorization and then:

1. Replace `ADMIN_PASSWORD` and set `BGH_ADMIN_RECOVERY_MODE` to `enabled`
   immediately in the protected production configuration.
2. Restart or redeploy immediately so the replacement takes effect.
3. Confirm that the previous credential and sessions created from it no longer
   authorize Admin access.
4. Check Git history, logs, and documentation for exposure without reproducing
   the credential.
5. Return control to the owner, disable recovery mode, restart or redeploy, and
   remove any temporary maintainer access.

## Local development

Local development is separate from production recovery. Replace
`ADMIN_PASSWORD` only in the ignored `.env.local` file, explicitly enable
`BGH_ADMIN_RECOVERY_MODE`, then restart the local development server. Disable
recovery mode after recovery is complete. Never put a real password in
`.env.example` or commit a local environment file.
