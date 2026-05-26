use std::error::Error;
use std::fmt;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::models::download::{DownloadStatus, DownloadTask};

pub const DOWNLOAD_STATUS_EVENT: &str = "downloads:status";
pub const DOWNLOAD_PROGRESS_EVENT: &str = "downloads:progress";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskStatusEventPayload {
    pub task_id: String,
    pub wallpaper_id: String,
    pub file_name: String,
    pub relative_file_path: String,
    pub status: DownloadStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
}

impl From<&DownloadTask> for DownloadTaskStatusEventPayload {
    fn from(task: &DownloadTask) -> Self {
        Self {
            task_id: task.id.clone(),
            wallpaper_id: task.wallpaper_id.clone(),
            file_name: task.target.file_name.clone(),
            relative_file_path: task.target.relative_file_path.clone(),
            status: task.status.clone(),
            failure_reason: task.failure_reason.clone(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEventPayload {
    pub task_id: String,
    pub wallpaper_id: String,
    pub file_name: String,
    pub downloaded_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
}

impl DownloadProgressEventPayload {
    pub fn new(task: &DownloadTask, downloaded_bytes: u64, total_bytes: Option<u64>) -> Self {
        Self {
            task_id: task.id.clone(),
            wallpaper_id: task.wallpaper_id.clone(),
            file_name: task.target.file_name.clone(),
            downloaded_bytes,
            total_bytes,
        }
    }
}

pub trait DownloadEventEmitter: Send + Sync {
    fn emit_status(
        &self,
        payload: DownloadTaskStatusEventPayload,
    ) -> Result<(), DownloadEventError>;
    fn emit_progress(
        &self,
        payload: DownloadProgressEventPayload,
    ) -> Result<(), DownloadEventError>;
}

pub struct NoopDownloadEventEmitter;

impl DownloadEventEmitter for NoopDownloadEventEmitter {
    fn emit_status(
        &self,
        _payload: DownloadTaskStatusEventPayload,
    ) -> Result<(), DownloadEventError> {
        Ok(())
    }

    fn emit_progress(
        &self,
        _payload: DownloadProgressEventPayload,
    ) -> Result<(), DownloadEventError> {
        Ok(())
    }
}

#[derive(Clone)]
pub struct AppHandleDownloadEventEmitter {
    app: AppHandle,
}

impl AppHandleDownloadEventEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl DownloadEventEmitter for AppHandleDownloadEventEmitter {
    fn emit_status(
        &self,
        payload: DownloadTaskStatusEventPayload,
    ) -> Result<(), DownloadEventError> {
        self.app
            .emit(DOWNLOAD_STATUS_EVENT, payload)
            .map_err(Into::into)
    }

    fn emit_progress(
        &self,
        payload: DownloadProgressEventPayload,
    ) -> Result<(), DownloadEventError> {
        self.app
            .emit(DOWNLOAD_PROGRESS_EVENT, payload)
            .map_err(Into::into)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DownloadEventError(String);

impl fmt::Display for DownloadEventError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl Error for DownloadEventError {}

impl From<tauri::Error> for DownloadEventError {
    fn from(error: tauri::Error) -> Self {
        Self(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::models::download::{DownloadStrategy, DownloadTarget, DownloadTask};

    use super::{
        DownloadProgressEventPayload, DownloadTaskStatusEventPayload, DOWNLOAD_PROGRESS_EVENT,
        DOWNLOAD_STATUS_EVENT,
    };

    fn sample_task() -> DownloadTask {
        DownloadTask::queued(
            "download-000001",
            "wh-1",
            "https://wallhaven.cc/w/wh-1",
            DownloadStrategy::new("AppLocalData", "wallpapers"),
            DownloadTarget::new("wh-1.jpg", "wallpapers/wh-1.jpg"),
        )
    }

    #[test]
    fn download_event_names_remain_stable() {
        assert_eq!(DOWNLOAD_STATUS_EVENT, "downloads:status");
        assert_eq!(DOWNLOAD_PROGRESS_EVENT, "downloads:progress");
    }

    #[test]
    fn status_event_payload_serializes_in_camel_case() {
        let payload = DownloadTaskStatusEventPayload::from(&sample_task());

        assert_eq!(
            serde_json::to_value(payload).unwrap(),
            json!({
                "taskId": "download-000001",
                "wallpaperId": "wh-1",
                "fileName": "wh-1.jpg",
                "relativeFilePath": "wallpapers/wh-1.jpg",
                "status": "queued"
            })
        );
    }

    #[test]
    fn progress_event_payload_keeps_total_bytes_optional() {
        let payload = DownloadProgressEventPayload::new(&sample_task(), 1024, None);

        assert_eq!(
            serde_json::to_value(payload).unwrap(),
            json!({
                "taskId": "download-000001",
                "wallpaperId": "wh-1",
                "fileName": "wh-1.jpg",
                "downloadedBytes": 1024
            })
        );
    }
}
