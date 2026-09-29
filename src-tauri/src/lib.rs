// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::process::Command; // Allows rust to spawn in commands
use std::fs; // Standard file system(fs) module to read and delete files from your disk
use base64::{Engine as _, engine::general_purpose}; // Functions to encode raw binary file data into a Base64 string
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, Code, Modifiers}; // Imports shortcut objects, keys, modifier flags so that OS routes keypresses to your app
use tauri::{Manager, Emitter}; // Gives access to Tauri helper methods and Emitter trait for window.emit()
use tokio;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn capture_screen() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let temp_path = "/tmp/snip_ai_ss.png"; // Where the OS will temporarily save the screenshoted file

        let status = Command::new("screencapture")
            .args(["-i", "-x", temp_path]) // -i is the crosshair tool letting you drag and select which part to clip. -x mutes the camera shutter sound. ? return an error immediately if the command fails to execute
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Screen capture failed".to_string()); // If we decide to press Escape or cancel the screenshot, the function exits with a non-zero status code, so we abort safely without reading a non-existent file
        }

        let image_bytes = fs::read(temp_path).map_err(|e| e.to_string())?; // Reads the PNG off disk into raw bytes so it remains temporary
        let base64_image = general_purpose::STANDARD.encode(image_bytes); // Converts the bytes to Base64 string
        let _ = fs::remove_file(temp_path); // Cleans up and deletes the temporary file

        Ok(base64_image) // Gives the Base64 string back
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
            // Control (⌃) + Option (⌥) + Spacebar
            let snip_shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::ALT),
                Code::Space
            );

            // Registers Ctrl + Option + Space globally with macOS
            app.global_shortcut().register(snip_shortcut)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}