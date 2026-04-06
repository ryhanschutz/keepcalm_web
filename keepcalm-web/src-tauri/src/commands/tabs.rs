use tauri::{AppHandle, Manager, WebviewBuilder, WebviewUrl, Emitter, State};
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
    let window = app.get_webview_window("main").ok_or("Janela principal não encontrada")?;
    
    let webview_url = if url == "about:blank" || url.is_empty() {
        WebviewUrl::External("about:blank".parse().unwrap())
    } else {
        match url.parse() {
            Ok(u) => WebviewUrl::External(u),
            Err(_) => {
                let search_url = format!("https://duckduckgo.com/?q={}", url);
                WebviewUrl::External(search_url.parse().unwrap())
            }
        }
    };

    let anti_fingerprint_script = crate::privacy::fingerprint::generate_override_script(&id);
    let id_clone = id.clone();
    let app_handle = app.clone();
    let title_event_app = app.clone();
    let title_event_id = id.clone();
    let load_event_app = app.clone();

    // Capturar o filtro para uso na interceptação global (Fase 2)
    let filter = Arc::clone(&filter_state);

    let mut webview_builder = WebviewBuilder::new(&id, webview_url)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .initialization_script(&anti_fingerprint_script)
        .incognito(true);

    // Aplicar Proxy se detectado pelo Smart Fallback
    if let Some(proxy_url_str) = detector.get_active_proxy().await {
        if let Ok(proxy_url) = proxy_url_str.parse() {
            webview_builder = webview_builder.proxy_url(proxy_url);
        }
    }

    // Interceptação Nativa (Fase 2): Interceptar todos os recursos (scripts, imagens, etc.)
    let webview_builder = webview_builder.on_web_resource_request(move |request, response| {
        let uri = request.uri().to_string();
        
        // Bloquear apenas recursos de terceiros ou rastreadores conhecidos
        if let Ok(filter_guard) = filter.read() {
            if let RequestDecision::Block = filter_guard.decide(&uri, "", "other") {
                println!("[KeepCalm] Bloqueando recurso invasivo: {}", uri);
                response.set_status(tauri::http::StatusCode::FORBIDDEN);
            }
        }
    });

    let webview_builder = webview_builder.on_navigation(move |url| {
            // Notificar o frontend sobre a mudança de URL principal
            app_handle.emit("webview-url-change", (id_clone.clone(), url.to_string())).ok();
            true
        })
        .on_document_title_changed(move |_webview, title| {
            title_event_app
                .emit("webview-title-change", (title_event_id.clone(), title))
                .ok();
        })
        .on_page_load(move |_webview, payload| {
            load_event_app
                .emit("webview-load-finished", payload.url().to_string())
                .ok();
        });

    let parent_window = window.as_ref().window();
    parent_window.add_child(
        webview_builder,
        tauri::LogicalPosition::new(0.0, 0.0),
        tauri::LogicalSize::new(0.0, 0.0),
    ).map_err(|e| format!("Falha ao criar Webview: {}", e))?;

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
        webview.set_bounds(tauri::Rect {
            position: tauri::PhysicalPosition {
                x: x as i32,
                y: y as i32,
            }.into(),
            size: tauri::PhysicalSize {
                width: width as u32,
                height: height as u32,
            }.into(),
        }).map_err(|e| e.to_string())?;
        
        webview.set_focus().ok();
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
        let webview_url = if url.starts_with("http") {
            url.parse().map_err(|e| format!("URL inválida: {}", e))?
        } else {
            format!("https://{}", url).parse().map_err(|e| format!("URL inválida: {}", e))?
        };
        webview.navigate(webview_url).map_err(|e| e.to_string())?;
        
        // Ativando flag de carregando no frontend
        app_handle.emit("webview-load-started", id).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn close_webview(app_handle: AppHandle, id: String) -> Result<(), String> {
    if let Some(webview) = app_handle.get_webview(&id) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
