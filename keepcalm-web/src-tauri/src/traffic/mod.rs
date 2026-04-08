pub mod models;

use std::collections::VecDeque;
use std::sync::{Arc, RwLock};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use tauri::{AppHandle, Manager, Emitter};
use crate::traffic::models::{HttpTransaction, HttpRequest, HttpResponse, BodyContent};

const MAX_REQUESTS: usize = 800;
// Removido limite MAX_BODY_SIZE por solicitação do usuário

pub struct RequestStore {
    pub transactions: VecDeque<HttpTransaction>,
}

impl RequestStore {
    pub fn new() -> Self {
        Self {
            transactions: VecDeque::with_capacity(MAX_REQUESTS),
        }
    }

    pub fn add(&mut self, mut tx: HttpTransaction) {
        // Normalização de headers e auto-tagging
        self.prepare_transaction(&mut tx);

        if self.transactions.len() >= MAX_REQUESTS {
            self.transactions.pop_front();
        }
        self.transactions.push_back(tx);
    }

    pub fn update_response(&mut self, id: &str, response: HttpResponse) {
        if let Some(tx) = self.transactions.iter_mut().find(|t| t.id == id) {
            tx.response = Some(response);
            Self::tag_response(tx);
        }
    }

    fn prepare_transaction(&self, tx: &mut HttpTransaction) {
        // Normalizar headers da request
        tx.request.headers = tx.request.headers.iter()
            .map(|(k, v)| (k.to_lowercase(), v.trim().to_string()))
            .collect();

        // Auto-tagging inicial (Request)
        if tx.request.url.contains("/api") {
            tx.tags.push("api".to_string());
        }
        if tx.request.headers.iter().any(|(k, _)| k == "authorization" || k == "cookie") {
            tx.tags.push("auth".to_string());
        }
        if tx.request.headers.iter().any(|(_, v)| v.contains("application/json")) {
            tx.tags.push("json".to_string());
        }

        // Hashing para deduplicação futura
        let mut s = DefaultHasher::new();
        tx.request.method.hash(&mut s);
        tx.request.url.hash(&mut s);
        if let BodyContent::Text(ref t) = tx.request.body {
            t.hash(&mut s);
        }
        tx.hash = format!("{:x}", s.finish());
    }

    fn tag_response(tx: &mut HttpTransaction) {
        if let Some(ref res) = tx.response {
            if res.status >= 400 {
                tx.tags.push("error".to_string());
            } else if res.status >= 300 && res.status < 400 {
                tx.tags.push("redirect".to_string());
            }
        }
    }
}

pub struct TrafficState(pub Arc<RwLock<RequestStore>>);

#[tauri::command]
pub async fn capture_request(
    state: tauri::State<'_, TrafficState>,
    app: AppHandle,
    request: HttpRequest,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let transaction = HttpTransaction {
        id: id.clone(),
        hash: String::new(),
        request,
        response: None,
        timestamp,
        size: 0, // Will be updated on response
        truncated: false,
        tags: Vec::new(),
    };

    if let Ok(mut store) = state.0.write() {
        store.add(transaction);
        let _ = app.emit("traffic-updated", ());
    }

    Ok(id)
}

#[tauri::command]
pub async fn capture_response(
    state: tauri::State<'_, TrafficState>,
    app: AppHandle,
    id: String,
    response: HttpResponse,
) -> Result<(), String> {
    if let Ok(mut store) = state.0.write() {
        store.update_response(&id, response);
        let _ = app.emit("traffic-updated", ());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_traffic_list(
    state: tauri::State<'_, TrafficState>,
) -> Result<Vec<HttpTransaction>, String> {
    if let Ok(store) = state.0.read() {
        return Ok(store.transactions.iter().cloned().collect());
    }
    Err("Failed to read traffic state".to_string())
}

#[tauri::command]
pub async fn clear_traffic(
    state: tauri::State<'_, TrafficState>,
    app: AppHandle,
) -> Result<(), String> {
    if let Ok(mut store) = state.0.write() {
        store.transactions.clear();
        let _ = app.emit("traffic-updated", ());
    }
    Ok(())
}
