# Butterfly Domain and Access Doctrine

## Objective
Define how `butterflyfx.us` should function as the primary home for Butterfly IDE and Helix without becoming a world-facing public AI endpoint.

## Primary Law
`butterflyfx.us` is private first, operator first, and release-gated.
It exists to serve the Butterfly operator before it serves the public.

## Core Position
- `butterflyfx.us` is the main Butterfly identity and control domain.
- Butterfly remains a desktop-first sovereign environment, not a browser-only SaaS.
- The website is an access, release, and control surface, not the only runtime.
- Helix must not be exposed as an anonymous public AI endpoint.
- Public distribution comes only after stable private use.

## Domain Roles
### `butterflyfx.us`
Use as the primary brand and entry domain.
Recommended responsibilities:
- landing page
- operator login
- release posture/status
- links into protected Butterfly surfaces

### `app.butterflyfx.us`
Use as the main authenticated control surface.
Recommended responsibilities:
- Helix control panel
- project/workspace status
- deployment and validation controls
- pod health and monitoring views
- private operator settings

### `helix.butterflyfx.us`
Optional Helix-first doorway.
Use only if it remains authenticated and operator-scoped.

### `downloads.butterflyfx.us`
Future signed release surface.
Do not open until Butterfly is stable enough for controlled distribution.

### `dimensionos.net`
May remain the technical/philosophical documentation home.
Use for doctrine, white papers, and architectural writing rather than operator control.

## Access Doctrine
### Phase 1 — single operator
- one operator account
- no public signup
- no anonymous access
- no shared public AI prompt surface

### Phase 2 — invite-only alpha
- named allowlist users only
- explicit invitation and approval
- narrow capability exposure
- private download path if needed

### Phase 3 — controlled public presence
- public product pages are allowed
- public downloads may be allowed
- operator controls and AI management surfaces remain protected

## Authentication Posture
- authenticated by default for all control surfaces
- start with a single operator identity: the owner
- prefer strong session security, CSRF protection, and secure cookies
- add passkeys and/or MFA when the first operator flow is stable
- never allow authentication success to imply deployment approval automatically

## Helix Access Rules
- Helix may be visible publicly as identity and documentation
- Helix may not be exposed publicly as an unrestricted execution endpoint
- model backends must stay behind approved local, tunneled, or tightly controlled surfaces
- deployment, GitHub, and pod-management actions require authenticated operator context

## Desktop Relationship
The Butterfly desktop app remains the primary working environment.
The web surface should support:
- identity
- authenticated control
- release and download management
- remote status visibility when approved

It should not replace the local sovereign controller unless a later architecture explicitly says so.

## Release Doctrine
- private use before public launch
- test with the operator first
- open distribution only after workflow, deployment, and health monitoring are trusted
- prefer signed releases and explicit version channels when downloads begin

## Non-Negotiable Rules
- no public anonymous AI control surface
- no public pod-management endpoint
- no direct public model-serving endpoint
- no public deployment trigger
- no public signup in the initial phase

## Summary
`butterflyfx.us` is the private home of Butterfly IDE and Helix.
It begins as an authenticated operator domain, expands later to controlled testing and downloads, and does not become a general public AI endpoint.