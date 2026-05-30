use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};

use crate::models::download::{DownloadStrategy, DownloadTarget};

pub const DEFAULT_BASE_DIR: &str = "AppLocalData";
pub const ABSOLUTE_BASE_DIR: &str = "Absolute";
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RootPathError {
    Empty,
    Relative,
}

impl fmt::Display for RootPathError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Empty => write!(f, "custom download directory must not be empty"),
            Self::Relative => write!(f, "custom download directory must be an absolute path"),
        }
    }
}

impl Error for RootPathError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ResolveDownloadPathError {
    UnsupportedBaseDir(String),
    InvalidRootPath(RootPathError),
    InvalidTarget(PathRuleError),
    TargetPathMismatch { expected: String, actual: String },
}

impl fmt::Display for ResolveDownloadPathError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedBaseDir(base_dir) => {
                write!(f, "unsupported download base dir: {base_dir}")
            }
            Self::InvalidRootPath(error) => error.fmt(f),
            Self::InvalidTarget(error) => error.fmt(f),
            Self::TargetPathMismatch { expected, actual } => write!(
                f,
                "download target path mismatch: expected {expected}, got {actual}"
            ),
        }
    }
}

impl Error for ResolveDownloadPathError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::InvalidRootPath(error) => Some(error),
            Self::InvalidTarget(error) => Some(error),
            _ => None,
        }
    }
}

pub fn default_download_strategy() -> DownloadStrategy {
    DownloadStrategy::new(DEFAULT_BASE_DIR, DEFAULT_RELATIVE_PATH)
}

pub fn strategy_from_custom_download_directory(
    custom_directory: Option<&str>,
) -> Result<DownloadStrategy, ResolveDownloadPathError> {
    match custom_directory {
        Some(path) if !path.trim().is_empty() => Ok(DownloadStrategy::absolute_directory(
            normalize_absolute_root_path(path)
                .map_err(ResolveDownloadPathError::InvalidRootPath)?,
        )),
        _ => Ok(default_download_strategy()),
    }
}

pub fn resolve_effective_download_directory(
    app_local_data_dir: &Path,
    custom_directory: Option<&str>,
) -> Result<PathBuf, ResolveDownloadPathError> {
    let strategy = strategy_from_custom_download_directory(custom_directory)?;
    resolve_strategy_directory(app_local_data_dir, &strategy)
}

pub fn build_download_target(file_name: &str) -> Result<DownloadTarget, ResolveDownloadPathError> {
    let strategy = default_download_strategy();
    build_download_target_with_strategy(&strategy, file_name)
}

pub fn build_download_target_with_strategy(
    strategy: &DownloadStrategy,
    file_name: &str,
) -> Result<DownloadTarget, ResolveDownloadPathError> {
    let file_name =
        validate_file_name(file_name).map_err(ResolveDownloadPathError::InvalidTarget)?;

    match strategy.base_dir.trim() {
        DEFAULT_BASE_DIR => {
            let relative_root = normalize_relative_path(&strategy.relative_path)
                .map_err(ResolveDownloadPathError::InvalidTarget)?;

            Ok(DownloadTarget::new(
                file_name,
                format!("{relative_root}/{file_name}"),
            ))
        }
        ABSOLUTE_BASE_DIR => Ok(DownloadTarget::new(file_name, file_name)),
        other => Err(ResolveDownloadPathError::UnsupportedBaseDir(
            other.to_string(),
        )),
    }
}

pub fn resolve_download_path(
    app_local_data_dir: &Path,
    strategy: &DownloadStrategy,
    target: &DownloadTarget,
) -> Result<PathBuf, ResolveDownloadPathError> {
    let expected_target = build_download_target_with_strategy(strategy, &target.file_name)?;

    if target.relative_file_path != expected_target.relative_file_path {
        return Err(ResolveDownloadPathError::TargetPathMismatch {
            expected: expected_target.relative_file_path,
            actual: target.relative_file_path.clone(),
        });
    }

    match strategy.base_dir.trim() {
        DEFAULT_BASE_DIR => Ok(app_local_data_dir.join(&target.relative_file_path)),
        ABSOLUTE_BASE_DIR => {
            let root_path = normalize_absolute_root_path(strategy.root_path.as_deref().ok_or(
                ResolveDownloadPathError::InvalidRootPath(RootPathError::Empty),
            )?)
            .map_err(ResolveDownloadPathError::InvalidRootPath)?;

            Ok(PathBuf::from(root_path).join(&target.relative_file_path))
        }
        other => Err(ResolveDownloadPathError::UnsupportedBaseDir(
            other.to_string(),
        )),
    }
}

