# Core Rust API Design for `butterfly_ide_lib`

## Goal
Define a small, stable dimensional runtime that all Butterfly layers can share:
frontend, Tauri commands, VS Code bridge, AI prompt assembly, and future plugins.

## Design Laws
1. Store rules, not derived results.
2. Coordinates identify; substrates interpret.
3. Manifolds provide geometry; executors perform effects.
4. Commands orchestrate runtime calls, but are not the runtime.
5. Keep the kernel dependency-light and testable.
6. Prefer minimal material: the fewest stable rules should produce the most behavior.
7. Prefer maximal area: reuse one manifold or substrate across many domains before adding new storage.
8. Prefer maximal strength: typed pivots, explicit invariants, and auditable execution beat informal convention.

## Module Map
- `identity`: entity IDs and coordinate ownership
- `substrates`: read/write substrate traits and registry
- `creation`: creation requests, context, and results
- `relation`: typed links between identities and coordinates
- `expression`: derived values and operation plans
- `collapse`: projection of high-dimensional state into executable form
- `command`: UI/IPC boundary, not core geometry

## Core Value Types
```rust
pub type Scalar = f64;
pub type DimensionIndex = u8;
pub type CoordinateId = u128;
pub type IdentityId = u128;
pub type SubstrateId = &'static str;

#[derive(Debug, Clone, PartialEq)]
pub struct Coordinate {
    pub id: CoordinateId,
    pub axes: Vec<Scalar>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Dimensionality(pub DimensionIndex);
```

## Manifold Contract
`Manifold` is the geometric source. It does not store domain meaning.

The baseline kernel includes a generic `ProductManifold`; the hardened primary model is `HelixManifold`, which preserves `z = x * y` while normalizing angular state across `0..360` with `90°` dimensional pivots.

```rust
pub trait Manifold {
    fn name(&self) -> &'static str;
    fn dimensionality(&self) -> Dimensionality;
    fn sample(&self, coordinate: &Coordinate) -> Scalar;
    fn rotate(&self, coordinate: &Coordinate, degrees: Scalar) -> Coordinate;
    fn project(&self, coordinate: &Coordinate, target: Dimensionality) -> Coordinate;
}
```

## Identity Contract
`Identity` represents an entity that may have one or more coordinate bindings.

```rust
#[derive(Debug, Clone)]
pub struct Identity {
    pub id: IdentityId,
    pub label: String,
    pub primary_coordinate: CoordinateId,
}
```

## Substrate Contracts
A substrate is a rule for measuring or generating coordinates.

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubstrateKind { Read, Write, Transform, Composite }

pub trait Substrate {
    fn id(&self) -> SubstrateId;
    fn kind(&self) -> SubstrateKind;
    fn domain(&self) -> &'static str;
}

pub trait ReadSubstrate: Substrate {
    type Output;
    fn read(&self, manifold: &dyn Manifold, coordinate: &Coordinate) -> Self::Output;
}

pub trait WriteSubstrate: Substrate {
    type Input;
    fn create(&self, manifold: &dyn Manifold, input: Self::Input) -> Coordinate;
}
```

## Relation Contract
Relations are typed links between identities, coordinates, or substrates.

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RelationKind { Contains, References, ProjectsTo, DerivedFrom, Expresses }

#[derive(Debug, Clone)]
pub struct Relation {
    pub kind: RelationKind,
    pub from: IdentityId,
    pub to: IdentityId,
}
```

## Expression Contract
Expressions are derivations, not stored payloads.

```rust
#[derive(Debug, Clone)]
pub enum Expression {
    Coordinate(Coordinate),
    Scalar(Scalar),
    OperationPlan(Vec<Operation>),
    Relation(Relation),
}
```

## Operation + Executor Contracts
Operations are machine-level intents; executors perform them.

```rust
#[derive(Debug, Clone)]
pub enum Operation {
    SetValue { target: CoordinateId, value: Scalar },
    StoreMapping { identity: IdentityId, coordinate: CoordinateId },
    LoadIdentity { identity: IdentityId },
    ListDirectory { path: String },
    EmitText { text: String },
}

#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub success: bool,
    pub message: Option<String>,
}

pub trait Executor {
    fn name(&self) -> &'static str;
    fn can_execute(&self, operation: &Operation) -> bool;
    fn execute(&self, operation: Operation) -> ExecutionResult;
}
```

## Collapse Contract
Collapse turns rich dimensional state into a bounded executable or view state.

```rust
pub trait Collapse<T> {
    fn collapse(&self) -> T;
}
```

## Creation Contract
Creation is the sanctioned entry point for new identities and coordinates.

```rust
pub struct CreationContext<'a> {
    pub manifold: &'a dyn Manifold,
    pub substrate_id: SubstrateId,
}

pub struct CreationResult {
    pub success: bool,
    pub identity: Option<Identity>,
    pub coordinate: Option<Coordinate>,
    pub operations: Vec<Operation>,
}
```

## Runtime Flow
1. User intent enters through `command`.
2. Command layer resolves a substrate and manifold.
3. A write substrate creates or locates a coordinate.
4. Read substrates derive values or operation plans.
5. Expressions are collapsed into operations when effects are needed.
6. Executors perform operations and return traceable results.

## Initial MVP Types
Implement first:
- `Coordinate`
- `Identity`
- `Manifold` with the baseline `z = x * y`
- `HelixManifold` for the hardened `0..360` / `90°` pivot model
- `ReadSubstrate` / `WriteSubstrate`
- `Operation`
- `Executor`
- `CreationContext` / `CreationResult`

## Immediate Refactor Guidance
- Keep `command` as the IPC boundary for Tauri.
- Move dimensional contracts into their named modules.
- Add a substrate registry before adding many handlers.
- Replace ad hoc JSON-only flows with typed runtime structs internally.
- Keep JSON conversion only at the app boundary.

## Non-Goals for First Pass
- Full DSL design
- Persistence engine redesign
- AI fine-tuning pipeline
- Complex plugin loading

## Next Documents
Suggested follow-on references:
- `DatatypeDerivationSpec.md` for how text, binary, objects, graphs, and media are derived from the hardened stack.
- `AIIntegration.md` for how prompts map to coordinates, substrates, relations, and operations.

