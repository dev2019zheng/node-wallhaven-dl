use std::collections::BTreeMap;
use std::error::Error;
use std::fmt;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use reqwest::{Client, Response};
use uuid::Uuid;

use crate::db::archive_repository::ArchiveRepository;
use crate::models::download::{
    ArchiveRecord, ArchiveRecordError, DownloadRequest, DownloadRequestError, DownloadStrategy,
    DownloadTarget, DownloadTask, DownloadTaskError,
};
use crate::services::archive_service::ArchiveStoreError;
use crate::services::download_events::{
    DownloadEventEmitter, DownloadEventError, DownloadProgressEventPayload,
    DownloadTaskStatusEventPayload, NoopDownloadEventEmitter,
};
use crate::services::path_service::{
    build_download_target_with_strategy, default_download_strategy, resolve_download_path,
    ResolveDownloadPathError,
};

pub type DownloadManagerResult<T> = Result<T, DownloadManagerError>;

#[derive(Debug)]
pub enum DownloadManagerError {
    InvalidRequest(String),
    ResolvePath(String),
    Network(String),
    Io(String),
    Conflict(String),
    Archive(String),
    TaskState(String),
    Event(String),
    StatePoisoned,
    MissingTask(String),
}

impl fmt::Display for DownloadManagerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRequest(message) => write!(f, "{message}"),
            Self::ResolvePath(message) => write!(f, "{message}"),
            Self::Network(message) => write!(f, "{message}"),
            Self::Io(message) => write!(f, "{message}"),
            Self::Conflict(message) => write!(f, "{message}"),
            Self::Archive(message) => write!(f, "{message}"),
            Self::TaskState(message) => write!(f, "{message}"),
            Self::Event(message) => write!(f, "{message}"),
            Self::StatePoisoned => write!(f, "download manager state is poisoned"),
            Self::MissingTask(task_id) => write!(f, "download task {task_id} was not found"),
        }
    }
}

impl Error for DownloadManagerError {}

impl DownloadManagerError {
    fn relative_file_path_conflict(
        relative_file_path: impl Into<String>,
        existing_wallpaper_id: impl Into<String>,
        incoming_wallpaper_id: impl Into<String>,
    ) -> Self {
        Self::Conflict(
            ArchiveStoreError::RelativeFilePathConflict {
                relative_file_path: relative_file_path.into(),
                existing_wallpaper_id: existing_wallpaper_id.into(),
                incoming_wallpaper_id: incoming_wallpaper_id.into(),
            }
            .to_string(),
        )
    }

    fn with_context(self, context: impl AsRef<str>) -> Self {
        let context = context.as_ref();
        match self {
            Self::InvalidRequest(message) => Self::InvalidRequest(format!("{message}; {context}")),
            Self::ResolvePath(message) => Self::ResolvePath(format!("{message}; {context}")),
            Self::Network(message) => Self::Network(format!("{message}; {context}")),
            Self::Io(message) => Self::Io(format!("{message}; {context}")),
            Self::Conflict(message) => Self::Conflict(format!("{message}; {context}")),
            Self::Archive(message) => Self::Archive(format!("{message}; {context}")),
            Self::TaskState(message) => Self::TaskState(format!("{message}; {context}")),
            Self::Event(message) => Self::Event(format!("{message}; {context}")),
            Self::StatePoisoned => {
                Self::TaskState(format!("download manager state is poisoned; {context}"))
            }
            Self::MissingTask(task_id) => {
                Self::TaskState(format!("download task {task_id} was not found; {context}"))
            }
        }
    }
}

impl From<DownloadRequestError> for DownloadManagerError {
    fn from(error: DownloadRequestError) -> Self {
        Self::InvalidRequest(error.to_string())
    }
}

impl From<ResolveDownloadPathError> for DownloadManagerError {
    fn from(error: ResolveDownloadPathError) -> Self {
        match error {
            ResolveDownloadPathError::InvalidTarget(path_error) => {
                Self::InvalidRequest(path_error.to_string())
            }
            other => Self::ResolvePath(other.to_string()),
        }
    }
}

impl From<ArchiveStoreError> for DownloadManagerError {
    fn from(error: ArchiveStoreError) -> Self {
        match error {
            ArchiveStoreError::RelativeFilePathConflict {
                relative_file_path,
                existing_wallpaper_id,
                incoming_wallpaper_id,
            } => Self::relative_file_path_conflict(
                relative_file_path,
                existing_wallpaper_id,
                incoming_wallpaper_id,
            ),
            other => Self::Archive(other.to_string()),
        }
    }
}

impl From<ArchiveRecordError> for DownloadManagerError {
    fn from(error: ArchiveRecordError) -> Self {
        Self::TaskState(error.to_string())
    }
}

impl From<DownloadTaskError> for DownloadManagerError {
    fn from(error: DownloadTaskError) -> Self {
        Self::TaskState(error.to_string())
    }
}

impl From<DownloadEventError> for DownloadManagerError {
    fn from(error: DownloadEventError) -> Self {
        Self::Event(error.to_string())
    }
}

pub struct DownloadManagerState {
    inner: Mutex<DownloadStore>,
    archive_repository: ArchiveRepository,
}

#[derive(Clone)]
struct ReservedRelativePath {
    task_id: String,
    wallpaper_id: String,
}

struct ReservedRelativePathGuard<'a> {
    state: &'a DownloadManagerState,
    task_id: String,
    download_target_key: String,
}

#[derive(Default)]
struct DownloadStore {
    tasks_by_id: BTreeMap<String, DownloadTask>,
    reserved_download_targets: BTreeMap<String, ReservedRelativePath>,
}

impl Drop for ReservedRelativePathGuard<'_> {
    fn drop(&mut self) {
        self.state
            .release_reserved_download_target(&self.task_id, &self.download_target_key);
    }
}

