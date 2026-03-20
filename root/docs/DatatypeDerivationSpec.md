# Datatype Derivation Spec
## Purpose
This document defines how Butterfly IDE derives usable datatype families from the hardened dimensional stack rather than treating stored payloads as the primary truth.
## Governing Rule
A datatype in Butterfly is not primarily a blob of stored material. It is a reproducible interpretation built from:
- coordinate geometry
- substrate rules
- relation structure
- expression logic
- collapse rules
- executor behavior when effects are required
## Hardened Constraints
Every datatype design should satisfy:
- minimal material: store the least durable information necessary
- maximal area: one rule family should support many instances
- maximal strength: round trips, pivots, and collapse behavior must be explicit and testable
## Shared Derivation Pipeline
All datatype families follow the same high-level flow:
1. choose or derive a coordinate
2. classify the coordinate through the primary helix manifold
3. apply domain substrates
4. connect related coordinates through typed relations
5. produce an expression or operation plan
6. collapse only when a bounded executable form is required
## Helix Requirements
The current kernel assumes:
- primary manifold: `z = x * y`
- angular domain: `0°..360°`
- primary pivot step: `90°`
- each `90°` pivot can trigger dimensional inheritance
Datatype rules should not bypass these laws when manifold classification is part of interpretation.
## Text Derivation
Text is derived from:
- a coordinate per symbol or token
- an ordering relation between coordinates
- a text substrate that maps coordinate state to symbol identity
- a collapse rule that emits a bounded string
### Minimum persistent material
- coordinate identity
- ordering relation
- encoding rule reference
### Derived at read time
- character sequence
- token stream
- rendered text output
## Binary Derivation
Binary data is treated as a bounded projection, not the canonical truth.
It is derived from:
- a coordinate or coordinate span
- a packing substrate
- width and endianness rules
- a collapse rule that emits bytes
### Minimum persistent material
- coordinate mapping
- packing rule
- integrity metadata when needed
### Derived at read time
- byte buffers
- numeric machine representations
- serialized payload segments
## Structured Object Derivation
Objects are coordinate-centered relation bundles.
They are derived from:
- one identity anchor coordinate
- field relation rules
- field-specific substrates
- an object collapse rule
### Minimum persistent material
- object identity anchor
- field relations
- schema or substrate references
### Derived at read time
- key-value maps
- typed structs
- JSON-like projections
## Graph Derivation
Graphs are natural fits for the Butterfly model.
They are derived from:
- node coordinates
- edge relations
- graph traversal substrates
- optional weighting or labeling rules
### Minimum persistent material
- node identities
- edge relations
- traversal and weighting rules
### Derived at read time
- adjacency views
- path results
- dependency graphs
- knowledge projections
## Media Derivation
Media is produced through domain substrates plus executor targets.
### Graphics
Derived from:
- coordinates
- geometry or color substrates
- collapse into draw operations
- graphics executor output
### Audio
Derived from:
- coordinates
- phase, frequency, and duration substrates
- collapse into audio operations
- audio executor output
### 3D or simulation state
Derived from:
- coordinate fields
- topology relations
- geometry or physics substrates
- bounded render or simulation collapse
## Round-Trip Requirements
A datatype family is considered valid when it can define, where appropriate:
- stable identity
- deterministic derivation
- bounded collapse
- explainable reconstruction
- targeted tests for invariants and round trips
## Non-Claim
This spec does not claim that the manifold alone is the datatype. The datatype emerges from the full Butterfly stack interpreting manifold-grounded coordinates under disciplined rules.
## Immediate Implementation Targets
The next concrete substrate families to formalize are:
- text substrate family
- binary packing substrate family
- structured object substrate family
- graph traversal substrate family
- media projection substrate family
## Summary
Butterfly datatypes are not primarily stored things. They are reproducible dimensional interpretations whose durability comes from rules, coordinates, and relations rather than bulk payload duplication.