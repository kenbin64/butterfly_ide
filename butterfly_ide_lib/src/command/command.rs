use crate::{AiInterfaceEndpoint, ModelInvocationRequest};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Command {
    /// Retrieve system information
    SystemInfo,

    /// List directory contents
    ListDir {
        path: String,
    },

    /// Fetch remote executor health through the approved AI interface
    AiHealth {
        endpoint: AiInterfaceEndpoint,
    },

    /// Fetch remote executor handshake through the approved AI interface
    AiHandshake {
        endpoint: AiInterfaceEndpoint,
    },

    /// Invoke the remote model through the approved AI interface
    AiInvoke {
        endpoint: AiInterfaceEndpoint,
        request: ModelInvocationRequest,
    },
}