impl DownloadManagerState {
    pub fn new(archive_repository: ArchiveRepository) -> Self {
        Self {
            inner: Mutex::new(DownloadStore::default()),
            archive_repository,
        }
    }

    pub fn list_downloads(&self) -> DownloadManagerResult<Vec<DownloadTask>> {
        Ok(self.lock()?.tasks_by_id.values().cloned().collect())
    }

    pub async fn find_archive_record(
        &self,
        wallpaper_id: &str,
    ) -> DownloadManagerResult<Option<ArchiveRecord>> {
        self.archive_repository
            .find_by_wallpaper_id(wallpaper_id)
            .await
            .map_err(Into::into)
    }

    async fn find_archive_record_by_download_target(
        &self,
        task: &DownloadTask,
    ) -> DownloadManagerResult<Option<ArchiveRecord>> {
        self.archive_repository
            .find_by_download_target(
                &task.strategy.base_dir,
                task.strategy.root_path.as_deref(),
                &task.target.relative_file_path,
            )
            .await
            .map_err(Into::into)
    }

    #[cfg(test)]
    fn create_task(&self, request: &DownloadRequest) -> DownloadManagerResult<DownloadTask> {
        self.create_task_with_strategy(request, default_download_strategy())
    }

    fn create_task_with_strategy(
        &self,
        request: &DownloadRequest,
        strategy: DownloadStrategy,
    ) -> DownloadManagerResult<DownloadTask> {
        let target = build_download_target_with_strategy(&strategy, request.file_name.trim())?;
        self.lock()?.create_task(request, strategy, target)
    }

    async fn reserve_archive_target<'a>(
        &'a self,
        task: &DownloadTask,
    ) -> DownloadManagerResult<ReservedRelativePathGuard<'a>> {
        let download_target_key = self.lock()?.reserve_download_target(task)?;

        let reservation = ReservedRelativePathGuard {
            state: self,
            task_id: task.id.clone(),
            download_target_key,
        };

        let Some(existing_record) = self.find_archive_record_by_download_target(task).await? else {
            return Ok(reservation);
        };

        if existing_record.wallpaper_id == task.wallpaper_id {
            return Ok(reservation);
        }

        Err(DownloadManagerError::relative_file_path_conflict(
            task.target.relative_file_path.clone(),
            existing_record.wallpaper_id,
            task.wallpaper_id.clone(),
        ))
    }

    fn release_reserved_download_target(&self, task_id: &str, download_target_key: &str) {
        if let Ok(mut store) = self.inner.lock() {
            store.release_reserved_download_target(task_id, download_target_key);
        }
    }

    fn mark_running(&self, task_id: &str) -> DownloadManagerResult<DownloadTask> {
        self.lock()?.mark_running(task_id)
    }

    async fn mark_succeeded(&self, task_id: &str) -> DownloadManagerResult<DownloadTask> {
        let updated_task = {
            let task = self
                .lock()?
                .tasks_by_id
                .get(task_id)
                .cloned()
                .ok_or_else(|| DownloadManagerError::MissingTask(task_id.to_string()))?;

            let mut updated_task = task.clone();
            updated_task.mark_succeeded()?;
            updated_task
        };

        let archive_record = ArchiveRecord::from_task(&updated_task)?;
        self.archive_repository.upsert(archive_record).await?;

        self.lock()?
            .tasks_by_id
            .insert(task_id.to_string(), updated_task.clone());

        Ok(updated_task)
    }

    fn mark_failed(&self, task_id: &str, reason: &str) -> DownloadManagerResult<DownloadTask> {
        self.lock()?.mark_failed(task_id, reason)
    }

    fn lock(&self) -> DownloadManagerResult<MutexGuard<'_, DownloadStore>> {
        self.inner
            .lock()
            .map_err(|_| DownloadManagerError::StatePoisoned)
    }
}

impl DownloadStore {
    fn create_task(
        &mut self,
        request: &DownloadRequest,
        strategy: DownloadStrategy,
        target: DownloadTarget,
    ) -> DownloadManagerResult<DownloadTask> {
        let task = DownloadTask::queued(
            format!("download-{}", Uuid::new_v4()),
            request.wallpaper_id.trim(),
            request.image_url.trim(),
            strategy,
            target,
        );

        self.tasks_by_id.insert(task.id.clone(), task.clone());
        Ok(task)
    }

    fn reserve_download_target(&mut self, task: &DownloadTask) -> DownloadManagerResult<String> {
        let key = download_target_key(task);
        match self.reserved_download_targets.get(&key) {
            Some(existing_reservation) if existing_reservation.task_id != task.id => {
                Err(DownloadManagerError::relative_file_path_conflict(
                    task.target.relative_file_path.clone(),
                    existing_reservation.wallpaper_id.clone(),
                    task.wallpaper_id.clone(),
                ))
            }
            _ => {
                self.reserved_download_targets.insert(
                    key.clone(),
                    ReservedRelativePath {
                        task_id: task.id.clone(),
                        wallpaper_id: task.wallpaper_id.clone(),
                    },
                );
                Ok(key)
            }
        }
    }

    fn release_reserved_download_target(&mut self, task_id: &str, download_target_key: &str) {
        let should_release = self
            .reserved_download_targets
            .get(download_target_key)
            .map(|reservation| reservation.task_id == task_id)
            .unwrap_or(false);

        if should_release {
            self.reserved_download_targets.remove(download_target_key);
        }
    }

    fn mark_running(&mut self, task_id: &str) -> DownloadManagerResult<DownloadTask> {
        let task = self
            .tasks_by_id
            .get_mut(task_id)
            .ok_or_else(|| DownloadManagerError::MissingTask(task_id.to_string()))?;
        task.mark_running()?;
        Ok(task.clone())
    }

