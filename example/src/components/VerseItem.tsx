import {
  type ScoredQuranText,
  type MorphologyAya,
  type WordMap,
  normalizeArabic,
} from 'quran-search-engine';

interface VerseItemProps {
  verse: ScoredQuranText;
  query: string;
  morphologyMap: Map<number, MorphologyAya>;
  wordMap: WordMap;
}

export function VerseItem({ verse }: VerseItemProps) {
  const highlightVerse = (text: string, matchedTokens: string[]) => {
    if (!matchedTokens || matchedTokens.length === 0) return text;

    // Determine the highlight class based on the verse match type
    const matchType = verse.matchType === 'none' ? 'fuzzy' : verse.matchType;
    const highlightClass = `highlight highlight-${matchType}`;

    // Sort tokens by length (longer first) to avoid partial matches
    const sortedTokens = [...matchedTokens].sort((a, b) => b.length - a.length);

    // Create a regex to match the token with optional diacritics between letters
    const createDiacriticRegex = (token: string) => {
      // 1. Normalize the token (remove alef variants, etc.) to match the library's behavior
      const normalizedToken = normalizeArabic(token);

      // 2. Escape special characters for regex
      const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 3. Arabic diacritics range (Tashkeel + others) including Tatweel (\u0640)
      const tashkeel = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*?';

      // 4. Create regex that allows diacritics between every letter
      // We map normalized characters to their possible Uthmani variants
      const letters = escaped.split('').map((char) => {
        if (char === 'ا') return '[اأإآٱ\\u0670]'; // Match all Alef forms + Dagger Alif
        if (char === 'ي') return '[يى]'; // Match Ya / Alef Maqsura
        if (char === 'ى') return '[ىي]';
        if (char === 'ة') return '[ةه]'; // Match Ta Marbuta / Ha
        if (char === 'ه') return '[هة]';
        return char;
      });

      // 5. Build the regex part for the token itself
      const tokenPattern = letters.join(tashkeel);

      // 6. EXPAND MATCH to the FULL WORD
      // The strategy is:
      // - Find the token pattern
      // - Look ahead and behind for any connected Arabic letters/diacritics until a separator (space/punctuation) is found.
      //
      // Arabic "word characters" range roughly: [\u0600-\u06FF]
      // We want to greedily grab any surrounding Arabic characters.
      //
      // \b is tricky with non-ASCII.
      // Instead, we can use:
      // [^\s]* + tokenPattern + [^\s]*
      // This means "match the token, plus any non-whitespace chars attached to it".

      return new RegExp(`([^\\s]*${tokenPattern}[^\\s]*)`, 'g');
    };

    let highlighted = text;
    for (const token of sortedTokens) {
      // Use the diacritic-aware regex
      const regex = createDiacriticRegex(token);
      // Use $1 to preserve the actual matched text (with its diacritics)
      highlighted = highlighted.replace(regex, `<span class="${highlightClass}">$1</span>`);
    }
    return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  return (
    <div className="verse-card">
      <div className="verse-card-header">
        <span>
          {verse.sura_name} ({verse.sura_id}:{verse.aya_id})
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              color: '#666',
              background: '#eee',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            Tokens: {verse.matchedTokens?.join(', ')}
          </span>
          <span className={`match-tag tag-${verse.matchType}`}>
            {verse.matchType === 'none' ? 'fuzzy' : verse.matchType} (Score: {verse.matchScore})
          </span>
        </div>
      </div>
      <div className="verse-arabic">{highlightVerse(verse.uthmani, verse.matchedTokens)}</div>
    </div>
  );
}
