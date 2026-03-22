/** Describes a single validation failure. */
export type SchemaError = {
  /** Dot-path to the offending field, e.g. "verses[0].gid". */
  path: string;
  /** Human-readable explanation. */
  message: string;
};

/** Result returned by every validate* function. */
export type ValidationResult = {
  valid: boolean;
  errors: SchemaError[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

function pushIf(
  errors: SchemaError[],
  condition: boolean,
  path: string,
  message: string,
  limit: number,
) {
  if (condition && errors.length < limit) errors.push({ path, message });
}

// ---------------------------------------------------------------------------
// QuranText / VerseInput validation
// ---------------------------------------------------------------------------

/**
 * Validates an array of verse objects against the VerseInput schema.
 *
 * Required fields: `gid` (number), `uthmani` (string), `standard` (string).
 * Any additional QuranText fields are validated when present.
 *
 * @param data  - The data to validate (expected: array of verse objects).
 * @param limit - Maximum number of per-item errors to collect (default 50).
 */
export function validateQuranData(data: unknown, limit = 50): ValidationResult {
  const errors: SchemaError[] = [];

  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Expected an array of verse objects.' }],
    };
  }

  if (data.length === 0) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Verse array must not be empty.' }],
    };
  }

  for (let i = 0; i < data.length && errors.length < limit; i++) {
    const v = data[i] as Record<string, unknown>;
    const p = `verses[${i}]`;

    if (v === null || typeof v !== 'object') {
      errors.push({ path: p, message: 'Expected an object.' });
      continue;
    }

    // Required fields (VerseInput)
    pushIf(
      errors,
      !isNumber(v.gid),
      `${p}.gid`,
      'Required number field "gid" is missing or not a number.',
      limit,
    );
    pushIf(
      errors,
      !isString(v.uthmani),
      `${p}.uthmani`,
      'Required string field "uthmani" is missing or not a string.',
      limit,
    );
    pushIf(
      errors,
      !isString(v.standard),
      `${p}.standard`,
      'Required string field "standard" is missing or not a string.',
      limit,
    );

    // Optional but type-checked fields (QuranText extras)
    if ('sura_id' in v)
      pushIf(errors, !isNumber(v.sura_id), `${p}.sura_id`, '"sura_id" must be a number.', limit);
    if ('aya_id' in v)
      pushIf(errors, !isNumber(v.aya_id), `${p}.aya_id`, '"aya_id" must be a number.', limit);
    if ('page_id' in v)
      pushIf(errors, !isNumber(v.page_id), `${p}.page_id`, '"page_id" must be a number.', limit);
    if ('juz_id' in v)
      pushIf(errors, !isNumber(v.juz_id), `${p}.juz_id`, '"juz_id" must be a number.', limit);
    if ('aya_id_display' in v)
      pushIf(
        errors,
        !isString(v.aya_id_display),
        `${p}.aya_id_display`,
        '"aya_id_display" must be a string.',
        limit,
      );
    if ('standard_full' in v)
      pushIf(
        errors,
        !isString(v.standard_full),
        `${p}.standard_full`,
        '"standard_full" must be a string.',
        limit,
      );
    if ('sura_name' in v)
      pushIf(
        errors,
        !isString(v.sura_name),
        `${p}.sura_name`,
        '"sura_name" must be a string.',
        limit,
      );
    if ('sura_name_en' in v)
      pushIf(
        errors,
        !isString(v.sura_name_en),
        `${p}.sura_name_en`,
        '"sura_name_en" must be a string.',
        limit,
      );
    if ('sura_name_romanization' in v)
      pushIf(
        errors,
        !isString(v.sura_name_romanization),
        `${p}.sura_name_romanization`,
        '"sura_name_romanization" must be a string.',
        limit,
      );
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// MorphologyAya validation
// ---------------------------------------------------------------------------

/**
 * Validates an array of morphology objects against the MorphologyAya schema.
 *
 * Each item must have `gid` (number), `lemmas` (string[]), `roots` (string[]).
 *
 * @param data  - The data to validate.
 * @param limit - Maximum number of per-item errors to collect (default 50).
 */
export function validateMorphologyData(data: unknown, limit = 50): ValidationResult {
  const errors: SchemaError[] = [];

  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          path: 'root',
          message: 'Expected an array of morphology objects.',
        },
      ],
    };
  }

  if (data.length === 0) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Morphology array must not be empty.' }],
    };
  }

  for (let i = 0; i < data.length && errors.length < limit; i++) {
    const m = data[i] as Record<string, unknown>;
    const p = `morphology[${i}]`;

    if (m === null || typeof m !== 'object') {
      errors.push({ path: p, message: 'Expected an object.' });
      continue;
    }

    pushIf(
      errors,
      !isNumber(m.gid),
      `${p}.gid`,
      'Required number field "gid" is missing or not a number.',
      limit,
    );

    if (!Array.isArray(m.lemmas)) {
      errors.push({
        path: `${p}.lemmas`,
        message: 'Required field "lemmas" must be an array of strings.',
      });
    } else if (m.lemmas.some((l: unknown) => !isString(l))) {
      errors.push({
        path: `${p}.lemmas`,
        message: 'All items in "lemmas" must be strings.',
      });
    }

    if (!Array.isArray(m.roots)) {
      errors.push({
        path: `${p}.roots`,
        message: 'Required field "roots" must be an array of strings.',
      });
    } else if (m.roots.some((r: unknown) => !isString(r))) {
      errors.push({
        path: `${p}.roots`,
        message: 'All items in "roots" must be strings.',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// WordMap validation
// ---------------------------------------------------------------------------

/**
 * Validates a word-map object against the WordMap schema.
 *
 * Top-level keys must be strings. Each value must be an object whose
 * optional `lemma` and `root` fields are strings.
 *
 * @param data  - The data to validate.
 * @param limit - Maximum number of per-entry errors to collect (default 50).
 */
export function validateWordMapData(data: unknown, limit = 50): ValidationResult {
  const errors: SchemaError[] = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          path: 'root',
          message: 'Expected a plain object (key → { lemma?, root? }).',
        },
      ],
    };
  }

  const entries = Object.entries(data as Record<string, unknown>);

  if (entries.length === 0) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Word map must not be empty.' }],
    };
  }

  for (let i = 0; i < entries.length && errors.length < limit; i++) {
    const [key, val] = entries[i];
    const p = `wordMap["${key}"]`;

    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      errors.push({
        path: p,
        message: 'Expected an object with optional "lemma" and "root" string fields.',
      });
      continue;
    }

    const entry = val as Record<string, unknown>;
    if ('lemma' in entry)
      pushIf(errors, !isString(entry.lemma), `${p}.lemma`, '"lemma" must be a string.', limit);
    if ('root' in entry)
      pushIf(errors, !isString(entry.root), `${p}.root`, '"root" must be a string.', limit);
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Semantic data validation
// ---------------------------------------------------------------------------

