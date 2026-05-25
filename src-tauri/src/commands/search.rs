use serde::Serialize;

use crate::models::search::{
    WallhavenSearchMeta, WallhavenSearchRequest, WallhavenSearchResponse, WallhavenWallpaper,
    WallhavenWallpaperCategory, WallhavenWallpaperPurity, WallhavenWallpaperThumbs,
};
use crate::services::wallhaven_client::{WallhavenClient, WallhavenClientError};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWallpapersResponse {
    pub data: Vec<SearchWallpaper>,
    pub meta: SearchMeta,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWallpaper {
    pub id: String,
    pub url: String,
    pub short_url: String,
    pub views: u64,
    pub favorites: u64,
    pub source: String,
    pub purity: WallhavenWallpaperPurity,
    pub category: WallhavenWallpaperCategory,
    pub dimension_x: u32,
    pub dimension_y: u32,
    pub resolution: String,
    pub ratio: String,
    pub file_size: u64,
    pub file_type: String,
    pub created_at: String,
    pub colors: Vec<String>,
    pub path: String,
    pub thumbs: SearchWallpaperThumbs,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWallpaperThumbs {
    pub large: String,
    pub original: String,
    pub small: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMeta {
    pub current_page: u32,
    pub last_page: u32,
    pub per_page: String,
    pub total: u64,
    pub query: Option<String>,
    pub seed: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SearchWallpapersErrorKind {
    InvalidRequest,
    UpstreamStatus,
    Timeout,
    Network,
    Decode,
    Internal,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWallpapersError {
    pub kind: SearchWallpapersErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_code: Option<u16>,
}

impl SearchWallpapersError {
    fn new(kind: SearchWallpapersErrorKind, message: String) -> Self {
        Self {
            kind,
            message,
            status_code: None,
        }
    }

    fn with_status(kind: SearchWallpapersErrorKind, message: String, status_code: u16) -> Self {
        Self {
            kind,
            message,
            status_code: Some(status_code),
        }
    }

    fn from_reqwest_error(error: reqwest::Error) -> Self {
        let message = error.to_string();

        if let Some(status) = error.status() {
            return Self::with_status(
                SearchWallpapersErrorKind::UpstreamStatus,
                message,
                status.as_u16(),
            );
        }

        if error.is_timeout() {
            return Self::new(SearchWallpapersErrorKind::Timeout, message);
        }

        if error.is_decode() {
            return Self::new(SearchWallpapersErrorKind::Decode, message);
        }

        Self::new(SearchWallpapersErrorKind::Network, message)
    }
}

impl From<WallhavenClientError> for SearchWallpapersError {
    fn from(error: WallhavenClientError) -> Self {
        match error {
            WallhavenClientError::InvalidBaseUrl(message) => {
                Self::new(SearchWallpapersErrorKind::Internal, message)
            }
            WallhavenClientError::InvalidRequest(error) => {
                Self::new(SearchWallpapersErrorKind::InvalidRequest, error.to_string())
            }
            WallhavenClientError::Request(error) => Self::from_reqwest_error(error),
        }
    }
}

impl From<WallhavenSearchResponse> for SearchWallpapersResponse {
    fn from(value: WallhavenSearchResponse) -> Self {
        Self {
            data: value.data.into_iter().map(SearchWallpaper::from).collect(),
            meta: SearchMeta::from(value.meta),
        }
    }
}

impl From<WallhavenWallpaper> for SearchWallpaper {
    fn from(value: WallhavenWallpaper) -> Self {
        Self {
            id: value.id,
            url: value.url,
            short_url: value.short_url,
            views: value.views,
            favorites: value.favorites,
            source: value.source,
            purity: value.purity,
            category: value.category,
            dimension_x: value.dimension_x,
            dimension_y: value.dimension_y,
            resolution: value.resolution,
            ratio: value.ratio,
            file_size: value.file_size,
            file_type: value.file_type,
            created_at: value.created_at,
            colors: value.colors,
            path: value.path,
            thumbs: SearchWallpaperThumbs::from(value.thumbs),
        }
    }
}

impl From<WallhavenWallpaperThumbs> for SearchWallpaperThumbs {
    fn from(value: WallhavenWallpaperThumbs) -> Self {
        Self {
            large: value.large,
            original: value.original,
            small: value.small,
        }
    }
}

impl From<WallhavenSearchMeta> for SearchMeta {
    fn from(value: WallhavenSearchMeta) -> Self {
        Self {
            current_page: value.current_page,
            last_page: value.last_page,
            per_page: value.per_page,
            total: value.total,
            query: value.query,
            seed: value.seed,
        }
    }
}

fn map_search_result(
    result: Result<WallhavenSearchResponse, WallhavenClientError>,
) -> Result<SearchWallpapersResponse, SearchWallpapersError> {
    result
        .map(SearchWallpapersResponse::from)
        .map_err(SearchWallpapersError::from)
}

#[tauri::command]
pub async fn search_wallpapers(
    request: WallhavenSearchRequest,
) -> Result<SearchWallpapersResponse, SearchWallpapersError> {
    let client = WallhavenClient::new();
    map_search_result(client.search(&request).await)
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use crate::models::search::{
        WallhavenRequestError, WallhavenSearchRequest, WallhavenSearchResponse,
    };
    use crate::services::wallhaven_client::{WallhavenClient, WallhavenClientError};

    use super::{map_search_result, SearchWallpapersError, SearchWallpapersResponse};

    fn sample_search_response() -> WallhavenSearchResponse {
        serde_json::from_str(include_str!("../../../page_data.json")).unwrap()
    }

    #[test]
    fn search_command_boundary_serializes_success_fields_in_camel_case() {
        let response = SearchWallpapersResponse::from(sample_search_response());
        let serialized = serde_json::to_value(response).unwrap();
        let first_wallpaper = &serialized["data"][0];
        let meta = &serialized["meta"];

        assert_eq!(
            first_wallpaper.get("shortUrl").unwrap(),
            "https://whvn.cc/kxpkmm"
        );
        assert!(first_wallpaper.get("short_url").is_none());
        assert_eq!(first_wallpaper.get("dimensionX").unwrap(), 1966);
        assert!(first_wallpaper.get("dimension_x").is_none());
        assert_eq!(first_wallpaper.get("dimensionY").unwrap(), 3000);
        assert!(first_wallpaper.get("dimension_y").is_none());
        assert_eq!(first_wallpaper.get("fileSize").unwrap(), 3088002);
        assert!(first_wallpaper.get("file_size").is_none());
        assert_eq!(
            first_wallpaper.get("createdAt").unwrap(),
            "2025-01-31 00:21:26"
        );
        assert!(first_wallpaper.get("created_at").is_none());
        assert_eq!(meta.get("currentPage").unwrap(), 1);
        assert!(meta.get("current_page").is_none());
        assert_eq!(meta.get("lastPage").unwrap(), 9);
        assert!(meta.get("last_page").is_none());
    }

    #[test]
    fn search_command_boundary_maps_invalid_request_to_structured_error() {
        let error = map_search_result(Err(WallhavenClientError::InvalidRequest(
            WallhavenRequestError::TopRangeRequiresToplist,
        )))
        .unwrap_err();
        let serialized = serde_json::to_value(error).unwrap();

        assert_eq!(
            serialized,
            json!({
                "kind": "invalidRequest",
                "message": "topRange is only supported when sorting is toplist"
            })
        );
        assert!(serialized.is_object());
    }

    #[test]
    fn search_command_boundary_maps_upstream_status_to_structured_error() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;

            Mock::given(method("GET"))
                .and(path("/api/v1/search"))
                .respond_with(ResponseTemplate::new(503).set_body_string("upstream unavailable"))
                .expect(1)
                .mount(&server)
                .await;

            let client = WallhavenClient::with_base_url(server.uri()).unwrap();
            let error = map_search_result(client.search(&WallhavenSearchRequest::default()).await)
                .unwrap_err();
            let serialized = serde_json::to_value(error).unwrap();

            assert_eq!(serialized["kind"], "upstreamStatus");
            assert_eq!(serialized["statusCode"], 503);
            assert!(serialized["message"].as_str().unwrap().contains("503"));
        });
    }

    #[test]
    fn search_command_boundary_maps_decode_failures_to_structured_error() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;

            Mock::given(method("GET"))
                .and(path("/api/v1/search"))
                .respond_with(
                    ResponseTemplate::new(200).set_body_raw("not-json", "application/json"),
                )
                .expect(1)
                .mount(&server)
                .await;

            let client = WallhavenClient::with_base_url(server.uri()).unwrap();
            let error = map_search_result(client.search(&WallhavenSearchRequest::default()).await)
                .unwrap_err();
            let serialized = serde_json::to_value(error).unwrap();

            assert_eq!(serialized["kind"], "decode");
            assert!(serialized["statusCode"].is_null());
        });
    }

    #[test]
    fn search_command_boundary_keeps_error_payload_as_object_when_serialized() {
        let error =
            SearchWallpapersError::from(WallhavenClientError::InvalidBaseUrl("invalid url".into()));
        let serialized = serde_json::to_value(error).unwrap();

        assert!(serialized.is_object());
        assert_eq!(serialized["kind"], "internal");
    }
}
