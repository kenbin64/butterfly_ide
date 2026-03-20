use serde_json::{json, Value};
use sysinfo::{
    System,
    RefreshKind,
    CpuRefreshKind,
    MemoryRefreshKind,
};

pub struct SystemHandler;

impl SystemHandler {
    pub fn new() -> Self {
        Self
    }

    pub fn handle(&self) -> Value {
        // Configure what to refresh
        let refresh = RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything());

        // Create system with specifics
        let mut sys = System::new_with_specifics(refresh);

        // Refresh everything requested
        sys.refresh_all();

        json!({
            "os_name": System::name(),
            "os_version": System::os_version(),
            "kernel_version": System::kernel_version(),
            "architecture": std::env::consts::ARCH,
            "cpu_count": sys.cpus().len(),
            "total_memory": sys.total_memory(),
            "uptime_seconds": System::uptime()
        })
    }
}