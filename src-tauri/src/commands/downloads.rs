use std::io;
use std::time::Duration;

use reqwest::Client;
use serde::Serialize;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

use crate::db::settings_repository::SettingsStoreError;
use crate::db::DatabaseState;
use crate::models::download::{DownloadRequest, DownloadTarget, DownloadTask};
use crate::models::settings::{NetworkProxySettings, NetworkProxySettingsError};
use crate::services::archive_service::ArchiveStoreError;
use crate::services::download_events::AppHandleDownloadEventEmitter;
use crate::services::download_manager::{
    download_wallpaper_to_directory_with_strategy_and_emitter, DownloadManagerError,
    DownloadManagerState,
};
use crate::services::path_service::{
    resolve_download_path, strategy_from_custom_download_directory, ResolveDownloadPathError,
};

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDownloadTaskRequest {
    pub task_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDownloadTaskResponse {
    pub task_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskDto {
    pub id: String,
    pub wallpaper_id: String,
    pub source_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub absolute_path: String,
    pub target: DownloadTarget,
    pub status: crate::models::download::DownloadStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DownloadCommandErrorKind {
    InvalidRequest,
    ResolvePath,
    Network,
    Io,
    Conflict,
    Internal,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadCommandError {
    pub kind: DownloadCommandErrorKind,
    pub message: String,
}

impl From<ResolveDownloadPathError> for DownloadCommandError {
    fn from(error: ResolveDownloadPathError) -> Self {
        match error {
            ResolveDownloadPathError::InvalidRootPath(message) => Self {
                kind: DownloadCommandErrorKind::InvalidRequest,
                message: message.to_string(),
            },
            other => Self {
                kind: DownloadCommandErrorKind::ResolvePath,
                message: other.to_string(),
            },
        }
    }
}

impl From<SettingsStoreError> for DownloadCommandError {
    fn from(error: SettingsStoreError) -> Self {
        Self {
            kind: DownloadCommandErrorKind::Internal,
            message: error.to_string(),
        }
    }
}

impl From<NetworkProxySettingsError> for DownloadCommandError {
    fn from(error: NetworkProxySettingsError) -> Self {
        Self {
            kind: DownloadCommandErrorKind::InvalidRequest,
            message: error.to_string(),
        }
    }
}

impl From<ArchiveStoreError> for DownloadCommandError {
    fn from(error: ArchiveStoreError) -> Self {
        Self {
            kind: DownloadCommandErrorKind::Internal,
            message: error.to_string(),
        }
    }
}

impl From<DownloadManagerError> for DownloadCommandError {
    fn from(error: DownloadManagerError) -> Self {
        match error {
            DownloadManagerError::InvalidRequest(message) => Self {
                kind: DownloadCommandErrorKind::InvalidRequest,
                message,
            },
            DownloadManagerError::ResolvePath(message) => Self {
                kind: DownloadCommandErrorKind::ResolvePath,
                message,
            },
            DownloadManagerError::Network(message) => Self {
                kind: DownloadCommandErrorKind::Network,
                message,
            },
            DownloadManagerError::Io(message) => Self {
                kind: DownloadCommandErrorKind::Io,
                message,
            },
            DownloadManagerError::Conflict(message) => Self {
                kind: DownloadCommandErrorKind::Conflict,
                message,
            },
            DownloadManagerError::TaskState(message)
            | DownloadManagerError::MissingTask(message) => Self {
                kind: DownloadCommandErrorKind::InvalidRequest,
                message,
            },
            DownloadManagerError::Archive(message) | DownloadManagerError::Event(message) => Self {
                kind: DownloadCommandErrorKind::Internal,
                message,
            },
            DownloadManagerError::StatePoisoned => Self {
                kind: DownloadCommandErrorKind::Internal,
                message: DownloadManagerError::StatePoisoned.to_string(),
            },
        }
    }
}

fn build_download_http_client(
    network_proxy: Option<&NetworkProxySettings>,
) -> Result<Client, DownloadCommandError> {
    let mut client_builder = Client::builder().timeout(Duration::from_secs(60));

    if let Some(network_proxy) = network_proxy {
        client_builder = client_builder.proxy(network_proxy.to_reqwest_proxy()?);
    }

    client_builder
        .build()
        .map_err(|error| DownloadCommandError {
            kind: DownloadCommandErrorKind::Internal,
            message: error.to_string(),
        })
}

fn resolve_app_local_data_dir(app: &AppHandle) -> Result<std::path::PathBuf, DownloadCommandError> {
    app.path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|error| DownloadCommandError {
            kind: DownloadCommandErrorKind::ResolvePath,
            message: error.to_string(),
        })
}

fn to_download_task_dto(
    app_local_data_dir: &std::path::Path,
    task: DownloadTask,
) -> Result<DownloadTaskDto, DownloadCommandError> {
    let absolute_path = resolve_download_path(app_local_data_dir, &task.strategy, &task.target)?;

    Ok(DownloadTaskDto {
        id: task.id,
        wallpaper_id: task.wallpaper_id,
        source_url: task.source_url,
        purity: task.purity,
        category: task.category,
        absolute_path: absolute_path.to_string_lossy().into_owned(),
        target: task.target,
        status: task.status,
        failure_reason: task.failure_reason,
    })
}

fn remove_download_file(path: &std::path::Path) -> Result<(), DownloadCommandError> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(DownloadCommandError {
            kind: DownloadCommandErrorKind::Io,
            message: format!("failed to remove download file {}: {error}", path.display()),
        }),
    }
}

#[tauri::command]
pub async fn download_wallpaper(
    app: AppHandle,
    database: State<'_, DatabaseState>,
    state: State<'_, DownloadManagerState>,
    request: DownloadRequest,
) -> Result<DownloadTaskDto, DownloadCommandError> {
    let app_local_data_dir = resolve_app_local_data_dir(&app)?;
    let custom_download_directory = database
        .settings_repository()
        .load_custom_download_directory()
        .await?;
    let network_proxy = database
        .settings_repository()
        .load_network_proxy_settings()
        .await?;
    let strategy = strategy_from_custom_download_directory(custom_download_directory.as_deref())?;

    let client = build_download_http_client(network_proxy.as_ref())?;

    let event_emitter = AppHandleDownloadEventEmitter::new(app);

    let task = download_wallpaper_to_directory_with_strategy_and_emitter(
        state.inner(),
        &client,
        &app_local_data_dir,
        strategy,
        request,
        &event_emitter,
    )
    .await?;

    to_download_task_dto(app_local_data_dir.as_path(), task)
}

#[tauri::command]
pub fn list_downloads(
    app: AppHandle,
    state: State<'_, DownloadManagerState>,
) -> Result<Vec<DownloadTaskDto>, DownloadCommandError> {
    let app_local_data_dir = resolve_app_local_data_dir(&app)?;

    state
        .inner()
        .list_downloads()?
        .into_iter()
        .map(|task| to_download_task_dto(app_local_data_dir.as_path(), task))
        .collect()
}

#[tauri::command]
pub async fn delete_download_task(
    app: AppHandle,
    database: State<'_, DatabaseState>,
    state: State<'_, DownloadManagerState>,
    request: DeleteDownloadTaskRequest,
) -> Result<DeleteDownloadTaskResponse, DownloadCommandError> {
    if request.task_id.trim().is_empty() {
        return Err(DownloadCommandError {
            kind: DownloadCommandErrorKind::InvalidRequest,
            message: "taskId must not be empty.".into(),
        });
    }

    let app_local_data_dir = resolve_app_local_data_dir(&app)?;
    let task = state.inner().remove_task(&request.task_id)?;
    let absolute_path =
        resolve_download_path(app_local_data_dir.as_path(), &task.strategy, &task.target)?;

    if matches!(
        task.status,
        crate::models::download::DownloadStatus::Succeeded
            | crate::models::download::DownloadStatus::SkippedExisting
    ) {
        remove_download_file(absolute_path.as_path())?;
        let _ = database
            .archive_repository()
            .delete_by_wallpaper_id(&task.wallpaper_id)
            .await?;
    }

    Ok(DeleteDownloadTaskResponse {
        task_id: request.task_id,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{DownloadCommandError, DownloadCommandErrorKind};

    #[test]
    fn download_command_error_serializes_in_camel_case() {
        let error = DownloadCommandError {
            kind: DownloadCommandErrorKind::InvalidRequest,
            message: "file name must not be empty".into(),
        };

        assert_eq!(
            serde_json::to_value(error).unwrap(),
            json!({
                "kind": "invalidRequest",
                "message": "file name must not be empty"
            })
        );
    }

    #[test]
    fn download_manager_conflict_errors_map_to_conflict_command_kind() {
        let error = DownloadCommandError::from(super::DownloadManagerError::Conflict(
            "relative file path wallpapers/shared.jpg is already reserved".into(),
        ));

        assert_eq!(error.kind, DownloadCommandErrorKind::Conflict);
        assert_eq!(
            error.message,
            "relative file path wallpapers/shared.jpg is already reserved"
        );
    }
}
