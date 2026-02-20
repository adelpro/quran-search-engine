/**
 * Removes Tashkeel (diacritics) and Quranic marks from Arabic text.
 *
 * @param text The input Arabic text.
 * @returns Text without diacritics.
 */
export const removeTashkeel = (text: string): string => {
  return text
    .replace(/\u0671/g, '\u0627') // Wasl alef → regular alef
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06FC]/g, '');
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

  // dagger alif + tatweel
  normalizedText = normalizedText.replace(/[\u0670\u0640]/g, '');

  // alef variants → ا
  normalizedText = normalizedText.replace(/[إأآٱ]/g, 'ا');

  // hamza variants → ء
  normalizedText = normalizedText.replace(/[ؤئء]/g, 'ء');

  // alif maqsura → ي
  normalizedText = normalizedText.replace(/ى/g, 'ي');

  // remove control chars / CRLF / non-Arabic symbols
  normalizedText = normalizedText.replace(/[\r\n]+/g, ' ');
  normalizedText = normalizedText.replace(/[^\u0621-\u064A\s-]+/g, '');
  normalizedText = normalizedText.replace(/\s{2,}/g, ' ');

  return normalizedText.trim();
};

/**
 * Checks if the given text contains Arabic characters.
 * Unicode range: U+0600 to U+06FF (Arabic block), U+0750 to U+077F (Arabic Supplement),
 * U+08A0 to U+08FF (Arabic Extended-A), and U+FB50 to U+FDFF (Arabic Presentation Forms).
 * This includes tashkeel, Quranic marks, and Uthmani characters.
 *
 * @param text The input Arabic text
 * @returns True if the text contains Arabic characters, false otherwise
 */

export const isArabic = (text: string): boolean => {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF]/.test(text);
};
