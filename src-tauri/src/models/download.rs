use std::error::Error;
use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub wallpaper_id: String,
    pub image_url: String,
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

impl DownloadRequest {
    pub fn new(
        wallpaper_id: impl Into<String>,
        image_url: impl Into<String>,
        file_name: impl Into<String>,
    ) -> Self {
        Self {
            wallpaper_id: wallpaper_id.into(),
            image_url: image_url.into(),
            file_name: file_name.into(),
            purity: None,
            category: None,
        }
    }

    pub fn validate(&self) -> Result<(), DownloadRequestError> {
        if self.wallpaper_id.trim().is_empty() {
            return Err(DownloadRequestError::EmptyWallpaperId);
        }

        if self.image_url.trim().is_empty() {
            return Err(DownloadRequestError::EmptyImageUrl);
        }

        if self.file_name.trim().is_empty() {
            return Err(DownloadRequestError::EmptyFileName);
        }

        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DownloadRequestError {
    EmptyWallpaperId,
    EmptyImageUrl,
    EmptyFileName,
}

impl fmt::Display for DownloadRequestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyWallpaperId => write!(f, "wallpaper id must not be empty"),
            Self::EmptyImageUrl => write!(f, "image url must not be empty"),
            Self::EmptyFileName => write!(f, "file name must not be empty"),
        }
    }
}

impl Error for DownloadRequestError {}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStrategy {
    pub base_dir: String,
    pub relative_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,
}

impl DownloadStrategy {
    pub fn new(base_dir: impl Into<String>, relative_path: impl Into<String>) -> Self {
        Self {
            base_dir: base_dir.into(),
            relative_path: relative_path.into(),
            root_path: None,
        }
    }

