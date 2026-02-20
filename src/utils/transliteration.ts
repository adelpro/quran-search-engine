/**
 * Phonetic transliteration layer for Latin-to-Arabic conversion.
 *
 * Converts common Latin/English phonetic representations of Arabic words
 * into their Arabic equivalents, enabling search queries like "Bismillah"
 * to match "بسم الله".
 *
 * Supports:
 * - Single-letter mappings (b → ب, t → ت, etc.)
 * - Digraph mappings (sh → ش, th → ث, kh → خ, etc.)
 * - Long vowel representations (ee → ي, oo → و)
 * - Emphatic consonants via uppercase (S → ص, D → ض, T → ط, Z → ظ)
 * - Common word patterns (Allah → الله)
 */

/** Digraph (two-character) mappings — checked before single-char mappings. */
const DIGRAPHS: Record<string, string> = {
  sh: 'ش',
  th: 'ث',
  kh: 'خ',
  dh: 'ذ',
  gh: 'غ',
  ee: 'ي',
  oo: 'و',
  aa: 'ا',
  ll: 'لل',
};

/**
 * Single-character mappings.
 * Lowercase = standard letters; certain uppercase = emphatic letters.
 */
const SINGLE_CHARS: Record<string, string> = {
  // Consonants (lowercase)
  b: 'ب',
  t: 'ت',
  j: 'ج',
  h: 'ه',
  d: 'د',
  r: 'ر',
  z: 'ز',
  s: 'س',
  f: 'ف',
  q: 'ق',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  w: 'و',
  y: 'ي',
  g: 'غ',

  // Vowels (lowercase)
  a: 'ا',
  i: 'ي',
  u: 'و',
  o: 'و',
  e: 'ي',

  // Emphatic consonants (uppercase only — handled before lowercasing)
  S: 'ص',
  D: 'ض',
  T: 'ط',
  Z: 'ظ',
  H: 'ح',

  // Hamza / Ayn
  "'": 'ء',
};

/** Well-known whole-word replacements applied before character-level conversion. */
const WORD_MAP: Record<string, string> = {
  allah: 'الله',
  bismillah: 'بسمالله',
  alhamdulillah: 'الحمدلله',
  rahman: 'رحمن',
  rahim: 'رحيم',
  quran: 'قران',
  hamd: 'حمد',
  salah: 'صلاه',
  salam: 'سلام',
  iman: 'ايمان',
  islam: 'اسلام',
  muhammad: 'محمد',
  ibrahim: 'ابراهيم',
  musa: 'موسي',
  isa: 'عيسي',
  nuh: 'نوح',
  adam: 'ادم',
  jannah: 'جنه',
  jahannam: 'جهنم',
  tawbah: 'توبه',
  hidayah: 'هدايه',
  rizq: 'رزق',
  sabr: 'صبر',
  shukr: 'شكر',
  taqwa: 'تقوي',
  dua: 'دعاء',
  dhikr: 'ذكر',
  akhirah: 'اخره',
  dunya: 'دنيا',
  kitab: 'كتاب',
  ayah: 'ايه',
  surah: 'سوره',
  rabb: 'رب',
  nabi: 'نبي',
  rasul: 'رسول',
  malak: 'ملك',
  yawm: 'يوم',
  qiyamah: 'قيامه',
};

/**
 * Returns `true` when the input looks like a Latin/English query
 * (contains Latin letters and no Arabic characters).
 */
export const isLatinInput = (text: string): boolean => {
  if (!text) return false;
  const hasLatin = /[a-zA-Z]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  return hasLatin && !hasArabic;
};

/**
 * Transliterates a Latin/phonetic string into Arabic characters.
 *
 * The conversion pipeline:
 * 1. Replace well-known whole words (allah → الله)
 * 2. For remaining tokens, greedily match digraphs then single characters
 * 3. Non-mapped characters (spaces, hyphens) become spaces
 *
 * @param input Latin/English phonetic string
 * @returns Arabic transliteration
 */
export const transliterate = (input: string): string => {
  if (!input) return '';

  // Split on spaces / hyphens to get individual tokens
  const tokens = input.split(/[\s-]+/).filter(Boolean);

  const arabicTokens = tokens.map((token) => {
    // Check whole-word map first (case-insensitive)
    const lower = token.toLowerCase();
    if (WORD_MAP[lower]) return WORD_MAP[lower];

    return transliterateToken(token);
  });

  return arabicTokens.join(' ');
};

/**
 * Transliterates a single token (no spaces) character by character,
 * greedily consuming digraphs before falling back to single-char mappings.
 */
const transliterateToken = (token: string): string => {
  let result = '';
  let i = 0;

  while (i < token.length) {
    // Try digraph (2-char) match first — always lowercase comparison
    if (i + 1 < token.length) {
      const pair = token.substring(i, i + 2).toLowerCase();
      if (DIGRAPHS[pair]) {
        result += DIGRAPHS[pair];
        i += 2;
        continue;
      }
    }

    // Single character — check original case first (for emphatic S/D/T/Z/H)
    const ch = token[i];
    if (SINGLE_CHARS[ch]) {
      result += SINGLE_CHARS[ch];
    } else {
      // Try lowercase fallback
      const lc = ch.toLowerCase();
      if (SINGLE_CHARS[lc]) {
        result += SINGLE_CHARS[lc];
      }
      // else skip unmapped character
    }

    i += 1;
  }

  return result;
};
