use std::error::Error;
use std::fmt;

use crate::models::download::{DownloadStrategy, DownloadTarget};

pub const DEFAULT_BASE_DIR: &str = "AppLocalData";
pub const DEFAULT_RELATIVE_PATH: &str = "wallpapers";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PathRuleError {
    EmptyFileName,
    EmptyRelativePath,
    AbsolutePath,
    NestedPath,
    PathTraversal,
}

impl fmt::Display for PathRuleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyFileName => write!(f, "file name must not be empty"),
            Self::EmptyRelativePath => write!(f, "relative path must not be empty"),
            Self::AbsolutePath => write!(f, "absolute paths are not allowed"),
            Self::NestedPath => write!(f, "file name must not contain nested directories"),
            Self::PathTraversal => write!(f, "path traversal segments are not allowed"),
        }
    }
}

impl Error for PathRuleError {}

pub fn default_download_strategy() -> DownloadStrategy {
    DownloadStrategy::new(DEFAULT_BASE_DIR, DEFAULT_RELATIVE_PATH)
}

pub fn build_download_target(file_name: &str) -> Result<DownloadTarget, PathRuleError> {
    let strategy = default_download_strategy();
    build_download_target_with_strategy(&strategy, file_name)
}

pub fn build_download_target_with_strategy(
    strategy: &DownloadStrategy,
    file_name: &str,
) -> Result<DownloadTarget, PathRuleError> {
    let file_name = validate_file_name(file_name)?;
    let relative_root = normalize_relative_path(&strategy.relative_path)?;

    Ok(DownloadTarget::new(
        file_name,
        format!("{relative_root}/{file_name}"),
    ))
}

fn validate_file_name(file_name: &str) -> Result<&str, PathRuleError> {
    if file_name.trim().is_empty() {
        return Err(PathRuleError::EmptyFileName);
    }

    if file_name.starts_with('/') || file_name.starts_with('\\') {
        return Err(PathRuleError::AbsolutePath);
    }

    if matches!(file_name, "." | "..") {
        return Err(PathRuleError::PathTraversal);
    }

    if file_name
        .split(['/', '\\'])
        .any(|segment| matches!(segment, "." | ".."))
    {
        return Err(PathRuleError::PathTraversal);
    }

    if file_name.contains('/') || file_name.contains('\\') {
        return Err(PathRuleError::NestedPath);
    }

    Ok(file_name)
}

fn has_windows_drive_prefix(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':'
}

fn normalize_relative_path(relative_path: &str) -> Result<String, PathRuleError> {
    let relative_path = relative_path.trim();
    if relative_path.is_empty() {
        return Err(PathRuleError::EmptyRelativePath);
    }

    if relative_path.starts_with('/')
        || relative_path.starts_with('\\')
        || has_windows_drive_prefix(relative_path)
    {
        return Err(PathRuleError::AbsolutePath);
    }

    let mut segments = Vec::new();
    for segment in relative_path.split(['/', '\\']) {
        let segment = segment.trim();
        if segment.is_empty() {
            continue;
        }

        if matches!(segment, "." | "..") {
            return Err(PathRuleError::PathTraversal);
        }

        segments.push(segment);
    }

    if segments.is_empty() {
        return Err(PathRuleError::EmptyRelativePath);
    }

    Ok(segments.join("/"))
}

#[cfg(test)]
mod tests {
    use super::{
        PathRuleError, build_download_target, build_download_target_with_strategy,
        default_download_strategy,
    };
    use crate::models::download::{DownloadStrategy, DownloadTarget};

    #[test]
    fn default_download_strategy_uses_app_local_data_wallpapers() {
        assert_eq!(
            default_download_strategy(),
            DownloadStrategy::new("AppLocalData", "wallpapers")
        );
    }

    #[test]
    fn build_download_target_places_file_under_wallpapers_directory() {
        assert_eq!(
            build_download_target("wallhaven-kxpkmm.jpg").unwrap(),
            DownloadTarget::new(
                "wallhaven-kxpkmm.jpg",
                "wallpapers/wallhaven-kxpkmm.jpg",
            )
        );
    }

    #[test]
    fn build_download_target_with_strategy_reuses_strategy_relative_path() {
        let strategy = DownloadStrategy::new("AppLocalData", "wallpapers/favorites");

        assert_eq!(
            build_download_target_with_strategy(&strategy, "fav.jpg").unwrap(),
            DownloadTarget::new("fav.jpg", "wallpapers/favorites/fav.jpg")
        );
    }

    #[test]
    fn build_download_target_with_strategy_rejects_relative_path_traversal() {
        let strategy = DownloadStrategy::new("AppLocalData", "wallpapers/../favorites");

        assert_eq!(
            build_download_target_with_strategy(&strategy, "fav.jpg").unwrap_err(),
            PathRuleError::PathTraversal
        );
    }

    #[test]
    fn build_download_target_with_strategy_rejects_windows_drive_prefix_relative_paths() {
        let strategy = DownloadStrategy::new("AppLocalData", "D:wallpapers");

        assert_eq!(
            build_download_target_with_strategy(&strategy, "fav.jpg").unwrap_err(),
            PathRuleError::AbsolutePath
        );
    }

    #[test]
    fn build_download_target_rejects_nested_paths() {
        assert_eq!(
            build_download_target("nested/wallpaper.jpg").unwrap_err(),
            PathRuleError::NestedPath
        );
    }

    #[test]
    fn build_download_target_rejects_path_traversal() {
        assert_eq!(
            build_download_target("../wallpaper.jpg").unwrap_err(),
            PathRuleError::PathTraversal
        );
    }

    #[test]
    fn build_download_target_rejects_absolute_paths() {
        assert_eq!(
            build_download_target("/tmp/wallpaper.jpg").unwrap_err(),
            PathRuleError::AbsolutePath
        );
    }
}
