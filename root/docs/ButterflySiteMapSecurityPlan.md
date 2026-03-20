# ButterflyFX Site Map and Security Plan

## Objective
Provide a concrete structure for `butterflyfx.us` that supports private operator use first, with clear protected surfaces and a staged path toward later distribution.

## Recommended Domain Map
- `butterflyfx.us` — main brand, login, release posture
- `app.butterflyfx.us` — authenticated Butterfly control surface
- `helix.butterflyfx.us` — optional authenticated Helix console
- `downloads.butterflyfx.us` — future signed downloads/releases
- `dimensionos.net` — doctrine and technical writing

## Main Site Map
### Public-minimal routes
- `/` — Butterfly identity, private-first posture, login entry
- `/login` — operator authentication
- `/about` — concise explanation of Butterfly and Helix

### Protected operator routes
- `/dashboard` — overall system state
- `/projects` — project and workspace inventory
- `/deployments` — deployment planning and release history
- `/health` — pod, executor, and service health
- `/logs` — recent operational logs and validation results
- `/settings` — operator, security, and domain settings
- `/downloads` — private installer/release access during alpha

## App Surface Priorities
Inside `app.butterflyfx.us`, the first operator panels should be:
1. Helix control panel
2. workspace/project status
3. test and validation results
4. deployment controls
5. pod health and logs

## Operator Flow
1. Login to `butterflyfx.us` or `app.butterflyfx.us`.
2. Land on `/dashboard` with system state and pending approvals.
3. Inspect repo, deployment, and pod health.
4. Approve or reject sensitive actions.
5. Review validation and smoke-test results after any deployment.

## Security Plan
### Edge protections
- HTTPS only
- secure cookies only
- rate limit login and auth endpoints
- deny directory listing and unnecessary public routes
- keep public pages informational and minimal

### Authentication protections
- one operator account in phase 1
- no public registration
- short-lived sessions with explicit renewal
- CSRF protection on state-changing requests
- add passkeys or MFA before expanding access beyond the owner

### Application protections
- one privileged role: Operator
- explicit approval step for deployment, GitHub push, and destructive actions
- visible audit trail for sensitive actions
- no hidden background deployment triggers

### Network protections
- prefer local controller plus SSH tunnel or approved private overlay
- keep executor and model services bound to loopback/private paths when possible
- never expose the raw model backend as a public internet endpoint
- if a controlled public gateway is required, keep it narrow and authenticated

### Data protections
- no telemetry by default
- no prompt/context export without explicit approval
- keep operator memory and project data on approved private storage
- do not mix public marketing pages with private operator data stores

## Staged Rollout
### Stage 1 — private operator-first
- only the owner can log in
- no public AI access
- no public downloads
- use the site for control, status, and testing

### Stage 2 — invite-only alpha
- allowlisted testers
- signed private downloads
- limited role/capability expansion only if needed

### Stage 3 — public product presence
- public landing and documentation are fine
- public downloads are allowed only when release quality is real
- control surfaces remain authenticated and approval-gated

## First Build Recommendation
Build the first web surface as a small authenticated control portal, not a full public product app.
The desktop app remains the main working environment, while the site handles identity, access, status, and release distribution.