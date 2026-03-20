use serde_json::Value;

use butterfly_ide_core::command::handler::CommandHandler;

pub fn dispatch(command: String, payload: Value) -> Value {
    let handler = CommandHandler::new();
    handler.handle(&command, payload)
}