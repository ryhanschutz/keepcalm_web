use crate::network::detector::NetworkDetector;
use crate::privacy::request_filter::{RequestDecision, RequestFilter};
use crate::privacy::PrivacyTelemetry;
use crate::traffic::models::{BodyContent, HttpRequest, HttpResponse, HttpTransaction};
use crate::traffic::{record_transaction, TrafficState};
use std::sync::{Arc, RwLock};
use tauri::webview::DownloadEvent;
use tauri::{AppHandle, Emitter, Manager, State, WebviewBuilder, WebviewUrl};

#[tauri::command]
pub async fn create_tab_webview(
    app: AppHandle,
    window: tauri::Window,
    id: String,
    url: String,
    _partition: String,
    detector: State<'_, Arc<NetworkDetector>>,
    filter_state: State<'_, Arc<RwLock<RequestFilter>>>,
    privacy_telemetry: State<'_, Arc<PrivacyTelemetry>>,
    traffic_state: State<'_, TrafficState>,
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

    let filter = Arc::clone(&filter_state);
    let traffic_store = traffic_state.inner().0.clone();
    let privacy = Arc::clone(&privacy_telemetry);
    const TRAFFIC_INTERCEPTOR: &str = include_str!("../../../src/utils/interceptor.js");

    let mut webview_builder = WebviewBuilder::new(&id, webview_url)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .initialization_script(TRAFFIC_INTERCEPTOR)
        .initialization_script(&anti_fingerprint_script);

    if url.contains("youtube.com") || url.contains("youtu.be") {
        webview_builder =
            webview_builder.initialization_script(crate::privacy::youtube::get_youtube_adblock_script());
    }

    let mut webview_builder = webview_builder.incognito(true);

    let proxy_url = tokio::time::timeout(
        std::time::Duration::from_millis(500),
        detector.get_active_proxy(),
    )
    .await
    .unwrap_or(None);

    if let Some(proxy_url_str) = proxy_url {
        if let Ok(proxy_url) = proxy_url_str.parse() {
            webview_builder = webview_builder.proxy_url(proxy_url);
        }
    }

    let app_for_capture = app.clone();
    let app_for_privacy = app.clone();
    let webview_builder = webview_builder.on_web_resource_request(move |request, response| {
        let uri = request.uri().to_string();
        if !should_capture_resource(&uri) {
            return;
        }

        let req_headers: Vec<(String, String)> = request
            .headers()
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_str().unwrap_or("").to_string()))
            .collect();

        let decision = filter
            .read()
            .ok()
            .map(|guard| (*guard).decide(&uri, "", "other"))
            .unwrap_or(RequestDecision::Allow);

        if let RequestDecision::Block = decision {
            *response.status_mut() = tauri::http::StatusCode::FORBIDDEN;

            let transaction = HttpTransaction {
                id: uuid::Uuid::new_v4().to_string(),
                hash: String::new(),
                request: HttpRequest {
                    method: request.method().to_string(),
                    url: uri.clone(),
                    headers: req_headers,
                    body: BodyContent::Empty,
                },
                response: Some(HttpResponse {
                    status: tauri::http::StatusCode::FORBIDDEN.as_u16(),
                    headers: Vec::new(),
                    body: BodyContent::Empty,
                }),
                timestamp: now_unix_ms(),
                size: 0,
                truncated: false,
                tags: vec!["blocked".to_string(), "native".to_string()],
            };
            record_transaction(&traffic_store, &app_for_capture, transaction);

            let blocked_url = uri;
            let blocked_app = app_for_privacy.clone();
            let privacy = Arc::clone(&privacy);
            tauri::async_runtime::spawn(async move {
                privacy.record_blocked_request(&blocked_url, false).await;
                let stats = privacy.get_stats().await;
                let _ = blocked_app.emit("privacy-stats-updated", stats);
            });
            return;
        }

        let transaction = HttpTransaction {
            id: uuid::Uuid::new_v4().to_string(),
            hash: String::new(),
            request: HttpRequest {
                method: request.method().to_string(),
                url: uri,
                headers: req_headers,
                body: BodyContent::Empty,
            },
            response: None,
            timestamp: now_unix_ms(),
            size: 0,
            truncated: false,
            tags: vec!["metadata".to_string(), "native".to_string()],
        };
        record_transaction(&traffic_store, &app_for_capture, transaction);
    });

    let webview_builder = webview_builder
        .on_navigation(move |url| {
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
        .on_download(move |_webview, event| match event {
            DownloadEvent::Requested { url, destination } => {
                let download_id = url.to_string();
                let filename = destination
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_else(|| "download".to_string());
                let _ = download_app.emit(
                    "download-started",
                    serde_json::json!({
                        "id": download_id,
                        "filename": filename,
                        "path": destination.to_string_lossy(),
                    }),
                );
                true
            }
            DownloadEvent::Finished { url, path, success } => {
                let _ = download_app.emit(
                    "download-finished",
                    serde_json::json!({
                        "id": url.to_string(),
                        "path": path.map(|value| value.to_string_lossy().to_string()),
                        "success": success,
                    }),
                );
                true
            }
            _ => true,
        });

    let result = window.add_child(
        webview_builder,
        tauri::LogicalPosition::new(0.0, 0.0),
        tauri::LogicalSize::new(0.0, 0.0),
    );

    match result {
        Ok(_) => {
            println!(
                "[KeepCalm] Comando Rust: Webview {} criada com sucesso como child de main.",
                id
            );
        }
        Err(error) => {
            let err_msg = format!("Falha ao criar Webview: {}", error);
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
            let webview_url = resolve_external_url(&url)?;
            webview.navigate(webview_url).map_err(|e| e.to_string())?;
            let _ = app_handle.emit("webview-load-started", id);
        }
        None => {
            eprintln!(
                "[KeepCalm] ERRO Rust: Tentou navegar em uma URL mas o Webview {} nao existe!",
                id
            );
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

fn should_capture_resource(uri: &str) -> bool {
    !(uri.starts_with("tauri://")
        || uri.starts_with("ipc:")
        || uri.starts_with("data:")
        || uri.starts_with("blob:")
        || uri.starts_with("about:")
        || uri.starts_with("keepcalm://"))
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default()
}
