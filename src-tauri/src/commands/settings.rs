use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

use crate::db::settings_repository::{SettingsRepository, SettingsStoreError};
use crate::db::DatabaseState;
use crate::models::settings::{
    NetworkProxyScheme, NetworkProxySettings, NetworkProxySettingsError,
};
use crate::services::path_service::{
    resolve_effective_download_directory, ResolveDownloadPathError,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadDirectorySettingsDto {
    pub custom_directory_path: String,
    pub effective_directory_path: String,
    pub default_directory_path: String,
    pub is_using_default_directory: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDownloadDirectorySettingsRequest {
    pub custom_directory_path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NetworkProxySchemeDto {
    Http,
    Https,
    Socks5,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProxySettingsDto {
    pub scheme: NetworkProxySchemeDto,
    pub address: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNetworkProxySettingsRequest {
    pub proxy: Option<NetworkProxySettingsDto>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingsCommandErrorKind {
    InvalidRequest,
    ResolvePath,
    Internal,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsCommandError {
    pub kind: SettingsCommandErrorKind,
    pub message: String,
}

impl SettingsCommandError {
    fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: SettingsCommandErrorKind::Internal,
            message: message.into(),
        }
    }
}

impl From<SettingsStoreError> for SettingsCommandError {
    fn from(error: SettingsStoreError) -> Self {
        Self::internal(error.to_string())
    }
}

impl From<ResolveDownloadPathError> for SettingsCommandError {
    fn from(error: ResolveDownloadPathError) -> Self {
        match error {
            ResolveDownloadPathError::InvalidRootPath(message) => Self {
                kind: SettingsCommandErrorKind::InvalidRequest,
                message: message.to_string(),
            },
            other => Self {
                kind: SettingsCommandErrorKind::ResolvePath,
                message: other.to_string(),
            },
        }
    }
}

impl From<NetworkProxySettingsError> for SettingsCommandError {
    fn from(error: NetworkProxySettingsError) -> Self {
        Self {
            kind: SettingsCommandErrorKind::InvalidRequest,
            message: error.to_string(),
        }
    }
}

impl From<NetworkProxyScheme> for NetworkProxySchemeDto {
    fn from(value: NetworkProxyScheme) -> Self {
        match value {
            NetworkProxyScheme::Http => Self::Http,
            NetworkProxyScheme::Https => Self::Https,
            NetworkProxyScheme::Socks5 => Self::Socks5,
        }
    }
}

impl From<NetworkProxySchemeDto> for NetworkProxyScheme {
    fn from(value: NetworkProxySchemeDto) -> Self {
        match value {
            NetworkProxySchemeDto::Http => Self::Http,
            NetworkProxySchemeDto::Https => Self::Https,
            NetworkProxySchemeDto::Socks5 => Self::Socks5,
        }
    }
}

impl From<NetworkProxySettings> for NetworkProxySettingsDto {
    fn from(value: NetworkProxySettings) -> Self {
        Self {
            scheme: value.scheme.into(),
            address: value.address,
        }
    }
}

impl TryFrom<NetworkProxySettingsDto> for NetworkProxySettings {
    type Error = NetworkProxySettingsError;

    fn try_from(value: NetworkProxySettingsDto) -> Result<Self, Self::Error> {
        NetworkProxySettings {
            scheme: value.scheme.into(),
            address: value.address,
        }
        .normalized()
    }
}

fn normalize_custom_directory_input(custom_directory_path: Option<String>) -> Option<String> {
    match custom_directory_path {
        Some(path) => {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        None => None,
    }
}

async fn load_download_directory_settings_from_repository(
    repository: &SettingsRepository,
    app_local_data_dir: &std::path::Path,
) -> Result<DownloadDirectorySettingsDto, SettingsCommandError> {
    let custom_directory_path = repository.load_custom_download_directory().await?;
    let effective_directory_path =
        resolve_effective_download_directory(app_local_data_dir, custom_directory_path.as_deref())?;
    let default_directory_path = resolve_effective_download_directory(app_local_data_dir, None)?;
    let is_using_default_directory = custom_directory_path.is_none();

    Ok(DownloadDirectorySettingsDto {
        custom_directory_path: custom_directory_path.unwrap_or_default(),
        effective_directory_path: effective_directory_path.to_string_lossy().into_owned(),
        default_directory_path: default_directory_path.to_string_lossy().into_owned(),
        is_using_default_directory,
    })
}

#[tauri::command]
pub async fn get_download_directory_settings(
    app: AppHandle,
    state: State<'_, DatabaseState>,
) -> Result<DownloadDirectorySettingsDto, SettingsCommandError> {
    let app_local_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|error| SettingsCommandError {
            kind: SettingsCommandErrorKind::ResolvePath,
            message: error.to_string(),
        })?;

    load_download_directory_settings_from_repository(
        &state.settings_repository(),
        app_local_data_dir.as_path(),
    )
    .await
}

#[tauri::command]
pub async fn save_download_directory_settings(
    app: AppHandle,
    state: State<'_, DatabaseState>,
    request: SaveDownloadDirectorySettingsRequest,
) -> Result<DownloadDirectorySettingsDto, SettingsCommandError> {
    let app_local_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|error| SettingsCommandError {
            kind: SettingsCommandErrorKind::ResolvePath,
            message: error.to_string(),
        })?;
    let custom_directory_path = normalize_custom_directory_input(request.custom_directory_path);

    if let Some(path) = custom_directory_path.as_deref() {
        let _ = resolve_effective_download_directory(app_local_data_dir.as_path(), Some(path))?;
    }

    state
        .settings_repository()
        .save_custom_download_directory(custom_directory_path.as_deref())
        .await?;

    load_download_directory_settings_from_repository(
        &state.settings_repository(),
        app_local_data_dir.as_path(),
    )
    .await
}

#[tauri::command]
pub async fn get_network_proxy_settings(
    state: State<'_, DatabaseState>,
) -> Result<Option<NetworkProxySettingsDto>, SettingsCommandError> {
    state
        .settings_repository()
        .load_network_proxy_settings()
        .await
        .map(|proxy| proxy.map(Into::into))
        .map_err(Into::into)
}

#[tauri::command]
pub async fn save_network_proxy_settings(
    state: State<'_, DatabaseState>,
    request: SaveNetworkProxySettingsRequest,
) -> Result<Option<NetworkProxySettingsDto>, SettingsCommandError> {
    let proxy = request
        .proxy
        .map(NetworkProxySettings::try_from)
        .transpose()?;

    state
        .settings_repository()
        .save_network_proxy_settings(proxy.as_ref())
        .await?;

    state
        .settings_repository()
        .load_network_proxy_settings()
        .await
        .map(|saved_proxy| saved_proxy.map(Into::into))
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        DownloadDirectorySettingsDto, NetworkProxySchemeDto, NetworkProxySettingsDto,
        SaveDownloadDirectorySettingsRequest, SaveNetworkProxySettingsRequest,
        SettingsCommandError, SettingsCommandErrorKind,
    };
    use crate::models::settings::NetworkProxySettingsError;
    use crate::services::path_service::{ResolveDownloadPathError, RootPathError};

    #[test]
    fn download_directory_settings_dto_serializes_in_camel_case() {
        let dto = DownloadDirectorySettingsDto {
            custom_directory_path: "/Users/test/Pictures/Wallhaven".into(),
            effective_directory_path: "/Users/test/Pictures/Wallhaven".into(),
            default_directory_path:
                "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers"
                    .into(),
            is_using_default_directory: false,
        };

        assert_eq!(
            serde_json::to_value(dto).unwrap(),
            json!({
                "customDirectoryPath": "/Users/test/Pictures/Wallhaven",
                "effectiveDirectoryPath": "/Users/test/Pictures/Wallhaven",
                "defaultDirectoryPath": "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
                "isUsingDefaultDirectory": false
            })
        );
    }

    #[test]
    fn save_download_directory_settings_request_deserializes_in_camel_case() {
        let request: SaveDownloadDirectorySettingsRequest = serde_json::from_value(json!({
            "customDirectoryPath": "/Users/test/Pictures/Wallhaven"
        }))
        .unwrap();

        assert_eq!(
            request,
            SaveDownloadDirectorySettingsRequest {
                custom_directory_path: Some("/Users/test/Pictures/Wallhaven".into())
            }
        );
    }

    #[test]
    fn network_proxy_settings_dto_serializes_in_camel_case() {
        let dto = NetworkProxySettingsDto {
            scheme: NetworkProxySchemeDto::Socks5,
            address: "127.0.0.1:7897".into(),
        };

        assert_eq!(
            serde_json::to_value(dto).unwrap(),
            json!({
                "scheme": "socks5",
                "address": "127.0.0.1:7897"
            })
        );
    }

    #[test]
    fn save_network_proxy_settings_request_deserializes_in_camel_case() {
        let request: SaveNetworkProxySettingsRequest = serde_json::from_value(json!({
            "proxy": {
                "scheme": "https",
                "address": "127.0.0.1:7897"
            }
        }))
        .unwrap();

        assert_eq!(
            request,
            SaveNetworkProxySettingsRequest {
                proxy: Some(NetworkProxySettingsDto {
                    scheme: NetworkProxySchemeDto::Https,
                    address: "127.0.0.1:7897".into(),
                })
            }
        );
    }

    #[test]
    fn invalid_root_path_errors_map_to_invalid_request() {
        let error = SettingsCommandError::from(ResolveDownloadPathError::InvalidRootPath(
            RootPathError::Relative,
        ));

        assert_eq!(error.kind, SettingsCommandErrorKind::InvalidRequest);
        assert_eq!(
            error.message,
            "custom download directory must be an absolute path"
        );
    }

    #[test]
    fn invalid_network_proxy_settings_errors_map_to_invalid_request() {
        let error = SettingsCommandError::from(NetworkProxySettingsError::IncludesScheme);

        assert_eq!(error.kind, SettingsCommandErrorKind::InvalidRequest);
        assert_eq!(error.message, "proxy address must not include a scheme");
    }
}
