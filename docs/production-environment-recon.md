# Production Environment Recon

Issue #107 / Issue 8-1: Validate production environment configuration

## 1. Executive conclusion

There is not enough evidence to approve deployment on the current Bluehost plan.

The application is a server-rendered Next.js app, not a static export. It needs a supported Node.js runtime, dependency installation, a production build, a persistent start command, SMTP configuration, secure admin session cookies, and writable storage that survives restarts, rebuilds, redeployments, and server replacement events.

Repository evidence shows current production state is file-backed JSON by default. That can be safe only if production writes to a durable directory that is not deleted by deploys or rebuilds and is backed up. A read-only, serverless, ephemeral, or release-directory-only deployment would risk silently resetting availability, losing reservation requests, or reverting operator-edited content.

Recommendation outcome: **Insufficient evidence — complete the listed account checks before deciding**.

## 2. Current application runtime requirements

- Framework: Next.js `16.2.6`, React `19.2.4`, App Router, TypeScript.
- Node.js requirement: the installed Next.js package declares `node >=20.9.0`.
- Scripts:
  - `npm run build` runs `next build`.
  - `npm run start` runs `next start`.
  - `npm test` compiles tests to `.test-build` and runs Node's built-in test runner.
  - `npm run lint` runs ESLint.
- Runtime shape:
  - Requires a continuously running Node.js process for `next start`.
  - Uses server-side API routes and form actions under `/app`.
  - Uses middleware for admin route protection.
  - Uses server-side SMTP email forwarding through `nodemailer`.
  - Does not use a static export configuration.
  - Does not include a deployment file such as `Dockerfile`, `Procfile`, `vercel.json`, or `netlify.toml`.
- Repository deployment and ignore findings:
  - No hosting-specific production deployment documentation was found.
  - `.env*` is ignored, with `.env.example` intentionally tracked.
  - `.next/`, `out/`, `build/`, `.test-build/`, `node_modules/`, and generated TypeScript build artifacts are ignored.
  - `data/operator-availability.json` and its temp file are ignored.
  - `data/reservation-requests.json` and `data/homepage-content.json` are not currently ignored by name. Production should avoid writing state inside the repository checkout, and any future repo-local data file policy should be handled in a separate implementation issue.
- Required environment variables from `.env.example` and code:
  - `NEXT_PUBLIC_APP_URL`
  - `SMTP_URL`
  - `EMAIL_FROM`
  - `CONTACT_EMAIL`
  - `ADMIN_PASSWORD`
- Optional persistence override variables used by code:
  - `BGH_AVAILABILITY_STORE_PATH`
  - `BGH_RESERVATION_REQUESTS_STORE_PATH`
  - `BGH_HOMEPAGE_CONTENT_STORE_PATH`

## 3. Current persistence model

The app currently has no SQLite database, no external database client, and no migration system.

Current file-backed persistence:

- Operator availability:
  - Default: `data/operator-availability.json`
  - Override: `BGH_AVAILABILITY_STORE_PATH`
  - Missing file returns an empty availability map, which makes unconfigured dates unavailable by default.
- Reservation requests:
  - Default: `data/reservation-requests.json`
  - Override: `BGH_RESERVATION_REQUESTS_STORE_PATH`
  - Missing file returns an empty request list.
- Homepage, FAQ, pricing, and policy content:
  - Default: `data/homepage-content.json`
  - Override: `BGH_HOMEPAGE_CONTENT_STORE_PATH`
  - Missing file returns bundled default content.

Writes use a temporary file and rename pattern. That is reasonable for a single-process MVP on a durable filesystem, but it is still file-backed JSON with last-write-wins behavior. It is not multi-instance safe and should not be used on multiple app instances sharing traffic unless the storage and locking model are explicitly designed.

Admin session behavior:

- Admin auth uses `ADMIN_PASSWORD`.
- A signed `bgh_admin_session` cookie is created after login.
- The cookie is `httpOnly`, `sameSite: "lax"`, path `/`, and `secure` when `NODE_ENV === "production"`.
- Sessions are cookie-based, not server-memory-based. Restarting the app does not inherently invalidate an existing session as long as `ADMIN_PASSWORD` remains unchanged.

Confirmation page behavior:

- The post-submit confirmation page uses a short-lived signed cookie.
- The signing secret is currently derived from `SMTP_URL`.
- Changing `SMTP_URL` invalidates outstanding confirmation cookies, but those cookies last only five minutes.

## 4. Production risks

