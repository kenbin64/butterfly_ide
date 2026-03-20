use super::{
    DeploymentHandshake, ManifoldAgentProfile, RemoteAccessPath, RemoteNodeProfile,
    RemoteNodeRole,
};
use crate::identity::IdentityId;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalControllerProfile {
    pub agent: ManifoldAgentProfile,
    pub workspace_root: String,
    pub loopback_host: String,
}

impl LocalControllerProfile {
    pub fn new(
        identity_id: IdentityId,
        label: impl Into<String>,
        workspace_root: impl Into<String>,
        constitutional_roles: impl Into<Vec<String>>,
    ) -> Self {
        let label = label.into();
        Self {
            agent: ManifoldAgentProfile::new(identity_id, label, true, constitutional_roles),
            workspace_root: workspace_root.into(),
            loopback_host: "127.0.0.1".into(),
        }
    }

    pub fn is_ready(&self) -> bool {
        self.agent.is_constitution_bound()
            && !self.workspace_root.is_empty()
            && !self.loopback_host.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SshTunnelSpec {
    pub gateway_user: String,
    pub gateway_host: String,
    pub local_port: u16,
    pub remote_port: u16,
}

impl SshTunnelSpec {
    pub fn new(
        gateway_user: impl Into<String>,
        gateway_host: impl Into<String>,
        local_port: u16,
        remote_port: u16,
    ) -> Self {
        Self {
            gateway_user: gateway_user.into(),
            gateway_host: gateway_host.into(),
            local_port,
            remote_port,
        }
    }

    pub fn command_line(&self) -> String {
        format!(
            "ssh -L {port}:127.0.0.1:{remote_port} {user}@{host}",
            port = self.local_port,
            remote_port = self.remote_port,
            user = self.gateway_user,
            host = self.gateway_host,
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "spec")]
pub enum AiInterfaceTransport {
    DirectLoopback,
    SshTunnel(SshTunnelSpec),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiInterfaceEndpoint {
    pub host: String,
    pub port: u16,
    pub transport: AiInterfaceTransport,
}

impl AiInterfaceEndpoint {
    pub fn direct_loopback(port: u16) -> Self {
        Self {
            host: "127.0.0.1".into(),
            port,
            transport: AiInterfaceTransport::DirectLoopback,
        }
    }

    pub fn ssh_tunnel(tunnel: SshTunnelSpec) -> Self {
        Self {
            host: "127.0.0.1".into(),
            port: tunnel.local_port,
            transport: AiInterfaceTransport::SshTunnel(tunnel),
        }
    }

    pub fn base_url(&self) -> String {
        format!("http://{}:{}", self.host, self.port)
    }

    pub fn health_url(&self) -> String {
        format!("{}/health", self.base_url())
    }

    pub fn handshake_url(&self) -> String {
        format!("{}/handshake", self.base_url())
    }

    pub fn model_status_url(&self) -> String {
        format!("{}/model/status", self.base_url())
    }

    pub fn invoke_url(&self) -> String {
        format!("{}/model/invoke", self.base_url())
    }

    pub fn uses_ssh_tunnel(&self) -> bool {
        matches!(self.transport, AiInterfaceTransport::SshTunnel(_))
    }

    pub fn is_loopback_bound(&self) -> bool {
        matches!(self.host.as_str(), "127.0.0.1" | "localhost")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ControllerExecutorInterface {
    pub controller: LocalControllerProfile,
    pub remote: RemoteNodeProfile,
    pub endpoint: AiInterfaceEndpoint,
}

impl ControllerExecutorInterface {
    pub fn new(
        controller: LocalControllerProfile,
        remote: RemoteNodeProfile,
        endpoint: AiInterfaceEndpoint,
    ) -> Self {
        Self {
            controller,
            remote,
            endpoint,
        }
    }

    pub fn requires_ssh_tunnel(&self) -> bool {
        self.remote.uses_controlled_public_gateway() && self.endpoint.is_loopback_bound()
    }

    pub fn is_ready_for_control(&self) -> bool {
        self.controller.is_ready()
            && self.remote.supports_role(RemoteNodeRole::DeploymentExecutor)
            && self.remote.supports_role(RemoteNodeRole::ValidationWorker)
            && (!self.requires_ssh_tunnel() || self.endpoint.uses_ssh_tunnel())
    }

    pub fn parse_health(&self, raw: &str) -> Result<ExecutorHealthSnapshot, serde_json::Error> {
        serde_json::from_str(raw)
    }

    pub fn parse_handshake(&self, raw: &str) -> Result<DeploymentHandshake, serde_json::Error> {
        serde_json::from_str(raw)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutorModelBackendStatus {
    pub configured: bool,
    pub reachable: bool,
    #[serde(default)]
    pub status: Option<u16>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutorHealthSnapshot {
    pub label: String,
    pub status: String,
    pub roles: Vec<String>,
    pub network_path: RemoteAccessPath,
    pub workspace: String,
    pub available_disk_gb: u32,
    pub available_memory_mb: u32,
    pub model_backend: ExecutorModelBackendStatus,
}

impl ExecutorHealthSnapshot {
    pub fn is_healthy(&self) -> bool {
        self.status == "healthy"
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AiDeploymentTargetKind {
    RunpodPod,
    GitHubRepository,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AiSourceOfTruth {
    LocalWorkspace,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AiRemoteUsage {
    Deployment,
    Validation,
    GitHubBackup,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiGitHubBackupTarget {
    pub label: String,
    pub repository: String,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub private: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiRemoteAssistPolicy {
    #[serde(default)]
    pub only_when_requested: bool,
    #[serde(default)]
    pub allowed_scopes: Vec<AiRemoteUsage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiDeploymentTarget {
    pub kind: AiDeploymentTargetKind,
    pub label: String,
    #[serde(default)]
    pub host: Option<String>,
    #[serde(default)]
    pub artifact: Option<String>,
    #[serde(default)]
    pub repository: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct AiWorkContext {
    #[serde(default)]
    pub manifold_focus: Vec<String>,
    #[serde(default)]
    pub substrate_focus: Vec<String>,
    #[serde(default)]
    pub objectives: Vec<String>,
    #[serde(default)]
    pub workspace_roots: Vec<String>,
    #[serde(default)]
    pub source_of_truth: Option<AiSourceOfTruth>,
    #[serde(default)]
    pub github_backup: Option<AiGitHubBackupTarget>,
    #[serde(default)]
    pub deployment_targets: Vec<AiDeploymentTarget>,
    #[serde(default)]
    pub remote_node: Option<String>,
    #[serde(default)]
    pub remote_assist: Option<AiRemoteAssistPolicy>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelInvocationRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub work_context: Option<AiWorkContext>,
    pub metadata: Option<Value>,
}

impl ModelInvocationRequest {
    pub fn new(prompt: impl Into<String>) -> Self {
        Self {
            prompt: prompt.into(),
            system_prompt: None,
            max_tokens: None,
            temperature: None,
            work_context: None,
            metadata: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AiDeploymentTarget, AiDeploymentTargetKind, AiGitHubBackupTarget,
        AiInterfaceEndpoint, AiRemoteAssistPolicy, AiRemoteUsage, AiSourceOfTruth,
        AiWorkContext, ControllerExecutorInterface, LocalControllerProfile, ModelInvocationRequest,
        SshTunnelSpec,
    };
    use crate::{RemoteAccessPath, RemoteNodeProfile, RemoteNodeRole, RemoteNodeStatus, RemoteServicePorts};
    use serde_json::json;

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
    fn local_controller_is_ready_when_constitution_bound() {
        let controller = LocalControllerProfile::new(
            7,
            "butterfly-controller",
            "C:/dev/butterfly-ide",
            vec!["plan deployments".into(), "approve runtime changes".into()],
        );

        assert!(controller.is_ready());
    }

    #[test]
    fn ssh_tunnel_endpoint_supports_controlled_gateway_access() {
        let controller = LocalControllerProfile::new(7, "controller", "C:/dev/butterfly-ide", vec!["validate".into()]);
        let tunnel = SshTunnelSpec::new("uzpre49zt78f2l-64410eaf", "ssh.runpod.io", 19000, 9000);
        let endpoint = AiInterfaceEndpoint::ssh_tunnel(tunnel.clone());
        let link = ControllerExecutorInterface::new(controller, runpod_node(), endpoint.clone());

        assert!(link.requires_ssh_tunnel());
        assert!(link.is_ready_for_control());
        assert_eq!(endpoint.health_url(), "http://127.0.0.1:19000/health");
        assert_eq!(tunnel.command_line(), "ssh -L 19000:127.0.0.1:9000 uzpre49zt78f2l-64410eaf@ssh.runpod.io");
    }

    #[test]
    fn interface_parses_executor_health_and_handshake_payloads() {
        let controller = LocalControllerProfile::new(7, "controller", "C:/dev/butterfly-ide", vec!["validate".into()]);
        let endpoint = AiInterfaceEndpoint::ssh_tunnel(SshTunnelSpec::new("runner", "ssh.runpod.io", 19000, 9000));
        let link = ControllerExecutorInterface::new(controller, runpod_node(), endpoint);

        let health = link
            .parse_health(r#"{"label":"runpod-executor","status":"healthy","roles":["DeploymentExecutor","ValidationWorker"],"network_path":"ControlledPublicGateway","workspace":"/workspace","available_disk_gb":912000,"available_memory_mb":165000,"model_backend":{"configured":false,"reachable":false}}"#)
            .unwrap();
        let handshake = link
            .parse_handshake(r#"{"stage":"Health","remote_label":"runpod-executor","accepted":true,"network_path":"ControlledPublicGateway","config_digest":"sha256:abc123","health":{"reachable":true,"available_disk_gb":912000,"available_memory_mb":165000,"active_services":["runpod-executor"]},"tests":[{"suite":"health","success":true,"summary":"executor reachable on loopback"},{"suite":"model-backend","success":true,"summary":"backend optional or unavailable"}]}"#)
            .unwrap();

        assert!(health.is_healthy());
        assert_eq!(health.network_path, RemoteAccessPath::ControlledPublicGateway);
        assert!(handshake.validation_passed());
    }

    #[test]
    fn model_invocation_request_serializes_expected_shape() {
        let mut request = ModelInvocationRequest::new("hello butterfly");
        request.system_prompt = Some("stay constitutional".into());
        request.max_tokens = Some(256);
        request.work_context = Some(AiWorkContext {
            manifold_focus: vec!["helix-manifold".into()],
            substrate_focus: vec!["text".into(), "binary".into()],
            objectives: vec!["author substrate-aware code".into()],
            workspace_roots: vec!["C:/dev/butterfly-ide".into()],
            source_of_truth: Some(AiSourceOfTruth::LocalWorkspace),
            github_backup: Some(AiGitHubBackupTarget {
                label: "origin".into(),
                repository: "kenbin64/butterfly-ide".into(),
                branch: Some("main".into()),
                private: true,
            }),
            deployment_targets: vec![
                AiDeploymentTarget {
                    kind: AiDeploymentTargetKind::RunpodPod,
                    label: "runpod-executor".into(),
                    host: Some("ssh.runpod.io".into()),
                    artifact: Some("butterfly-runtime".into()),
                    repository: None,
                    branch: None,
                },
                AiDeploymentTarget {
                    kind: AiDeploymentTargetKind::GitHubRepository,
                    label: "origin".into(),
                    host: None,
                    artifact: None,
                    repository: Some("kenbin64/butterfly-ide".into()),
                    branch: Some("main".into()),
                },
            ],
            remote_node: Some("runpod-executor".into()),
            remote_assist: Some(AiRemoteAssistPolicy {
                only_when_requested: true,
                allowed_scopes: vec![AiRemoteUsage::Deployment, AiRemoteUsage::Validation],
            }),
        });
        request.metadata = Some(json!({"coordinate_id": 90}));

        let value = serde_json::to_value(request).unwrap();
        assert_eq!(value["prompt"], "hello butterfly");
        assert_eq!(value["system_prompt"], "stay constitutional");
        assert_eq!(value["max_tokens"], 256);
        assert_eq!(value["work_context"]["manifold_focus"][0], "helix-manifold");
        assert_eq!(value["work_context"]["substrate_focus"][1], "binary");
        assert_eq!(value["work_context"]["source_of_truth"], "LocalWorkspace");
        assert_eq!(value["work_context"]["github_backup"]["repository"], "kenbin64/butterfly-ide");
        assert_eq!(value["work_context"]["deployment_targets"][1]["kind"], "GitHubRepository");
        assert_eq!(value["work_context"]["remote_assist"]["only_when_requested"], true);
        assert_eq!(value["metadata"]["coordinate_id"], 90);
    }
}