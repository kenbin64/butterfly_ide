pub mod text;
pub mod object;
pub mod binary;

use std::collections::HashMap;

use crate::{identity::Coordinate, manifold::Manifold};

pub use text::{
    TextCoordinateSpec, TextReadSubstrate, TextSymbolProjection, TextWriteSubstrate,
    TEXT_READ_SUBSTRATE_ID, TEXT_WRITE_SUBSTRATE_ID,
};
pub use binary::{
    BinaryByteProjection, BinaryCoordinateSpec, BinaryReadSubstrate, BinaryWriteSubstrate,
    BINARY_READ_SUBSTRATE_ID, BINARY_WRITE_SUBSTRATE_ID,
};
pub use object::{
    ObjectFieldBinding, ObjectFieldProjection, ObjectFieldSpec, ObjectSchema,
    StructuredObjectProjection, StructuredObjectReadSubstrate, StructuredObjectWriteSubstrate,
    OBJECT_READ_SUBSTRATE_ID, OBJECT_WRITE_SUBSTRATE_ID,
};

pub type SubstrateId = &'static str;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubstrateKind {
    Read,
    Write,
    Transform,
    Composite,
}

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubstrateMetadata {
    pub id: SubstrateId,
    pub kind: SubstrateKind,
    pub domain: &'static str,
}

impl SubstrateMetadata {
    pub fn new(id: SubstrateId, kind: SubstrateKind, domain: &'static str) -> Self {
        Self { id, kind, domain }
    }
}

#[derive(Debug, Default, Clone)]
pub struct SubstrateRegistry {
    entries: HashMap<SubstrateId, SubstrateMetadata>,
}

impl SubstrateRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_metadata(&mut self, metadata: SubstrateMetadata) -> Option<SubstrateMetadata> {
        self.entries.insert(metadata.id, metadata)
    }

    pub fn register<S: Substrate>(&mut self, substrate: &S) -> Option<SubstrateMetadata> {
        self.register_metadata(SubstrateMetadata::new(
            substrate.id(),
            substrate.kind(),
            substrate.domain(),
        ))
    }

    pub fn get(&self, id: SubstrateId) -> Option<&SubstrateMetadata> {
        self.entries.get(id)
    }

    pub fn all(&self) -> Vec<SubstrateMetadata> {
        let mut entries = self.entries.values().cloned().collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.id);
        entries
    }
}

#[cfg(test)]
mod tests {
    use super::{Substrate, SubstrateKind, SubstrateRegistry};

    struct ExampleSubstrate;

    impl Substrate for ExampleSubstrate {
        fn id(&self) -> &'static str {
            "example.read"
        }

        fn kind(&self) -> SubstrateKind {
            SubstrateKind::Read
        }

        fn domain(&self) -> &'static str {
            "text"
        }
    }

    #[test]
    fn registry_tracks_registered_substrates() {
        let mut registry = SubstrateRegistry::new();
        registry.register(&ExampleSubstrate);

        let metadata = registry.get("example.read").expect("metadata to exist");
        assert_eq!(metadata.domain, "text");
        assert_eq!(registry.all().len(), 1);
    }
}