    fn mark_failed(&mut self, task_id: &str, reason: &str) -> DownloadManagerResult<DownloadTask> {
        let task = self
            .tasks_by_id
            .get_mut(task_id)
            .ok_or_else(|| DownloadManagerError::MissingTask(task_id.to_string()))?;
        task.mark_failed(reason)?;
        Ok(task.clone())
    }
}

pub async fn download_wallpaper_to_directory(
    state: &DownloadManagerState,
    client: &Client,
    app_local_data_dir: &Path,
    request: DownloadRequest,
) -> DownloadManagerResult<DownloadTask> {
    download_wallpaper_to_directory_with_strategy(
        state,
        client,
        app_local_data_dir,
        default_download_strategy(),
        request,
    )
    .await
}

pub async fn download_wallpaper_to_directory_with_strategy(
    state: &DownloadManagerState,
    client: &Client,
    app_local_data_dir: &Path,
    strategy: DownloadStrategy,
    request: DownloadRequest,
) -> DownloadManagerResult<DownloadTask> {
    let event_emitter = NoopDownloadEventEmitter;

    download_wallpaper_to_directory_with_strategy_and_emitter(
        state,
        client,
        app_local_data_dir,
        strategy,
        request,
        &event_emitter,
    )
    .await
}

pub async fn download_wallpaper_to_directory_with_emitter<Emitter>(
    state: &DownloadManagerState,
    client: &Client,
    app_local_data_dir: &Path,
    request: DownloadRequest,
    event_emitter: &Emitter,
) -> DownloadManagerResult<DownloadTask>
where
    Emitter: DownloadEventEmitter,
{
    download_wallpaper_to_directory_with_strategy_and_emitter(
        state,
        client,
        app_local_data_dir,
        default_download_strategy(),
        request,
        event_emitter,
    )
    .await
}

pub(crate) async fn download_wallpaper_to_directory_with_strategy_and_emitter<Emitter>(
    state: &DownloadManagerState,
    client: &Client,
    app_local_data_dir: &Path,
    strategy: DownloadStrategy,
    request: DownloadRequest,
    event_emitter: &Emitter,
) -> DownloadManagerResult<DownloadTask>
where
    Emitter: DownloadEventEmitter,
{
    request.validate()?;

    let task = state.create_task_with_strategy(&request, strategy)?;
    emit_task_status(event_emitter, &task)
        .map_err(|error| fail_task_and_return(state, &task.id, error, event_emitter))?;

    let target_path = resolve_download_path(app_local_data_dir, &task.strategy, &task.target)
        .map_err(|error| fail_task_and_return(state, &task.id, error.into(), event_emitter))?;
    let _reservation = state
        .reserve_archive_target(&task)
        .await
        .map_err(|error| fail_task_and_return(state, &task.id, error, event_emitter))?;

    let running_task = state
        .mark_running(&task.id)
        .map_err(|error| fail_task_and_return(state, &task.id, error, event_emitter))?;
    emit_task_status(event_emitter, &running_task)
        .map_err(|error| fail_task_and_return(state, &task.id, error, event_emitter))?;

    let parent_dir = target_path.parent().ok_or_else(|| {
        fail_task_and_return(
            state,
            &task.id,
            DownloadManagerError::Io(format!(
                "download target {} has no parent directory",
                target_path.display()
            )),
            event_emitter,
        )
    })?;

    fs::create_dir_all(parent_dir).map_err(|error| {
        fail_task_and_return(
            state,
            &task.id,
            DownloadManagerError::Io(error.to_string()),
            event_emitter,
        )
    })?;

    let staged_target_path = build_staged_target_path(parent_dir, &task);
    let backup_target_path = build_backup_target_path(parent_dir, &task);

    let response = client.get(&task.source_url).send().await.map_err(|error| {
        fail_task_and_return(
            state,
            &task.id,
            DownloadManagerError::Network(error.to_string()),
            event_emitter,
        )
    })?;

    let response = response.error_for_status().map_err(|error| {
        fail_task_and_return(
            state,
            &task.id,
            DownloadManagerError::Network(error.to_string()),
            event_emitter,
        )
    })?;

    stream_response_to_file(response, &staged_target_path, &task, event_emitter)
        .await
        .map_err(|error| {
            fail_task_and_return(
                state,
                &task.id,
                attach_cleanup_context(
                    error,
                    cleanup_file_if_exists(&staged_target_path, "temporary download file"),
                ),
                event_emitter,
            )
        })?;

    let succeeded_task = promote_and_archive_download(
        state,
        &task,
        &staged_target_path,
        &target_path,
        &backup_target_path,
    )
    .await
    .map_err(|error| fail_task_and_return(state, &task.id, error, event_emitter))?;
    emit_task_status(event_emitter, &succeeded_task)
        .map_err(|error| fail_task_and_return(state, &task.id, error, event_emitter))?;

    Ok(succeeded_task)
}

fn build_staged_target_path(parent_dir: &Path, task: &DownloadTask) -> PathBuf {
    parent_dir.join(format!(".{}.{}.part", task.target.file_name, task.id))
}

fn build_backup_target_path(parent_dir: &Path, task: &DownloadTask) -> PathBuf {
    parent_dir.join(format!(".{}.{}.backup", task.target.file_name, task.id))
}

fn download_target_key(task: &DownloadTask) -> String {
    format!(
        "{}\0{}\0{}",
        task.strategy.base_dir,
        task.strategy.root_path.as_deref().unwrap_or_default(),
        task.target.relative_file_path,
    )
}

fn cleanup_file_if_exists(path: &Path, description: &str) -> Option<String> {
    match fs::remove_file(path) {
        Ok(()) => None,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => Some(format!(
            "failed to remove {description} {}: {error}",
            path.display()
        )),
    }
}

