use adblock::engine::Engine;
use adblock::lists::ParseOptions;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestDecision {
    Allow,
    Block,
}

#[derive(Clone)]
pub struct RequestFilter {
    engine: Arc<Engine>,
}

impl RequestFilter {
    pub fn new() -> Self {
        Self {
            engine: Arc::new(Engine::default()),
        }
    }

    pub fn load_rules(&mut self, rules: Vec<String>) {
        let mut filter_set = adblock::lists::FilterSet::new();
        for rule in rules {
            filter_set.add_filter_line(&rule, ParseOptions::default()).ok();
        }
        // Construir o engine e substituir o Arc atual
        self.engine = Arc::new(Engine::from_filter_set(filter_set, true));
    }

    pub fn decide(&self, url: &str, source_url: &str, resource_type: &str) -> RequestDecision {
        // Engenharia de adblock costuma usar tipos específicos, mas passaremos como string por enquanto
        let blocker_result = self.engine.check_network_request(
            url,
            source_url,
            resource_type,
        );

        if blocker_result.matched {
            RequestDecision::Block
        } else {
            RequestDecision::Allow
        }
    }
}
