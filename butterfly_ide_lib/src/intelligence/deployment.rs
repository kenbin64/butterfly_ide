use crate::{identity::IdentityId, policy::DeploymentTarget, CoordinateId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RemoteNodeRole {
    DeploymentExecutor,
    DomainManager,
    CertificateManager,
    ValidationWorker,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RemoteNodeStatus {
    Unknown,
    Provisioning,
    Healthy,
    Degraded,
    Offline,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RemoteAccessPath {
    PrivateLan,
    Tailscale,
    ControlledPublicGateway,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TailscaleAccess {
    pub tailnet: Option<String>,
    pub device_name: String,
    pub magic_dns_name: Option<String>,
    pub tailscale_ip: Option<String>,
}

impl TailscaleAccess {
    pub fn new(
        tailnet: Option<String>,
        device_name: impl Into<String>,
        magic_dns_name: Option<String>,
        tailscale_ip: Option<String>,
    ) -> Self {
        Self {
            tailnet,
            device_name: device_name.into(),
            magic_dns_name,
            tailscale_ip,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteServicePorts {
    pub ssh: Option<u16>,
    pub control_api: Option<u16>,
    pub health: Option<u16>,
    pub deployment_agent: Option<u16>,
}

impl RemoteServicePorts {
    pub fn new(
        ssh: Option<u16>,
        control_api: Option<u16>,
        health: Option<u16>,
        deployment_agent: Option<u16>,
    ) -> Self {
        Self {
            ssh,
            control_api,
            health,
            deployment_agent,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteNodeProfile {
    pub identity_id: IdentityId,
    pub coordinate_id: CoordinateId,
    pub label: String,
    pub host: String,
    pub access_path: RemoteAccessPath,
    pub tailscale: Option<TailscaleAccess>,
    pub roles: Vec<RemoteNodeRole>,
    pub status: RemoteNodeStatus,
    pub ports: RemoteServicePorts,
    pub domains: Vec<String>,
}

impl RemoteNodeProfile {
    pub fn new(
        identity_id: IdentityId,
        coordinate_id: CoordinateId,
        label: impl Into<String>,
        host: impl Into<String>,
        access_path: RemoteAccessPath,
        tailscale: Option<TailscaleAccess>,
        roles: impl Into<Vec<RemoteNodeRole>>,
        status: RemoteNodeStatus,
        ports: RemoteServicePorts,
        domains: impl Into<Vec<String>>,
    ) -> Self {
        Self {
            identity_id,
            coordinate_id,
            label: label.into(),
            host: host.into(),
            access_path,
            tailscale,
            roles: roles.into(),
            status,
            ports,
            domains: domains.into(),
        }
    }

    pub fn supports_role(&self, role: RemoteNodeRole) -> bool {
        self.roles.contains(&role)
    }

    pub fn manages_domain(&self, domain: &str) -> bool {
        self.domains.iter().any(|candidate| candidate == domain)
    }

    pub fn uses_tailscale(&self) -> bool {
        self.access_path == RemoteAccessPath::Tailscale && self.tailscale.is_some()
    }

    pub fn uses_controlled_public_gateway(&self) -> bool {
        self.access_path == RemoteAccessPath::ControlledPublicGateway
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeploymentObjective {
    DeployArtifact,
    ConfigureRuntime,
    BindDomain,
    ProvisionCertificate,
    ValidateRelease,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeploymentTaskKind {
    UploadArtifact,
    ApplyConfiguration,
    RestartService,
    BindDomain,
    ProvisionCertificate,
    RunHealthCheck,
    RunSmokeTests,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentTask {
    pub kind: DeploymentTaskKind,
    pub summary: String,
    pub requires_approval: bool,
}

impl DeploymentTask {
    pub fn new(
        kind: DeploymentTaskKind,
        summary: impl Into<String>,
        requires_approval: bool,
    ) -> Self {
        Self {
            kind,
            summary: summary.into(),
            requires_approval,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainBindingRequest {
    pub domain: String,
    pub service_label: String,
    pub target_host: String,
    pub force_https: bool,
}

impl DomainBindingRequest {
    pub fn new(
        domain: impl Into<String>,
        service_label: impl Into<String>,
        target_host: impl Into<String>,
        force_https: bool,
    ) -> Self {
        Self {
            domain: domain.into(),
            service_label: service_label.into(),
            target_host: target_host.into(),
            force_https,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CertificateStrategy {
    LetsEncrypt,
    ExistingSecret,
    ManualProvisioning,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CertificateRequest {
    pub domain: String,
    pub contact_email: Option<String>,
    pub strategy: CertificateStrategy,
    pub auto_renew: bool,
}

impl CertificateRequest {
    pub fn new(
        domain: impl Into<String>,
        contact_email: Option<String>,
        strategy: CertificateStrategy,
        auto_renew: bool,
    ) -> Self {
        Self {
            domain: domain.into(),
            contact_email,
            strategy,
            auto_renew,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentSessionPlan {
    pub session_label: String,
    pub controller_identity: IdentityId,
    pub remote_node: RemoteNodeProfile,
    pub target: DeploymentTarget,
    pub objective: DeploymentObjective,
    pub tasks: Vec<DeploymentTask>,
    pub domain_request: Option<DomainBindingRequest>,
    pub certificate_request: Option<CertificateRequest>,
}

impl DeploymentSessionPlan {
    pub fn new(
        session_label: impl Into<String>,
        controller_identity: IdentityId,
        remote_node: RemoteNodeProfile,
        target: DeploymentTarget,
        objective: DeploymentObjective,
        tasks: impl Into<Vec<DeploymentTask>>,
        domain_request: Option<DomainBindingRequest>,
        certificate_request: Option<CertificateRequest>,
    ) -> Self {
        Self {
            session_label: session_label.into(),
            controller_identity,
            remote_node,
            target,
            objective,
            tasks: tasks.into(),
            domain_request,
            certificate_request,
        }
    }

    pub fn requires_explicit_approval(&self) -> bool {
        self.tasks.iter().any(|task| task.requires_approval)
            || self.domain_request.is_some()
            || self.certificate_request.is_some()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeploymentHandshakeStage {
    Identity,
    Health,
    Configuration,
    Validation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HandshakeHealthReport {
    pub reachable: bool,
    pub available_disk_gb: u32,
    pub available_memory_mb: u32,
    pub active_services: Vec<String>,
}

impl HandshakeHealthReport {
    pub fn new(
        reachable: bool,
        available_disk_gb: u32,
        available_memory_mb: u32,
        active_services: impl Into<Vec<String>>,
    ) -> Self {
        Self {
            reachable,
            available_disk_gb,
            available_memory_mb,
            active_services: active_services.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HandshakeTestReport {
    pub suite: String,
    pub success: bool,
    pub summary: String,
}

impl HandshakeTestReport {
    pub fn new(
        suite: impl Into<String>,
        success: bool,
        summary: impl Into<String>,
    ) -> Self {
        Self {
            suite: suite.into(),
            success,
            summary: summary.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeploymentHandshake {
    pub stage: DeploymentHandshakeStage,
    pub remote_label: String,
    pub accepted: bool,
    pub network_path: RemoteAccessPath,
    pub config_digest: Option<String>,
    pub health: Option<HandshakeHealthReport>,
    pub tests: Vec<HandshakeTestReport>,
}

impl DeploymentHandshake {
    pub fn new(
        stage: DeploymentHandshakeStage,
        remote_label: impl Into<String>,
        accepted: bool,
        network_path: RemoteAccessPath,
        config_digest: Option<String>,
        health: Option<HandshakeHealthReport>,
        tests: impl Into<Vec<HandshakeTestReport>>,
    ) -> Self {
        Self {
            stage,
            remote_label: remote_label.into(),
            accepted,
            network_path,
            config_digest,
            health,
            tests: tests.into(),
        }
    }

    pub fn validation_passed(&self) -> bool {
        self.accepted && self.tests.iter().all(|report| report.success)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        CertificateRequest, CertificateStrategy, DeploymentHandshake, DeploymentHandshakeStage,
        DeploymentObjective, DeploymentSessionPlan, DeploymentTask, DeploymentTaskKind,
        DomainBindingRequest, HandshakeHealthReport, HandshakeTestReport, RemoteAccessPath,
        RemoteNodeProfile, RemoteNodeRole, RemoteNodeStatus, RemoteServicePorts,
        TailscaleAccess,
    };
    use crate::policy::DeploymentTarget;

    fn remote_node() -> RemoteNodeProfile {
        RemoteNodeProfile::new(
            40,
            400,
            "butterfly-vps",
            "deploy.example.internal",
            RemoteAccessPath::Tailscale,
            Some(TailscaleAccess::new(
                Some("butterfly.ts.net".into()),
                "butterfly-vps",
                Some("butterfly-vps.butterfly.ts.net".into()),
                Some("100.64.0.10".into()),
            )),
            vec![
                RemoteNodeRole::DeploymentExecutor,
                RemoteNodeRole::CertificateManager,
            ],
            RemoteNodeStatus::Healthy,
            RemoteServicePorts::new(Some(22), Some(8443), Some(8080), Some(9000)),
            vec!["app.example.com".into()],
        )
    }

    fn runpod_node() -> RemoteNodeProfile {
        RemoteNodeProfile::new(
            41,
            401,
            "butterfly-runpod",
            "ssh.runpod.io",
            RemoteAccessPath::ControlledPublicGateway,
            None,
            vec![
                RemoteNodeRole::DeploymentExecutor,
                RemoteNodeRole::ValidationWorker,
            ],
            RemoteNodeStatus::Healthy,
            RemoteServicePorts::new(Some(22), None, Some(9000), Some(9000)),
            Vec::new(),
        )
    }

    #[test]
    fn remote_node_profile_tracks_roles_and_domains() {
        let node = remote_node();

        assert!(node.supports_role(RemoteNodeRole::DeploymentExecutor));
        assert!(node.manages_domain("app.example.com"));
        assert!(node.uses_tailscale());
        assert!(!node.manages_domain("unknown.example.com"));
    }

    #[test]
    fn remote_node_profile_tracks_controlled_public_gateway_nodes() {
        let node = runpod_node();

        assert!(node.supports_role(RemoteNodeRole::DeploymentExecutor));
        assert!(node.supports_role(RemoteNodeRole::ValidationWorker));
        assert!(node.uses_controlled_public_gateway());
        assert!(!node.uses_tailscale());
        assert!(!node.manages_domain("app.example.com"));
    }

    #[test]
    fn deployment_session_requires_approval_for_domain_and_certificate_work() {
        let plan = DeploymentSessionPlan::new(
            "deploy-app",
            1,
            remote_node(),
            DeploymentTarget::new("deploy.example.internal", "release.tar.gz"),
            DeploymentObjective::ProvisionCertificate,
            vec![DeploymentTask::new(
                DeploymentTaskKind::ProvisionCertificate,
                "Issue certificate for app.example.com",
                true,
            )],
            Some(DomainBindingRequest::new(
                "app.example.com",
                "butterfly-web",
                "deploy.example.internal",
                true,
            )),
            Some(CertificateRequest::new(
                "app.example.com",
                Some("ops@example.com".into()),
                CertificateStrategy::LetsEncrypt,
                true,
            )),
        );

        assert!(plan.requires_explicit_approval());
    }

    #[test]
    fn handshake_validation_requires_acceptance_and_passing_tests() {
        let handshake = DeploymentHandshake::new(
            DeploymentHandshakeStage::Validation,
            "butterfly-vps",
            true,
            RemoteAccessPath::Tailscale,
            Some("sha256:abc123".into()),
            Some(HandshakeHealthReport::new(true, 120, 4096, vec!["nginx".into()])),
            vec![
                HandshakeTestReport::new("health", true, "200 OK"),
                HandshakeTestReport::new("smoke", true, "home page served"),
            ],
        );

        assert!(handshake.validation_passed());
    }

    #[test]
    fn handshake_validation_fails_when_any_test_fails() {
        let handshake = DeploymentHandshake::new(
            DeploymentHandshakeStage::Validation,
            "butterfly-vps",
            true,
            RemoteAccessPath::Tailscale,
            None,
            None,
            vec![HandshakeTestReport::new("smoke", false, "tls mismatch")],
        );

        assert!(!handshake.validation_passed());
    }
}