fn discard_file_if_exists(path: &Path) {
    let _ = cleanup_file_if_exists(path, "stale backup file");
}

fn attach_cleanup_context(
    error: DownloadManagerError,
    cleanup_context: Option<String>,
) -> DownloadManagerError {
    match cleanup_context {
        Some(context) => error.with_context(context),
        None => error,
    }
}

fn promote_staged_file(
    staged_target_path: &Path,
    target_path: &Path,
    backup_target_path: &Path,
) -> DownloadManagerResult<Option<PathBuf>> {
    let had_existing_target = target_path.exists();

    if had_existing_target {
        fs::rename(target_path, backup_target_path).map_err(|error| {
            attach_cleanup_context(
                DownloadManagerError::Io(format!(
                    "failed to move existing download target {} to backup {}: {error}",
                    target_path.display(),
                    backup_target_path.display()
                )),
                cleanup_file_if_exists(staged_target_path, "temporary download file"),
            )
        })?;
    }

    match fs::rename(staged_target_path, target_path) {
        Ok(()) => Ok(had_existing_target.then(|| backup_target_path.to_path_buf())),
        Err(error) => {
            let mut cleanup_messages = vec![format!(
                "failed to promote temporary download file {} to {}: {error}",
                staged_target_path.display(),
                target_path.display()
            )];

            if had_existing_target {
                if let Err(restore_error) = fs::rename(backup_target_path, target_path) {
                    cleanup_messages.push(format!(
                        "failed to restore previous download file from {} to {}: {restore_error}",
                        backup_target_path.display(),
                        target_path.display()
                    ));
                }
            }

            if let Some(cleanup_error) =
                cleanup_file_if_exists(staged_target_path, "temporary download file")
            {
                cleanup_messages.push(cleanup_error);
            }

            Err(DownloadManagerError::Io(cleanup_messages.join("; ")))
        }
    }
}

fn rollback_promoted_file(target_path: &Path, backup_target_path: Option<&Path>) -> Option<String> {
    let mut cleanup_messages = Vec::new();

    if let Some(cleanup_error) = cleanup_file_if_exists(target_path, "promoted download file") {
        cleanup_messages.push(cleanup_error);
    }

    if let Some(backup_target_path) = backup_target_path {
        if backup_target_path.exists() {
            if let Err(error) = fs::rename(backup_target_path, target_path) {
                cleanup_messages.push(format!(
                    "failed to restore previous download file from {} to {}: {error}",
                    backup_target_path.display(),
                    target_path.display()
                ));
            }
        }
    }

    if cleanup_messages.is_empty() {
        None
    } else {
        Some(cleanup_messages.join("; "))
    }
}

async fn promote_and_archive_download(
    state: &DownloadManagerState,
    task: &DownloadTask,
    staged_target_path: &Path,
    target_path: &Path,
    backup_target_path: &Path,
) -> DownloadManagerResult<DownloadTask> {
    let replaced_target_backup =
        promote_staged_file(staged_target_path, target_path, backup_target_path)?;

    match state.mark_succeeded(&task.id).await {
        Ok(succeeded_task) => {
            if let Some(backup_target_path) = replaced_target_backup.as_deref() {
                discard_file_if_exists(backup_target_path);
            }
            Ok(succeeded_task)
        }
        Err(error) => Err(attach_cleanup_context(
            error,
            rollback_promoted_file(target_path, replaced_target_backup.as_deref()),
        )),
    }
}

trait ChunkSource {
    fn next_chunk<'a>(
        &'a mut self,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = DownloadManagerResult<Option<Vec<u8>>>> + Send + 'a>,
    >;
}

struct ResponseChunkSource {
    response: Response,
}

impl ChunkSource for ResponseChunkSource {
    fn next_chunk<'a>(
        &'a mut self,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = DownloadManagerResult<Option<Vec<u8>>>> + Send + 'a>,
    > {
        Box::pin(async move {
            self.response
                .chunk()
                .await
                .map(|chunk| chunk.map(|chunk| chunk.to_vec()))
                .map_err(|error| DownloadManagerError::Network(error.to_string()))
        })
    }
}

fn emit_task_status<Emitter>(
    event_emitter: &Emitter,
    task: &DownloadTask,
) -> DownloadManagerResult<()>
where
    Emitter: DownloadEventEmitter,
{
    event_emitter
        .emit_status(DownloadTaskStatusEventPayload::from(task))
        .map_err(Into::into)
}

async fn stream_response_to_file<Emitter>(
    response: Response,
    target_path: &Path,
    task: &DownloadTask,
    event_emitter: &Emitter,
) -> DownloadManagerResult<()>
where
    Emitter: DownloadEventEmitter,
{
    let total_bytes = response.content_length();
    let mut source = ResponseChunkSource { response };

    write_source_to_file_with_progress_events(
        &mut source,
        target_path,
        task,
        total_bytes,
        event_emitter,
    )
    .await
}

async fn write_source_to_file_with_progress_events<Source, Emitter>(
    source: &mut Source,
    target_path: &Path,
    task: &DownloadTask,
    total_bytes: Option<u64>,
    event_emitter: &Emitter,
) -> DownloadManagerResult<()>
where
    Source: ChunkSource + Send,
    Emitter: DownloadEventEmitter,
{
    let mut downloaded_bytes = 0_u64;

    write_chunks_to_file(source, target_path, |chunk_size| {
        downloaded_bytes += chunk_size as u64;
        event_emitter
            .emit_progress(DownloadProgressEventPayload::new(
                task,
                downloaded_bytes,
                total_bytes,
            ))
            .map_err(Into::into)
    })
    .await
}

