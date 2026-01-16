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

    // 1. Identify all matches in the original text
    type MatchRange = {
      start: number;
      end: number;
      token: string;
      priority: number; // Higher length = Higher priority
      type: string;
    };

    const matches: MatchRange[] = [];

    // Create a regex to match the token with optional diacritics
    const createDiacriticRegex = (token: string) => {
      const normalizedToken = normalizeArabic(token);
      const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tashkeel = '[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]*?';

      const letters = escaped.split('').map((char) => {
        if (char === 'ا') return '[اأإآٱ\\u0670و]';
        if (char === 'ي') return '[يى\\u06CC\\u0626]';
        if (char === 'ى') return '[ىي\\u06CC\\u0626]';
        if (char === 'ة') return '[ةهت]';
        if (char === 'ه') return '[هة]';
        if (char === 'ك') return '[ك\\u06AC\\u06AD\\u06AE\\u06AF\\u06B0]';
        if (char === 'ء') return '[ءؤئ]';
        if (char === 'و') return '[وؤ]';
        return char;
      });

      const tokenPattern = letters.join(tashkeel);
      // Capture the full word boundary
      return new RegExp(`([^\\s]*${tokenPattern}[^\\s]*)`, 'g');
    };

    for (const token of matchedTokens) {
      const regex = createDiacriticRegex(token);
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          token,
          priority: token.length,
          type: verse.tokenTypes?.[token] ?? 'fuzzy',
        });
      }
    }

    // 2. Resolve Overlaps
    // We want to keep the longest match for any given range.
    // If ranges overlap, we can either merge them or pick the "best" one.
    // Simple strategy: Sort by length (desc) then position.
    // Iterate and mask out occupied regions.

    matches.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority; // Longest first
      return a.start - b.start;
    });

    const finalRanges: MatchRange[] = [];
    const occupied = new Array(text.length).fill(false);

    for (const m of matches) {
      // Check if range is fully free (or maybe allow nesting? No, flat highlighting is safer for now)
      // Actually, if we have "Word" and "Subword", "Word" comes first (longer).
      // We mark "Word" region as occupied. "Subword" will be ignored.
      // This solves the double-highlighting bug.

      let isFree = true;
      for (let i = m.start; i < m.end; i++) {
        if (occupied[i]) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        finalRanges.push(m);
        for (let i = m.start; i < m.end; i++) {
          occupied[i] = true;
        }
      }
    }

    // 3. Reconstruct the string
    // Sort ranges by start position for reconstruction
    finalRanges.sort((a, b) => a.start - b.start);

    let result = '';
    let cursor = 0;

    for (const range of finalRanges) {
      // Append non-highlighted text before this range
      result += text.slice(cursor, range.start);

      // Append highlighted text
      const segment = text.slice(range.start, range.end);
      const matchType = range.type === 'none' ? 'fuzzy' : range.type;
      const highlightClass = `highlight highlight-${matchType}`;

      result += `<span class="${highlightClass}">${segment}</span>`;

      cursor = range.end;
    }

    // Append remaining text
    result += text.slice(cursor);

    return <div dangerouslySetInnerHTML={{ __html: result }} />;
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
            Tokens:{' '}
            {verse.matchedTokens?.map((t) => `${t} (${verse.tokenTypes?.[t] ?? '?'})`).join(', ')}
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
