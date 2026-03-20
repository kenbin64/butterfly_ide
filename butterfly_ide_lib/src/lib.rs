pub mod command;
pub mod identity;
pub mod intelligence;
pub mod manifold;
pub mod policy;
pub mod substrates;
pub mod creation;
pub mod relation;
pub mod expression;
pub mod collapse;

pub use collapse::Collapse;
pub use creation::{CreationContext, CreationResult};
pub use expression::{ExecutionResult, Executor, Expression, Operation};
pub use identity::{
    Coordinate, CoordinateId, CoordinatePerspective, DimensionIndex, DimensionalPerspective,
    DimensionalPromotion, DimensionalStage, Dimensionality, Identity, IdentityId, Scalar,
};
pub use intelligence::{
    AiDeploymentTarget, AiDeploymentTargetKind, AiGitHubBackupTarget, AiInterfaceEndpoint,
    AiInterfaceTransport, AiRemoteAssistPolicy, AiRemoteUsage, AiSourceOfTruth, AiWorkContext,
    ControllerExecutorInterface, CertificateRequest, CertificateStrategy, DeploymentHandshake,
    DeploymentHandshakeStage, DeploymentObjective, DeploymentSessionPlan, DeploymentTask,
    DeploymentTaskKind, ExecutorHealthSnapshot, ExecutorModelBackendStatus,
    LocalControllerProfile, LibraryIngestionPlan, ManifoldAgentProfile, ManifoldAsset,
    ManifoldAssetKind, DomainBindingRequest, HandshakeHealthReport, HandshakeTestReport,
    ModelInvocationRequest, RemoteNodeProfile, RemoteAccessPath, RemoteNodeRole,
    RemoteNodeStatus, RemoteServicePorts, SshTunnelSpec, SubstrateAuthoringPlan,
    SubstrateTestPlan, TailscaleAccess,
};
pub use manifold::{
    Angle, FibonacciAccumulation, HelixManifold, HelixProjection, Manifold, ProductManifold,
    Quadrant, StructuralDirectives, FIBONACCI_ACCUMULATION_STEPS,
    FIBONACCI_COLLAPSE_THRESHOLD, HELIX_DIMENSION_STEP_DEGREES, HELIX_TURN_DEGREES,
};
pub use policy::{
    AccessDecision, ApprovalContext, Capability, DeploymentTarget, NetworkPurpose, PathAction,
    PolicyConfig, PolicyEngine,
};
pub use relation::{Relation, RelationKind};
pub use substrates::{
    BinaryByteProjection, BinaryCoordinateSpec, BinaryReadSubstrate, BinaryWriteSubstrate,
    BINARY_READ_SUBSTRATE_ID, BINARY_WRITE_SUBSTRATE_ID,
    ObjectFieldBinding, ObjectFieldProjection, ObjectFieldSpec, ObjectSchema,
    ReadSubstrate, Substrate, SubstrateId, SubstrateKind, SubstrateMetadata, SubstrateRegistry,
    StructuredObjectProjection, StructuredObjectReadSubstrate, StructuredObjectWriteSubstrate,
    TextCoordinateSpec, TextReadSubstrate, TextSymbolProjection, TextWriteSubstrate,
    WriteSubstrate, OBJECT_READ_SUBSTRATE_ID, OBJECT_WRITE_SUBSTRATE_ID,
    TEXT_READ_SUBSTRATE_ID, TEXT_WRITE_SUBSTRATE_ID,
};
