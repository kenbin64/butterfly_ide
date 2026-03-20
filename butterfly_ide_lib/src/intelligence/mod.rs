pub mod deployment;
pub mod interface;

use crate::{identity::IdentityId, substrates::SubstrateId, CoordinateId};

pub use deployment::{
    CertificateRequest, CertificateStrategy, DeploymentHandshake, DeploymentHandshakeStage,
    DeploymentObjective, DeploymentSessionPlan, DeploymentTask, DeploymentTaskKind,
    DomainBindingRequest, HandshakeHealthReport, HandshakeTestReport, RemoteNodeProfile,
    RemoteAccessPath, RemoteNodeRole, RemoteNodeStatus, RemoteServicePorts, TailscaleAccess,
};
pub use interface::{
    AiDeploymentTarget, AiDeploymentTargetKind, AiGitHubBackupTarget, AiInterfaceEndpoint,
    AiInterfaceTransport, AiRemoteAssistPolicy, AiRemoteUsage, AiSourceOfTruth, AiWorkContext,
    ControllerExecutorInterface, ExecutorHealthSnapshot, ExecutorModelBackendStatus,
    LocalControllerProfile, ModelInvocationRequest, SshTunnelSpec,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManifoldAssetKind {
    Object,
    Library,
    Dataset,
    Model,
    Agent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifoldAsset {
    pub identity_id: IdentityId,
    pub name: String,
    pub kind: ManifoldAssetKind,
    pub primary_coordinate: CoordinateId,
    pub substrate_bindings: Vec<SubstrateId>,
}

impl ManifoldAsset {
    pub fn new(
        identity_id: IdentityId,
        name: impl Into<String>,
        kind: ManifoldAssetKind,
        primary_coordinate: CoordinateId,
        substrate_bindings: impl Into<Vec<SubstrateId>>,
    ) -> Self {
        Self {
            identity_id,
            name: name.into(),
            kind,
            primary_coordinate,
            substrate_bindings: substrate_bindings.into(),
        }
    }

    pub fn supports_substrate(&self, substrate_id: SubstrateId) -> bool {
        self.substrate_bindings.contains(&substrate_id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubstrateTestPlan {
    pub name: String,
    pub invariant: String,
}

impl SubstrateTestPlan {
    pub fn new(name: impl Into<String>, invariant: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            invariant: invariant.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubstrateAuthoringPlan {
    pub domain: String,
    pub purpose: String,
    pub target_substrates: Vec<String>,
    pub invariants: Vec<String>,
    pub tests: Vec<SubstrateTestPlan>,
}

impl SubstrateAuthoringPlan {
    pub fn new(
        domain: impl Into<String>,
        purpose: impl Into<String>,
        target_substrates: impl Into<Vec<String>>,
        invariants: impl Into<Vec<String>>,
        tests: impl Into<Vec<SubstrateTestPlan>>,
    ) -> Self {
        Self {
            domain: domain.into(),
            purpose: purpose.into(),
            target_substrates: target_substrates.into(),
            invariants: invariants.into(),
            tests: tests.into(),
        }
    }

    pub fn requires_verification(&self) -> bool {
        !self.tests.is_empty() || !self.invariants.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LibraryIngestionPlan {
    pub library_name: String,
    pub version: Option<String>,
    pub domains: Vec<String>,
    pub substrate_targets: Vec<String>,
    pub entry_points: Vec<String>,
}

impl LibraryIngestionPlan {
    pub fn new(
        library_name: impl Into<String>,
        version: Option<String>,
        domains: impl Into<Vec<String>>,
        substrate_targets: impl Into<Vec<String>>,
        entry_points: impl Into<Vec<String>>,
    ) -> Self {
        Self {
            library_name: library_name.into(),
            version,
            domains: domains.into(),
            substrate_targets: substrate_targets.into(),
            entry_points: entry_points.into(),
        }
    }

    pub fn maps_domain(&self, domain: &str) -> bool {
        self.domains.iter().any(|candidate| candidate == domain)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifoldAgentProfile {
    pub identity_id: IdentityId,
    pub label: String,
    pub local_only: bool,
    pub constitutional_roles: Vec<String>,
}

impl ManifoldAgentProfile {
    pub fn new(
        identity_id: IdentityId,
        label: impl Into<String>,
        local_only: bool,
        constitutional_roles: impl Into<Vec<String>>,
    ) -> Self {
        Self {
            identity_id,
            label: label.into(),
            local_only,
            constitutional_roles: constitutional_roles.into(),
        }
    }

    pub fn is_constitution_bound(&self) -> bool {
        self.local_only && !self.constitutional_roles.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::{
        LibraryIngestionPlan, ManifoldAgentProfile, ManifoldAsset, ManifoldAssetKind,
        SubstrateAuthoringPlan, SubstrateTestPlan,
    };
    use crate::TEXT_WRITE_SUBSTRATE_ID;

    #[test]
    fn manifold_asset_tracks_bound_substrates() {
        let asset = ManifoldAsset::new(
            10,
            "three.js",
            ManifoldAssetKind::Library,
            25,
            vec![TEXT_WRITE_SUBSTRATE_ID],
        );

        assert!(asset.supports_substrate(TEXT_WRITE_SUBSTRATE_ID));
    }

    #[test]
    fn authoring_plan_requires_verification_when_invariants_exist() {
        let plan = SubstrateAuthoringPlan::new(
            "binary",
            "derive bytes from coordinates",
            vec!["binary.read".into(), "binary.write".into()],
            vec!["round trips stay deterministic".into()],
            vec![SubstrateTestPlan::new("round_trip", "create then read preserves bytes")],
        );

        assert!(plan.requires_verification());
    }

    #[test]
    fn library_ingestion_plan_maps_domains() {
        let plan = LibraryIngestionPlan::new(
            "react",
            Some("19".into()),
            vec!["ui".into(), "component".into()],
            vec!["object".into()],
            vec!["render".into()],
        );

        assert!(plan.maps_domain("ui"));
        assert!(!plan.maps_domain("audio"));
    }

    #[test]
    fn manifold_agent_profile_can_be_constitution_bound() {
        let profile = ManifoldAgentProfile::new(
            11,
            "butterfly-brain",
            true,
            vec!["author substrates".into(), "write tests".into()],
        );

        assert!(profile.is_constitution_bound());
    }
}