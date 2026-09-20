use std::sync::Mutex;
use tauri::{Manager, AppHandle, Emitter};

struct BackendChild(Mutex<Option<u32>>);
struct BackendPort(Mutex<u16>);

#[tauri::command]
fn get_api_port(state: tauri::State<'_, BackendPort>) -> u16 {
    let port = *state.0.lock().unwrap();
    if port > 0 {
        return port;
    }
    // Fallback: read port.info written by launcher.py
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let path = std::path::PathBuf::from(local_app_data)
            .join("PMS-Data")
            .join("port.info");
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(p) = content.trim().parse::<u16>() {
                *state.0.lock().unwrap() = p;
                return p;
            }
        }
    }
    0
}

fn emit_port_to_webview(handle: &AppHandle, port: u16) {
    // Emit the event. If the webview listener is not yet registered, the
    // get_api_port poll (running every 100ms) will catch it from state.
    let _ = handle.emit("backend-ready", port);
    // Also inject directly into the window JS context as a belt-and-suspenders
    // mechanism so the frontend does not depend solely on event delivery timing.
    if let Some(window) = handle.get_webview_window("main") {
        let js = format!(
            "window.__PMS_API_PORT__={};\
             if(window.__PmsPortResolvers){{window.__PmsPortResolvers.forEach(function(r){{r({});}});window.__PmsPortResolvers=[];}}",
            port, port
        );
        let _ = window.eval(&js);
    }
}

fn spawn_backend(app: &AppHandle) {
    // Remove stale port.info from a previous run.
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let path = std::path::PathBuf::from(&local_app_data)
            .join("PMS-Data")
            .join("port.info");
        let _ = std::fs::remove_file(&path);
    }

    // Locate backend EXE in Tauri resource directory.
    let resource_dir = match app.path().resource_dir() {
        Ok(d) => d,
        Err(e) => {
            log::error!("[PMS] resource_dir() failed: {}", e);
            let _ = app.emit("backend-error", format!("Cannot locate resources: {}", e));
            return;
        }
    };

    let backend_exe = resource_dir
        .join("pms-backend")
        .join("pms-backend-x86_64-pc-windows-msvc.exe");

    log::info!("[PMS] Backend exe: {:?}", backend_exe);

    if !backend_exe.exists() {
        log::error!("[PMS] Backend executable not found: {:?}", backend_exe);
        let _ = app.emit("backend-error",
            format!("Backend not found: {}", backend_exe.display()));
        return;
    }

    let mut cmd = std::process::Command::new(&backend_exe);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            log::error!("[PMS] Failed to spawn backend: {}", e);
            let _ = app.emit("backend-error", format!("Failed to start: {}", e));
            return;
        }
    };

    let pid = child.id();
    log::info!("[PMS] Backend spawned PID={}", pid);

    if let Some(state) = app.try_state::<BackendChild>() {
        *state.0.lock().unwrap() = Some(pid);
    }

    // stderr reader — log only, does not block port detection.
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            for line in BufReader::new(stderr).lines().flatten() {
                log::warn!("[Backend stderr] {}", line);
            }
        });
    }

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            log::error!("[PMS] stdout pipe unavailable");
            let _ = app.emit("backend-error", "Internal: stdout pipe unavailable");
            return;
        }
    };

    // Background thread: read stdout line-by-line for PMS_PORT: announcement.
    let handle = app.clone();
    std::thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        let reader = BufReader::new(stdout);
        let mut port_found = false;

        for line in reader.lines() {
            match line {
                Ok(ref text) => {
                    log::info!("[Backend stdout] {}", text);
                    if !port_found {
                        if let Some(idx) = text.find("PMS_PORT:") {
                            let rest = &text[idx + "PMS_PORT:".len()..];
                            let port_str: String = rest
                                .chars()
                                .take_while(|c| c.is_ascii_digit())
                                .collect();
                            if let Ok(port) = port_str.parse::<u16>() {
                                log::info!("[PMS] Backend ready on port {}", port);
                                if let Some(state) = handle.try_state::<BackendPort>() {
                                    *state.0.lock().unwrap() = port;
                                }
                                emit_port_to_webview(&handle, port);
                                port_found = true;
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("[PMS] stdout read error: {}", e);
                    break;
                }
            }
        }

        // Fallback: stdout closed without port — poll port.info for up to 60 s.
        if !port_found {
            log::warn!("[PMS] Stdout closed without port — polling port.info (max 60 s)");
            for attempt in 0..120u8 {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                    let path = std::path::PathBuf::from(&local_app_data)
                        .join("PMS-Data")
                        .join("port.info");
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(port) = content.trim().parse::<u16>() {
                            log::info!("[PMS] Port from port.info: {} (attempt {})", port, attempt + 1);
                            if let Some(state) = handle.try_state::<BackendPort>() {
                                *state.0.lock().unwrap() = port;
                            }
                            emit_port_to_webview(&handle, port);
                            return;
                        }
                    }
                }
            }
            log::error!("[PMS] Backend failed to announce port within 60 s");
            let _ = handle.emit("backend-error",
                "Backend failed to start. Run pms-backend-x86_64-pc-windows-msvc.exe manually to see the error.");
        }
    });

    // Reap the child process.
    std::thread::spawn(move || {
        match child.wait() {
            Ok(status) => log::warn!("[PMS] Backend exited: {}", status),
            Err(e) => log::error!("[PMS] Backend wait error: {}", e),
        }
    });
}

fn kill_backend(app: &AppHandle) {
    if let Some(state) = app.try_state::<BackendChild>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(pid) = guard.take() {
                log::info!("[PMS] Killing backend PID={}", pid);
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .creation_flags(0x08000000)
                        .status();
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            app.manage(BackendPort(Mutex::new(0u16)));
            app.manage(BackendChild(Mutex::new(None)));
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