- State loss on redeploy: if production writes to the repo checkout or build release directory, redeploying may overwrite or delete JSON state.
- State loss on rebuild: if the build process recreates the deployment directory, default `data/*.json` state may not survive.
- State loss on server replacement: if the host replaces the VM/container without persistent volume restore, local JSON files may disappear.
- Silent reset behavior:
  - Missing availability file becomes empty availability, making dates unavailable by default.
  - Missing reservation request file becomes an empty list.
  - Missing homepage content file falls back to default content.
- Shared hosting uncertainty: generic shared hosting is commonly optimized for PHP/WordPress-style hosting. Public Bluehost pages do not prove this account's plan can run a long-lived Next.js process.
- Node version uncertainty: the app needs Node `>=20.9.0`; the account must prove that exact support or better.
- Process management uncertainty: production needs a restart policy and persistent process manager. SSH alone is not enough if the process dies after logout or server restart.
- Environment-variable uncertainty: production secrets must be set outside Git and outside public docs. The account must provide a secure way to manage them.
- File permissions uncertainty: the production Node user must be able to read/write the persistent JSON files and temp files.
- Backup uncertainty: the current persistence model has no built-in backup, export, point-in-time recovery, or database durability.
- Multi-instance risk: the current JSON write model is not safe for horizontally scaled app instances.

## 5. Bluehost capabilities confirmed from public information

Public Bluehost information confirms these general capabilities, but not whether the client's specific account has them enabled:

- Bluehost has shared web hosting, VPS hosting, managed VPS hosting, dedicated hosting, cloud hosting, domains, and SSL products.
- Bluehost documents SSH access:
  - Shared server SSH can be enabled from the Bluehost Portal, subject to account verification.
  - VPS and dedicated customers have root SSH access available.
  - Source: <https://www.bluehost.com/help/article/ssh-access>
- Bluehost's self-managed VPS page advertises:
  - full root access
  - ability to install custom software
  - allocated CPU/RAM/NVMe resources
  - root SSH + API access on VPS tiers
  - Source: <https://www.bluehost.com/vps-hosting>
- Bluehost documents DNS management through cPanel Zone Editor for domains using Bluehost nameservers.
  - Source: <https://www.bluehost.com/help/article/dns-management-add-edit-or-delete-dns-entries>
- Bluehost sells and documents SSL certificates and states free SSL is included in all hosting plans, using Let's Encrypt.
  - Source: <https://www.bluehost.com/ssl-certificates>

Not confirmed from public information:

- The client's current plan type.
- Whether the client's current plan supports Node.js `>=20.9.0`.
- Whether the current plan supports a persistent Next.js `next start` process.
- Whether the current plan exposes a secure environment-variable manager for Node apps.
- Whether deployments preserve writable app data.
- Whether Bluehost support will support this specific Next.js deployment path on this account.

## 6. Bluehost account details that still require manual verification

The account owner must verify these inside Bluehost or with Bluehost support, without sharing credentials or private account details in the repo:

- Hosting plan type:
  - shared web hosting, WordPress hosting, cloud hosting, VPS, managed VPS, dedicated, or another product.
- Node.js support:
  - whether Node apps are supported on this exact plan.
  - supported Node.js versions.
  - ability to run Node `>=20.9.0`.
- Dependency installation:
  - whether `npm ci` or equivalent dependency installation is allowed.
  - whether build memory and CPU are sufficient for `next build`.
- Build and start:
  - whether `npm run build` can run on the server or in a deploy pipeline.
  - whether `npm run start` / `next start` can be configured as the production command.
  - whether the process stays running after SSH logout.
  - whether the process restarts after crash or server reboot.
- Process management:
  - supported process manager, if any.
  - log access.
  - restart controls.
- Environment variables:
  - secure storage location.
  - whether runtime variables are available to the Node process.
  - whether variable changes require rebuilds, restarts, or both.
- Writable persistent storage:
  - safe writable directory outside the release/build directory.
  - whether that directory survives app restarts.
  - whether it survives server restarts.
  - whether it survives redeployments.
  - whether it survives rebuilds.
  - backup and restore behavior.
- Domain and DNS:
  - whether Bluehost is the registrar.
  - whether Bluehost nameservers are authoritative.
  - whether DNS is managed in Bluehost Zone Editor or elsewhere.
  - required DNS changes if the app is hosted elsewhere.
- SSL:
  - whether free SSL is active for the target domain.
  - whether SSL terminates at Bluehost, a reverse proxy, or another platform.
  - renewal behavior and ownership.

## 7. Deployment options

### Option A: Deploy on current Bluehost plan

Only safe if manual verification confirms all of the following:

