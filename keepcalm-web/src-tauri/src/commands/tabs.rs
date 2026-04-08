use tauri::{AppHandle, Manager, WebviewBuilder, WebviewUrl, Emitter, State};
use tauri::webview::DownloadEvent;
use crate::privacy::request_filter::{RequestFilter, RequestDecision};
use crate::network::detector::NetworkDetector;
use std::sync::{Arc, RwLock};

#[tauri::command]
pub async fn create_tab_webview(
    app: AppHandle,
    window: tauri::Window,
    id: String,
    url: String,
    _partition: String,
    detector: State<'_, Arc<NetworkDetector>>,
    filter_state: State<'_, Arc<RwLock<RequestFilter>>>,
    traffic_state: State<'_, crate::traffic::TrafficState>,
) -> Result<(), String> {
    println!("[KeepCalm] Comando Rust: Criando aba {} -> {}", id, url);

    let _ = app.emit("webview-request-create", id.clone());
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

    println!("[KeepCalm] Debug {}: obtendo filter_state", id);
    let filter = Arc::clone(&filter_state);
    let traffic_arc = traffic_state.inner().0.clone();

    const TRAFFIC_INTERCEPTOR: &str = include_str!("../../../src/utils/interceptor.js");

    println!("[KeepCalm] Debug {}: criando builder", id);
    let mut webview_builder = WebviewBuilder::new(&id, webview_url)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .initialization_script(TRAFFIC_INTERCEPTOR)
        .initialization_script(&anti_fingerprint_script);

    // Injeção de bloqueadores cosméticos
    if url.contains("youtube.com") || url.contains("youtu.be") {
        webview_builder = webview_builder.initialization_script(crate::privacy::youtube::get_youtube_adblock_script());
    }

    let mut webview_builder = webview_builder.incognito(true);

    println!("[KeepCalm] Debug {}: solicitando proxy", id);
    // Tenta obter proxy com timeout para não bloquear a criação da aba
    let proxy_url = tokio::time::timeout(
        std::time::Duration::from_millis(500),
        detector.get_active_proxy()
    ).await.unwrap_or(None);

    println!("[KeepCalm] Debug {}: proxy resolvido", id);
    if let Some(proxy_url_str) = proxy_url {
        if let Ok(proxy_url) = proxy_url_str.parse() {
            webview_builder = webview_builder.proxy_url(proxy_url);
        }
    }

    // Interceptação Nativa (Fase 2): Filtro e Captura
    let app_for_capture = app.clone();
    let webview_builder = webview_builder.on_web_resource_request(move |request, response| {
        let uri = request.uri().to_string();
        
        // Bloqueio
        if let Ok(filter_guard) = filter.read() {
            if let RequestDecision::Block = (*filter_guard).decide(&uri, "", "other") {
                *response.status_mut() = tauri::http::StatusCode::FORBIDDEN;
                return;
            }
        }

        // Captura Nativa (Capturamos metadados e headers no Rust)
        if !uri.starts_with("tauri://") && !uri.starts_with("ipc:") {
            let req_headers: Vec<(String, String)> = request.headers().iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect();

            let res_headers: Vec<(String, String)> = response.headers().iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect();

            let http_req = crate::traffic::models::HttpRequest {
                method: request.method().to_string(),
                url: uri,
                headers: req_headers,
                body: crate::traffic::models::BodyContent::Empty, // Nativo não captura corpo POST facilmente sem ler stream
            };

            let http_res = crate::traffic::models::HttpResponse {
                status: response.status().as_u16(),
                headers: res_headers,
                body: crate::traffic::models::BodyContent::Empty,
            };

            let tx_id = uuid::Uuid::new_v4().to_string();
            let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

            let tx = crate::traffic::models::HttpTransaction {
                id: tx_id,
                hash: String::new(),
                request: http_req,
                response: Some(http_res),
                timestamp,
                size: 0,
                truncated: false,
                tags: vec!["native".to_string()],
            };

            if let Ok(mut store) = traffic_arc.write() {
                store.add(tx);
                let _ = app_for_capture.emit("traffic-updated", ());
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
            match event {
                DownloadEvent::Requested { url, destination } => {
                    let download_id = url.to_string();
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

    println!("[KeepCalm] Comando Rust: Webview builder configurado. Iniciando add_child para {}", id);
    let result = window.add_child(
        webview_builder,
        tauri::LogicalPosition::new(0.0, 0.0),
        tauri::LogicalSize::new(0.0, 0.0),
    );

    match result {
        Ok(_) => {
            println!("[KeepCalm] Comando Rust: Webview {} criada com sucesso como child de main.", id);
        }
        Err(e) => {
            let err_msg = format!("Falha ao criar Webview: {}", e);
            eprintln!("[KeepCalm] Comando Rust: {}", err_msg);
            return Err(err_msg);
        }
    }

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
    println!("[KeepCalm] Comando Rust: Atualizando URL da aba {} para {}", id, url);

    match app_handle.get_webview(&id) {
        Some(webview) => {
            println!("[KeepCalm] Comando Rust: Webview {} encontrado. Navegando...", id);
            let webview_url = resolve_external_url(&url)?;
            webview.navigate(webview_url).map_err(|e| e.to_string())?;
            let _ = app_handle.emit("webview-load-started", id);
        }
        None => {
            eprintln!("[KeepCalm] ERRO Rust: Tentou navegar em uma URL mas o Webview {} NAO existe ou foi perdido!", id);
        }
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
