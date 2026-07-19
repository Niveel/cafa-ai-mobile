const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const localeDirectory = path.join(root, 'config', 'locales');
const languages = ['en', 'es', 'fr', 'pt'];
const catalogs = {};
let failed = false;

function fail(message) {
  failed = true;
  console.error(`ERROR: ${message}`);
}

function placeholders(value) {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/{{([^{}]+)}}/g)].map((match) => match[1]).sort();
}

for (const language of languages) {
  const file = path.join(localeDirectory, `${language}.json`);
  const source = fs.readFileSync(file, 'utf8');
  const rawKeys = [...source.matchAll(/^\s*"((?:\\.|[^"\\])+)"\s*:/gm)].map((match) => JSON.parse(`"${match[1]}"`));
  const duplicates = rawKeys.filter((key, index) => rawKeys.indexOf(key) !== index);
  if (duplicates.length) fail(`${language}.json contains duplicate keys: ${[...new Set(duplicates)].join(', ')}`);

  try {
    catalogs[language] = JSON.parse(source);
  } catch (error) {
    fail(`${language}.json is not valid JSON: ${error.message}`);
    continue;
  }

  for (const [key, value] of Object.entries(catalogs[language])) {
    if (typeof value === 'string') continue;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) continue;
    fail(`${language}.${key} must be a string or an array of strings`);
  }
}

const english = catalogs.en ?? {};
for (const language of languages.slice(1)) {
  const catalog = catalogs[language] ?? {};
  const unknown = Object.keys(catalog).filter((key) => !(key in english));
  if (unknown.length) fail(`${language}.json has keys not present in English: ${unknown.join(', ')}`);

  for (const [key, value] of Object.entries(catalog)) {
    const fallback = english[key];
    if (typeof value !== 'string' || typeof fallback !== 'string') continue;
    const expected = placeholders(fallback);
    const actual = placeholders(value);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      fail(`${language}.${key} placeholders differ: expected [${expected}], received [${actual}]`);
    }
  }

  const missing = Object.keys(english).filter((key) => !(key in catalog));
  const fallbackProbe = missing[0];
  if (fallbackProbe && (catalog[fallbackProbe] ?? english[fallbackProbe] ?? fallbackProbe) !== english[fallbackProbe]) {
    fail(`${language} English fallback validation failed for ${fallbackProbe}`);
  }
  console.log(`${language}: ${Object.keys(catalog).length} keys, ${missing.length} use English fallback`);
}

const starterPrompts = english['chat.starterPrompts'];
if (!Array.isArray(starterPrompts) || !starterPrompts.length) {
  fail('English chat.starterPrompts must be a non-empty string array');
}

const appContextSource = fs.readFileSync(path.join(root, 'context', 'AppContext.tsx'), 'utf8');
if (!appContextSource.includes('getUserPersonalization()')) {
  fail('AppContext must load backend personalization for the selected language');
}
if (!appContextSource.includes('activateLanguage(personalization.language)')) {
  fail('AppContext must activate the catalog selected by backend personalization');
}
if (!appContextSource.includes('requestId !== languageRequestIdRef.current')) {
  fail('AppContext must reject stale asynchronous catalog loads');
}

if (failed) process.exit(1);
console.log(`en: ${Object.keys(english).length} keys`);
console.log('Locale validation passed: JSON, duplicate keys, key validity, fallback, and placeholders.');
