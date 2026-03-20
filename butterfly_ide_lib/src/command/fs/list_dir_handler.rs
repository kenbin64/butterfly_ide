use serde_json::{json, Value};
use std::fs;

pub struct ListDirHandler;

impl ListDirHandler {
    pub fn new() -> Self {
        Self
    }

    pub fn handle(&self, path: String) -> Value {
        let entries = fs::read_dir(path)
            .map(|iter| {
                iter.filter_map(|e| e.ok())
                    .map(|e| e.path().display().to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        json!({ "entries": entries })
    }
}