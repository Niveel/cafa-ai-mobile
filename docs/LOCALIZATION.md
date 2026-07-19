# Localization

English is the source and fallback catalog. Locale catalogs live in `config/locales/<language>.json`. English is initialized synchronously; other catalogs are loaded on selection and cached for the rest of the session. On native Expo builds, Metro still packages every statically discoverable async locale module in the installed binary. The async boundary defers module evaluation and application-memory retention; it does not reduce the native binary to one locale. Expo web production exports may create separate async chunks.

References: [Expo Metro bundle splitting](https://docs.expo.dev/guides/customizing-metro/#bundle-splitting) and [Metro dynamic imports](https://metrobundler.dev/docs/module-api/#import-dynamic-import).

## Add a language

1. Add the language code to `AppLanguage`, `LANGUAGE_METADATA`, `SUPPORTED_LANGUAGES`, and `catalogLoaders` in `config/i18n.ts`.
2. Copy `config/locales/en.json` to `<language>.json` and translate values without changing keys or `{{placeholder}}` names.
3. Add the language to `scripts/localization/validate-locales.cjs` and the backend personalization type when the backend supports it.
4. Run `npm run validate:i18n`, `npx tsc --noEmit`, and `npm run lint`.

Missing localized keys intentionally fall back to English, then to the stable key. Catalogs are flat JSON so a development or CI translator can compare them with English and submit only missing keys. Any future generator must use `localization.config.json`, the Cafa glossary, and translation memory. Billing, legal, security, and accessibility output identified by the review rules must be marked for human review before release. Runtime translation services and credentials are not used.