async fn write_chunks_to_file<Source, OnChunkWritten>(
    source: &mut Source,
    target_path: &Path,
    mut on_chunk_written: OnChunkWritten,
) -> DownloadManagerResult<()>
where
    Source: ChunkSource + Send,
    OnChunkWritten: FnMut(usize) -> DownloadManagerResult<()> + Send,
{
    let mut file = fs::File::create(target_path)
        .map_err(|error| DownloadManagerError::Io(error.to_string()))?;

    while let Some(chunk) = source.next_chunk().await? {
        file.write_all(&chunk)
            .map_err(|error| DownloadManagerError::Io(error.to_string()))?;
        on_chunk_written(chunk.len())?;
    }

    file.flush()
        .map_err(|error| DownloadManagerError::Io(error.to_string()))?;

    Ok(())
}

fn fail_task_and_return<Emitter>(
    state: &DownloadManagerState,
    task_id: &str,
    error: DownloadManagerError,
    event_emitter: &Emitter,
) -> DownloadManagerError
where
    Emitter: DownloadEventEmitter,
{
    let reason = error.to_string();
    match state.mark_failed(task_id, &reason) {
        Ok(failed_task) => {
            match event_emitter.emit_status(DownloadTaskStatusEventPayload::from(&failed_task)) {
                Ok(()) => error,
                Err(emit_error) => DownloadManagerError::Event(format!(
                    "{reason}; additionally failed to emit failed status: {emit_error}"
                )),
            }
        }
        Err(mark_error) => DownloadManagerError::TaskState(format!(
            "{reason}; additionally failed to persist failed status: {mark_error}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use reqwest::Client;
    use tempfile::TempDir;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use crate::db::{initialize_for_path, DatabaseState};
    use crate::models::download::{
        ArchiveRecord, DownloadRequest, DownloadStatus, DownloadStrategy, DownloadTarget,
        DownloadTask,
    };
    use crate::services::download_events::{
        DownloadEventEmitter, DownloadEventError, DownloadProgressEventPayload,
        DownloadTaskStatusEventPayload,
    };

    use super::{
        download_wallpaper_to_directory, download_wallpaper_to_directory_with_emitter,
        download_wallpaper_to_directory_with_strategy, write_chunks_to_file,
        write_source_to_file_with_progress_events, ChunkSource, DownloadManagerResult,
        DownloadManagerState,
    };

    struct TestDirectory {
        path: PathBuf,
    }

    impl TestDirectory {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "wallhaven-download-manager-tests-{}-{}",
                std::process::id(),
                unique
            ));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    struct TestDatabase {
        _temp_dir: TempDir,
        database: DatabaseState,
    }

    impl TestDatabase {
        async fn new() -> Self {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();

            Self {
                _temp_dir: temp_dir,
                database,
            }
        }

        fn download_manager_state(&self) -> DownloadManagerState {
            DownloadManagerState::new(self.database.archive_repository())
        }
    }

    struct ScriptedChunkSource {
        chunks: Vec<Vec<u8>>,
        next_chunk_index: usize,
        second_chunk_gate: Arc<(Mutex<bool>, Condvar)>,
    }

    impl ChunkSource for ScriptedChunkSource {
        fn next_chunk<'a>(
            &'a mut self,
        ) -> std::pin::Pin<
            Box<
                dyn std::future::Future<Output = DownloadManagerResult<Option<Vec<u8>>>>
                    + Send
                    + 'a,
            >,
        > {
            Box::pin(async move {
                match self.next_chunk_index {
                    0 => {
                        self.next_chunk_index += 1;
                        Ok(Some(self.chunks[0].clone()))
                    }
                    1 => {
                        self.next_chunk_index += 1;
                        let (lock, cvar) = &*self.second_chunk_gate;
                        let mut released = lock.lock().unwrap();
                        while !*released {
                            let wait_result =
                                cvar.wait_timeout(released, Duration::from_secs(2)).unwrap();
                            released = wait_result.0;
                            assert!(
                                *released || !wait_result.1.timed_out(),
                                "timed out waiting to release second chunk"
                            );
                        }
                        Ok(Some(self.chunks[1].clone()))
                    }
                    _ => Ok(None),
                }
            })
        }
    }

    #[derive(Clone, Debug, PartialEq, Eq)]
    enum RecordedDownloadEvent {
        Status(DownloadTaskStatusEventPayload),
        Progress(DownloadProgressEventPayload),
    }

    #[derive(Clone, Default)]
    struct RecordingDownloadEventEmitter {
        recorded_events: Arc<Mutex<Vec<RecordedDownloadEvent>>>,
    }

    impl RecordingDownloadEventEmitter {
        fn events(&self) -> Vec<RecordedDownloadEvent> {
            self.recorded_events.lock().unwrap().clone()
        }
    }

    impl DownloadEventEmitter for RecordingDownloadEventEmitter {
        fn emit_status(
            &self,
            payload: DownloadTaskStatusEventPayload,
        ) -> Result<(), DownloadEventError> {
            self.recorded_events
                .lock()
                .unwrap()
                .push(RecordedDownloadEvent::Status(payload));
            Ok(())
        }

        fn emit_progress(
            &self,
            payload: DownloadProgressEventPayload,
        ) -> Result<(), DownloadEventError> {
            self.recorded_events
                .lock()
                .unwrap()
                .push(RecordedDownloadEvent::Progress(payload));
            Ok(())
        }
    }

    #[derive(Clone)]
    struct ClosingArchiveStoreOnFirstProgressEmitter {
        pool: sqlx::SqlitePool,
        did_close: Arc<Mutex<bool>>,
    }

    impl ClosingArchiveStoreOnFirstProgressEmitter {
        fn new(pool: sqlx::SqlitePool) -> Self {
            Self {
                pool,
                did_close: Arc::new(Mutex::new(false)),
            }
        }
    }

    impl DownloadEventEmitter for ClosingArchiveStoreOnFirstProgressEmitter {
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
            let should_close = {
                let mut did_close = self.did_close.lock().unwrap();
                if *did_close {
                    false
                } else {
                    *did_close = true;
                    true
                }
            };

            if should_close {
                let pool = self.pool.clone();
                std::thread::spawn(move || {
                    tauri::async_runtime::block_on(async move {
                        pool.close().await;
                    });
                })
                .join()
                .unwrap();
            }

            Ok(())
        }
    }

    fn sample_download_task() -> DownloadTask {
        DownloadTask::queued(
            "download-000001",
            "wh-progress",
            "https://wallhaven.cc/w/wh-progress",
            DownloadStrategy::new("AppLocalData", "wallpapers"),
            DownloadTarget::new("wh-progress.jpg", "wallpapers/wh-progress.jpg"),
        )
    }

    #[test]
    fn successful_download_emits_queued_running_and_succeeded_status_events() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-events-success.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(ResponseTemplate::new(200).set_body_raw("ok", "image/jpeg"))
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let emitter = RecordingDownloadEventEmitter::default();
            let temp_dir = TestDirectory::new();

            let task = download_wallpaper_to_directory_with_emitter(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-events-success",
                    format!("{}{}", server.uri(), request_path),
                    "wh-events-success.jpg",
                ),
                &emitter,
            )
            .await
            .unwrap();

            let status_events = emitter
                .events()
                .into_iter()
                .filter_map(|event| match event {
                    RecordedDownloadEvent::Status(payload) => Some(payload),
                    RecordedDownloadEvent::Progress(_) => None,
                })
                .collect::<Vec<_>>();

            assert_eq!(task.status, DownloadStatus::Succeeded);
            assert_eq!(
                status_events
                    .iter()
                    .map(|payload| payload.status.clone())
                    .collect::<Vec<_>>(),
                vec![
                    DownloadStatus::Queued,
                    DownloadStatus::Running,
                    DownloadStatus::Succeeded,
                ]
            );
            assert!(status_events
                .iter()
                .all(|payload| payload.task_id == task.id));
            assert!(status_events
                .iter()
                .all(|payload| payload.wallpaper_id == "wh-events-success"));
        });
    }

    #[test]
    fn chunked_download_writes_emit_progress_events() {
        tauri::async_runtime::block_on(async {
            let temp_dir = TestDirectory::new();
            let target_dir = temp_dir.path().join("wallpapers");
            fs::create_dir_all(&target_dir).unwrap();
            let target_path = target_dir.join("progress.jpg");
            let second_chunk_gate = Arc::new((Mutex::new(true), Condvar::new()));
            let mut source = ScriptedChunkSource {
                chunks: vec![b"first".to_vec(), b"second".to_vec()],
                next_chunk_index: 0,
                second_chunk_gate,
            };
            let emitter = RecordingDownloadEventEmitter::default();
            let task = sample_download_task();

            write_source_to_file_with_progress_events(
                &mut source,
                target_path.as_path(),
                &task,
                Some(11),
                &emitter,
            )
            .await
            .unwrap();

            let progress_events = emitter
                .events()
                .into_iter()
                .filter_map(|event| match event {
                    RecordedDownloadEvent::Progress(payload) => Some(payload),
                    RecordedDownloadEvent::Status(_) => None,
                })
                .collect::<Vec<_>>();

            assert_eq!(progress_events.len(), 2);
            assert_eq!(
                progress_events
                    .iter()
                    .map(|payload| payload.downloaded_bytes)
                    .collect::<Vec<_>>(),
                vec![5, 11]
            );
            assert!(progress_events
                .iter()
                .all(|payload| payload.total_bytes == Some(11)));
        });
    }

    #[test]
    fn failed_download_emits_failed_status_event_with_reason() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-events-failure.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(ResponseTemplate::new(500).set_body_string("upstream failure"))
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let emitter = RecordingDownloadEventEmitter::default();
            let temp_dir = TestDirectory::new();
            let error = download_wallpaper_to_directory_with_emitter(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-events-failure",
                    format!("{}{}", server.uri(), request_path),
                    "wh-events-failure.jpg",
                ),
                &emitter,
            )
            .await
            .unwrap_err();

            let status_events = emitter
                .events()
                .into_iter()
                .filter_map(|event| match event {
                    RecordedDownloadEvent::Status(payload) => Some(payload),
                    RecordedDownloadEvent::Progress(_) => None,
                })
                .collect::<Vec<_>>();
            let failed_event = status_events.last().unwrap();

            assert!(error.to_string().contains("500"));
            assert_eq!(failed_event.status, DownloadStatus::Failed);
            assert!(failed_event
                .failure_reason
                .as_deref()
                .unwrap()
                .contains("500"));
        });
    }

    #[test]
    fn created_tasks_receive_unique_ids() {
        tauri::async_runtime::block_on(async {
            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();

            let first_task = state
                .create_task(&DownloadRequest::new(
                    "wh-unique-1",
                    "https://example.com/wh-unique-1.jpg",
                    "wh-unique-1.jpg",
                ))
                .unwrap();
            let second_task = state
                .create_task(&DownloadRequest::new(
                    "wh-unique-2",
                    "https://example.com/wh-unique-2.jpg",
                    "wh-unique-2.jpg",
                ))
                .unwrap();

            assert_ne!(first_task.id, second_task.id);
            assert!(first_task.id.starts_with("download-"));
            assert!(second_task.id.starts_with("download-"));
        });
    }


    #[test]
    fn download_manager_writes_into_the_configured_custom_directory() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let image_bytes = b"custom-directory-bytes".to_vec();
            let request_path = "/images/wh-custom.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(
                    ResponseTemplate::new(200).set_body_raw(image_bytes.clone(), "image/jpeg"),
                )
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let app_local_data_dir = TestDirectory::new();
            let custom_download_dir = TestDirectory::new();
            let strategy = DownloadStrategy::absolute_directory(
                custom_download_dir.path().to_string_lossy().into_owned(),
            );
            let task = download_wallpaper_to_directory_with_strategy(
                &state,
                &Client::new(),
                app_local_data_dir.path(),
                strategy,
                DownloadRequest::new(
                    "wh-custom",
                    format!("{}{}", server.uri(), request_path),
                    "wh-custom.jpg",
                ),
            )
            .await
            .unwrap();

            let expected_path = custom_download_dir.path().join("wh-custom.jpg");
            assert_eq!(task.target.relative_file_path, "wh-custom.jpg");
            assert!(expected_path.exists());
            assert_eq!(fs::read(expected_path).unwrap(), image_bytes);
        });
    }

    #[test]
    fn download_manager_uses_path_rules_to_write_into_app_local_data_wallpapers() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let image_bytes = b"wallpaper-bytes".to_vec();
            let request_path = "/images/wh-1.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(
                    ResponseTemplate::new(200).set_body_raw(image_bytes.clone(), "image/jpeg"),
                )
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let temp_dir = TestDirectory::new();
            let task = download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-1",
                    format!("{}{}", server.uri(), request_path),
                    "wh-1.jpg",
                ),
            )
            .await
            .unwrap();

            let expected_path = temp_dir.path().join("wallpapers/wh-1.jpg");
            assert_eq!(task.target.relative_file_path, "wallpapers/wh-1.jpg");
            assert!(expected_path.exists());
            assert_eq!(fs::read(expected_path).unwrap(), image_bytes);
        });
    }

    #[test]
    fn successful_download_is_listed_with_succeeded_status() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-2.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(ResponseTemplate::new(200).set_body_raw("ok", "image/jpeg"))
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let temp_dir = TestDirectory::new();

            download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-2",
                    format!("{}{}", server.uri(), request_path),
                    "wh-2.jpg",
                ),
            )
            .await
            .unwrap();

            let tasks = state.list_downloads().unwrap();
            assert_eq!(tasks.len(), 1);
            assert_eq!(tasks[0].status, DownloadStatus::Succeeded);
            assert_eq!(tasks[0].failure_reason, None);
        });
    }

    #[test]
    fn failed_download_is_listed_with_failed_status_and_reason() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-3.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(ResponseTemplate::new(500).set_body_string("upstream failure"))
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let temp_dir = TestDirectory::new();
            let error = download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-3",
                    format!("{}{}", server.uri(), request_path),
                    "wh-3.jpg",
                ),
            )
            .await
            .unwrap_err();

            assert!(error.to_string().contains("500"));

            let tasks = state.list_downloads().unwrap();
            assert_eq!(tasks.len(), 1);
            assert_eq!(tasks[0].status, DownloadStatus::Failed);
            assert!(tasks[0].failure_reason.as_deref().unwrap().contains("500"));
        });
    }

    #[test]
    fn successful_download_is_written_to_archive_store() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-4.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(ResponseTemplate::new(200).set_body_raw("archive", "image/jpeg"))
                .expect(1)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let temp_dir = TestDirectory::new();

            download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-4",
                    format!("{}{}", server.uri(), request_path),
                    "wh-4.jpg",
                ),
            )
            .await
            .unwrap();

            assert_eq!(
                state.find_archive_record("wh-4").await.unwrap(),
                Some(ArchiveRecord {
                    wallpaper_id: "wh-4".into(),
                    source_url: format!("{}{}", server.uri(), request_path),
                    file_name: "wh-4.jpg".into(),
                    relative_file_path: "wallpapers/wh-4.jpg".into(),
                    download_base_dir: "AppLocalData".into(),
                    download_root_path: None,
                })
            );
        });
    }

    #[test]
    fn archive_failures_remove_the_final_file_after_promotion() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-archive-failure.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(
                    ResponseTemplate::new(200).set_body_raw("archive-failure", "image/jpeg"),
                )
                .expect(1)
                .mount(&server)
                .await;

            let database_dir = tempfile::tempdir().unwrap();
            let database_path = database_dir.path().join("wallhaven.sqlite");
            let database = initialize_for_path(&database_path).await.unwrap();
            let state = DownloadManagerState::new(database.archive_repository());
            let emitter = ClosingArchiveStoreOnFirstProgressEmitter::new(database.pool().clone());
            let temp_dir = TestDirectory::new();
            let final_path = temp_dir.path().join("wallpapers/wh-archive-failure.jpg");

            let error = download_wallpaper_to_directory_with_emitter(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-archive-failure",
                    format!("{}{}", server.uri(), request_path),
                    "wh-archive-failure.jpg",
                ),
                &emitter,
            )
            .await
            .unwrap_err();

            assert!(error
                .to_string()
                .contains("archive store persistence error"));
            assert!(!final_path.exists());

            let reopened = initialize_for_path(&database_path).await.unwrap();
            let reopened_state = DownloadManagerState::new(reopened.archive_repository());
            assert_eq!(
                reopened_state
                    .find_archive_record("wh-archive-failure")
                    .await
                    .unwrap(),
                None
            );

            let failed_task = state
                .list_downloads()
                .unwrap()
                .into_iter()
                .find(|task| task.wallpaper_id == "wh-archive-failure")
                .unwrap();
            assert_eq!(failed_task.status, DownloadStatus::Failed);
        });
    }

    #[test]
    fn in_flight_relative_path_reservations_reject_follow_up_downloads_before_network_io() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/shared.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(
                    ResponseTemplate::new(200).set_body_raw("should-not-run", "image/jpeg"),
                )
                .expect(0)
                .mount(&server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let reserved_task = state
                .create_task(&DownloadRequest::new(
                    "wh-running",
                    "https://example.com/running/shared.jpg",
                    "shared.jpg",
                ))
                .unwrap();
            let _reservation = state.reserve_archive_target(&reserved_task).await.unwrap();
            let temp_dir = TestDirectory::new();

            let error = download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-conflict",
                    format!("{}{}", server.uri(), request_path),
                    "shared.jpg",
                ),
            )
            .await
            .unwrap_err();

            assert!(error
                .to_string()
                .contains("relative file path wallpapers/shared.jpg"));
            assert!(!temp_dir.path().join("wallpapers/shared.jpg").exists());

            let failed_task = state
                .list_downloads()
                .unwrap()
                .into_iter()
                .find(|task| task.wallpaper_id == "wh-conflict")
                .unwrap();
            assert_eq!(failed_task.status, DownloadStatus::Failed);
            assert!(failed_task
                .failure_reason
                .as_deref()
                .unwrap()
                .contains("relative file path wallpapers/shared.jpg"));
        });
    }

    #[test]
    fn conflicting_archive_target_does_not_overwrite_existing_file() {
        tauri::async_runtime::block_on(async {
            let archived_server = MockServer::start().await;
            let conflicting_server = MockServer::start().await;
            let request_path = "/images/shared.jpg";
            let archived_bytes = b"archived-wallpaper".to_vec();
            let conflicting_bytes = b"conflicting-wallpaper".to_vec();

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(
                    ResponseTemplate::new(200).set_body_raw(archived_bytes.clone(), "image/jpeg"),
                )
                .expect(1)
                .mount(&archived_server)
                .await;

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(
                    ResponseTemplate::new(200)
                        .set_body_raw(conflicting_bytes.clone(), "image/jpeg"),
                )
                .expect(0)
                .mount(&conflicting_server)
                .await;

            let test_database = TestDatabase::new().await;
            let state = test_database.download_manager_state();
            let temp_dir = TestDirectory::new();
            let target_path = temp_dir.path().join("wallpapers/shared.jpg");

            download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-archived",
                    format!("{}{}", archived_server.uri(), request_path),
                    "shared.jpg",
                ),
            )
            .await
            .unwrap();

            let error = download_wallpaper_to_directory(
                &state,
                &Client::new(),
                temp_dir.path(),
                DownloadRequest::new(
                    "wh-conflict",
                    format!("{}{}", conflicting_server.uri(), request_path),
                    "shared.jpg",
                ),
            )
            .await
            .unwrap_err();

            assert!(error
                .to_string()
                .contains("relative file path wallpapers/shared.jpg is already reserved"));
            assert_eq!(fs::read(&target_path).unwrap(), archived_bytes);
            assert_eq!(
                state.find_archive_record("wh-conflict").await.unwrap(),
                None
            );
            assert_eq!(
                state.find_archive_record("wh-archived").await.unwrap(),
                Some(ArchiveRecord {
                    wallpaper_id: "wh-archived".into(),
                    source_url: format!("{}{}", archived_server.uri(), request_path),
                    file_name: "shared.jpg".into(),
                    relative_file_path: "wallpapers/shared.jpg".into(),
                    download_base_dir: "AppLocalData".into(),
                    download_root_path: None,
                })
            );

            let failed_task = state
                .list_downloads()
                .unwrap()
                .into_iter()
                .find(|task| task.wallpaper_id == "wh-conflict")
                .unwrap();
            assert_eq!(failed_task.status, DownloadStatus::Failed);
            assert!(failed_task
                .failure_reason
                .as_deref()
                .unwrap()
                .contains("relative file path wallpapers/shared.jpg is already reserved"));
        });
    }

    #[test]
    fn download_stream_writes_first_chunk_before_response_completes() {
        tauri::async_runtime::block_on(async {
            let temp_dir = TestDirectory::new();
            let target_dir = temp_dir.path().join("wallpapers");
            fs::create_dir_all(&target_dir).unwrap();
            let target_path = target_dir.join("streamed.jpg");
            let writer_target_path = target_path.clone();
            let first_chunk = vec![b'a'; 64 * 1024];
            let second_chunk = vec![b'b'; 64 * 1024];
            let expected_first_chunk = first_chunk.clone();
            let expected_full_body = [first_chunk.clone(), second_chunk.clone()].concat();
            let second_chunk_gate = Arc::new((Mutex::new(false), Condvar::new()));
            let second_chunk_gate_for_writer = Arc::clone(&second_chunk_gate);
            let (first_chunk_written_tx, first_chunk_written_rx) = std::sync::mpsc::sync_channel(1);

            let writer_handle = tauri::async_runtime::spawn(async move {
                let mut source = ScriptedChunkSource {
                    chunks: vec![first_chunk, second_chunk],
                    next_chunk_index: 0,
                    second_chunk_gate: second_chunk_gate_for_writer,
                };
                let mut first_chunk_notified = false;
                write_chunks_to_file(&mut source, writer_target_path.as_path(), move |_| {
                    if !first_chunk_notified {
                        first_chunk_notified = true;
                        first_chunk_written_tx.send(()).unwrap();
                    }
                    Ok(())
                })
                .await
            });

            first_chunk_written_rx
                .recv_timeout(Duration::from_secs(2))
                .unwrap();
            assert_eq!(fs::read(&target_path).unwrap(), expected_first_chunk);

            let (lock, cvar) = &*second_chunk_gate;
            let mut released = lock.lock().unwrap();
            *released = true;
            cvar.notify_one();
            drop(released);

            writer_handle.await.unwrap().unwrap();
            assert_eq!(fs::read(&target_path).unwrap(), expected_full_body);
        });
    }
}
