pub mod fingerprint;
pub mod request_filter;

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
        self.filter.decide(url)
    }
}