/**
 * Validates an array of semantic concept objects against the semantic.json schema.
 *
 * Each entry must have:
 * - `english` (string[]) – English terms for the concept.
 * - `arabic` (string[]) – Arabic terms for the concept.
 *
 * @param data  - The data to validate (expected: array of semantic objects).
 * @param limit - Maximum number of per-item errors to collect (default 50).
 */
export function validateSemanticData(data: unknown, limit = 50): ValidationResult {
  const errors: SchemaError[] = [];

  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          path: 'root',
          message: 'Expected an array of semantic concept objects.',
        },
      ],
    };
  }

  if (data.length === 0) {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Semantic data array must not be empty.' }],
    };
  }

  for (let i = 0; i < data.length && errors.length < limit; i++) {
    const entry = data[i] as Record<string, unknown>;
    const p = `semantic[${i}]`;

    if (entry === null || typeof entry !== 'object') {
      errors.push({ path: p, message: 'Expected an object.' });
      continue;
    }

    if (!Array.isArray(entry.english)) {
      pushIf(
        errors,
        true,
        `${p}.english`,
        'Required field "english" must be an array of strings.',
        limit,
      );
    } else if (entry.english.some((t: unknown) => !isString(t))) {
      pushIf(errors, true, `${p}.english`, 'All items in "english" must be strings.', limit);
    }

    if (!Array.isArray(entry.arabic)) {
      pushIf(
        errors,
        true,
        `${p}.arabic`,
        'Required field "arabic" must be an array of strings.',
        limit,
      );
    } else if (entry.arabic.some((t: unknown) => !isString(t))) {
      pushIf(errors, true, `${p}.arabic`, 'All items in "arabic" must be strings.', limit);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Convenience: format errors for logging
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable multi-line summary of validation errors.
 */
export function formatSchemaErrors(result: ValidationResult): string {
  if (result.valid) return 'Validation passed — no errors.';
  return result.errors.map((e, i) => `  ${i + 1}. [${e.path}] ${e.message}`).join('\n');
}