fn resolve_strategy_directory(
    app_local_data_dir: &Path,
    strategy: &DownloadStrategy,
) -> Result<PathBuf, ResolveDownloadPathError> {
    match strategy.base_dir.trim() {
        DEFAULT_BASE_DIR => {
            let relative_root = normalize_relative_path(&strategy.relative_path)
                .map_err(ResolveDownloadPathError::InvalidTarget)?;
            Ok(app_local_data_dir.join(relative_root))
        }
        ABSOLUTE_BASE_DIR => {
            let root_path = normalize_absolute_root_path(strategy.root_path.as_deref().ok_or(
                ResolveDownloadPathError::InvalidRootPath(RootPathError::Empty),
            )?)
            .map_err(ResolveDownloadPathError::InvalidRootPath)?;
            Ok(PathBuf::from(root_path))
        }
        other => Err(ResolveDownloadPathError::UnsupportedBaseDir(
            other.to_string(),
        )),
    }
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

fn normalize_absolute_root_path(root_path: &str) -> Result<String, RootPathError> {
    let root_path = root_path.trim();
    if root_path.is_empty() {
        return Err(RootPathError::Empty);
    }

    let path = Path::new(root_path);
    if !path.is_absolute() {
        return Err(RootPathError::Relative);
    }

    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{
        build_download_target, build_download_target_with_strategy, default_download_strategy,
        resolve_download_path, resolve_effective_download_directory,
        strategy_from_custom_download_directory, PathRuleError, ResolveDownloadPathError,
        RootPathError,
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
    fn strategy_from_custom_download_directory_uses_the_default_strategy_when_blank() {
        assert_eq!(
            strategy_from_custom_download_directory(Some("   ")).unwrap(),
            default_download_strategy()
        );
    }

    #[test]
    fn strategy_from_custom_download_directory_requires_an_absolute_path() {
        assert_eq!(
            strategy_from_custom_download_directory(Some("Downloads/Wallhaven")).unwrap_err(),
            ResolveDownloadPathError::InvalidRootPath(RootPathError::Relative)
        );
    }

    #[test]
    fn build_download_target_places_file_under_wallpapers_directory() {
        assert_eq!(
            build_download_target("wallhaven-kxpkmm.jpg").unwrap(),
            DownloadTarget::new("wallhaven-kxpkmm.jpg", "wallpapers/wallhaven-kxpkmm.jpg",)
        );
    }

    #[test]
    fn build_download_target_with_custom_absolute_strategy_keeps_the_file_name_relative() {
        let strategy = DownloadStrategy::absolute_directory("/Users/test/Pictures/Wallhaven");

        assert_eq!(
            build_download_target_with_strategy(&strategy, "fav.jpg").unwrap(),
            DownloadTarget::new("fav.jpg", "fav.jpg")
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
            ResolveDownloadPathError::InvalidTarget(PathRuleError::PathTraversal)
        );
    }

    #[test]
    fn build_download_target_with_strategy_rejects_windows_drive_prefix_relative_paths() {
        let strategy = DownloadStrategy::new("AppLocalData", "D:wallpapers");

        assert_eq!(
            build_download_target_with_strategy(&strategy, "fav.jpg").unwrap_err(),
            ResolveDownloadPathError::InvalidTarget(PathRuleError::AbsolutePath)
        );
    }

    #[test]
    fn build_download_target_rejects_nested_paths() {
        assert_eq!(
            build_download_target("nested/wallpaper.jpg").unwrap_err(),
            ResolveDownloadPathError::InvalidTarget(PathRuleError::NestedPath)
        );
    }

    #[test]
    fn build_download_target_rejects_path_traversal() {
        assert_eq!(
            build_download_target("../wallpaper.jpg").unwrap_err(),
            ResolveDownloadPathError::InvalidTarget(PathRuleError::PathTraversal)
        );
    }

    #[test]
    fn build_download_target_rejects_absolute_paths() {
        assert_eq!(
            build_download_target("/tmp/wallpaper.jpg").unwrap_err(),
            ResolveDownloadPathError::InvalidTarget(PathRuleError::AbsolutePath)
        );
    }

    #[test]
    fn resolve_effective_download_directory_returns_the_default_app_directory() {
        assert_eq!(
            resolve_effective_download_directory(
                PathBuf::from("/tmp/wallhaven-data").as_path(),
                None,
            )
            .unwrap(),
            PathBuf::from("/tmp/wallhaven-data").join("wallpapers")
        );
    }

    #[test]
    fn resolve_effective_download_directory_returns_the_custom_absolute_directory() {
        assert_eq!(
            resolve_effective_download_directory(
                PathBuf::from("/tmp/wallhaven-data").as_path(),
                Some("/Users/test/Pictures/Wallhaven"),
            )
            .unwrap(),
            PathBuf::from("/Users/test/Pictures/Wallhaven")
        );
    }

    #[test]
    fn resolve_download_path_places_target_under_app_local_data_root() {
        let app_local_data_dir = PathBuf::from("/tmp/wallhaven-data");
        let strategy = default_download_strategy();
        let target = build_download_target("wallhaven-kxpkmm.jpg").unwrap();

        assert_eq!(
            resolve_download_path(&app_local_data_dir, &strategy, &target).unwrap(),
            app_local_data_dir.join("wallpapers/wallhaven-kxpkmm.jpg")
        );
    }

    #[test]
    fn resolve_download_path_places_target_under_the_custom_absolute_directory() {
        let strategy = DownloadStrategy::absolute_directory("/Users/test/Pictures/Wallhaven");
        let target =
            build_download_target_with_strategy(&strategy, "wallhaven-kxpkmm.jpg").unwrap();

        assert_eq!(
            resolve_download_path(
                PathBuf::from("/tmp/wallhaven-data").as_path(),
                &strategy,
                &target,
            )
            .unwrap(),
            PathBuf::from("/Users/test/Pictures/Wallhaven").join("wallhaven-kxpkmm.jpg")
        );
    }

    #[test]
    fn resolve_download_path_rejects_unsupported_base_directory() {
        let target = DownloadTarget::new("wallhaven-kxpkmm.jpg", "wallpapers/wallhaven-kxpkmm.jpg");
        let strategy = DownloadStrategy::new("Home", "wallpapers");

        assert_eq!(
            resolve_download_path(
                PathBuf::from("/tmp/wallhaven-data").as_path(),
                &strategy,
                &target
            )
            .unwrap_err(),
            ResolveDownloadPathError::UnsupportedBaseDir("Home".into())
        );
    }

    #[test]
    fn resolve_download_path_rejects_target_relative_path_mismatch() {
        let strategy = default_download_strategy();
        let target = DownloadTarget::new("wallhaven-kxpkmm.jpg", "wallpapers/other.jpg");

        assert_eq!(
            resolve_download_path(
                PathBuf::from("/tmp/wallhaven-data").as_path(),
                &strategy,
                &target
            )
            .unwrap_err(),
            ResolveDownloadPathError::TargetPathMismatch {
                expected: "wallpapers/wallhaven-kxpkmm.jpg".into(),
                actual: "wallpapers/other.jpg".into(),
            }
        );
    }

    #[test]
    fn resolve_download_path_rejects_relative_custom_roots() {
        let strategy = DownloadStrategy::absolute_directory("Downloads/Wallhaven");
        let target =
            build_download_target_with_strategy(&strategy, "wallhaven-kxpkmm.jpg").unwrap();

        assert_eq!(
            resolve_download_path(
                PathBuf::from("/tmp/wallhaven-data").as_path(),
                &strategy,
                &target
            )
            .unwrap_err(),
            ResolveDownloadPathError::InvalidRootPath(RootPathError::Relative)
        );
    }
}
