pub mod models;

use crate::traffic::models::{BodyContent, HttpRequest, HttpResponse, HttpTransaction};
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, VecDeque};
use std::hash::{Hash, Hasher};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

pub const MAX_REQUESTS: usize = 400;
const MAX_URL_LENGTH: usize = 4096;
const MAX_HEADER_VALUE_LENGTH: usize = 2048;
const MAX_BODY_PREVIEW_LENGTH: usize = 16384;

pub struct RequestStore {
    pub transactions: VecDeque<HttpTransaction>,
    pending_responses: HashMap<String, HttpResponse>,
}

impl RequestStore {
    pub fn new() -> Self {
        Self {
            transactions: VecDeque::with_capacity(MAX_REQUESTS),
            pending_responses: HashMap::new(),
        }
    }

    pub fn add(&mut self, mut tx: HttpTransaction) -> HttpTransaction {
        if let Some(response) = self.pending_responses.remove(&tx.id) {
            tx.response = Some(response);
        }
        self.prepare_transaction(&mut tx);

        if self.transactions.len() >= MAX_REQUESTS {
            self.transactions.pop_front();
        }

        self.transactions.push_back(tx.clone());
        tx
    }

    pub fn update_response(&mut self, id: &str, response: HttpResponse) -> Option<HttpTransaction> {
        if let Some(tx) = self.transactions.iter_mut().find(|transaction| transaction.id == id) {
            let mut truncated = tx.truncated;
            tx.response = Some(Self::prepare_response(response, &mut truncated));
            tx.truncated = truncated;
            tx.size = estimate_size(tx);
            Self::tag_response(tx);
            tx.tags.sort();
            tx.tags.dedup();
            return Some(tx.clone());
        }

        self.pending_responses.insert(id.to_string(), response);
        None
    }

    fn prepare_transaction(&self, tx: &mut HttpTransaction) {
        tx.request.url = truncate(&tx.request.url, MAX_URL_LENGTH);
        tx.request.headers = sanitize_headers(&tx.request.headers);
        tx.request.body = sanitize_body(tx.request.body.clone(), &mut tx.truncated);

        if tx.request.url.contains("/api") {
            tx.tags.push("api".to_string());
        }
        if tx
            .request
            .headers
            .iter()
            .any(|(key, _)| key == "authorization" || key == "cookie")
        {
            tx.tags.push("auth".to_string());
        }
        if tx
            .request
            .headers
            .iter()
            .any(|(key, value)| key == "content-type" && value.contains("application/json"))
        {
            tx.tags.push("json".to_string());
        }

        if let Some(response) = tx.response.take() {
            tx.response = Some(Self::prepare_response(response, &mut tx.truncated));
            Self::tag_response(tx);
        }

        tx.size = estimate_size(tx);

        let mut hasher = DefaultHasher::new();
        tx.request.method.hash(&mut hasher);
        tx.request.url.hash(&mut hasher);
        match &tx.request.body {
            BodyContent::Text(text) => text.hash(&mut hasher),
            BodyContent::Base64(data) => data.hash(&mut hasher),
            BodyContent::Empty => {}
        }
        tx.hash = format!("{:x}", hasher.finish());

        tx.tags.sort();
        tx.tags.dedup();
    }

    fn prepare_response(mut response: HttpResponse, truncated: &mut bool) -> HttpResponse {
        response.headers = sanitize_headers(&response.headers);
        response.body = sanitize_body(response.body, truncated);
        response
    }

    fn tag_response(tx: &mut HttpTransaction) {
        if let Some(ref response) = tx.response {
            if response.status >= 400 {
                tx.tags.push("error".to_string());
            } else if response.status >= 300 {
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
    id: String,
    request: HttpRequest,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let transaction = HttpTransaction {
        id,
        hash: String::new(),
        request,
        response: None,
        timestamp: now_unix_ms(),
        size: 0,
        truncated: false,
        tags: tags.unwrap_or_default(),
    };

    if let Ok(mut store) = state.0.write() {
        let transaction = store.add(transaction);
        let _ = app.emit("traffic-upserted", transaction);
    }

    Ok(())
}

#[tauri::command]
pub async fn capture_response(
    state: tauri::State<'_, TrafficState>,
    app: AppHandle,
    id: String,
    response: HttpResponse,
) -> Result<(), String> {
    if let Ok(mut store) = state.0.write() {
        if let Some(transaction) = store.update_response(&id, response) {
            let _ = app.emit("traffic-upserted", transaction);
        }
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
        store.pending_responses.clear();
        let _ = app.emit("traffic-cleared", ());
    }

    Ok(())
}

pub fn record_transaction(
    state: &Arc<RwLock<RequestStore>>,
    app: &AppHandle,
    transaction: HttpTransaction,
) {
    if let Ok(mut store) = state.write() {
        let transaction = store.add(transaction);
        let _ = app.emit("traffic-upserted", transaction);
    }
}

fn sanitize_headers(headers: &[(String, String)]) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(key, value)| (key.to_lowercase(), truncate(value, MAX_HEADER_VALUE_LENGTH)))
        .collect()
}

fn sanitize_body(body: BodyContent, truncated: &mut bool) -> BodyContent {
    match body {
        BodyContent::Text(text) => {
            if text.chars().count() > MAX_BODY_PREVIEW_LENGTH {
                *truncated = true;
            }
            let sanitized = truncate(&text, MAX_BODY_PREVIEW_LENGTH);
            BodyContent::Text(sanitized)
        }
        BodyContent::Base64(data) => {
            if data.chars().count() > MAX_BODY_PREVIEW_LENGTH {
                *truncated = true;
            }
            let sanitized = truncate(&data, MAX_BODY_PREVIEW_LENGTH);
            BodyContent::Base64(sanitized)
        }
        BodyContent::Empty => BodyContent::Empty,
    }
}

fn estimate_size(tx: &HttpTransaction) -> usize {
    let request_headers = tx
        .request
        .headers
        .iter()
        .map(|(key, value)| key.len() + value.len())
        .sum::<usize>();
    let request_body = body_len(&tx.request.body);
    let response_headers = tx
        .response
        .as_ref()
        .map(|response| {
            response
                .headers
                .iter()
                .map(|(key, value)| key.len() + value.len())
                .sum::<usize>()
        })
        .unwrap_or_default();
    let response_body = tx
        .response
        .as_ref()
        .map(|response| body_len(&response.body))
        .unwrap_or_default();

    tx.request.method.len()
        + tx.request.url.len()
        + request_headers
        + request_body
        + response_headers
        + response_body
}

fn body_len(body: &BodyContent) -> usize {
    match body {
        BodyContent::Text(text) => text.len(),
        BodyContent::Base64(data) => data.len(),
        BodyContent::Empty => 0,
    }
}

fn truncate(value: &str, max_len: usize) -> String {
    let mut iter = value.chars();
    let truncated = iter.by_ref().take(max_len).collect::<String>();
    if iter.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default()
}
