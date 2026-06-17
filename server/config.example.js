// server/config.example.js
//
// Copy this file to server/config.js and fill in your translation API
// credentials. server/config.js is gitignored — never commit real API keys.

module.exports = {
  port: 3000,

  // Which translation provider to use: "google" or "azure".
  // See server/lib/translate.js for notes on Cantonese (zh-HK) and
  // Tagalog (tl) language-code handling differences between the two.
  translationProvider: 'google',

  google: {
    apiKey: 'YOUR_GOOGLE_CLOUD_TRANSLATION_API_KEY',
  },

  azure: {
    apiKey: 'YOUR_AZURE_TRANSLATOR_KEY',
    region: 'YOUR_AZURE_RESOURCE_REGION', // e.g. "westus2"
  },
};
