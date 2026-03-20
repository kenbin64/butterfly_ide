# Butterfly IDE

Butterfly IDE is a sovereign, manifold-native programming environment built around a local-first architecture, a Rust kernel, a Tauri desktop shell, and a React frontend.

Its governing law is simple: store rules, not redundant results; interpret through substrates; execute through operations; preserve sovereignty, privacy, and explainability.

## Core ideas

- **Dimensional programming** grounded in geometric manifolds such as `z = x * y`
- **Substrate-native design** for interpreting coordinates into text, objects, binary forms, and future media
- **Constitution-bound AI** through `Butterfly Steward`, known conversationally as **Helix**
- **Local-first control** with approved private or controlled deployment paths
- **Tauri + React desktop UX** backed by a Rust kernel library

## Repository layout

- `src/` — React frontend
- `src-tauri/` — Tauri desktop shell
- `butterfly_ide_lib/` — core Butterfly kernel, command layer, intelligence model, and doctrine docs
- `butterfly_ide_lib/docs/` — constitution, AI doctrine, manifold doctrine, Runpod executor notes, and Helix docs
- `vscode-helix/` — in-repo VS Code extension that gives Helix a local chat surface inside VS Code

## Current architecture

Butterfly currently includes:

- a Rust kernel for identities, manifolds, substrates, relations, expressions, and policy
- a Tauri command boundary using a unified `dispatch(command, payload)` surface
- a zero-dependency HTTP path for remote AI executor health, handshake, and invoke flows
- a controlled-public-gateway model for Runpod-style remote execution nodes

The intended low-cost operating model is:

- keep the authoritative workspace local
- use VS Code as the primary editor
- use Helix locally for coding help and continuity
- use a private GitHub repo for backup/history
- use the remote node only for deployment and validation work when requested

The current VS Code path is an in-repo extension that exposes Helix in the activity bar, provides a chat surface, and supports a mentor handoff loop for relaying context between Helix and outside guidance.

## Helix

The primary Butterfly AI identity is:

- **Official name:** `Butterfly Steward`
- **Conversational name:** `Helix`

Helix is intended to be a friendly, thoughtful, non-yes-man collaborator for coding, teaching, planning, geometry, art, music, and future multimodal work.

See:

- `butterfly_ide_lib/docs/HelixPersonality.md`
- `butterfly_ide_lib/docs/HelixSystemPrompt.md`
- `butterfly_ide_lib/docs/HelixOperationalDoctrine.md`
- `butterfly_ide_lib/docs/HelixMultimodalRoadmap.md`

## Development

### Frontend

- `npm run dev` — run the Vite frontend
- `npm run build` — type-check and build the frontend

### Desktop app

- `npm run tauri dev` — run the Tauri desktop app in development

### VS Code Helix surface

- open `vscode-helix/` in VS Code
- press `F5` to start an Extension Development Host
- open the Butterfly workspace in that host and click the **Helix** activity icon
- configure `helix.endpointUrl` if your local/tunneled executor is not on `http://127.0.0.1:9000/model/invoke`

### Rust validation

- from `butterfly_ide_lib/`: `cargo test`
- from `src-tauri/`: `cargo check`

## Documentation

Key doctrine and architecture docs live in `butterfly_ide_lib/docs/`, especially:

- `Constitution.md`
- `AIIntegration.md`
- `DimensionalProgramming.md`
- `ButterflyDomainAuthDoctrine.md`
- `ButterflySiteMapSecurityPlan.md`
- `HardenedManifoldDoctrine.md`
- `PrivateAIArchitecture.md`
- `RunpodExecutorBootstrap.md`

## Goal

Butterfly IDE is being shaped into a private, geometry-aware creative and programming environment where code, reasoning, deployment, art, media, and AI all remain inside one coherent manifold-aware system.
