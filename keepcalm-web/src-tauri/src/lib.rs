pub mod commands;
pub mod network;
pub mod privacy;

use std::sync::Arc;
use crate::network::detector::NetworkDetector;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar o detector de rede
    let network_detector = Arc::new(NetworkDetector::new());
    
    // Clonar para a tarefa de background
    let detector_clone = Arc::clone(&network_detector);
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(network_detector)
        .invoke_handler(tauri::generate_handler![
            crate::commands::network::get_network_status,
            crate::commands::network::run_network_probe,
            crate::commands::tabs::create_tab_webview,
            crate::commands::tabs::reposition_webview,
            crate::commands::tabs::update_webview_url,
            crate::commands::tabs::close_webview,
        ])
        .setup(|app| {
            use tauri::Manager;
            
            // Ativar proteção contra captura de tela no Windows (Anti-Veyon/Anti-Teams)
            #[cfg(target_os = "windows")]
            {
                use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};
                use windows::Win32::Foundation::HWND;

                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        unsafe {
                            let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as _), WDA_EXCLUDEFROMCAPTURE);
                            println!("[KeepCalm] Proteção Anti-Capture ATIVADA com sucesso.");
                        }
                    }
                }
            }

            // Iniciar a detecção em segundo plano
            tauri::async_runtime::spawn(async move {
                loop {
                    let _ = detector_clone.run_probe().await;
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
