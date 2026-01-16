import { normalizeArabic } from '../src/utils/normalization';

const createDiacriticRegex = (token: string) => {
  // 1. Normalize the token (remove alef variants, etc.)
  const normalizedToken = normalizeArabic(token);

  // 2. Escape special characters for regex
  const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 3. Arabic diacritics range (Tashkeel + others)
  const tashkeel = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*?';

  // 4. Create regex that allows diacritics between every letter
  return new RegExp(`(${escaped.split('').join(tashkeel)})`, 'g');
};

const createRobustDiacriticRegex = (token: string) => {
  const normalizedToken = normalizeArabic(token);
  const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tashkeel = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*?';

  const letters = escaped.split('').map((char) => {
    if (char === 'ا') return '[اأإآٱ\\u0670]';
    if (char === 'ي') return '[يى]';
    if (char === 'ى') return '[ىي]';
    if (char === 'ة') return '[ةه]';
    if (char === 'ه') return '[هة]';
    return char;
  });

  return new RegExp(`(${letters.join(tashkeel)})`, 'g');
};

const testHighlight = (text: string, token: string, robust: boolean) => {
  const regex = robust ? createRobustDiacriticRegex(token) : createDiacriticRegex(token);
  const match = text.match(regex);
  console.log(`Token: "${token}" (Normalized: ${normalizeArabic(token)})`);
  console.log(`Text:  "${text}"`);
  console.log(`Method: ${robust ? 'Robust' : 'Simple'}`);
  console.log(`Match: ${match ? 'YES' : 'NO'}`);
  if (match) console.log(`Found: ${match[0]}`);
  console.log('---');
};

// Case: "يكتبون" should work with simple regex if chars match
testHighlight('يَكْتُبُونَ', 'يكتبون', false);

// Case: "الرحمن" with Wasla in text
// Token: "الرحمن" (Simple)
// Text: "ٱلرَّحْمَٰنِ" (Uthmani with Wasla)
testHighlight('ٱلرَّحْمَٰنِ', 'الرحمن', false); // Likely FAIL
testHighlight('ٱلرَّحْمَٰنِ', 'الرحمن', true); // Likely PASS
