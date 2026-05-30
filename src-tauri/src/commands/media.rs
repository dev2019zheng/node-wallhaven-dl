use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::settings_repository::SettingsStoreError;
use crate::db::DatabaseState;
use crate::models::settings::NetworkProxySettingsError;
use crate::services::wallhaven_client::WallhavenClientError;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadRemoteImageRequest {
    pub url: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteImageResponse {
    pub bytes: Vec<u8>,
    pub content_type: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaCommandErrorKind {
    InvalidRequest,
    Network,
    Internal,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCommandError {
    pub kind: MediaCommandErrorKind,
    pub message: String,
}

impl MediaCommandError {
    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            kind: MediaCommandErrorKind::InvalidRequest,
            message: message.into(),
        }
    }

    fn network(message: impl Into<String>) -> Self {
        Self {
            kind: MediaCommandErrorKind::Network,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: MediaCommandErrorKind::Internal,
            message: message.into(),
        }
    }
}

impl From<SettingsStoreError> for MediaCommandError {
    fn from(error: SettingsStoreError) -> Self {
        Self::internal(error.to_string())
    }
}

impl From<NetworkProxySettingsError> for MediaCommandError {
    fn from(error: NetworkProxySettingsError) -> Self {
        Self::invalid_request(error.to_string())
    }
}

impl From<WallhavenClientError> for MediaCommandError {
    fn from(error: WallhavenClientError) -> Self {
        match error {
            WallhavenClientError::InvalidProxy(message)
            | WallhavenClientError::InvalidBaseUrl(message) => Self::invalid_request(message),
            WallhavenClientError::InvalidRequest(error) => Self::invalid_request(error.to_string()),
            WallhavenClientError::Request(error) => Self::network(error.to_string()),
        }
    }
}

fn validate_remote_image_url(url: &str) -> Result<reqwest::Url, MediaCommandError> {
    let url = reqwest::Url::parse(url.trim())
        .map_err(|error| MediaCommandError::invalid_request(error.to_string()))?;

    if !matches!(url.scheme(), "http" | "https") {
        return Err(MediaCommandError::invalid_request(
            "remote image URL must use http or https",
        ));
    }

    Ok(url)
}

#[tauri::command]
pub async fn load_remote_image(
    database: State<'_, DatabaseState>,
    request: LoadRemoteImageRequest,
) -> Result<RemoteImageResponse, MediaCommandError> {
    let url = validate_remote_image_url(&request.url)?;
    let network_proxy = database
        .settings_repository()
        .load_network_proxy_settings()
        .await?;
    let client = crate::services::wallhaven_client::build_http_client(network_proxy.as_ref())?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| MediaCommandError::network(error.to_string()))?
        .error_for_status()
        .map_err(|error| MediaCommandError::network(error.to_string()))?;
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .filter(|value| value.starts_with("image/"))
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| MediaCommandError::network(error.to_string()))?
        .to_vec();

    Ok(RemoteImageResponse {
        bytes,
        content_type,
    })
}
