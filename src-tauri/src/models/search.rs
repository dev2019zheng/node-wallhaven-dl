use std::error::Error;
use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallhavenSearchRequest {
    pub categories: Option<WallhavenCategoryFilter>,
    pub purity: Option<WallhavenPurityFilter>,
    pub sorting: Option<WallhavenSorting>,
    pub top_range: Option<WallhavenToplistRange>,
    pub q: Option<String>,
    pub page: Option<u32>,
    pub api_key: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WallhavenPurityFilter {
    pub sfw: bool,
    pub sketchy: bool,
    pub nsfw: bool,
}

impl WallhavenPurityFilter {
    fn legacy_code(&self) -> Result<&'static str, WallhavenRequestError> {
        match (self.sfw, self.sketchy, self.nsfw) {
            (true, true, true) => Ok("111"),
            (true, true, false) => Ok("110"),
            (true, false, true) => Ok("101"),
            (true, false, false) => Ok("100"),
            (false, true, true) => Ok("011"),
            (false, true, false) => Ok("010"),
            (false, false, true) => Ok("001"),
            (false, false, false) => Err(WallhavenRequestError::EmptyPuritySelection),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WallhavenCategoryFilter {
    All,
    Anime,
    General,
    People,
    Ga,
    Gp,
}

impl WallhavenCategoryFilter {
    fn legacy_code(&self) -> &'static str {
        match self {
            Self::All => "111",
            Self::Anime => "010",
            Self::General => "100",
            Self::People => "001",
            Self::Ga => "110",
            Self::Gp => "101",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum WallhavenSorting {
    #[serde(rename = "date_added")]
    DateAdded,
    #[serde(rename = "toplist")]
    Toplist,
}

impl WallhavenSorting {
    fn as_str(&self) -> &'static str {
        match self {
            Self::DateAdded => "date_added",
            Self::Toplist => "toplist",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum WallhavenToplistRange {
    #[serde(rename = "1d")]
    OneDay,
    #[serde(rename = "3d")]
    ThreeDays,
    #[serde(rename = "1w")]
    OneWeek,
    #[serde(rename = "1M")]
    OneMonth,
    #[serde(rename = "3M")]
    ThreeMonths,
    #[serde(rename = "6M")]
    SixMonths,
    #[serde(rename = "1y")]
    OneYear,
}

impl WallhavenToplistRange {
    fn as_str(&self) -> &'static str {
        match self {
            Self::OneDay => "1d",
            Self::ThreeDays => "3d",
            Self::OneWeek => "1w",
            Self::OneMonth => "1M",
            Self::ThreeMonths => "3M",
            Self::SixMonths => "6M",
            Self::OneYear => "1y",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WallhavenSearchResponse {
    pub data: Vec<WallhavenWallpaper>,
    pub meta: WallhavenSearchMeta,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WallhavenWallpaper {
    pub id: String,
    pub url: String,
    pub short_url: String,
    pub views: u64,
    pub favorites: u64,
    pub source: String,
    pub purity: WallhavenWallpaperPurity,
    pub category: WallhavenWallpaperCategory,
    pub dimension_x: u32,
    pub dimension_y: u32,
    pub resolution: String,
    pub ratio: String,
    pub file_size: u64,
    pub file_type: String,
    pub created_at: String,
    pub colors: Vec<String>,
    pub path: String,
    pub thumbs: WallhavenWallpaperThumbs,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WallhavenWallpaperPurity {
    Sfw,
    Sketchy,
    Nsfw,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WallhavenWallpaperCategory {
    General,
    Anime,
    People,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WallhavenWallpaperThumbs {
    pub large: String,
    pub original: String,
    pub small: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WallhavenSearchMeta {
    pub current_page: u32,
    pub last_page: u32,
    pub per_page: String,
    pub total: u64,
    pub query: Option<String>,
    pub seed: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum WallhavenRequestError {
    EmptyPuritySelection,
    TopRangeRequiresToplist,
    TopRangeRequiredWhenToplist,
}

impl fmt::Display for WallhavenRequestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyPuritySelection => write!(f, "At least one purity must be selected"),
            Self::TopRangeRequiresToplist => {
                write!(f, "topRange is only supported when sorting is toplist")
            }
            Self::TopRangeRequiredWhenToplist => {
                write!(f, "topRange is required when sorting is toplist")
            }
        }
    }
}

impl Error for WallhavenRequestError {}

impl WallhavenSearchRequest {
    pub fn to_query_params(&self) -> Result<Vec<(String, String)>, WallhavenRequestError> {
        let mut params = Vec::new();

        if let Some(categories) = &self.categories {
            params.push(("categories".into(), categories.legacy_code().into()));
        }

        if let Some(purity) = &self.purity {
            params.push(("purity".into(), purity.legacy_code()?.into()));
        }

        if let Some(query) = &self.q {
            params.push(("q".into(), query.clone()));
        }

        if let Some(page) = self.page {
            params.push(("page".into(), page.to_string()));
        }

        match (&self.sorting, &self.top_range) {
            (None, Some(_)) => return Err(WallhavenRequestError::TopRangeRequiresToplist),
            (Some(WallhavenSorting::Toplist), None) => {
                return Err(WallhavenRequestError::TopRangeRequiredWhenToplist)
            }
            (Some(WallhavenSorting::Toplist), Some(top_range)) => {
                params.push(("sorting".into(), WallhavenSorting::Toplist.as_str().into()));
                params.push(("topRange".into(), top_range.as_str().into()));
                params.push(("order".into(), "desc".into()));
            }
            (Some(sorting), Some(_)) => {
                if matches!(sorting, WallhavenSorting::Toplist) {
                    unreachable!("toplist with topRange is handled by the branch above")
                }

                return Err(WallhavenRequestError::TopRangeRequiresToplist);
            }
            (Some(sorting), None) => {
                params.push(("sorting".into(), sorting.as_str().into()));
            }
            (None, None) => {}
        }

        Ok(params)
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        WallhavenCategoryFilter, WallhavenPurityFilter, WallhavenSearchRequest,
        WallhavenSearchResponse, WallhavenSorting, WallhavenToplistRange,
    };

    #[test]
    fn builds_toplist_query_params_from_structured_request() {
        let request = WallhavenSearchRequest {
            categories: Some(WallhavenCategoryFilter::Ga),
            purity: Some(WallhavenPurityFilter {
                sfw: true,
                sketchy: true,
                nsfw: false,
            }),
            sorting: Some(WallhavenSorting::Toplist),
            top_range: Some(WallhavenToplistRange::OneMonth),
            q: Some("landscape".into()),
            page: Some(2),
            api_key: Some("test-key".into()),
        };

        assert_eq!(
            request.to_query_params().unwrap(),
            vec![
                ("categories".into(), "110".into()),
                ("purity".into(), "110".into()),
                ("q".into(), "landscape".into()),
                ("page".into(), "2".into()),
                ("sorting".into(), "toplist".into()),
                ("topRange".into(), "1M".into()),
                ("order".into(), "desc".into()),
            ]
        );
    }

    #[test]
    fn rejects_toprange_without_toplist_sorting() {
        let request = WallhavenSearchRequest {
            sorting: Some(WallhavenSorting::DateAdded),
            top_range: Some(WallhavenToplistRange::OneWeek),
            ..WallhavenSearchRequest::default()
        };

        let error = request.to_query_params().unwrap_err();
        assert_eq!(
            error.to_string(),
            "topRange is only supported when sorting is toplist"
        );
    }

    #[test]
    fn rejects_empty_purity_selection() {
        let request = WallhavenSearchRequest {
            purity: Some(WallhavenPurityFilter {
                sfw: false,
                sketchy: false,
                nsfw: false,
            }),
            ..WallhavenSearchRequest::default()
        };

        let error = request.to_query_params().unwrap_err();
        assert_eq!(error.to_string(), "At least one purity must be selected");
    }

    #[test]
    fn deserializes_search_response_fixture() {
        let response: WallhavenSearchResponse =
            serde_json::from_str(include_str!("../../../page_data.json")).unwrap();

        assert_eq!(response.data.len(), 24);
        assert_eq!(response.meta.current_page, 1);
        assert_eq!(response.meta.last_page, 9);
        assert_eq!(response.data[0].id, "kxpkmm");
        assert_eq!(response.data[0].short_url, "https://whvn.cc/kxpkmm");
    }

    #[test]
    fn rejects_unknown_sorting_at_deserialize_boundary() {
        let result = serde_json::from_value::<WallhavenSearchRequest>(json!({
          "sorting": "favorites"
        }));

        assert!(result.is_err());
    }
}
