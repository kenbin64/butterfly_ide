use crate::identity::IdentityId;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RelationKind {
    Contains,
    References,
    ProjectsTo,
    DerivedFrom,
    Expresses,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Relation {
    pub kind: RelationKind,
    pub from: IdentityId,
    pub to: IdentityId,
}

impl Relation {
    pub fn new(kind: RelationKind, from: IdentityId, to: IdentityId) -> Self {
        Self { kind, from, to }
    }
}

#[cfg(test)]
mod tests {
    use super::{Relation, RelationKind};

    #[test]
    fn relation_keeps_endpoints() {
        let relation = Relation::new(RelationKind::Contains, 10, 20);

        assert_eq!(relation.from, 10);
        assert_eq!(relation.to, 20);
    }
}
