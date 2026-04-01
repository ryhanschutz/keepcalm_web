use crate::network::detector::NetworkDetector;
use crate::privacy::request_filter::RequestDecision;
use crate::privacy::PrivacyTelemetry;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WebviewBuilder, WebviewUrl};

#[tauri::command]
pub async fn create_tab_webview(
    app: AppHandle,
    id: String,
    url: String,
    _partition: String,
    detector: State<'_, Arc<NetworkDetector>>,
    telemetry: State<'_, Arc<PrivacyTelemetry>>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Janela principal nao encontrada")?;

    let webview_url = resolve_webview_url(&url);
    let anti_fingerprint_script = crate::privacy::fingerprint::generate_override_script(&id);
    let filter = crate::privacy::request_filter::RequestFilter::new();

    let url_event_app = app.clone();
    let url_event_id = id.clone();
    let title_event_app = app.clone();
    let title_event_id = id.clone();
    let start_event_app = app.clone();
    let start_event_id = id.clone();
    let finish_event_app = app.clone();
    let finish_event_id = id.clone();
    let blocked_event_app = app.clone();
    let blocked_telemetry = telemetry.inner().clone();

    let mut webview_builder = WebviewBuilder::new(&id, webview_url)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .initialization_script(&anti_fingerprint_script)
        .incognito(true);

    if let Some(proxy_url_str) = detector.get_active_proxy().await {
        if let Ok(proxy_url) = proxy_url_str.parse() {
            webview_builder = webview_builder.proxy_url(proxy_url);
        }
    }

    let webview_builder = webview_builder
        .on_navigation(move |url| {
            if let RequestDecision::Block = filter.decide(url.as_str()) {
                let blocked_url = url.to_string();
                println!("[KeepCalm] Blocking unsafe navigation: {}", blocked_url);

                let telemetry_for_task = blocked_telemetry.clone();
                let app_for_task = blocked_event_app.clone();

                tauri::async_runtime::spawn(async move {
                    telemetry_for_task
                        .record_blocked_request(&blocked_url, true)
                        .await;

                    let stats = telemetry_for_task.get_stats().await;
                    app_for_task.emit("privacy-stats-updated", stats).ok();
                });

                return false;
            }

            start_event_app
                .emit("webview-load-started", start_event_id.clone())
                .ok();
            url_event_app
                .emit("webview-url-change", (url_event_id.clone(), url.to_string()))
                .ok();

            true
        })
        .on_document_title_changed(move |_webview, title| {
            title_event_app
                .emit("webview-title-change", (title_event_id.clone(), title))
                .ok();
        })
        .on_page_load(move |_webview, payload| {
            finish_event_app
                .emit(
                    "webview-load-finished",
                    (finish_event_id.clone(), payload.url().to_string()),
                )
                .ok();
        });

    let parent_window = window.as_ref().window();
    parent_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::LogicalSize::new(0.0, 0.0),
        )
        .map_err(|e| format!("Falha ao criar Webview: {}", e))?;

    app.emit("webview-load-started", id).ok();

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
        app_handle.emit("webview-load-started", id).ok();
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
    if let Some(webview) = app_handle.get_webview(&id) {
        webview.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn run_history_script(app_handle: &AppHandle, id: &str, script: &str) -> Result<(), String> {
    if let Some(webview) = app_handle.get_webview(id) {
        app_handle.emit("webview-load-started", id.to_string()).ok();
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
