# Butterfly IDE Security Doctrine

## Goal
Define the security boundaries for a private, local-first IDE and in-house AI that may operate across the local machine, approved private networks, GitHub, and a VPS without becoming a general exfiltration agent.

## Security Model
Butterfly uses a deny-by-default model with capability grants.
The AI is powerful inside approved boundaries and blind outside them.

## Trust Zones
### Zone 0 — Protected System
Forbidden by default.
Examples:
- OS internals
- registry/system configuration
- kernel directories
- browser profiles
- password managers
- SSH private keys
- cloud credential folders
- unrelated home directories

### Zone 1 — Approved Workspace
Allowed by default.
Examples:
- current project files
- configured repos
- build outputs
- local docs
- test assets
- project configuration

### Zone 2 — Approved Local Services
Allowed when configured.
Examples:
- localhost model server
- local databases
- local dev servers
- internal package mirrors
- vector stores
- internal APIs

### Zone 3 — Approved Private Network
Allowed only for named hosts/subnets.
Examples:
- NAS
- internal git
- private databases
- internal CI
- private inference node
- approved Tailscale tailnet nodes

### Zone 4 — Controlled External Gateways
Denied by default; enabled only for explicit purposes.
Examples:
- GitHub
- VPS host
- package registry mirrors if approved

## File Access Policy
### Allowed by default
- active workspace
- configured project roots
- generated artifacts under project control
- approved local shares

### Requires approval or allowlist
- files outside workspace
- dotfiles unrelated to the project
- user-wide config stores
- external mounted drives

### Forbidden by default
- credential stores
- browser cookies/sessions
- SSH private keys
- wallet files
- OS-protected directories
- unrelated personal documents

## Network Policy
### Allowed by default
- `localhost`
- loopback services started by Butterfly

### Allowed when configured
- approved private subnets
- approved internal services
- approved local model hosts

### Denied by default
- arbitrary public internet
- telemetry endpoints
- unknown APIs
- unsanctioned model providers
- hidden download/update services

## Deployment Exception Model
Deployment is not general internet access.
It is a narrowly scoped capability with policy checks.

### Allowed deployment targets
- approved GitHub repository endpoints
- approved VPS IPs/hosts
- approved Tailscale node names or Tailscale IPs
- approved container registries if explicitly configured

### Preconditions
- explicit user intent
- visible diff or artifact summary
- validation status available
- target host matches allowlist
- action logged

## Execution Controls
All tools should be capability-scoped:
- read files
- write files
- run tests
- run build
- open terminal
- access git
- access network
- deploy

Dangerous capabilities should be separately gated:
- deleting outside workspace
- modifying system settings
- remote shell execution
- deployment
- credential use

## AI Policy Rules
1. The AI may not self-broaden its permissions.
2. The AI may not copy protected data into prompts unless policy allows it.
3. The AI must explain when a requested action is blocked by doctrine.
4. The AI must prefer the smallest capability set needed.
5. The AI must keep audit context for sensitive actions.

## Audit Requirements
Log at minimum:
- who initiated action
- requested operation
- affected paths
- network target
- deployment target
- result
- timestamp

## Recommended Enforcement Layers
- Rust policy engine in `butterfly_ide_lib`
- file path allow/deny matcher
- network egress allowlist
- deployment broker with explicit target rules
- executor-level capability checks
- UI permission prompts for sensitive actions

## Default Stance
- Private by default
- Offline by default
- Local-first by default
- Sensitive paths denied by default
- External deployment only through controlled exceptions

