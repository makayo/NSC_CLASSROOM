// server/lib/translate.js
//
// Thin wrapper around whichever translation API is configured in
// server/config.js. Internal language codes (used everywhere else in this
// app, and defined in content/languages.json) don't always match what the
// provider's API expects, so each provider gets its own code map below.
//
// CANTONESE NOTE: Google Cloud Translation API (v2) has no dedicated
// Cantonese code — there is no "yue". Requesting zh-HK falls back here to
// zh-TW (Traditional script, Mandarin grammar), which is NOT the same
// language as spoken Cantonese and should be flagged to native speakers
// during the pilot. Azure Translator does support a real "yue" (Cantonese)
// code, so if Cantonese accuracy matters, Azure is the safer choice for
// this deployment — set translationProvider to "azure" in config.js.
//
// TAGALOG NOTE: Google uses "tl" (Tagalog); Azure uses "fil" (Filipino).
// These are closely related but not identical — fil is the standardized
// national language built on Tagalog. Either is a reasonable approximation;
// verify with a native speaker before the pilot.

const axios = require('axios');
const config = require('../config');

const GOOGLE_LANG_MAP = {
  es: 'es',
  'zh-CN': 'zh-CN',
  'zh-HK': 'zh-TW', // closest available — see Cantonese note above
  vi: 'vi',
  ar: 'ar',
  fa: 'fa',
  so: 'so',
  am: 'am',
  tl: 'tl',
};

const AZURE_LANG_MAP = {
  es: 'es',
  'zh-CN': 'zh-Hans',
  'zh-HK': 'yue', // true Cantonese
  vi: 'vi',
  ar: 'ar',
  fa: 'fa',
  so: 'so',
  am: 'am',
  tl: 'fil',
};

async function translateGoogle(text, internalLangCode) {
  const target = GOOGLE_LANG_MAP[internalLangCode];
  if (!target) throw new Error(`No Google language mapping for "${internalLangCode}"`);

  const response = await axios.post(
    `https://translation.googleapis.com/language/translate/v2?key=${config.google.apiKey}`,
    { q: text, target, source: 'en', format: 'text' }
  );

  const translation = response.data && response.data.data && response.data.data.translations[0];
  if (!translation) throw new Error('Unexpected Google Translate response shape');
  return translation.translatedText;
}

async function translateAzure(text, internalLangCode) {
  const target = AZURE_LANG_MAP[internalLangCode];
  if (!target) throw new Error(`No Azure language mapping for "${internalLangCode}"`);

  const response = await axios.post(
    `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${target}`,
    [{ Text: text }],
    {
      headers: {
        'Ocp-Apim-Subscription-Key': config.azure.apiKey,
        'Ocp-Apim-Subscription-Region': config.azure.region,
        'Content-Type': 'application/json',
      },
    }
  );

  const translation = response.data && response.data[0] && response.data[0].translations[0];
  if (!translation) throw new Error('Unexpected Azure Translator response shape');
  return translation.text;
}

/**
 * Translate `text` (English) into the given internal language code.
 * Throws on failure — callers should catch this and fall back to English
 * for that language rather than leaving students with no caption.
 */
async function translateText(text, internalLangCode) {
  if (!text || !text.trim()) return text;
  if (internalLangCode === 'en') return text;

  if (config.translationProvider === 'azure') {
    return translateAzure(text, internalLangCode);
  }
  return translateGoogle(text, internalLangCode);
}

module.exports = { translateText };
