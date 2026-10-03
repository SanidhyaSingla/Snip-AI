// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs; // Standard file system module to read/delete temp files
use std::process::Command; // Spawns external CLI processes (screencapture)
use base64::{engine::general_purpose, Engine as _}; // Encodes raw binary images to base64
use tauri::{Emitter, Manager}; // Tauri core window management and emitting events
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut}; // Global shortcut management
use tokio; // Async runtime

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn capture_screen() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let temp_path = "/tmp/snip_ai_ss.png"; // Temporary screenshot storage path

        let status = Command::new("screencapture")
            .args(["-i", "-x", temp_path]) // -i: interactive drag region, -x: mute shutter sound
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Screen capture failed".to_string()); // User hit Escape or canceled selection
        }

        let image_bytes = fs::read(temp_path).map_err(|e| e.to_string())?; // Read image into memory
        let base64_image = general_purpose::STANDARD.encode(image_bytes); // Convert to base64 string
        let _ = fs::remove_file(temp_path); // Clean up temp file from disk

        Ok(base64_image)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("trigger_snip", {});
                        }
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, capture_screen])
        .setup(|app| {
            // Register Global Shortcut (Control + Option + Space)
            let snip_shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::ALT),
                Code::Space,
            );
            if let Err(err) = app.global_shortcut().register(snip_shortcut) {
                eprintln!("Failed to register global shortcut: {}", err);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}