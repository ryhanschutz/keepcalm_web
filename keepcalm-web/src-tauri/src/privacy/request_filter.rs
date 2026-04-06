use aho_corasick::AhoCorasick;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RequestDecision {
    Allow,
    Block,
}

#[derive(Clone)]
pub struct RequestFilter {
    matcher: Option<Arc<AhoCorasick>>,
}

impl RequestFilter {
    pub fn new() -> Self {
        Self {
            matcher: None,
        }
    }

    pub fn load_rules(&mut self, rules: Vec<String>) {
        if rules.is_empty() {
            self.matcher = None;
            return;
        }

        // Compila todas as regras em um autômato Aho-Corasick para busca instantânea
        // Filtramos regras ABP complexas que não são substrings puras para não quebrar o motor
        let clean_patterns: Vec<String> = rules.into_iter()
            .filter(|r| !r.starts_with('@') && !r.contains('$')) // Evitar regras de exceção/opção ABP
            .map(|r| r.replace("||", "").replace('^', ""))      // Normalizar para substrings
            .collect();

        if let Ok(matcher) = AhoCorasick::builder()
            .ascii_case_insensitive(true)
            .build(clean_patterns) 
        {
            self.matcher = Some(Arc::new(matcher));
        }
    }

    pub fn decide(&self, url: &str, _source_url: &str, _resource_type: &str) -> RequestDecision {
        if let Some(ref matcher) = self.matcher {
            if matcher.is_match(url) {
                return RequestDecision::Block;
            }
        }
        RequestDecision::Allow
    }
}
