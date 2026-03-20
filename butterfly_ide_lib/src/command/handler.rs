use crate::command::{bus::CommandBus, command::Command};
use crate::{AiInterfaceEndpoint, ModelInvocationRequest};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};

pub trait Handler {
    fn handle(&self, input: Option<String>) -> Value;
}

pub struct CommandHandler {
    bus: CommandBus,
}

impl CommandHandler {
    pub fn new() -> Self {
        Self {
            bus: CommandBus::new(),
        }
    }

    pub fn handle(&self, command: &str, payload: Value) -> Value {
        match self.parse_command(command, payload) {
            Ok(command) => self.bus.dispatch(command),
            Err(error) => json!({ "error": error }),
        }
    }

    fn parse_command(&self, command: &str, payload: Value) -> Result<Command, String> {
        match command.trim().to_ascii_lowercase().as_str() {
            "systeminfo" | "system_info" | "system.info" => Ok(Command::SystemInfo),
            "listdir" | "list_dir" | "fs.listdir" | "fs.list_dir" => {
                let payload: PathPayload = parse_payload(payload)?;
                Ok(Command::ListDir { path: payload.path })
            }
            "ai.health" | "ai_health" | "executor.health" => {
                let payload: EndpointPayload = parse_payload(payload)?;
                Ok(Command::AiHealth {
                    endpoint: payload.endpoint,
                })
            }
            "ai.handshake" | "ai_handshake" | "executor.handshake" => {
                let payload: EndpointPayload = parse_payload(payload)?;
                Ok(Command::AiHandshake {
                    endpoint: payload.endpoint,
                })
            }
            "ai.invoke" | "ai_invoke" | "executor.invoke" => {
                let payload: InvokePayload = parse_payload(payload)?;
                Ok(Command::AiInvoke {
                    endpoint: payload.endpoint,
                    request: payload.request,
                })
            }
            other => Err(format!("unknown command: {other}")),
        }
    }
}

#[derive(Debug, Deserialize)]
struct PathPayload {
    path: String,
}

#[derive(Debug, Deserialize)]
struct EndpointPayload {
    endpoint: AiInterfaceEndpoint,
}

#[derive(Debug, Deserialize)]
struct InvokePayload {
    endpoint: AiInterfaceEndpoint,
    request: ModelInvocationRequest,
}

fn parse_payload<T: DeserializeOwned>(payload: Value) -> Result<T, String> {
    serde_json::from_value(payload).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::CommandHandler;
    use serde_json::json;

    #[test]
    fn command_handler_reports_unknown_commands() {
        let handler = CommandHandler::new();
        let response = handler.handle("unknown.command", json!({}));

        assert_eq!(response["error"], "unknown command: unknown.command");
    }

    #[test]
    fn command_handler_accepts_legacy_list_dir_shape() {
        let handler = CommandHandler::new();
        let response = handler.handle("list_dir", json!({ "path": "." }));

        assert!(response["entries"].is_array());
    }
}
