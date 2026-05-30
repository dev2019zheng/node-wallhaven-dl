use std::error::Error;
use std::fmt;

use reqwest::Proxy;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NetworkProxyScheme {
    Http,
    Https,
    Socks5,
}

impl NetworkProxyScheme {
    fn as_scheme(&self) -> &'static str {
        match self {
            Self::Http => "http",
            Self::Https => "https",
            Self::Socks5 => "socks5",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProxySettings {
    pub scheme: NetworkProxyScheme,
    pub address: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NetworkProxySettingsError {
    EmptyAddress,
    IncludesScheme,
    InvalidProxyUrl(String),
}

impl fmt::Display for NetworkProxySettingsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyAddress => write!(f, "proxy address must not be empty"),
            Self::IncludesScheme => {
                write!(f, "proxy address must not include a scheme")
            }
            Self::InvalidProxyUrl(message) => write!(f, "invalid proxy settings: {message}"),
        }
    }
}

impl Error for NetworkProxySettingsError {}

impl NetworkProxySettings {
    pub fn normalized(&self) -> Result<Self, NetworkProxySettingsError> {
        Ok(Self {
            scheme: self.scheme.clone(),
            address: self.normalized_address()?,
        })
    }

    pub fn to_proxy_url(&self) -> Result<String, NetworkProxySettingsError> {
        Ok(format!(
            "{}://{}",
            self.scheme.as_scheme(),
            self.normalized_address()?
        ))
    }

    pub fn to_reqwest_proxy(&self) -> Result<Proxy, NetworkProxySettingsError> {
        Proxy::all(self.to_proxy_url()?)
            .map_err(|error| NetworkProxySettingsError::InvalidProxyUrl(error.to_string()))
    }

    fn normalized_address(&self) -> Result<String, NetworkProxySettingsError> {
        let trimmed = self.address.trim();

        if trimmed.is_empty() {
            return Err(NetworkProxySettingsError::EmptyAddress);
        }

        if trimmed.contains("://") {
            return Err(NetworkProxySettingsError::IncludesScheme);
        }

        Ok(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{NetworkProxyScheme, NetworkProxySettings, NetworkProxySettingsError};

    #[test]
    fn network_proxy_settings_serialize_in_camel_case() {
        let settings = NetworkProxySettings {
            scheme: NetworkProxyScheme::Socks5,
            address: "127.0.0.1:7897".into(),
        };

        assert_eq!(
            serde_json::to_value(settings).unwrap(),
            json!({
                "scheme": "socks5",
                "address": "127.0.0.1:7897"
            })
        );
    }

    #[test]
    fn network_proxy_settings_build_a_proxy_url_from_the_selected_scheme() {
        let settings = NetworkProxySettings {
            scheme: NetworkProxyScheme::Socks5,
            address: "127.0.0.1:7897".into(),
        };

        assert_eq!(settings.to_proxy_url().unwrap(), "socks5://127.0.0.1:7897");
    }

    #[test]
    fn network_proxy_settings_reject_addresses_that_include_a_scheme() {
        let settings = NetworkProxySettings {
            scheme: NetworkProxyScheme::Http,
            address: "http://127.0.0.1:7897".into(),
        };

        assert_eq!(
            settings.normalized().unwrap_err(),
            NetworkProxySettingsError::IncludesScheme
        );
    }
}
