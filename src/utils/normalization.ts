/**
 * Removes Tashkeel (diacritics) and Quranic marks from Arabic text.
 *
 * @param text The input Arabic text.
 * @returns Text without diacritics.
 */
export const removeTashkeel = (text: string): string => {
  return (
    text
      // \u0671: Wasla (ٱ) - Connective alef → regular alef (\u0627)
      .replace(/\u0671/g, '\u0627')
      // Remove all Arabic diacritical marks:
      // \u064B-\u065F: Fatha, damma, kasra, shadda, sukun, tanween
      // \u0670: Dagger alef (ٰ)
      // \u06D6-\u06DC: Quranic annotation marks
      // \u06DF-\u06E8: More Quranic marks
      // \u06EA-\u06FC: Additional Quranic marks
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06FC]/g, '')
  );
};

/**
 * Advanced Arabic normalization for search indexing.
 * Handles Unicode normalization, variant unification, and cleanup.
 *
 * @param text The input Arabic text.
 * @returns The normalized string.
 */
export const normalizeArabic = (text: string): string => {
  if (!text) return '';

  let normalizedText = removeTashkeel(text).normalize('NFC');

  // Remove dagger alef (\u0670) and tatweel/kashida (\u0640)
  normalizedText = normalizedText.replace(/[\u0670\u0640]/g, '');

  // Normalize all alef variants to plain alef (\u0627):
  // \u0625: إ (alef with hamza below)
  // \u0623: أ (alef with hamza above)
  // \u0622: آ (alef with madd)
  // \u0671: ٱ (wasla alef)
  normalizedText = normalizedText.replace(/[إأآٱ]/g, 'ا');

  // Normalize hamza variants:
  // \u0624: ؤ (waw with hamza)
  // \u0626: ئ (ya with hamza)
  // \u0621: ء (standalone hamza)
  normalizedText = normalizedText.replace(/[ؤئء]/g, 'ء');

  // Normalize alif maqsura (\u0649) to yaa (\u064A)
  normalizedText = normalizedText.replace(/ى/g, 'ي');

  // Clean up whitespace and non-Arabic characters
  // Keep only: Arabic letters (\u0621-\u064A), spaces (\s), hyphens (-)
  normalizedText = normalizedText.replace(/[\r\n]+/g, ' '); // Convert newlines to spaces
  normalizedText = normalizedText.replace(/[^\u0621-\u064A\s-]+/g, ''); // Remove non-Arabic
  normalizedText = normalizedText.replace(/\s{2,}/g, ' '); // Collapse multiple spaces

  return normalizedText.trim();
};
