// Native bridge for Vision OS. Mirrors dev-api.ts: read-only access to the user's own apps
// (Marginal, Rooznegar, HabitWall), launching them, and reading the Windows wallpaper.
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::ipc::Response;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn env_dir(var: &str) -> PathBuf {
    PathBuf::from(std::env::var(var).unwrap_or_default())
}

fn marginal_workspace() -> PathBuf {
    env_dir("APPDATA").join("marginal-research").join("workspace")
}

fn app_candidates() -> Vec<(&'static str, Vec<PathBuf>)> {
    let local = env_dir("LOCALAPPDATA");
    let home = env_dir("USERPROFILE");
    vec![
        ("marginal", vec![local.join("Programs").join("Marginal Research").join("Marginal Research.exe")]),
        ("habitwall", vec![local.join("HabitWall").join("habitwall.exe")]),
        (
            "rooznegar",
            vec![
                local.join("Programs").join("Rooznegar").join("Rooznegar.exe"),
                home.join("Desktop").join("Rooznegar").join("build").join("Rooznegar.exe"),
            ],
        ),
    ]
}

fn find_app(id: &str) -> Option<PathBuf> {
    app_candidates()
        .into_iter()
        .find(|(k, _)| *k == id)
        .and_then(|(_, list)| list.into_iter().find(|p| p.exists()))
}

#[tauri::command]
fn marginal_papers() -> Value {
    let file = marginal_workspace().join("workspace.json");
    let Ok(text) = fs::read_to_string(&file) else {
        return json!({ "available": false, "papers": [] });
    };
    let ws: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).unwrap_or(json!({}));
    let papers: Vec<Value> = ws["papers"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|p| {
            json!({
                "id": p["id"], "title": p["title"], "authors": p["authors"], "year": p["year"],
                "venue": p["venue"], "status": p["status"], "collection": p["collection"].as_str().unwrap_or(""),
                "favorite": p["favorite"].as_bool().unwrap_or(false), "pdf": p["pdf"].as_str().unwrap_or(""),
                "pages": p["pages"].as_u64().unwrap_or(0), "lastPage": p["lastPage"].as_u64().unwrap_or(0),
                "maxPage": p["maxPage"].as_u64().unwrap_or(0), "opened": p["opened"].as_str().unwrap_or(""),
                "added": p["added"].as_str().unwrap_or(""), "notes": p["notes"].as_array().map(|a| a.len()).unwrap_or(0),
            })
        })
        .collect();
    json!({ "available": true, "papers": papers })
}

#[tauri::command]
fn marginal_file(name: String) -> Result<Response, String> {
    // only a bare file name inside Marginal's files folder
    if name.contains(['/', '\\']) || name.contains("..") || !name.ends_with(".pdf") {
        return Err("invalid file name".into());
    }
    fs::read(marginal_workspace().join("files").join(&name)).map(Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
fn rooznegar_data() -> Option<String> {
    fs::read_to_string(env_dir("LOCALAPPDATA").join("Rooznegar").join("data.json")).ok()
}

#[tauri::command]
fn habitwall_today() -> Value {
    use rusqlite::{Connection, OpenFlags};
    let path = env_dir("APPDATA").join("app.habitwall.desktop").join("habitwall.db");
    let empty = json!({ "available": false, "habits": [], "checkins": [] });
    if !path.exists() {
        return empty;
    }
    let Ok(db) = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX) else {
        return empty;
    };
    let habits: Vec<Value> = db
        .prepare("SELECT id, title, color, icon, kind, target_value, unit, archived_at FROM habits ORDER BY sort_order, created_at")
        .and_then(|mut st| {
            st.query_map([], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?, "title": r.get::<_, String>(1)?, "color": r.get::<_, String>(2)?,
                    "icon": r.get::<_, Option<String>>(3)?, "kind": r.get::<_, String>(4)?, "target_value": r.get::<_, f64>(5)?,
                    "unit": r.get::<_, Option<String>>(6)?, "archived_at": r.get::<_, Option<String>>(7)?,
                }))
            })
            .map(|rows| rows.filter_map(Result::ok).collect())
        })
        .unwrap_or_default();
    let checkins: Vec<Value> = db
        .prepare("SELECT habit_id, day, status, value FROM checkins WHERE day >= date('now','-2 day')")
        .and_then(|mut st| {
            st.query_map([], |r| {
                Ok(json!({
                    "habit_id": r.get::<_, String>(0)?, "day": r.get::<_, String>(1)?,
                    "status": r.get::<_, Option<String>>(2)?, "value": r.get::<_, f64>(3)?,
                }))
            })
            .map(|rows| rows.filter_map(Result::ok).collect())
        })
        .unwrap_or_default();
    json!({ "available": true, "habits": habits, "checkins": checkins })
}

