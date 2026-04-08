pub mod commands;
pub mod network;
pub mod privacy;
pub mod traffic;

use std::sync::{Arc, RwLock};
use crate::network::detector::NetworkDetector;
use crate::privacy::request_filter::RequestFilter;
use crate::privacy::PrivacyTelemetry;
use crate::traffic::TrafficState;
use crate::traffic::RequestStore;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar estados globais
    let network_detector = Arc::new(NetworkDetector::new());
    let privacy_telemetry = Arc::new(PrivacyTelemetry::new());
    let traffic_state = TrafficState(Arc::new(RwLock::new(RequestStore::new())));
    
    // Filtro de privacidade (adblock engine) com RwLock para acesso concorrente rápido
    let request_filter = Arc::new(RwLock::new(RequestFilter::new()));
    
    // Clones para as tarefas de background
    let detector_clone = Arc::clone(&network_detector);
    
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(network_detector)
        .manage(request_filter)
        .manage(privacy_telemetry)
        .manage(traffic_state)
        .invoke_handler(tauri::generate_handler![
            crate::commands::network::get_network_status,
            crate::commands::network::run_network_probe,
            crate::commands::network::set_bypass_mode,
            crate::commands::privacy::get_privacy_stats,
            crate::commands::privacy::clear_privacy_stats,
            crate::commands::tabs::create_tab_webview,
            crate::commands::tabs::reposition_webview,
            crate::commands::tabs::update_webview_url,
            crate::commands::tabs::go_back_webview,
            crate::commands::tabs::go_forward_webview,
            crate::commands::tabs::reload_webview,
            crate::commands::tabs::close_webview,
            crate::commands::pip::create_pip_window,
            crate::commands::sidecars::run_security_tool,
            crate::commands::repeater::send_repeater_request,
            crate::traffic::capture_request,
            crate::traffic::capture_response,
            crate::traffic::get_traffic_list,
            crate::traffic::clear_traffic,
        ])
        .setup(|app| {
            // Ativar proteção contra captura de tela no Windows (Anti-Capture)
            #[cfg(target_os = "windows")]
            {
                use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};
                use windows::Win32::Foundation::HWND;

                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        unsafe {
                            let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as _), WDA_EXCLUDEFROMCAPTURE);
                            println!("[KeepCalm] Proteção Anti-Capture ATIVADA.");
                        }
                    }
                }
            }

            // Carregar regras do blocklist.db em segundo plano para não travar o boot
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let db_path = "assets/blocklist.db"; 
                if std::path::Path::new(db_path).exists() {
                    println!("[KeepCalm] Engine: Carregando blocklist.db...");
                    if let Ok(pool) = sqlx::SqlitePool::connect(&format!("sqlite:{}", db_path)).await {
                        if let Ok(rows) = sqlx::query_as::<_, (String,)>("SELECT pattern FROM rules").fetch_all(&pool).await {
                            let rules: Vec<String> = rows.into_iter().map(|(r,)| r).collect();
                            let count = rules.len();
                            
                            let filter_arc = app_handle.state::<Arc<RwLock<RequestFilter>>>();
                            if let Ok(mut filter_guard) = filter_arc.inner().write() {
                                filter_guard.load_rules(rules);
                                println!("[KeepCalm] Engine: {} regras integradas ao motor Aho-Corasick.", count);
                            }
                        }
                    }
                } else {
                    println!("[KeepCalm] Aviso: blocklist.db ausente em {}. Filtro básico ativo.", db_path);
                }
            });

            // Loop de detecção de rede (Tor/Proxy)
            let app_handle_main = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let _ = detector_clone.run_probe(Some(&app_handle_main)).await;
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
