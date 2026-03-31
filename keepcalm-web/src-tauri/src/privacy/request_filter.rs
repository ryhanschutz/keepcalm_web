use serde::{{Deserialize, Serialize}};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestDecision {{
    Allow,
    Block,
    Modify,
}}

pub struct RequestFilter;

impl RequestFilter {{
    pub fn new() -> Self {{
        Self
    }}

    pub fn decide(&self, url: &str) -> RequestDecision {{
        // Implementar lógica de casamento com blocklist.db
        if url.contains("telemetry") || url.contains("tracker") || url.contains("ads.") {{
            return RequestDecision::Block;
        }}
        RequestDecision::Allow
    }}
}}
