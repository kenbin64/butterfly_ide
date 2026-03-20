use crate::{expression::Operation, identity::{Coordinate, Identity}};

/// CreationResult returns the identity, coordinate, and planned operations.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CreationResult {
    pub success: bool,
    pub identity: Option<Identity>,
    pub coordinate: Option<Coordinate>,
    pub operations: Vec<Operation>,
}

impl CreationResult {
    pub fn new(success: bool) -> Self {
        Self {
            success,
            identity: None,
            coordinate: None,
            operations: Vec::new(),
        }
    }

    pub fn success(
        identity: Option<Identity>,
        coordinate: Option<Coordinate>,
        operations: Vec<Operation>,
    ) -> Self {
        Self {
            success: true,
            identity,
            coordinate,
            operations,
        }
    }

    pub fn failure() -> Self {
        Self::new(false)
    }
}

#[cfg(test)]
mod tests {
    use super::CreationResult;
    use crate::{expression::Operation, identity::{Coordinate, Identity}};

    #[test]
    fn success_constructor_preserves_payload() {
        let identity = Identity::new(1, "doc", 2);
        let coordinate = Coordinate::new(2, [0.0, 1.0]);
        let result = CreationResult::success(
            Some(identity.clone()),
            Some(coordinate.clone()),
            vec![Operation::LoadIdentity { identity: identity.id }],
        );

        assert!(result.success);
        assert_eq!(result.identity, Some(identity));
        assert_eq!(result.coordinate, Some(coordinate));
        assert_eq!(result.operations.len(), 1);
    }
}