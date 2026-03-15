# Phonetic Inverted Index Generation

## Overview

This script generates a comprehensive inverted index that maps phonetic transliterations of Quranic words to their normalized Arabic equivalents. It processes raw transliteration text files, cleans the data, aligns it word-by-word with structured Quran JSON data, and outputs a searchable JSON index.

This documentation is designed to help anyone working on the codebase understand the exact workflow and how edge cases (like mismatched word counts between Arabic and English transliterations) are handled.

---

## High-Level Pipeline

The script runs through a systematic pipeline to clean, align, and index the data. Here is the step-by-step workflow:

### 1. Read & Clean Transliteration Input

* Reads the raw text file (`quran_transliteration.txt`).
* Removes the header `"The Calgary Islamic Homepage"`.
* Strips out non-alphanumeric symbols and normalizes newlines.
* Saves the sanitized output to `cleaned.txt`.
* Splits the text by the token `Surah` and writes individual per-surah files for easier processing.

### 2. Load Quran JSON

* Parses `quran.json` and maps the rows into `ayahData` objects (extracting fields like `text`, `sura_id`, `number_in_surah`, etc.).
* Builds an `ayahLookup` map keyed by `"{sura}-{verse}"` for fast retrieval during alignment.

### 3. Remove Basmala

* Globally removes the phrase `بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ` from every standard ayah text.
* *Note:* Because the Basmala is removed globally to fix word count alignment on standard verses, the script manually seeds the Basmala tokens back into the `allRecords` array before processing.

### 4. Per-Verse Alignment (Core Logic)

For each verse in the transliteration files, the script attempts to map the phonetic tokens to the Arabic words:

* **Tokenize:** Splits the transliterated verse into phonetic tokens.
* **Lookup:** Finds the corresponding ayah record in the JSON data. It allows for small offsets (`0, -1, 1, -2, 2`) to account for numbering discrepancies between different data sources.
* **Compute Word Arrays:**
* `arabicWords`: The actual Quran text with stops removed.
* `normalizedWords`: Buckwalter-friendly normalization of the Arabic text.
* `simpleLatinWords`: A simple Latin mapping generated directly from the normalized Arabic.


* **Compare & Align:**
* **If token counts match (1:1):** Appends the aligned records directly.
* **If counts differ slightly (≤ 3):** * **Merge:** Tries to merge adjacent phonetic tokens using pre-defined `mergeSeeds`. This *reduces* the phonetic token count to match the Arabic.
* **Split:** Tries to replace a single phonetic token with mapped sub-tokens using `splitSeedsMap`. This *increases* the phonetic token count to match the Arabic.


* **If still unresolved:** Pushes a `MismatchedWord` object to a `not_matched_words` array for later debugging.



### 5. Write Debug File & Build Index

* **Debug Output:** If there are any unresolved mismatches, the script writes them to `debug_mismatch_verse.json` so developers can manually review where the alignment failed.
* **Index Generation:** Builds an inverted index from `allRecords`. It maps the phonetic forms (both full and short versions) to their corresponding normalized Arabic words.
* **Final Save:** Sorts the keys and lists, then writes the final output to `phonetic_inverted_index.json`.

---

## Handling Misalignments & Edge Cases (The Seed Strategy)

The most complex part of Step 4 is handling cases where English transliteration doesn't map 1-to-1 with Arabic words. The pipeline relies on pre-defined seed data to heal these misalignments automatically.

### Merging Phonetic Tokens

When there are *more* phonetic words than Arabic words, the `mergeSeeds` array dictates which phonetic prefixes/suffixes to combine.

```typescript
// Keywords to merge to match the number of Arabic Quran words
const mergeSeeds = ['ya', 'awa', 'waal', 'baAAda', 'ha', 'wa', 'likay', 'waya', 'ayna'];

```

### Splitting Phonetic Tokens

When there are *fewer* phonetic words than Arabic words, the `splitSeedsMap` explicitly defines how to break specific compound tokens apart.

```typescript
// Keywords to split to match the number of Arabic Quran words
const splitSeedsMap: Record<string, string[]> = {
  aynama: ['ayn', 'ama'],
  feema: ['fee', 'ma'],
  mimma: ['min', 'ma'],
  amman: ['am', 'man'],
  haantum: ['ha', 'antum'],
  yabnaomma: ['ya', 'bna', 'omma'],
  malee: ['ma', 'lee'],
  waallawi: ['waal', 'lawi'],
};

```

### Manual Record Injection

Certain verses break the automated pipeline entirely (like Ayah 27:30 containing an inline Basmala). These are manually seeded to guarantee structural integrity.

```typescript
const allRecords: Array<[string, string, string, string]> = [
  // Manually add the basmala because it was removed globally
  ['بِسْمِ', 'بسم', 'Bismi', 'bsm'],
  ['ٱللَّهِ', 'الله', 'Allahi', 'allh'],
  ['ٱلرَّحْمَٰنِ', 'الرحمان', 'alrrahmani', 'alrhman'],
  ['ٱلرَّحِيمِ', 'الرحيم', 'alrraheemi', 'alrhym'],

  // Manually add 27:30 to prevent misalignment from inline basmala removal
  ['إِنَّهُ', 'انه', 'Innahu', 'innahu'],
  ['مِن', 'من', 'min', 'min'],
  ['سُلَیمَٰنَ', 'سلمان', 'sulaymana', 'sulaymana'],
  ['وَإِنَّهُ', 'وانه', 'wainnahu', 'wainnahu'],
];

```

---

## Final Output Structure

The final `phonetic_inverted_index.json` is a simple key-value map for fast lookups.

```json
{
  "bsm": ["بسم"],
  "bismi": ["بسم"],
  "allh": ["الله"],
  "allahi": ["الله"],
  "sulaymana": ["سلمان"]
}

```
