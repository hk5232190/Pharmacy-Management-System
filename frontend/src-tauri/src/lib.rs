use std::sync::Mutex;
use tauri::{Manager, AppHandle};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};

/// Holds the sidecar child process so we can kill it on app exit.
struct BackendChild(Mutex<Option<CommandChild>>);

/// Holds the dynamically assigned backend port.
struct BackendPort(Mutex<u16>);

/// Tauri command: frontend queries the backend port.
/// Returns 0 if backend hasn't announced its port yet.
#[tauri::command]
fn get_api_port(state: tauri::State<'_, BackendPort>) -> u16 {
    *state.0.lock().unwrap()
}

/// Spawn the Python backend sidecar and listen for the port announcement.
fn spawn_backend(app: &AppHandle) {
    let sidecar_result = app
        .shell()
        .sidecar("pms-backend");

    let sidecar = match sidecar_result {
        Ok(s) => s,
        Err(e) => {
            log::error!("Failed to create backend sidecar: {}", e);
            return;
        }
    };

    let spawn_result = sidecar.spawn();
    let (mut rx, child) = match spawn_result {
        Ok(r) => r,
        Err(e) => {
            log::error!("Failed to spawn backend sidecar: {}", e);
            return;
        }
    };

    // Store the child handle for cleanup
    if let Some(state) = app.try_state::<BackendChild>() {
        *state.0.lock().unwrap() = Some(child);
    }

    let handle = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    let line = line.trim().to_string();
                    log::info!("Backend stdout: {}", line);

                    // Look for port announcement: PMS_PORT:8000
                    if line.starts_with("PMS_PORT:") {
                        if let Ok(port) = line.trim_start_matches("PMS_PORT:").trim().parse::<u16>() {
                            log::info!("Backend started on port {}", port);

                            // Store the port in state
                            if let Some(state) = handle.try_state::<BackendPort>() {
                                *state.0.lock().unwrap() = port;
                            }

                            // Inject port into the webview window
                            if let Some(window) = handle.get_webview_window("main") {
                                let js = format!("window.__PMS_API_PORT__ = {}; console.log('Backend port set to: {}');", port, port);
                                let _ = window.eval(&js);
                            }
                        }
                    }
                }
                CommandEvent::Stderr(err_bytes) => {
                    let line = String::from_utf8_lossy(&err_bytes);
                    log::warn!("Backend stderr: {}", line.trim());
                }
                CommandEvent::Terminated(status) => {
                    log::error!("Backend process terminated with code: {:?}", status.code);
                    break;
                }
                _ => {}
            }
        }
    });
}

/// Kill the backend sidecar process.
fn kill_backend(app: &AppHandle) {
    if let Some(state) = app.try_state::<BackendChild>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                log::info!("Killing backend sidecar process...");
                let _ = child.kill();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            // Initialize state
            app.manage(BackendPort(Mutex::new(0u16)));
            app.manage(BackendChild(Mutex::new(None)));

            // Spawn the Python backend sidecar
            spawn_backend(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_api_port])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                kill_backend(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Pharmacy Management System");
}
