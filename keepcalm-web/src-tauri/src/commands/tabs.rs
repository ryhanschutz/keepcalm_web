use tauri::{AppHandle, Manager, WebviewBuilder, WebviewUrl, Emitter, State};
use tauri::webview::DownloadEvent;
use crate::privacy::request_filter::{RequestFilter, RequestDecision};
use crate::network::detector::NetworkDetector;
use std::sync::{Arc, RwLock};

#[tauri::command]
pub async fn create_tab_webview(
    app: AppHandle,
    id: String,
    url: String,
    _partition: String,
    detector: State<'_, Arc<NetworkDetector>>,
    filter_state: State<'_, Arc<RwLock<RequestFilter>>>,
) -> Result<(), String> {
    println!("[KeepCalm] Comando Rust: Criando aba {} -> {}", id, url);
    let window = app
        .get_webview_window("main")
        .ok_or("Janela principal nao encontrada")?;

    let webview_url = resolve_webview_url(&url);
    let anti_fingerprint_script = crate::privacy::fingerprint::generate_override_script(&id);
    
    let id_clone = id.clone();
    let app_handle = app.clone();
    let title_event_app = app.clone();
    let title_event_id = id.clone();
    let start_event_app = app.clone();
    let start_event_id = id.clone();
    let finish_event_app = app.clone();
    let finish_event_id = id.clone();
    let download_app = app.clone();

    // Capturar o filtro global para interceptação
    let filter = Arc::clone(&filter_state);

    let mut webview_builder = WebviewBuilder::new(&id, webview_url)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .initialization_script(&anti_fingerprint_script)
        .incognito(true);

    if let Some(proxy_url_str) = detector.get_active_proxy().await {
        if let Ok(proxy_url) = proxy_url_str.parse() {
            webview_builder = webview_builder.proxy_url(proxy_url);
        }
    }

    // Interceptação Nativa (Fase 2): Filtro de Recursos (Scripts, Imagens, etc.)
    let webview_builder = webview_builder.on_web_resource_request(move |request, response| {
        let uri = request.uri().to_string();
        
        if let Ok(filter_guard) = filter.read() {
            // Deref explícito para evitar confusão de métodos do Guard
            if let RequestDecision::Block = (*filter_guard).decide(&uri, "", "other") {
                println!("[KeepCalm] Bloqueando recurso invasivo: {}", uri);
                *response.status_mut() = tauri::http::StatusCode::FORBIDDEN;
            }
        }
    });

    let webview_builder = webview_builder
        .on_navigation(move |url| {
            // Notificar frontend sobre mudança de URL utilizando o trait Emitter
            let _ = app_handle.emit("webview-url-change", (id_clone.clone(), url.to_string()));
            let _ = start_event_app.emit("webview-load-started", start_event_id.clone());
            true
        })
        .on_document_title_changed(move |_webview, title| {
            let _ = title_event_app.emit("webview-title-change", (title_event_id.clone(), title));
        })
        .on_page_load(move |_webview, payload| {
            let _ = finish_event_app.emit(
                "webview-load-finished",
                (finish_event_id.clone(), payload.url().to_string()),
            );
        })
        .on_download(move |_webview, event| {
            let mut download_id = String::new();
            match event {
                DownloadEvent::Requested { url, destination } => {
                    download_id = url.to_string();
                    let filename = destination.file_name().map(|n: &std::ffi::OsStr| n.to_string_lossy().to_string()).unwrap_or_else(|| "download".to_string());
                    let _ = download_app.emit("download-started", serde_json::json!({
                        "id": download_id.clone(), 
                        "filename": filename,
                        "path": destination.to_string_lossy(),
                    }));
                    true 
                },
                DownloadEvent::Finished { .. } => {
                    let _ = download_app.emit("download-finished", serde_json::json!({ "status": "ok" }));
                    true
                },
                _ => true
            }
        });

    let parent_window = window.as_ref().window();
    parent_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::LogicalSize::new(0.0, 0.0),
        )
        .map_err(|e| format!("Falha ao criar Webview: {}", e))?;

    let _ = app.emit("webview-load-started", id);

    Ok(())
}

#[tauri::command]
pub async fn reposition_webview(
    app_handle: AppHandle,
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app_handle.get_webview(&id) {
        webview
            .set_bounds(tauri::Rect {
                position: tauri::PhysicalPosition {
                    x: x as i32,
                    y: y as i32,
                }
                .into(),
                size: tauri::PhysicalSize {
                    width: width.max(1.0) as u32,
                    height: height.max(1.0) as u32,
                }
                .into(),
            })
            .map_err(|e| e.to_string())?;

        if width > 1.0 && height > 1.0 {
            webview.set_focus().ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn update_webview_url(
    app_handle: AppHandle,
    id: String,
    url: String,
) -> Result<(), String> {
    if let Some(webview) = app_handle.get_webview(&id) {
        let webview_url = resolve_external_url(&url)?;
        webview.navigate(webview_url).map_err(|e| e.to_string())?;
        let _ = app_handle.emit("webview-load-started", id);
    }

    Ok(())
}

#[tauri::command]
pub async fn go_back_webview(app_handle: AppHandle, id: String) -> Result<(), String> {
    run_history_script(&app_handle, &id, "window.history.back();")
}

#[tauri::command]
pub async fn go_forward_webview(app_handle: AppHandle, id: String) -> Result<(), String> {
    run_history_script(&app_handle, &id, "window.history.forward();")
}

#[tauri::command]
pub async fn reload_webview(app_handle: AppHandle, id: String) -> Result<(), String> {
    run_history_script(&app_handle, &id, "window.location.reload();")
}

#[tauri::command]
pub async fn close_webview(app_handle: AppHandle, id: String) -> Result<(), String> {
    println!("[KeepCalm] Comando Rust: Fechando aba {}", id);
    if let Some(webview) = app_handle.get_webview(&id) {
        webview.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn run_history_script(app_handle: &AppHandle, id: &str, script: &str) -> Result<(), String> {
    if let Some(webview) = app_handle.get_webview(id) {
        let _ = app_handle.emit("webview-load-started", id.to_string());
        webview.eval(script).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn resolve_webview_url(url: &str) -> WebviewUrl {
    match resolve_external_url(url) {
        Ok(value) => WebviewUrl::External(value),
        Err(_) => WebviewUrl::External("https://duckduckgo.com/".parse().unwrap()),
    }
}

fn resolve_external_url(url: &str) -> Result<url::Url, String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        url.parse().map_err(|e| format!("URL invalida: {}", e))
    } else {
        format!("https://{}", url)
            .parse()
            .map_err(|e| format!("URL invalida: {}", e))
    }
}
