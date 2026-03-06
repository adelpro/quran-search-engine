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

/**
 * Validates a single VerseInput record.
 */
export const validateVerseInput = (verse: unknown, index?: number): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (typeof verse !== 'object' || verse === null) {
    return [{ field: 'verse', message: 'Must be a non-null object', index }];
  }

  const v = verse as Record<string, unknown>;

  // gid: required, positive integer
  if (typeof v['gid'] !== 'number' || !Number.isInteger(v['gid']) || v['gid'] < 0) {
    errors.push({ field: 'gid', message: 'Must be a non-negative integer', index });
  }

  // uthmani: required, non-empty string
  if (typeof v['uthmani'] !== 'string' || v['uthmani'].trim() === '') {
    errors.push({ field: 'uthmani', message: 'Must be a non-empty string', index });
  }

  // standard: required, non-empty string
  if (typeof v['standard'] !== 'string' || v['standard'].trim() === '') {
    errors.push({ field: 'standard', message: 'Must be a non-empty string', index });
  }

  return errors;
};

/**
 * Validates an array of VerseInput records.
 */
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
    const verseErrors = validateVerseInput(verse, index);
    errors.push(...verseErrors);

    // Check duplicate gids
    if (typeof (verse as Record<string, unknown>)['gid'] === 'number') {
      const gid = (verse as Record<string, unknown>)['gid'] as number;
      if (seenGids.has(gid)) {
        errors.push({ field: 'gid', message: `Duplicate gid: ${gid}`, index });
      }
      seenGids.add(gid);
    }
  });

  return { valid: errors.length === 0, errors };
};

/**
 * Validates the morphologyMap structure.
 */
export const validateMorphologyMap = (
  map: Map<number, MorphologyAya>,
): ValidationResult => {
  if (!(map instanceof Map)) {
    return { valid: false, errors: [{ field: 'morphologyMap', message: 'Must be a Map' }] };
  }

  const errors: ValidationError[] = [];

  map.forEach((entry, key) => {
    if (typeof key !== 'number') {
      errors.push({ field: 'morphologyMap', message: `Key must be a number, got: ${typeof key}` });
    }
    if (!Array.isArray(entry?.lemmas)) {
      errors.push({ field: 'morphologyMap.lemmas', message: `Entry ${key}: lemmas must be an array` });
    }
    if (!Array.isArray(entry?.roots)) {
      errors.push({ field: 'morphologyMap.roots', message: `Entry ${key}: roots must be an array` });
    }
  });

  return { valid: errors.length === 0, errors };
};

/**
 * Validates the WordMap structure.
 */
export const validateWordMap = (wordMap: WordMap): ValidationResult => {
  if (typeof wordMap !== 'object' || wordMap === null || Array.isArray(wordMap)) {
    return { valid: false, errors: [{ field: 'wordMap', message: 'Must be a plain object' }] };
  }

  const errors: ValidationError[] = [];

  for (const [key, value] of Object.entries(wordMap)) {
    if (typeof value !== 'object' || value === null) {
      errors.push({ field: `wordMap[${key}]`, message: 'Value must be an object' });
      continue;
    }
    if (value.lemma !== undefined && typeof value.lemma !== 'string') {
      errors.push({ field: `wordMap[${key}].lemma`, message: 'Must be a string if present' });
    }
    if (value.root !== undefined && typeof value.root !== 'string') {
      errors.push({ field: `wordMap[${key}].root`, message: 'Must be a string if present' });
    }
  }

  return { valid: errors.length === 0, errors };
};
