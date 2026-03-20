# Private AI Architecture for Butterfly IDE

## Objective
Build an in-house, private, unmetered AI system for Butterfly IDE that runs without API keys, works offline or on approved private networks, and is constitution-bound to dimensional, manifold, and substrate principles.

## Top-Level Components
1. Butterfly IDE desktop shell
2. Butterfly kernel (`butterfly_ide_lib`)
3. Local AI service (`butterfly-brain`)
4. Local model runtime
5. Retrieval/context engine
6. Tool execution sandbox
7. VS Code bridge
8. Deployment broker

## 1. Butterfly IDE Desktop Shell
Recommended stack:
- Tauri
- Rust backend
- React UI
- Monaco/VS Code-compatible editor surface

Responsibilities:
- workspace UI
- editor panes
- terminal/test/build panes
- AI chat and action panel
- manifold/substrate visualizers
- deployment controls
- authenticated operator control surfaces for Butterfly and Helix

Domain posture:
- `butterflyfx.us` is the main Butterfly identity and login domain
- protected control workflows should live behind authenticated surfaces such as `app.butterflyfx.us`
- the site should remain operator-first rather than exposing a public anonymous AI endpoint

## 2. Butterfly Kernel
The kernel is the canonical truth model.
It should expose:
- coordinates
- identities
- manifolds
- substrates
- relations
- expressions
- collapse
- operations
- executors
- policy checks

Everything else calls into the kernel rather than inventing parallel models.

## 3. Local AI Service
Create a local service process named `butterfly-brain`.
It should expose local-only endpoints such as:
- `plan_task`
- `explain_dimensionally`
- `propose_patch`
- `debug_code`
- `analyze_math`
- `summarize_architecture`
- `prepare_deploy`
- `plan_remote_session`
- `validate_remote_node`

This service should never require a public API key.

It should also treat itself, models, libraries, and datasets as manifold-grounded assets rather than unmanaged external blobs.

It is the sovereign controller in any local/VPS deployment topology.

## 4. Model Runtime
Recommended approach: open-weight local models.
Possible model roles:
- reasoning model
- coding model
- lightweight fast assistant model

Possible local serving layers:
- Ollama
- llama.cpp
- local GPU-backed server

The system should support model swapping without changing the IDE contract.

## 5. Constitution Compiler
This is the most important AI layer.
Before every major request, Butterfly compiles:
- user task
- workspace context
- relevant files
- kernel abstractions
- Butterfly constitution
- security doctrine
- allowed capabilities
- output format

The model should receive doctrine as operating law, not optional flavor text.

## 6. Retrieval and Memory
Use local-only retrieval for:
- repository code
- docs
- substrate registry
- prior architectural notes
- approved private-network docs
- manifold asset metadata for libraries, datasets, and models

Memory classes:
- session memory
- workspace memory
- doctrine memory
- operator preferences

No memory should leave approved storage.

## 7. Tool Execution Sandbox
The AI should not directly touch the OS.
It should act through controlled executors:
- file executor
- process executor
- git executor
- math executor
- network executor
- deploy executor

Every executor must be policy-aware and audit-capable.

## 8. Math and Architecture Reasoning
Use a hybrid model:
- LLM for reasoning, code, and explanation
- symbolic/numeric tools for verification

Recommended math toolchain:
- Python
- SymPy
- NumPy
- optional SciPy/plotting tools

The AI should explain results in Butterfly terms after tool verification.

## 9. VS Code Bridge
Recommended first integration: a VS Code extension that talks to Butterfly locally.
Features:
- send selection to Butterfly
- get dimensional explanation
- receive patch suggestions
- inspect substrates/manifolds
- sync active file and workspace state

Current first implementation direction:
- show Helix directly inside the VS Code activity bar
- provide a local-first chat surface for coding/debugging turns
- support operator-mediated mentor handoff so outside guidance can be relayed into Helix and Helix context can be exported back out

This enables adoption before rebuilding every editor feature natively.

## 10. Deployment Broker
Create a dedicated deployment service inside Butterfly.
Responsibilities:
- git status and diff analysis
- test/build checks
- commit/push orchestration
- GitHub operations
- VPS deployment
- rollback metadata
- audit logging

The broker is the only component allowed to perform approved external deploy actions.

### Two-node deployment mode
In VPS mode, the deployment broker coordinates two Butterfly-bound agents:
- local controller AI on the workstation
- remote executor AI on the VPS

The local controller should:
- prepare the deployment session plan
- validate policy and explicit approval state
- send only approved deployment/config/domain/certificate intents
- require health/config/test handshakes before considering the release valid
- prefer approved Tailscale/private-overlay routes when available
- fall back to a controlled public gateway only when overlay routing is unavailable and the remote surface remains narrow

The VPS executor should:
- expose a narrow control surface
- apply approved runtime configuration
- manage approved domain bindings
- provision or renew approved certificates
- return health and smoke-test reports
- keep model/runtime access behind the same narrow control surface instead of exposing the backend directly

### Preferred network posture
When Tailscale is enabled, Butterfly should prefer:
- tailnet device identity over ad hoc public exposure
- Tailscale IP or MagicDNS addressing for control traffic
- private overlay validation before any controlled public gateway path

The VPS executor is not a general autonomous internet agent. It is a constitution-bound remote node operating through deployment-specific contracts.
For container-based Runpod nodes without `/dev/net/tun`, Butterfly should model the node as a controlled public gateway until an approved overlay path exists.

## 11. Polyglot Support
Treat languages/frameworks as substrate families and tool adapters.
First-class targets may include:
- Rust
- TypeScript/JavaScript
- Python
- React
- Angular
- Bootstrap
- jQuery
- Three.js

Butterfly chooses tools by fitness, not ideology.

The AI should be able to ingest approved libraries into Butterfly by deriving substrate mappings, adapter layers, test plans, and executor boundaries instead of treating libraries as disconnected code piles.

## 12. Recommended Build Order
1. Constitution and security docs
2. kernel contracts
3. policy engine
4. local AI service
5. prompt/constitution compiler
6. tool sandbox
7. VS Code bridge
8. deployment broker
9. visual inspectors
10. model tuning/adapters

## Success Condition
Butterfly succeeds when the AI is not merely local, but local, doctrinal, explainable, secure, and genuinely manifold/substrate-native.

## Related Doctrine
- `SecurityDoctrine.md`
- `ButterflyDomainAuthDoctrine.md`
- `ButterflySiteMapSecurityPlan.md`

