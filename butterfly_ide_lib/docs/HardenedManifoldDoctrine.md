# Hardened Manifold Doctrine

## Purpose
This doctrine hardens Butterfly IDE around the minimal-surface intuition of the Schwarz Diamond and gyroid families: minimal material, maximal area, maximal strength.

## Governing Laws
### 1. Minimal material
- Store rules, pivots, coordinates, and policy.
- Do not store derived state when it can be recomputed from the manifold.
- AI responses should prefer the smallest durable abstraction that preserves meaning.

### 2. Maximal area
- One manifold should support many substrates.
- One substrate should support many projections before new structure is introduced.
- One explanation should cover many cases by exposing rules instead of repeating payloads.

### 3. Maximal strength
- Every core transition should be typed, testable, and auditable.
- Dimensional pivots must be explicit rather than inferred from hidden state.
- Policy, execution, and collapse must preserve operator control.

## Primary Helix Manifold
The primary hardened manifold remains:

`z = x * y`

Its operating law is:
- angular domain: `0°..360°`
- primary pivot increment: `90°`
- each `90°` pivot marks a dimensional inheritance transition
- projection remains bounded and deterministic

## Kernel Consequences
The kernel should expose:
- normalized angle primitives
- explicit quadrant or pivot classification
- deterministic rotation and projection helpers
- dimension inheritance rules driven by pivot state
- tests that lock these invariants

## AI Consequences
The AI must:
- reason from geometry, substrates, relations, and operations
- prefer reusable rules over repeated output
- reduce architectural mass before adding new mechanisms
- choose structures that maximize interpretive reach without weakening guarantees
- reject shortcuts that increase redundancy or reduce auditability

## Definition of Hardened
A Butterfly component is hardened when it does all of the following:
- reduces redundant storage
- increases reuse of the same manifold surface
- strengthens type or policy guarantees
- preserves explainability under execution

## Immediate Runtime Mapping
Current kernel mapping for the helix model:
- `0°` pivot -> base dimensionality
- `90°` pivot -> base + 1 dimension
- `180°` pivot -> base + 2 dimensions
- `270°` pivot -> base + 3 dimensions

This mapping is intentionally conservative: it gives the kernel a testable inheritance law now, while leaving room for richer higher-dimensional substrate rules later.