- Node.js `>=20.9.0` is supported.
- Dependencies can be installed.
- `next build` can run successfully.
- `next start` can run as a persistent production process.
- The process restarts automatically after crash and server reboot.
- Runtime environment variables can be set securely.
- A writable persistent state directory exists outside the deploy/release directory.
- The app can point all three store path env vars to that durable directory.
- SSL and DNS can route production traffic to the Node process.

Without those confirmations, this option is not approved.

### Option B: Keep domain and DNS on Bluehost, deploy application elsewhere

This is likely lower operational risk if the current Bluehost account is shared, WordPress-focused, or cannot prove durable Node process support.

The external host still must provide:

- Node.js `>=20.9.0`.
- A supported Next.js runtime.
- secure runtime environment variables.
- a persistent writable volume or a planned persistence migration.
- restart behavior.
- build logs and deploy rollback.
- SSL termination.

Important: many serverless Next.js platforms do not preserve local filesystem writes. This app should not be deployed to a read-only or ephemeral serverless filesystem unless persistence is moved to a durable external store in a separate approved issue.

### Option C: Bluehost VPS or dedicated server

This can fit the current app better than shared hosting because public Bluehost pages advertise root access and custom software control for VPS. It still requires operational setup:

- install the supported Node.js version.
- install dependencies.
- build the app.
- run `next start` behind a reverse proxy.
- configure a process manager.
- configure SSL.
- store env vars outside Git.
- put JSON state in a durable backed-up directory outside the release directory.
- define backup and restore steps.

This is viable only if someone will own server operations.

### Option D: Static export

Not viable for the current application. The app has server-side routes, middleware, SMTP, admin sessions, file-backed writes, and runtime reservation handling.

## 8. Recommended lowest-risk deployment path

Do not deploy yet.

First, complete the Bluehost account checks in section 6. If the current account cannot prove supported Node.js `>=20.9.0`, dependency installation, `next build`, persistent `next start`, secure env vars, SSL routing, and durable writable storage, keep the domain and DNS under Bluehost control and deploy the application on a host that explicitly supports long-running Next.js apps plus durable persistence.

For the current codebase, the lowest-risk production shape is:

- one production Node.js app instance.
- Node.js `>=20.9.0`.
- `npm ci`, then `npm run build`, then `npm run start`.
- all secrets and production env vars configured outside Git.
- `BGH_AVAILABILITY_STORE_PATH`, `BGH_RESERVATION_REQUESTS_STORE_PATH`, and `BGH_HOMEPAGE_CONTENT_STORE_PATH` pointed to a durable backed-up directory outside the app release directory.
- backups verified before launch.
- SSL enabled before admin login or guest form traffic.
- no horizontal scaling until persistence is moved away from local JSON or explicit locking is added in a separate approved issue.

## 9. Go/no-go criteria

Go only if all criteria are true:

- The production host supports Node.js `>=20.9.0`.
- The host can install dependencies and build this app.
- The host can run `next start` persistently with restart-on-failure and restart-on-boot behavior.
- Runtime env vars can be stored securely without committing or exposing secrets.
- SMTP credentials and sender/destination values can be configured securely.
- SSL is active for the production domain.
- DNS ownership and routing are understood.
- The app's JSON state files are stored in a durable, backed-up directory outside the deploy/build output.
- A redeploy test proves state survives.
- A server restart test proves state survives.
- A rebuild test proves state survives.
- Admin login works over HTTPS.
- Reservation submission works and produces both an email and a persisted request.

No-go if any criterion is false or unknown:

- Node.js version support is below `20.9.0`.
- The app can only be hosted as static files.
- The filesystem is read-only or ephemeral.
- The only writable path is inside a release directory that deploys overwrite.
- There is no persistent process manager.
- Env vars require committing secrets.
- SSL cannot be enabled before production use.
- DNS ownership is unclear.

## 10. Next actions

1. Have the Bluehost account owner identify the exact hosting product and plan.
2. Ask Bluehost support or verify in the control panel whether the plan supports Node.js `>=20.9.0` and persistent custom app processes.
3. Verify SSH access without sharing credentials.
4. Verify how a Node app's production command is configured and restarted.
5. Verify how runtime environment variables are set and protected.
6. Identify a durable writable directory and confirm it survives restart, rebuild, redeploy, and server replacement workflows.
7. Confirm SSL status and renewal behavior for the production domain.
8. Confirm where authoritative DNS is managed.
9. Decide between:
   - current Bluehost plan, only if every go criterion passes.
   - Bluehost DNS/domain plus another app host, if Bluehost cannot prove the required runtime and persistence behavior.
   - Bluehost VPS/dedicated, only if ongoing server operations are accepted.
10. Open a separate implementation issue for any deployment changes, persistence migration, backup workflow, or host-specific configuration.
