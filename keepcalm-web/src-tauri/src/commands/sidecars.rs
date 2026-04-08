use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde_json::json;

#[tauri::command]
pub async fn run_security_tool(
    app: AppHandle,
    tool_name: String,
    args: Vec<String>,
) -> Result<(), String> {
    println!("[KeepCalm] Executando sidecar: {} com args: {:?}", tool_name, args);

    let sidecar_command = app.shell().sidecar(&tool_name)
        .map_err(|e| format!("Falha ao carregar sidecar {}: {}", tool_name, e))?
        .args(args);

    let (mut rx, _child) = sidecar_command.spawn()
        .map_err(|e| format!("Falha ao iniciar {}: {}", tool_name, e))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    let _ = app.emit("security-tool-output", json!({
                        "tool": tool_name,
                        "type": "stdout",
                        "content": text
                    }));
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    let _ = app.emit("security-tool-output", json!({
                        "tool": tool_name,
                        "type": "stderr",
                        "content": text
                    }));
                }
                CommandEvent::Terminated(payload) => {
                    let _ = app.emit("security-tool-output", json!({
                        "tool": tool_name,
                        "type": "terminated",
                        "code": payload.code,
                        "signal": payload.signal
                    }));
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}
