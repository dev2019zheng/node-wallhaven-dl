use std::error::Error;
use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GalleryListQuery {
    page: u32,
    page_size: u32,
    offset: i64,
}

impl GalleryListQuery {
    pub fn new(page: u32, page_size: u32) -> Result<Self, GalleryListQueryError> {
        if page == 0 {
            return Err(GalleryListQueryError::InvalidPage);
        }

        if page_size == 0 {
            return Err(GalleryListQueryError::InvalidPageSize);
        }

        let zero_based_page = page - 1;
        let offset = u64::from(zero_based_page) * u64::from(page_size);
        let offset = i64::try_from(offset).map_err(|_| GalleryListQueryError::PageOutOfRange)?;

        Ok(Self {
            page,
            page_size,
            offset,
        })
    }

    pub fn page(&self) -> u32 {
        self.page
    }

    pub fn page_size(&self) -> u32 {
        self.page_size
    }

    pub fn sql_limit(&self) -> i64 {
        i64::from(self.page_size)
    }

    pub fn sql_offset(&self) -> i64 {
        self.offset
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GalleryListQueryError {
    InvalidPage,
    InvalidPageSize,
    PageOutOfRange,
}

impl fmt::Display for GalleryListQueryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPage => write!(f, "page must be greater than 0"),
            Self::InvalidPageSize => write!(f, "page size must be greater than 0"),
            Self::PageOutOfRange => write!(f, "requested page is out of range"),
        }
    }
}

impl Error for GalleryListQueryError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GalleryArchiveRecord {
    pub wallpaper_id: String,
    pub source_url: String,
    pub file_name: String,
    pub relative_file_path: String,
    pub download_base_dir: String,
    pub download_root_path: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GalleryArchivePage {
    pub items: Vec<GalleryArchiveRecord>,
    pub total: u64,
}

#[cfg(test)]
mod tests {
    use super::{GalleryListQuery, GalleryListQueryError};

    #[test]
    fn gallery_list_query_requires_page_and_page_size_to_be_positive() {
        assert_eq!(
            GalleryListQuery::new(0, 20).unwrap_err(),
            GalleryListQueryError::InvalidPage
        );
        assert_eq!(
            GalleryListQuery::new(1, 0).unwrap_err(),
            GalleryListQueryError::InvalidPageSize
        );
    }

    #[test]
    fn gallery_list_query_calculates_limit_and_offset() {
        let query = GalleryListQuery::new(3, 24).unwrap();

        assert_eq!(query.page(), 3);
        assert_eq!(query.page_size(), 24);
        assert_eq!(query.sql_limit(), 24);
        assert_eq!(query.sql_offset(), 48);
    }
}
