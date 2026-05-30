use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

use crate::db::archive_repository::ArchiveRepository;
use crate::db::DatabaseState;
use crate::models::download::{DownloadStrategy, DownloadTarget};
use crate::models::gallery::{GalleryArchiveRecord, GalleryListQuery, GalleryListQueryError};
use crate::services::archive_service::ArchiveStoreError;
use crate::services::path_service::{
    default_download_strategy, resolve_download_path, ResolveDownloadPathError,
};

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryListRequest {
    pub page: u32,
    pub page_size: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetGalleryFavoriteRequest {
    pub wallpaper_id: String,
    pub is_favorite: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGalleryTagsRequest {
    pub wallpaper_id: String,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryListResponse {
    pub items: Vec<GalleryItemDto>,
    pub page: u32,
    pub page_size: u32,
    pub total: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryItemDto {
    pub wallpaper_id: String,
    pub source_url: String,
    pub file_name: String,
    pub relative_file_path: String,
    pub absolute_path: String,
    pub purity: Option<String>,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub created_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GalleryCommandErrorKind {
    InvalidRequest,
    Internal,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryCommandError {
    pub kind: GalleryCommandErrorKind,
    pub message: String,
}

impl GalleryCommandError {
    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            kind: GalleryCommandErrorKind::InvalidRequest,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: GalleryCommandErrorKind::Internal,
            message: message.into(),
        }
    }
}

fn normalize_gallery_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized_tags = Vec::new();

    for tag in tags {
        let normalized_tag = tag.trim();
        if normalized_tag.is_empty()
            || normalized_tag.len() > 40
            || normalized_tags
                .iter()
                .any(|existing: &String| existing.eq_ignore_ascii_case(normalized_tag))
        {
            continue;
        }

        normalized_tags.push(normalized_tag.to_string());
    }

    normalized_tags.truncate(12);
    normalized_tags
}

impl From<GalleryListQueryError> for GalleryCommandError {
    fn from(error: GalleryListQueryError) -> Self {
        Self {
            kind: GalleryCommandErrorKind::InvalidRequest,
            message: error.to_string(),
        }
    }
}

impl From<ArchiveStoreError> for GalleryCommandError {
    fn from(error: ArchiveStoreError) -> Self {
        Self::internal(error.to_string())
    }
}

impl From<ResolveDownloadPathError> for GalleryCommandError {
    fn from(error: ResolveDownloadPathError) -> Self {
        Self::internal(error.to_string())
    }
}

fn archive_record_strategy(record: &GalleryArchiveRecord) -> DownloadStrategy {
    match record.download_base_dir.as_str() {
        "Absolute" => DownloadStrategy::absolute_directory(
            record.download_root_path.clone().unwrap_or_default(),
        ),
        _ => {
            let mut strategy = default_download_strategy();
            strategy.base_dir = record.download_base_dir.clone();
            strategy
        }
    }
}

fn to_gallery_item_dto(
    record: GalleryArchiveRecord,
    app_local_data_dir: &Path,
) -> Result<GalleryItemDto, GalleryCommandError> {
    let strategy = archive_record_strategy(&record);
    let absolute_path = resolve_download_path(
        app_local_data_dir,
        &strategy,
        &DownloadTarget::new(record.file_name.clone(), record.relative_file_path.clone()),
    )?;

    Ok(GalleryItemDto {
        wallpaper_id: record.wallpaper_id,
        source_url: record.source_url,
        file_name: record.file_name,
        relative_file_path: record.relative_file_path,
        absolute_path: absolute_path.to_string_lossy().into_owned(),
        purity: record.purity,
        category: record.category,
        tags: record.tags,
        is_favorite: record.is_favorite,
        created_at: record.created_at,
    })
}

async fn list_gallery_items_from_repository(
    repository: &ArchiveRepository,
    app_local_data_dir: &Path,
    request: GalleryListRequest,
) -> Result<GalleryListResponse, GalleryCommandError> {
    let query = GalleryListQuery::new(request.page, request.page_size)?;
    let page = repository.list_gallery_page(&query).await?;
    let items = page
        .items
        .into_iter()
        .map(|item| to_gallery_item_dto(item, app_local_data_dir))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(GalleryListResponse {
        items,
        page: query.page(),
        page_size: query.page_size(),
        total: page.total,
    })
}

#[tauri::command]
pub async fn list_gallery_items(
    app: AppHandle,
    state: State<'_, DatabaseState>,
    request: GalleryListRequest,
) -> Result<GalleryListResponse, GalleryCommandError> {
    let app_local_data_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|error| GalleryCommandError::internal(error.to_string()))?;
    let response = list_gallery_items_from_repository(
        &state.archive_repository(),
        app_local_data_dir.as_path(),
        request,
    )
    .await?;

    for item in &response.items {
        app.asset_protocol_scope()
            .allow_file(Path::new(&item.absolute_path))
            .map_err(|error| GalleryCommandError::internal(error.to_string()))?;
    }

    Ok(response)
}

async fn resolve_app_local_data_dir(
    app: &AppHandle,
) -> Result<std::path::PathBuf, GalleryCommandError> {
    app.path()
        .resolve("", BaseDirectory::AppLocalData)
        .map_err(|error| GalleryCommandError::internal(error.to_string()))
}

async fn gallery_item_after_update(
    app: &AppHandle,
    record: Option<GalleryArchiveRecord>,
) -> Result<GalleryItemDto, GalleryCommandError> {
    let record = record.ok_or_else(|| {
        GalleryCommandError::invalid_request(
            "Gallery wallpaper was not found in the local archive.",
        )
    })?;
    let app_local_data_dir = resolve_app_local_data_dir(app).await?;
    let item = to_gallery_item_dto(record, app_local_data_dir.as_path())?;
    app.asset_protocol_scope()
        .allow_file(Path::new(&item.absolute_path))
        .map_err(|error| GalleryCommandError::internal(error.to_string()))?;
    Ok(item)
}

#[tauri::command]
pub async fn set_gallery_favorite(
    app: AppHandle,
    state: State<'_, DatabaseState>,
    request: SetGalleryFavoriteRequest,
) -> Result<GalleryItemDto, GalleryCommandError> {
    if request.wallpaper_id.trim().is_empty() {
        return Err(GalleryCommandError::invalid_request(
            "wallpaperId must not be empty.",
        ));
    }

    let record = state
        .archive_repository()
        .set_favorite(&request.wallpaper_id, request.is_favorite)
        .await?;

    gallery_item_after_update(&app, record).await
}

#[tauri::command]
pub async fn update_gallery_tags(
    app: AppHandle,
    state: State<'_, DatabaseState>,
    request: UpdateGalleryTagsRequest,
) -> Result<GalleryItemDto, GalleryCommandError> {
    if request.wallpaper_id.trim().is_empty() {
        return Err(GalleryCommandError::invalid_request(
            "wallpaperId must not be empty.",
        ));
    }

    let tags = normalize_gallery_tags(request.tags);
    let record = state
        .archive_repository()
        .update_tags(&request.wallpaper_id, &tags)
        .await?;

    gallery_item_after_update(&app, record).await
}

#[cfg(test)]
mod tests {
    use reqwest::Client;
    use sqlx::query;
    use tempfile::tempdir;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use crate::db::initialize_for_path;
    use crate::models::download::DownloadRequest;
    use crate::services::download_manager::{
        download_wallpaper_to_directory, DownloadManagerState,
    };

    use super::{
        list_gallery_items_from_repository, GalleryItemDto, GalleryListRequest, GalleryListResponse,
    };

    #[test]
    fn gallery_command_boundary_serializes_response_fields_in_camel_case() {
        let response = GalleryListResponse {
            items: vec![GalleryItemDto {
                wallpaper_id: "wh-1".into(),
                source_url: "https://wallhaven.cc/w/wh-1".into(),
                file_name: "wh-1.jpg".into(),
                relative_file_path: "wallpapers/wh-1.jpg".into(),
                absolute_path: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wh-1.jpg".into(),
                purity: Some("sfw".into()),
                category: Some("general".into()),
                tags: vec![],
                is_favorite: false,
                created_at: "2026-05-24 12:00:00".into(),
            }],
            page: 1,
            page_size: 20,
            total: 1,
        };
        let serialized = serde_json::to_value(response).unwrap();
        let first_item = &serialized["items"][0];

        assert_eq!(serialized["page"], 1);
        assert_eq!(serialized["pageSize"], 20);
        assert!(serialized.get("page_size").is_none());
        assert_eq!(first_item["wallpaperId"], "wh-1");
        assert!(first_item.get("wallpaper_id").is_none());
        assert_eq!(first_item["sourceUrl"], "https://wallhaven.cc/w/wh-1");
        assert!(first_item.get("source_url").is_none());
        assert_eq!(first_item["relativeFilePath"], "wallpapers/wh-1.jpg");
        assert!(first_item.get("relative_file_path").is_none());
        assert_eq!(
            first_item["absolutePath"],
            "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wh-1.jpg"
        );
        assert!(first_item.get("absolute_path").is_none());
        assert_eq!(first_item["createdAt"], "2026-05-24 12:00:00");
        assert!(first_item.get("created_at").is_none());
    }

    #[test]
    fn gallery_command_uses_archived_custom_directory_after_the_setting_changes() {
        tauri::async_runtime::block_on(async {
            let database_dir = tempdir().unwrap();
            let database = initialize_for_path(&database_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let custom_download_dir = tempdir().unwrap();
            let app_local_data_dir = tempdir().unwrap();

            query(
                "INSERT INTO wallpapers (wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind("wh-custom")
            .bind("https://wallhaven.cc/w/wh-custom")
            .bind("wh-custom.jpg")
            .bind("wh-custom.jpg")
            .bind("Absolute")
            .bind(custom_download_dir.path().to_string_lossy().into_owned())
            .bind("2026-05-26 09:00:00")
            .execute(database.pool())
            .await
            .unwrap();

            let response = list_gallery_items_from_repository(
                &database.archive_repository(),
                app_local_data_dir.path(),
                GalleryListRequest {
                    page: 1,
                    page_size: 20,
                },
            )
            .await
            .unwrap();

            assert_eq!(response.total, 1);
            assert_eq!(response.items[0].relative_file_path, "wh-custom.jpg");
            assert_eq!(
                response.items[0].absolute_path,
                custom_download_dir
                    .path()
                    .join("wh-custom.jpg")
                    .to_string_lossy()
                    .into_owned()
            );
        });
    }

    #[test]
    fn gallery_command_reads_from_sqlite_archive_and_ignores_in_memory_download_tasks() {
        tauri::async_runtime::block_on(async {
            let server = MockServer::start().await;
            let request_path = "/images/wh-in-memory.jpg";

            Mock::given(method("GET"))
                .and(path(request_path))
                .respond_with(ResponseTemplate::new(500).set_body_string("upstream failure"))
                .expect(1)
                .mount(&server)
                .await;

            let database_dir = tempdir().unwrap();
            let database = initialize_for_path(&database_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            query(
                "INSERT INTO wallpapers (wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind("wh-archived")
            .bind("https://wallhaven.cc/w/wh-archived")
            .bind("wh-archived.jpg")
            .bind("wallpapers/wh-archived.jpg")
            .bind("AppLocalData")
            .bind::<Option<String>>(None)
            .bind("2026-05-24 12:00:00")
            .execute(database.pool())
            .await
            .unwrap();

            let download_manager = DownloadManagerState::new(database.archive_repository());
            let app_local_data_dir = tempdir().unwrap();
            let error = download_wallpaper_to_directory(
                &download_manager,
                &Client::new(),
                app_local_data_dir.path(),
                DownloadRequest::new(
                    "wh-in-memory",
                    format!("{}{}", server.uri(), request_path),
                    "wh-in-memory.jpg",
                ),
            )
            .await
            .unwrap_err();

            assert!(error.to_string().contains("500"));
            assert_eq!(download_manager.list_downloads().unwrap().len(), 1);

            let response = list_gallery_items_from_repository(
                &database.archive_repository(),
                app_local_data_dir.path(),
                GalleryListRequest {
                    page: 1,
                    page_size: 20,
                },
            )
            .await
            .unwrap();

            assert_eq!(response.total, 1);
            assert_eq!(
                response.items,
                vec![GalleryItemDto {
                    wallpaper_id: "wh-archived".into(),
                    source_url: "https://wallhaven.cc/w/wh-archived".into(),
                    file_name: "wh-archived.jpg".into(),
                    relative_file_path: "wallpapers/wh-archived.jpg".into(),
                    absolute_path: app_local_data_dir
                        .path()
                        .join("wallpapers/wh-archived.jpg")
                        .to_string_lossy()
                        .into_owned(),
                    purity: None,
                    category: None,
                    tags: vec![],
                    is_favorite: false,
                    created_at: "2026-05-24 12:00:00".into(),
                }]
            );
        });
    }
}
