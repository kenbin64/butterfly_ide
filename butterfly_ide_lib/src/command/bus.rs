use serde_json::Value;

use crate::command::ai::executor_handler::ExecutorHandler;
use crate::command::command::Command;
use crate::command::fs::list_dir_handler::ListDirHandler;
use crate::command::system::system_handler::SystemHandler;

pub struct CommandBus;

impl CommandBus {
    pub fn new() -> Self {
        Self
    }

    pub fn dispatch(&self, command: Command) -> Value {
        match command {
            Command::SystemInfo => {
                let handler = SystemHandler::new();
                handler.handle()
            }

            Command::ListDir { path } => {
                let handler = ListDirHandler::new();
                handler.handle(path)
            }

            Command::AiHealth { endpoint } => {
                let handler = ExecutorHandler::new();
                handler.health(endpoint)
            }

            Command::AiHandshake { endpoint } => {
                let handler = ExecutorHandler::new();
                handler.handshake(endpoint)
            }

            Command::AiInvoke { endpoint, request } => {
                let handler = ExecutorHandler::new();
                handler.invoke(endpoint, request)
            }
        }
    }
}