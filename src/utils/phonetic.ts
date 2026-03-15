import Fuse from 'fuse.js';
import phoneticData from '../data/phonetic.json';

type PhoneticDictionary = Record<string, string[]>;

export const buildPhoneticMap = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const data = phoneticData as PhoneticDictionary;

  for (const [phonetic, arabicWords] of Object.entries(data)) {
    const cleanLatinWord = phonetic.toLowerCase().trim();
    map.set(cleanLatinWord, arabicWords);
  }

  return map;
};

export const phoneticMap = buildPhoneticMap();

// Lazy-loaded Fuse instance for phonetic keys
let cachedPhoneticFuse: Fuse<string> | null = null;
export const getPhoneticFuse = (): Fuse<string> => {
  if (!cachedPhoneticFuse) {
    const keys = Array.from(phoneticMap.keys());
    cachedPhoneticFuse = new Fuse(keys, {
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 3,
      includeScore: true,
    });
  }
  return cachedPhoneticFuse;
};
