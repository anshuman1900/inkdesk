use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::State;

/// Registry of opened documents: id -> absolute path.
#[derive(Default)]
struct DocRegistry(Mutex<HashMap<String, String>>);

fn hash_path(s: &str) -> u64 {
    // FNV-1a 64-bit — stable id per path, no external crate needed.
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Register a PDF path; returns "<id>:<size_bytes>". Stub for P1 — the
/// custom protocol + metadata expansion lands in P4.
#[tauri::command]
fn doc_register(path: String, registry: State<DocRegistry>) -> Result<String, String> {
    let p = PathBuf::from(&path);
    let meta = std::fs::metadata(&p).map_err(|e| format!("{}: {}", path, e))?;
    if !meta.is_file() {
        return Err(format!("not a file: {}", path));
    }
    let id = format!("d{:016x}", hash_path(&path));
    registry
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), path);
    Ok(format!("{}:{}", id, meta.len()))
}

pub fn run() {
    use tauri_plugin_sql::{Migration, MigrationKind};

    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_schema",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:inkdesk.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(DocRegistry::default())
        .invoke_handler(tauri::generate_handler![doc_register])
        .run(tauri::generate_context!())
        .expect("error while running inkdesk");
}
