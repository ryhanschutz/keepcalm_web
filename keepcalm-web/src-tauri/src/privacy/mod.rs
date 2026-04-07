use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

pub mod fingerprint;
pub mod request_filter;
pub mod youtube;

pub struct PrivacyManager {
    pub filter: request_filter::RequestFilter,
}

impl PrivacyManager {
    pub fn new() -> Self {
        Self {
            filter: request_filter::RequestFilter::new(),
        }
    }

    pub fn get_fingerprint_script(&self, session_uuid: &str) -> String {
        fingerprint::generate_override_script(session_uuid)
    }

    pub fn decide_request(&self, url: &str) -> request_filter::RequestDecision {
        self.filter.decide(url, "", "other")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyStats {
    pub blocked_requests: u64,
    pub blocked_top_level_navigations: u64,
    pub last_blocked_url: Option<String>,
    pub updated_at_unix_ms: u64,
}

impl Default for PrivacyStats {
    fn default() -> Self {
        Self {
            blocked_requests: 0,
            blocked_top_level_navigations: 0,
            last_blocked_url: None,
            updated_at_unix_ms: now_unix_ms(),
        }
    }
}

pub struct PrivacyTelemetry {
    stats: RwLock<PrivacyStats>,
}

impl PrivacyTelemetry {
    pub fn new() -> Self {
        Self {
            stats: RwLock::new(PrivacyStats::default()),
        }
    }

    pub async fn get_stats(&self) -> PrivacyStats {
        self.stats.read().await.clone()
    }

    pub async fn clear(&self) -> PrivacyStats {
        let mut guard = self.stats.write().await;
        *guard = PrivacyStats::default();
        guard.clone()
    }

    pub async fn record_blocked_request(&self, url: &str, top_level_navigation: bool) {
        let mut guard = self.stats.write().await;
        guard.blocked_requests += 1;
        if top_level_navigation {
            guard.blocked_top_level_navigations += 1;
        }
        guard.last_blocked_url = Some(url.to_string());
        guard.updated_at_unix_ms = now_unix_ms();
    }
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or_default()
}
