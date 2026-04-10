use crate::network::detector::NetworkDetector;
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn run_security_tool(
    app: AppHandle,
    tool_name: String,
    args: Vec<String>,
    detector: State<'_, Arc<NetworkDetector>>,
) -> Result<(), String> {
    println!(
        "[KeepCalm] Executando sidecar: {} com args: {:?}",
        tool_name, args
    );

    let mut sidecar_command = app
        .shell()
        .sidecar(&tool_name)
        .map_err(|e| format!("Falha ao carregar sidecar {}: {}", tool_name, e))?
        .args(args);

    if let Some(proxy_url) = detector.get_active_proxy().await {
        sidecar_command = sidecar_command
            .env("ALL_PROXY", &proxy_url)
            .env("HTTP_PROXY", &proxy_url)
            .env("HTTPS_PROXY", &proxy_url);
    } else {
        // Avoid inheriting broken global proxy env from host process.
        sidecar_command = sidecar_command
            .env("ALL_PROXY", "")
            .env("HTTP_PROXY", "")
            .env("HTTPS_PROXY", "")
            .env("GIT_HTTP_PROXY", "")
            .env("GIT_HTTPS_PROXY", "");
    }

    let (mut rx, _child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Falha ao iniciar {}: {}", tool_name, e))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    let _ = app.emit(
                        "security-tool-output",
                        json!({
                            "tool": tool_name,
                            "type": "stdout",
                            "content": text
                        }),
                    );
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line).to_string();
                    let _ = app.emit(
                        "security-tool-output",
                        json!({
                            "tool": tool_name,
                            "type": "stderr",
                            "content": text
                        }),
                    );
                }
                CommandEvent::Terminated(payload) => {
                    let _ = app.emit(
                        "security-tool-output",
                        json!({
                            "tool": tool_name,
                            "type": "terminated",
                            "code": payload.code,
                            "signal": payload.signal
                        }),
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}
