use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, State};

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

/// Register a PDF path; returns "<id>:<size_bytes>".
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

/// Write arbitrary bytes to a path (PDF pipeline output, exports).
#[tauri::command]
fn write_file(path: String, bytes: Vec<u8>) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("empty payload".into());
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("{}: {}", path, e))?;
    Ok(path)
}

/// Snipping tool capture: minimize the app, screenshot the virtual screen, restore.
/// Returns raw PNG bytes (base64 handled on the JS side or written to a temp file).
#[tauri::command]
fn snip_capture(app: tauri::AppHandle, temp_path: String) -> Result<String, String> {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.minimize();
    }
    std::thread::sleep(std::time::Duration::from_millis(450));
    let script = r#"
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $b.Size)
$bmp.Save('PATH', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"#.replace("PATH", &temp_path.replace(''', "''"));
    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.maximize();
        let _ = w.set_focus();
    }
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(temp_path)
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).is_file()
}

/// Open a file with the Windows print verb (flatten first, then call this).
#[tauri::command]
fn print_file(path: String) -> Result<(), String> {
    let safe = path.replace('\'', "''");
    let script = format!("Start-Process -FilePath '{}' -Verb Print", safe);
    std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
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
        .invoke_handler(tauri::generate_handler![doc_register, write_file, print_file, file_exists, snip_capture])
        // Stream registered PDF bytes into the webview: inkdesk://pdf/<id>
        .register_uri_scheme_protocol("inkdesk", |ctx, request| {
            let id = request
                .uri()
                .path()
                .trim_start_matches('/')
                .to_string();
            let lookup = ctx
                .app_handle()
                .state::<DocRegistry>()
                .0
                .lock()
                .ok()
                .and_then(|reg| reg.get(&id).cloned());
            match lookup {
                Some(fp) => match std::fs::read(&fp) {
                    Ok(bytes) => tauri::http::Response::builder()
                        .status(200)
                        .header("Content-Type", "application/pdf")
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Cache-Control", "no-store")
                        .body(bytes)
                        .unwrap(),
                    Err(e) => tauri::http::Response::builder()
                        .status(404)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(format!("read error: {}", e).into_bytes())
                        .unwrap(),
                },
                None => tauri::http::Response::builder()
                    .status(404)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(b"unknown doc id".to_vec())
                    .unwrap(),
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running inkdesk");
}
