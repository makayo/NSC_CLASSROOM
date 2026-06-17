// server/lib/glossary.js
//
// Loads content/glossary.json — this classroom tool's Northstar/computer-basics
// vocabulary (Wi-Fi, browser/app names, etc.) — and protects those terms from
// being mangled by the machine translation API. This glossary is NOT shared
// with OCE_TRANSLATOR; the kiosk's domain (benefits/workforce terms) is
// unrelated to what's taught in this class, so each tool keeps its own list.
// Only the language list and NSC branding are shared between the two repos.
//
// Strategy: before sending a sentence to the translator, swap each glossary
// term for a placeholder token. After translation comes back, swap the
// placeholder for the verified translation (or the original English term,
// for entries marked "keep in Latin script" — which is every entry here,
// since these are all brand names/acronyms conventionally left as-is).
//
// KNOWN LIMITATION: machine translation engines sometimes reorder, retranslate,
// or mangle placeholder tokens — this is more likely for non-Latin-script
// targets (Arabic, Farsi, Amharic) and for Chinese. The token format below
// (an unbroken alphanumeric string) tends to survive best in practice, but
// this should be verified with real API calls during the classroom pilot.
// If problems show up for a specific language, consider doing the glossary
// substitution as a post-translation find/replace on the *English* term
// instead (less robust placeholder, more direct).

const fs = require('fs');

function loadGlossary(glossaryPath) {
  const raw = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
  const terms = (raw.terms || [])
    .map((entry) => {
      const { en, note, caseSensitive, ...translations } = entry;
      if (!en) return null;
      return { en, note: note || null, caseSensitive: !!caseSensitive, translations };
    })
    .filter(Boolean)
    // Longest terms first, so "Google Drive" matches before "Google" would.
    .sort((a, b) => b.en.length - a.en.length);
  return terms;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatcher(terms, caseSensitive) {
  const subset = terms.filter((t) => !!t.caseSensitive === caseSensitive);
  if (!subset.length) return null;
  const pattern = subset.map((t) => escapeRegExp(t.en)).join('|');
  return new RegExp(`\\b(${pattern})\\b`, caseSensitive ? 'g' : 'gi');
}

const TOKEN_PREFIX = 'GLOSSARYTERM';
const TOKEN_SUFFIX = 'END';

/**
 * Replace glossary terms in `text` with placeholder tokens.
 * Returns { processedText, matches } where matches[i] is the glossary
 * term object that replaced placeholder i, in order of appearance.
 *
 * Runs in two passes — case-sensitive terms first (e.g. "Windows" the OS,
 * which should NOT match lowercase "windows" the room feature), then
 * case-insensitive terms over what's left. Because case-sensitive matches
 * are replaced first, this preserves left-to-right order of appearance
 * for the final `matches` array.
 */
function protectGlossaryTerms(text, terms) {
  if (!text) return { processedText: text, matches: [] };

  const matches = [];
  const replaceWith = (matcher) => (input) =>
    matcher
      ? input.replace(matcher, (matched) => {
          const term = terms.find(
            (t) => t.en.toLowerCase() === matched.toLowerCase()
          );
          const idx = matches.length;
          matches.push(term);
          return `${TOKEN_PREFIX}${idx}${TOKEN_SUFFIX}`;
        })
      : input;

  const caseSensitiveMatcher = buildMatcher(terms, true);
  const caseInsensitiveMatcher = buildMatcher(terms, false);

  let processedText = replaceWith(caseSensitiveMatcher)(text);
  processedText = replaceWith(caseInsensitiveMatcher)(processedText);

  return { processedText, matches };
}

/**
 * Replace placeholder tokens in translated text with the verified
 * translation for `lang`, falling back to the original English term
 * (e.g. for acronyms like DSHS, EBT, ctcLink that stay in Latin script).
 */
function restoreGlossaryTerms(translatedText, matches, lang) {
  let result = translatedText;
  matches.forEach((term, idx) => {
    const token = `${TOKEN_PREFIX}${idx}${TOKEN_SUFFIX}`;
    const replacement =
      term.translations && term.translations[lang] ? term.translations[lang] : term.en;
    const tokenRegex = new RegExp(token, 'i');
    result = result.replace(tokenRegex, replacement);
  });
  return result;
}

module.exports = { loadGlossary, protectGlossaryTerms, restoreGlossaryTerms };