    pub fn absolute_directory(root_path: impl Into<String>) -> Self {
        Self {
            base_dir: "Absolute".into(),
            relative_path: String::new(),
            root_path: Some(root_path.into()),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTarget {
    pub file_name: String,
    pub relative_file_path: String,
}

impl DownloadTarget {
    pub fn new(file_name: impl Into<String>, relative_file_path: impl Into<String>) -> Self {
        Self {
            file_name: file_name.into(),
            relative_file_path: relative_file_path.into(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
    SkippedExisting,
}

impl fmt::Display for DownloadStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Queued => write!(f, "queued"),
            Self::Running => write!(f, "running"),
            Self::Succeeded => write!(f, "succeeded"),
            Self::Failed => write!(f, "failed"),
            Self::SkippedExisting => write!(f, "skipped_existing"),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub id: String,
    pub wallpaper_id: String,
    pub source_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub strategy: DownloadStrategy,
    pub target: DownloadTarget,
    pub status: DownloadStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DownloadTaskError {
    InvalidTransition {
        from: DownloadStatus,
        to: DownloadStatus,
    },
    EmptyFailureReason,
}

impl fmt::Display for DownloadTaskError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidTransition { from, to } => {
                write!(f, "cannot transition download task from {from} to {to}")
            }
            Self::EmptyFailureReason => write!(f, "failed downloads require a non-empty reason"),
        }
    }
}

impl Error for DownloadTaskError {}

impl DownloadTask {
    pub fn queued(
        id: impl Into<String>,
        wallpaper_id: impl Into<String>,
        source_url: impl Into<String>,
        purity: Option<String>,
        category: Option<String>,
        strategy: DownloadStrategy,
        target: DownloadTarget,
    ) -> Self {
        Self {
            id: id.into(),
            wallpaper_id: wallpaper_id.into(),
            source_url: source_url.into(),
            purity,
            category,
            strategy,
            target,
            status: DownloadStatus::Queued,
            failure_reason: None,
        }
    }

    pub fn mark_running(&mut self) -> Result<(), DownloadTaskError> {
        self.transition_to(DownloadStatus::Running)
    }

    pub fn mark_succeeded(&mut self) -> Result<(), DownloadTaskError> {
        self.transition_to(DownloadStatus::Succeeded)
    }

    pub fn mark_failed(&mut self, reason: impl AsRef<str>) -> Result<(), DownloadTaskError> {
        let reason = reason.as_ref().trim();
        if reason.is_empty() {
            return Err(DownloadTaskError::EmptyFailureReason);
        }

        self.transition_to(DownloadStatus::Failed)?;
        self.failure_reason = Some(reason.to_string());
        Ok(())
    }

    pub fn mark_skipped_existing(&mut self) -> Result<(), DownloadTaskError> {
        self.transition_to(DownloadStatus::SkippedExisting)
    }

    fn transition_to(&mut self, next: DownloadStatus) -> Result<(), DownloadTaskError> {
        if !self.can_transition_to(&next) {
            return Err(DownloadTaskError::InvalidTransition {
                from: self.status.clone(),
                to: next,
            });
        }

        self.status = next;
        self.failure_reason = None;
        Ok(())
    }

    fn can_transition_to(&self, next: &DownloadStatus) -> bool {
        matches!(
            (&self.status, next),
            (DownloadStatus::Queued, DownloadStatus::Running)
                | (DownloadStatus::Queued, DownloadStatus::Failed)
                | (DownloadStatus::Queued, DownloadStatus::SkippedExisting)
                | (DownloadStatus::Running, DownloadStatus::Succeeded)
                | (DownloadStatus::Running, DownloadStatus::Failed)
                | (DownloadStatus::Running, DownloadStatus::SkippedExisting)
        )
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveRecord {
    pub wallpaper_id: String,
    pub source_url: String,
    pub file_name: String,
    pub relative_file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub download_base_dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_root_path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ArchiveRecordError {
    NotArchivable(DownloadStatus),
}

impl fmt::Display for ArchiveRecordError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotArchivable(status) => {
                write!(f, "download tasks in {status} status cannot be archived")
            }
        }
    }
}

impl Error for ArchiveRecordError {}

impl ArchiveRecord {
    pub fn from_task(task: &DownloadTask) -> Result<Self, ArchiveRecordError> {
        match task.status {
            DownloadStatus::Succeeded | DownloadStatus::SkippedExisting => Ok(Self {
                wallpaper_id: task.wallpaper_id.clone(),
                source_url: task.source_url.clone(),
                file_name: task.target.file_name.clone(),
                relative_file_path: task.target.relative_file_path.clone(),
                purity: task.purity.clone(),
                category: task.category.clone(),
                tags: Vec::new(),
                is_favorite: false,
                download_base_dir: task.strategy.base_dir.clone(),
                download_root_path: task.strategy.root_path.clone(),
            }),
            _ => Err(ArchiveRecordError::NotArchivable(task.status.clone())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        ArchiveRecord, ArchiveRecordError, DownloadRequest, DownloadRequestError, DownloadStatus,
        DownloadStrategy, DownloadTarget, DownloadTask, DownloadTaskError,
    };

    fn sample_task() -> DownloadTask {
        DownloadTask::queued(
            "task-1",
            "wh-1",
            "https://wallhaven.cc/w/wh-1",
            None,
            None,
            DownloadStrategy::new("AppLocalData", "wallpapers"),
            DownloadTarget::new("wh-1.jpg", "wallpapers/wh-1.jpg"),
        )
    }

    #[test]
    fn queued_task_starts_in_queued_state() {
        let task = sample_task();

        assert_eq!(task.status, DownloadStatus::Queued);
        assert_eq!(task.failure_reason, None);
    }

    #[test]
    fn download_request_requires_non_empty_wallpaper_id() {
        assert_eq!(
            DownloadRequest::new("   ", "https://wallhaven.cc/w/wh-1", "wh-1.jpg")
                .validate()
                .unwrap_err(),
            DownloadRequestError::EmptyWallpaperId
        );
    }

    #[test]
    fn download_request_requires_non_empty_image_url_and_file_name() {
        assert_eq!(
            DownloadRequest::new("wh-1", "   ", "wh-1.jpg")
                .validate()
                .unwrap_err(),
            DownloadRequestError::EmptyImageUrl
        );
        assert_eq!(
            DownloadRequest::new("wh-1", "https://wallhaven.cc/w/wh-1", "   ")
                .validate()
                .unwrap_err(),
            DownloadRequestError::EmptyFileName
        );
    }

    #[test]
    fn absolute_directory_strategy_tracks_the_custom_root_path() {
        assert_eq!(
            DownloadStrategy::absolute_directory("/Users/test/Pictures/Wallhaven"),
            DownloadStrategy {
                base_dir: "Absolute".into(),
                relative_path: String::new(),
                root_path: Some("/Users/test/Pictures/Wallhaven".into()),
            }
        );
    }

    #[test]
    fn download_status_rejects_transition_from_terminal_state() {
        let mut task = sample_task();

        task.mark_running().unwrap();
        task.mark_succeeded().unwrap();

        assert_eq!(
            task.mark_failed("network timeout").unwrap_err(),
            DownloadTaskError::InvalidTransition {
                from: DownloadStatus::Succeeded,
                to: DownloadStatus::Failed,
            }
        );
    }

    #[test]
    fn failed_status_requires_non_empty_reason() {
        let mut task = sample_task();

        assert_eq!(
            task.mark_failed("   ").unwrap_err(),
            DownloadTaskError::EmptyFailureReason
        );
    }

    #[test]
    fn archive_record_uses_download_target_for_archivable_states() {
        let mut task = sample_task();

        task.mark_running().unwrap();
        task.mark_succeeded().unwrap();

        assert_eq!(
            ArchiveRecord::from_task(&task).unwrap(),
            ArchiveRecord {
                wallpaper_id: "wh-1".into(),
                source_url: "https://wallhaven.cc/w/wh-1".into(),
                file_name: "wh-1.jpg".into(),
                relative_file_path: "wallpapers/wh-1.jpg".into(),
                purity: None,
                category: None,
                tags: Vec::new(),
                is_favorite: false,
                download_base_dir: "AppLocalData".into(),
                download_root_path: None,
            }
        );
    }

    #[test]
    fn archive_record_rejects_non_archivable_states() {
        let task = sample_task();

        assert_eq!(
            ArchiveRecord::from_task(&task).unwrap_err(),
            ArchiveRecordError::NotArchivable(DownloadStatus::Queued)
        );
    }

    #[test]
    fn skipped_existing_tasks_can_still_be_archived() {
        let mut task = sample_task();

        task.mark_skipped_existing().unwrap();

        assert_eq!(
            ArchiveRecord::from_task(&task).unwrap(),
            ArchiveRecord {
                wallpaper_id: "wh-1".into(),
                source_url: "https://wallhaven.cc/w/wh-1".into(),
                file_name: "wh-1.jpg".into(),
                relative_file_path: "wallpapers/wh-1.jpg".into(),
                purity: None,
                category: None,
                tags: Vec::new(),
                is_favorite: false,
                download_base_dir: "AppLocalData".into(),
                download_root_path: None,
            }
        );
    }

    #[test]
    fn archive_record_preserves_the_custom_download_root_for_gallery_lookups() {
        let mut task = DownloadTask::queued(
            "task-custom",
            "wh-custom",
            "https://wallhaven.cc/w/wh-custom",
            None,
            None,
            DownloadStrategy::absolute_directory("/Users/test/Pictures/Wallhaven"),
            DownloadTarget::new("wh-custom.jpg", "wh-custom.jpg"),
        );

        task.mark_skipped_existing().unwrap();

        assert_eq!(
            ArchiveRecord::from_task(&task).unwrap(),
            ArchiveRecord {
                wallpaper_id: "wh-custom".into(),
                source_url: "https://wallhaven.cc/w/wh-custom".into(),
                file_name: "wh-custom.jpg".into(),
                relative_file_path: "wh-custom.jpg".into(),
                purity: None,
                category: None,
                tags: Vec::new(),
                is_favorite: false,
                download_base_dir: "Absolute".into(),
                download_root_path: Some("/Users/test/Pictures/Wallhaven".into()),
            }
        );
    }
}
