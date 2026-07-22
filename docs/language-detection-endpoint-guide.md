# Cafa AI — Automatic Language Detection Endpoint

This document covers the public endpoint that detects a visitor's likely preferred language from their IP location. The app must apply the detected language automatically; the user must not be prompted to confirm the change.

**Base URL:** `https://cafaapi.niveel.com/api/v1`

---

## Endpoint

`GET /api/v1/tools/check-language`

**Authentication:** None required — works for guests and first-time visitors before login.

**Request:** No body or query parameters. The server detects the visitor's IP automatically.

---

## Response

```json
{
  "success": true,
  "data": {
    "detectedCountryCode": "SN",
    "detectedCountryName": "Senegal",
    "suggestedLanguageCode": "fr",
    "suggestedLanguageName": "French",
    "suggestedLanguageNativeName": "Français",
    "currentDefaultLanguageCode": "en",
    "shouldPrompt": true,
    "supportedLanguages": [
      { "code": "en", "name": "English", "nativeName": "English" },
      { "code": "fr", "name": "French", "nativeName": "Français" },
      { "code": "es", "name": "Spanish", "nativeName": "Español" },
      { "code": "pt", "name": "Portuguese", "nativeName": "Português" }
    ]
  }
}
```

**Example — visitor from Ghana:**

```json
{
  "success": true,
  "data": {
    "detectedCountryCode": "GH",
    "detectedCountryName": "Ghana",
    "suggestedLanguageCode": "en",
    "suggestedLanguageName": "English",
    "suggestedLanguageNativeName": "English",
    "currentDefaultLanguageCode": "en",
    "shouldPrompt": false,
    "supportedLanguages": [ ... ]
  }
}
```

---

## Field Reference

| Field | Type | Description |
|---|---|---|
| `detectedCountryCode` | string \| null | ISO country code detected from the visitor's IP |
| `detectedCountryName` | string \| null | Full country name |
| `suggestedLanguageCode` | string | One of `en`, `fr`, `es`, `pt` — the language the app must apply |
| `suggestedLanguageName` | string | English name of the detected language |
| `suggestedLanguageNativeName` | string | Native name of the detected language (for example, "Français") |
| `currentDefaultLanguageCode` | string | Always `"en"` — the app's fallback language |
| `shouldPrompt` | boolean | Legacy response field. Do not use it to show a prompt or to decide whether to apply the language. |
| `supportedLanguages` | array | All four supported languages with code, name, and native name — use this to render the language picker UI directly, with no extra request needed |

---

## Frontend Integration Flow

```text
App opens for the first time (or first time in this session)
         ↓
Call GET /tools/check-language
         ↓
Set the app language to suggestedLanguageCode
         ↓
Persist the selected language and continue loading the app
```

Do not show a confirmation popup, language suggestion, “Keep English” action, or other interruption. Apply `suggestedLanguageCode` directly, regardless of the value of `shouldPrompt`.

If the detected language is already active, no visible action is necessary. Users can still change the language later through the normal language picker.

**Important — only call this once on first visit:**
The frontend is responsible for storing a local first-launch flag so automatic detection does not overwrite a language the user selects later.

---

## Reliability Notes

- This endpoint **never returns an error** — if IP detection fails for any reason (network issue, private IP, or unexpected data), it returns a valid `200` response with `suggestedLanguageCode: "en"` as a safe fallback.
- Rate limited the same as other lightweight public endpoints — safe to call once on first visit.
- Language detection is based on the visitor's IP-derived country and is applied automatically. The user can change it later from the app's language picker.

---

## Full Example curl Test

```bash
curl -s "https://cafaapi.niveel.com/api/v1/tools/check-language"
```
