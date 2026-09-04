# i18n (zh / en)

Industry-aligned stack: `i18next` + `react-i18next` with JSON namespaces.

## Toggle

Use the language button next to the theme control in the top chrome. It shows the **target** language (`中文` when current is English, `EN` when current is Chinese) and switches instantly without reload.

## Persistence (v1)

Locale preference is stored in `localStorage` under `wallhaven-locale`.

Rust / settings-store `locale` field is intentionally deferred to avoid schema churn; syncing into the settings service can land later without changing the UI contract.
