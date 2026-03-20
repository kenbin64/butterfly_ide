use std::fmt;

use crate::{manifold::Manifold, substrates::SubstrateId};

/// CreationContext carries the manifold and substrate selected for creation.
pub struct CreationContext<'a> {
    pub manifold: &'a dyn Manifold,
    pub substrate_id: SubstrateId,
}

impl<'a> CreationContext<'a> {
    pub fn new(manifold: &'a dyn Manifold, substrate_id: SubstrateId) -> Self {
        Self {
            manifold,
            substrate_id,
        }
    }
}

impl fmt::Debug for CreationContext<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CreationContext")
            .field("manifold", &self.manifold.name())
            .field("substrate_id", &self.substrate_id)
            .finish()
    }
}

