use crate::command::command::Command;

pub struct ListDirCommand;

impl ListDirCommand {
    pub fn new(path: String) -> Command {
        Command::ListDir { path }
    }
}