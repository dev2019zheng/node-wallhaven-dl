use std::error::Error;
use std::fmt;
use std::time::Duration;

use reqwest::{Client, Url};

use crate::models::search::{
    WallhavenRequestError, WallhavenSearchRequest, WallhavenSearchResponse,
};
use crate::models::settings::NetworkProxySettings;

const DEFAULT_BASE_URL: &str = "https://wallhaven.cc";
const SEARCH_PATH: &str = "/api/v1/search";
const CONNECT_TIMEOUT_SECONDS: u64 = 5;
const REQUEST_TIMEOUT_SECONDS: u64 = 15;
const USER_AGENT: &str = "wallhaven-desktop/0.1.0";

#[derive(Debug)]
pub enum WallhavenClientError {
    InvalidBaseUrl(String),
    InvalidProxy(String),
    InvalidRequest(WallhavenRequestError),
    Request(reqwest::Error),
}

impl fmt::Display for WallhavenClientError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidBaseUrl(message) => write!(f, "{message}"),
            Self::InvalidProxy(message) => write!(f, "{message}"),
            Self::InvalidRequest(error) => write!(f, "{error}"),
            Self::Request(error) => write!(f, "{error}"),
        }
    }
}

impl Error for WallhavenClientError {}

impl From<WallhavenRequestError> for WallhavenClientError {
    fn from(value: WallhavenRequestError) -> Self {
        Self::InvalidRequest(value)
    }
}

impl From<reqwest::Error> for WallhavenClientError {
    fn from(value: reqwest::Error) -> Self {
        Self::Request(value)
    }
}

#[derive(Clone, Debug)]
pub struct WallhavenClient {
    base_url: Url,
    http_client: Client,
}

pub fn build_http_client(
    proxy_settings: Option<&NetworkProxySettings>,
) -> Result<Client, WallhavenClientError> {
    let mut http_client_builder = Client::builder()
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECONDS))
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
        .user_agent(USER_AGENT);

    if let Some(proxy_settings) = proxy_settings {
        http_client_builder = http_client_builder.proxy(
            proxy_settings
                .to_reqwest_proxy()
                .map_err(|error| WallhavenClientError::InvalidProxy(error.to_string()))?,
        );
    }

    http_client_builder.build().map_err(Into::into)
}

impl WallhavenClient {
    pub fn new() -> Self {
        Self::with_proxy(None).expect("default wallhaven base URL should always be valid")
    }

    pub fn with_proxy(
        proxy_settings: Option<&NetworkProxySettings>,
    ) -> Result<Self, WallhavenClientError> {
        Self::with_base_url_and_proxy(DEFAULT_BASE_URL, proxy_settings)
    }

    pub fn with_base_url(base_url: impl AsRef<str>) -> Result<Self, WallhavenClientError> {
        Self::with_base_url_and_proxy(base_url, None)
    }

    pub fn with_base_url_and_proxy(
        base_url: impl AsRef<str>,
        proxy_settings: Option<&NetworkProxySettings>,
    ) -> Result<Self, WallhavenClientError> {
        let base_url = Url::parse(base_url.as_ref())
            .map_err(|error| WallhavenClientError::InvalidBaseUrl(error.to_string()))?;

        let http_client = build_http_client(proxy_settings)?;

        Ok(Self {
            base_url,
            http_client,
        })
    }

    pub async fn search(
        &self,
        request: &WallhavenSearchRequest,
    ) -> Result<WallhavenSearchResponse, WallhavenClientError> {
        let query_params = request.to_query_params()?;
        let endpoint = self
            .base_url
            .join(SEARCH_PATH)
            .map_err(|error| WallhavenClientError::InvalidBaseUrl(error.to_string()))?;

        let mut request_builder = self.http_client.get(endpoint).query(&query_params);

        if let Some(api_key) = request
            .api_key
            .as_deref()
            .map(str::trim)
            .filter(|key| !key.is_empty())
        {
            request_builder = request_builder.header("X-API-Key", api_key);
        }

        let response = request_builder.send().await?.error_for_status()?;
        Ok(response.json::<WallhavenSearchResponse>().await?)
    }
}

#[cfg(test)]
mod tests {
    use wiremock::matchers::{header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use crate::models::search::{
        WallhavenCategoryFilter, WallhavenPurityFilter, WallhavenSearchRequest, WallhavenSorting,
        WallhavenToplistRange,
    };
    use crate::models::settings::{NetworkProxyScheme, NetworkProxySettings};

    use super::WallhavenClient;

    #[test]
    fn wallhaven_client_accepts_socks5_proxy_settings() {
        let client = WallhavenClient::with_base_url_and_proxy(
            "https://wallhaven.cc",
            Some(&NetworkProxySettings {
                scheme: NetworkProxyScheme::Socks5,
                address: "127.0.0.1:7897".into(),
            }),
        )
        .unwrap();

        assert_eq!(client.base_url.as_str(), "https://wallhaven.cc/");
    }

    #[test]
    fn search_requests_include_query_params_and_api_key_header() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let fixture = include_str!("../../../page_data.json");

            let mock = Mock::given(method("GET"))
                .and(path("/api/v1/search"))
                .and(query_param("categories", "110"))
                .and(query_param("purity", "110"))
                .and(query_param("sorting", "toplist"))
                .and(query_param("topRange", "1M"))
                .and(query_param("order", "desc"))
                .and(query_param("q", "landscape"))
                .and(query_param("page", "2"))
                .and(header("x-api-key", "test-key"))
                .respond_with(ResponseTemplate::new(200).set_body_raw(fixture, "application/json"))
                .expect(1);

            mock.mount(&server).await;

            let client = WallhavenClient::with_base_url(server.uri()).unwrap();
            let response = client
                .search(&WallhavenSearchRequest {
                    categories: Some(WallhavenCategoryFilter::Ga),
                    purity: Some(WallhavenPurityFilter {
                        sfw: true,
                        sketchy: true,
                        nsfw: false,
                    }),
                    sorting: Some(WallhavenSorting::Toplist),
                    top_range: Some(WallhavenToplistRange::OneMonth),
                    q: Some("landscape".into()),
                    page: Some(2),
                    at_least: None,
                    ratios: None,
                    api_key: Some("test-key".into()),
                })
                .await
                .unwrap();

            assert_eq!(response.meta.current_page, 1);
            assert_eq!(response.data[0].id, "kxpkmm");
        });
    }
}
