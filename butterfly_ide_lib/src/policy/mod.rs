use std::{net::IpAddr, path::{Path, PathBuf}};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Capability {
    ReadWorkspace,
    WriteWorkspace,
    RunCommands,
    UseLocalNetwork,
    UseDeploymentGateway,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PathAction {
    Read,
    Write,
    Delete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetworkPurpose {
    General,
    Deployment,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AccessDecision {
    Allow,
    Deny(&'static str),
}

impl AccessDecision {
    pub fn is_allowed(&self) -> bool {
        matches!(self, Self::Allow)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeploymentTarget {
    pub host: String,
    pub artifact: String,
}

impl DeploymentTarget {
    pub fn new(host: impl Into<String>, artifact: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            artifact: artifact.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ApprovalContext {
    pub user_approved: bool,
    pub validation_succeeded: bool,
}

#[derive(Debug, Clone, Default)]
pub struct PolicyConfig {
    pub allowed_capabilities: Vec<Capability>,
    pub workspace_roots: Vec<PathBuf>,
    pub allowed_roots: Vec<PathBuf>,
    pub denied_roots: Vec<PathBuf>,
    pub allowed_private_hosts: Vec<String>,
    pub allowed_deployment_hosts: Vec<String>,
    pub allow_localhost: bool,
    pub allow_private_ips: bool,
}

impl PolicyConfig {
    pub fn local_first(workspace_root: impl Into<PathBuf>) -> Self {
        Self {
            allowed_capabilities: vec![
                Capability::ReadWorkspace,
                Capability::WriteWorkspace,
                Capability::RunCommands,
                Capability::UseLocalNetwork,
            ],
            workspace_roots: vec![workspace_root.into()],
            allowed_roots: Vec::new(),
            denied_roots: vec![
                PathBuf::from("C:/Users/Default/.ssh"),
                PathBuf::from("C:/Users/Default/AppData/Local/Google/Chrome"),
                PathBuf::from("C:/Windows/System32"),
            ],
            allowed_private_hosts: Vec::new(),
            allowed_deployment_hosts: Vec::new(),
            allow_localhost: true,
            allow_private_ips: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PolicyEngine {
    config: PolicyConfig,
}

impl PolicyEngine {
    pub fn new(config: PolicyConfig) -> Self {
        Self { config }
    }

    pub fn config(&self) -> &PolicyConfig {
        &self.config
    }

    pub fn check_capability(&self, capability: Capability) -> AccessDecision {
        if self.config.allowed_capabilities.contains(&capability) {
            AccessDecision::Allow
        } else {
            AccessDecision::Deny("capability not granted")
        }
    }

    pub fn check_path(&self, path: impl AsRef<Path>, action: PathAction) -> AccessDecision {
        let required = match action {
            PathAction::Read => Capability::ReadWorkspace,
            PathAction::Write | PathAction::Delete => Capability::WriteWorkspace,
        };
        if !self.check_capability(required).is_allowed() {
            return AccessDecision::Deny("missing workspace capability");
        }

        let path = path.as_ref();
        if self.matches_any_path(path, &self.config.denied_roots) {
            return AccessDecision::Deny("path is protected by policy");
        }
        if self.matches_any_path(path, &self.config.workspace_roots)
            || self.matches_any_path(path, &self.config.allowed_roots)
        {
            return AccessDecision::Allow;
        }

        AccessDecision::Deny("path is outside approved roots")
    }

    pub fn check_network_host(&self, host: &str, purpose: NetworkPurpose) -> AccessDecision {
        let required = match purpose {
            NetworkPurpose::General => Capability::UseLocalNetwork,
            NetworkPurpose::Deployment => Capability::UseDeploymentGateway,
        };
        if !self.check_capability(required).is_allowed() {
            return AccessDecision::Deny("missing network capability");
        }

        let host = host.trim().to_ascii_lowercase();
        if self.config.allow_localhost && matches!(host.as_str(), "localhost" | "127.0.0.1" | "::1") {
            return AccessDecision::Allow;
        }
        if purpose == NetworkPurpose::Deployment
            && self.config.allowed_deployment_hosts.iter().any(|allowed| allowed.eq_ignore_ascii_case(&host))
        {
            return AccessDecision::Allow;
        }
        if self.config.allowed_private_hosts.iter().any(|allowed| allowed.eq_ignore_ascii_case(&host)) {
            return AccessDecision::Allow;
        }
        if self.config.allow_private_ips && host.parse::<IpAddr>().map(is_private_ip).unwrap_or(false) {
            return AccessDecision::Allow;
        }

        AccessDecision::Deny("host is not approved by policy")
    }

    pub fn check_deployment(
        &self,
        target: &DeploymentTarget,
        approval: ApprovalContext,
    ) -> AccessDecision {
        if !approval.user_approved {
            return AccessDecision::Deny("deployment requires explicit approval");
        }
        if !approval.validation_succeeded {
            return AccessDecision::Deny("deployment requires successful validation");
        }

        self.check_network_host(&target.host, NetworkPurpose::Deployment)
    }

    fn matches_any_path(&self, path: &Path, roots: &[PathBuf]) -> bool {
        roots.iter().any(|root| path.starts_with(root))
    }
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_private(),
        IpAddr::V6(ip) => ip.is_loopback() || ip.is_unique_local(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AccessDecision, ApprovalContext, Capability, DeploymentTarget, NetworkPurpose, PathAction,
        PolicyConfig, PolicyEngine,
    };
    use std::path::PathBuf;

    fn engine() -> PolicyEngine {
        let mut config = PolicyConfig::local_first("C:/dev/butterfly-ide");
        config.allowed_capabilities.push(Capability::UseDeploymentGateway);
        config.allowed_private_hosts.push("devbox.local".into());
        config.allowed_deployment_hosts.push("github.com".into());
        config.denied_roots = vec![PathBuf::from("C:/dev/butterfly-ide/secrets")];
        PolicyEngine::new(config)
    }

    #[test]
    fn allows_workspace_reads() {
        let decision = engine().check_path("C:/dev/butterfly-ide/src/main.rs", PathAction::Read);
        assert_eq!(decision, AccessDecision::Allow);
    }

    #[test]
    fn denies_protected_paths() {
        let decision = engine().check_path("C:/dev/butterfly-ide/secrets/token.txt", PathAction::Read);
        assert_eq!(decision, AccessDecision::Deny("path is protected by policy"));
    }

    #[test]
    fn allows_private_network_and_blocks_public_hosts() {
        assert_eq!(engine().check_network_host("192.168.1.50", NetworkPurpose::General), AccessDecision::Allow);
        assert_eq!(engine().check_network_host("example.com", NetworkPurpose::General), AccessDecision::Deny("host is not approved by policy"));
    }

    #[test]
    fn deployment_requires_approval_and_approved_host() {
        let target = DeploymentTarget::new("github.com", "release.zip");
        let denied = engine().check_deployment(&target, ApprovalContext::default());
        assert_eq!(denied, AccessDecision::Deny("deployment requires explicit approval"));

        let allowed = engine().check_deployment(
            &target,
            ApprovalContext {
                user_approved: true,
                validation_succeeded: true,
            },
        );
        assert_eq!(allowed, AccessDecision::Allow);
    }

    #[test]
    fn blocks_network_when_capability_missing() {
        let mut config = PolicyConfig::local_first("C:/dev/butterfly-ide");
        config.allowed_capabilities.retain(|cap| *cap != Capability::UseLocalNetwork);
        let engine = PolicyEngine::new(config);

        assert_eq!(engine.check_network_host("localhost", NetworkPurpose::General), AccessDecision::Deny("missing network capability"));
    }
}