pub mod commands;
pub mod network;
pub mod privacy;

use std::sync::{Arc, RwLock};
use crate::network::detector::NetworkDetector;
use crate::privacy::request_filter::RequestFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar o detector de rede
    let network_detector = Arc::new(NetworkDetector::new());
    
    // Inicializar o filtro de privacidade (adblock engine) com RwLock para leitura rápida
    let request_filter = Arc::new(RwLock::new(RequestFilter::new()));
    
    // Clonar para a tarefa de background
    let detector_clone = Arc::clone(&network_detector);
    let filter_clone = Arc::clone(&request_filter);
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(network_detector)
        .manage(request_filter)
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
            
            // Ativar proteção contra captura de tela no Windows (Anti-Capture)
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

            // Carregar regras do blocklist.db em background
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let db_path = "assets/blocklist.db"; 
                if std::path::Path::new(db_path).exists() {
                    println!("[KeepCalm] Iniciando carregamento de regras no engine...");
                    if let Ok(pool) = sqlx::SqlitePool::connect(&format!("sqlite:{}", db_path)).await {
                        if let Ok(rows) = sqlx::query_as::<_, (String,)>("SELECT pattern FROM rules").fetch_all(&pool).await {
                            let rules: Vec<String> = rows.into_iter().map(|(r,)| r).collect();
                            let count = rules.len();
                            
                            let filter_state = app_handle.state::<Arc<RwLock<RequestFilter>>>();
                            if let Ok(mut filter_guard) = filter_state.write() {
                                filter_guard.load_rules(rules);
                                println!("[KeepCalm] {} regras carregadas no motor Adblock de alto nível.", count);
                            }
                        }
                    }
                } else {
                    println!("[KeepCalm] Aviso: blocklist.db não localizado em {}. Filtro básico ativo.", db_path);
                }
            });

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
