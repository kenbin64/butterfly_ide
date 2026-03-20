use crate::{
    identity::{Coordinate, CoordinateId, IdentityId, Scalar},
    relation::Relation,
};

#[derive(Debug, Clone, PartialEq)]
pub enum Operation {
    SetValue {
        target: CoordinateId,
        value: Scalar,
    },
    StoreMapping {
        identity: IdentityId,
        coordinate: CoordinateId,
    },
    LoadIdentity {
        identity: IdentityId,
    },
    ListDirectory {
        path: String,
    },
    EmitText {
        text: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionResult {
    pub success: bool,
    pub message: Option<String>,
}

impl ExecutionResult {
    pub fn success() -> Self {
        Self {
            success: true,
            message: None,
        }
    }

    pub fn failure(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: Some(message.into()),
        }
    }
}

pub trait Executor {
    fn name(&self) -> &'static str;
    fn can_execute(&self, operation: &Operation) -> bool;
    fn execute(&self, operation: Operation) -> ExecutionResult;
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expression {
    Coordinate(Coordinate),
    Scalar(Scalar),
    OperationPlan(Vec<Operation>),
    Relation(Relation),
}

#[cfg(test)]
mod tests {
    use super::{ExecutionResult, Expression, Operation};

    #[test]
    fn execution_result_failure_carries_message() {
        let result = ExecutionResult::failure("unable to collapse expression");

        assert!(!result.success);
        assert_eq!(result.message.as_deref(), Some("unable to collapse expression"));
    }

    #[test]
    fn expression_can_wrap_operation_plan() {
        let expression = Expression::OperationPlan(vec![Operation::EmitText {
            text: "hello".into(),
        }]);

        match expression {
            Expression::OperationPlan(operations) => assert_eq!(operations.len(), 1),
            _ => panic!("expected operation plan"),
        }
    }
}
