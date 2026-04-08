use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::str::FromStr;

#[derive(Debug, Deserialize)]
pub struct RepeaterRequest {
    pub method: String,
    pub url: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RepeaterResponse {
    pub status: u16,
    pub headers: std::collections::HashMap<String, String>,
    pub body: String,
}

#[tauri::command]
pub async fn send_repeater_request(req: RepeaterRequest) -> Result<RepeaterResponse, String> {
    let client = reqwest::Client::new();
    
    let method = reqwest::Method::from_str(&req.method.to_uppercase())
        .map_err(|e| format!("Método inválido: {}", e))?;
        
    let mut header_map = HeaderMap::new();
    for (key, value) in req.headers {
        let name = HeaderName::from_str(&key)
            .map_err(|e| format!("Header inválido: {}", e))?;
        let val = HeaderValue::from_str(&value)
            .map_err(|e| format!("Valor de header inválido: {}", e))?;
        header_map.insert(name, val);
    }

    let mut request_builder = client.request(method, &req.url)
        .headers(header_map);

    if let Some(body) = req.body {
        request_builder = request_builder.body(body);
    }

    let response = request_builder.send()
        .await
        .map_err(|e| format!("Erro na requisição: {}", e))?;

    let status = response.status().as_u16();
    let mut resp_headers = std::collections::HashMap::new();
    for (name, value) in response.headers() {
        resp_headers.insert(
            name.to_string(),
            value.to_str().unwrap_or("").to_string()
        );
    }

    let body = response.text()
        .await
        .unwrap_or_else(|_| "[Erro ao ler corpo da resposta]".to_string());

    Ok(RepeaterResponse {
        status,
        headers: resp_headers,
        body,
    })
}