#[tauri::command]
fn find_apps() -> HashMap<String, Option<String>> {
    app_candidates()
        .into_iter()
        .map(|(k, list)| (k.to_string(), list.into_iter().find(|p| p.exists()).map(|p| p.display().to_string())))
        .collect()
}

#[tauri::command]
fn launch_app(id: String) -> Result<(), String> {
    let exe = find_app(&id).ok_or("app not found")?;
    let mut cmd = Command::new(&exe);
    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }
    cmd.spawn().map(|_| ()).map_err(|e| e.to_string())
}

fn wallpaper_path() -> Option<PathBuf> {
    let mut cmd = Command::new("reg");
    cmd.args(["query", r"HKCU\Control Panel\Desktop", "/v", "WallPaper"]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    if let Ok(out) = cmd.output() {
        let text = String::from_utf8_lossy(&out.stdout);
        if let Some(line) = text.lines().find(|l| l.contains("REG_SZ")) {
            if let Some(path) = line.split("REG_SZ").nth(1) {
                let p = PathBuf::from(path.trim());
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }
    let cached = env_dir("APPDATA").join("Microsoft").join("Windows").join("Themes").join("TranscodedWallpaper");
    cached.exists().then_some(cached)
}

#[tauri::command]
fn windows_wallpaper() -> Result<Response, String> {
    let p = wallpaper_path().ok_or("no wallpaper")?;
    fs::read(Path::new(&p)).map(Response::new).map_err(|e| e.to_string())
}

// ───────────────────────── Ollama bridge
// The webview cannot call http://127.0.0.1:11434 directly (CORS for the tauri.localhost origin),
// so requests go through Rust. Only the local Ollama server is reachable, and only its /api paths.
const OLLAMA: &str = "http://127.0.0.1:11434";

static CANCELLED: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

fn ollama_url(path: &str) -> Result<String, String> {
    if !path.starts_with("/api/") || path.contains("..") {
        return Err("invalid Ollama path".into());
    }
    Ok(format!("{OLLAMA}{path}"))
}

#[tauri::command]
async fn ollama_get(path: String) -> Result<String, String> {
    let res = reqwest::get(ollama_url(&path)?).await.map_err(|e| e.to_string())?;
    res.text().await.map_err(|e| e.to_string())
}

/// POST and stream the NDJSON response back chunk by chunk.
#[tauri::command]
async fn ollama_stream(path: String, body: String, id: String, on_chunk: tauri::ipc::Channel<String>) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut res = client
        .post(ollama_url(&path)?)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Ollama {}: {}", res.status(), res.text().await.unwrap_or_default()));
    }
    while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
        if CANCELLED.lock().map(|c| c.contains(&id)).unwrap_or(false) {
            break;
        }
        on_chunk.send(String::from_utf8_lossy(&chunk).into_owned()).map_err(|e| e.to_string())?;
    }
    if let Ok(mut c) = CANCELLED.lock() {
        c.retain(|x| x != &id);
    }
    Ok(())
}

#[tauri::command]
fn ollama_cancel(id: String) {
    if let Ok(mut c) = CANCELLED.lock() {
        c.push(id);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            marginal_papers,
            marginal_file,
            rooznegar_data,
            habitwall_today,
            find_apps,
            launch_app,
            windows_wallpaper,
            ollama_get,
            ollama_stream,
            ollama_cancel
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vision OS");
}
