import type { VerseInput, MorphologyAya, WordMap } from '../types';

export type ValidationError = {
  field: string;
  message: string;
  index?: number;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' &&
  val !== null &&
  !Array.isArray(val) &&
  Object.getPrototypeOf(val) === Object.prototype;

const isValidInteger = (val: unknown): val is number =>
  typeof val === 'number' && Number.isInteger(val) && isFinite(val);

export const validateVerseInput = (verse: unknown, index?: number): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!isPlainObject(verse)) {
    return [{ field: 'verse', message: 'Must be a non-null plain object', index }];
  }

  if (!isValidInteger(verse['gid']) || (verse['gid'] as number) < 0) {
    errors.push({ field: 'gid', message: 'Must be a non-negative integer', index });
  }

  if (typeof verse['uthmani'] !== 'string' || verse['uthmani'].trim() === '') {
    errors.push({ field: 'uthmani', message: 'Must be a non-empty string', index });
  }

  if (typeof verse['standard'] !== 'string' || verse['standard'].trim() === '') {
    errors.push({ field: 'standard', message: 'Must be a non-empty string', index });
  }

  return errors;
};

export const validateQuranData = <TVerse extends VerseInput>(
  data: TVerse[],
): ValidationResult => {
  if (!Array.isArray(data)) {
    return { valid: false, errors: [{ field: 'quranData', message: 'Must be an array' }] };
  }

  if (data.length === 0) {
    return { valid: false, errors: [{ field: 'quranData', message: 'Must not be empty' }] };
  }

  const errors: ValidationError[] = [];
  const seenGids = new Set<number>();

  data.forEach((verse, index) => {
    if (!isPlainObject(verse)) {
      errors.push({ field: 'verse', message: 'Must be a non-null plain object', index });
      return;
    }

    const verseErrors = validateVerseInput(verse, index);
    errors.push(...verseErrors);

    const gid = verse['gid'];
    if (typeof gid === 'number') {
      if (seenGids.has(gid)) {
        errors.push({ field: 'gid', message: `Duplicate gid: ${gid}`, index });
      }
      seenGids.add(gid);
    }
  });

  return { valid: errors.length === 0, errors };
};

export const validateMorphologyMap = (
  map: Map<number, MorphologyAya>,
): ValidationResult => {
  if (!(map instanceof Map)) {
    return { valid: false, errors: [{ field: 'morphologyMap', message: 'Must be a Map' }] };
  }

  const errors: ValidationError[] = [];

  map.forEach((entry, key) => {
    // Fix #1a: reject NaN, Infinity, fractions
    if (!isValidInteger(key) || key < 0) {
      errors.push({ field: 'morphologyMap', message: `Key must be a non-negative integer, got: ${key}` });
    }

    // Fix #1b: validate entry.gid
    if (!isPlainObject(entry)) {
      errors.push({ field: 'morphologyMap', message: `Entry ${key}: must be a plain object` });
      return;
    }

    if (!isValidInteger(entry['gid']) || (entry['gid'] as number) < 0) {
      errors.push({ field: 'morphologyMap.gid', message: `Entry ${key}: gid must be a non-negative integer` });
    }

    if (!Array.isArray(entry['lemmas'])) {
      errors.push({ field: 'morphologyMap.lemmas', message: `Entry ${key}: lemmas must be an array` });
    } else {
      (entry['lemmas'] as unknown[]).forEach((lemma, i) => {
        if (typeof lemma !== 'string') {
          errors.push({ field: 'morphologyMap.lemmas', message: `Entry ${key}: lemmas[${i}] must be a string` });
        }
      });
    }

    if (!Array.isArray(entry['roots'])) {
      errors.push({ field: 'morphologyMap.roots', message: `Entry ${key}: roots must be an array` });
    } else {
      (entry['roots'] as unknown[]).forEach((root, i) => {
        if (typeof root !== 'string') {
          errors.push({ field: 'morphologyMap.roots', message: `Entry ${key}: roots[${i}] must be a string` });
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
};

export const validateWordMap = (wordMap: WordMap): ValidationResult => {
  if (!isPlainObject(wordMap)) {
    return { valid: false, errors: [{ field: 'wordMap', message: 'Must be a plain object' }] };
  }

  const errors: ValidationError[] = [];

  for (const [key, value] of Object.entries(wordMap)) {
    // Fix #2: each entry value must also be a plain object
    if (!isPlainObject(value)) {
      errors.push({ field: `wordMap[${key}]`, message: 'Value must be a plain object' });
      continue;
    }
    if (value['lemma'] !== undefined && typeof value['lemma'] !== 'string') {
      errors.push({ field: `wordMap[${key}].lemma`, message: 'Must be a string if present' });
    }
    if (value['root'] !== undefined && typeof value['root'] !== 'string') {
      errors.push({ field: `wordMap[${key}].root`, message: 'Must be a string if present' });
    }
  }

  return { valid: errors.length === 0, errors };
};
