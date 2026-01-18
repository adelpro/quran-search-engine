# Node.js Example

A Node.js example demonstrating the Quran Search Engine library for server-side usage.

## Features

- Load and search Quran data programmatically
- Display search statistics and results
- Command-line interface for custom searches
- Example searches for common Arabic words

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Run the example:

   ```bash
   pnpm start
   ```

3. For custom searches, provide a search term as an argument:
   ```bash
   pnpm start "الله"
   ```

## Usage

The script will:

1. Load all Quran data, morphology, and word mappings
2. Run example searches for common words
3. Display results with match types and scores
4. Allow custom searches via command line arguments

## Output Example

```
🚀 Loading Quran Search Engine data...

✅ Loaded 6236 verses
✅ Loaded morphology data for 6236 verses
✅ Loaded word map with 77403 entries

🔍 Search for "Allah": "الله"
──────────────────────────────────────────────────
📊 Found 2568 matches
   - Exact: 2568
   - Lemma: 0
   - Root: 0
   - Fuzzy: 0

1. Al-Fatiha (1:1)
   Match: exact (Score: 1)
   Text: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
   ...
```
