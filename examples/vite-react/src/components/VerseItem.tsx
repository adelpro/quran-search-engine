import {
  type ScoredQuranText,
  type MorphologyAya,
  type WordMap,
  getHighlightRanges,
} from 'quran-search-engine';
import type { ReactNode } from 'react';

interface VerseItemProps {
  verse: ScoredQuranText;
  query: string;
  morphologyMap: Map<number, MorphologyAya>;
  wordMap: WordMap;
}

export function VerseItem({ verse }: VerseItemProps) {
  function renderHighlightedVerse(): ReactNode {
    const ranges = getHighlightRanges(verse.uthmani, verse.matchedTokens, verse.tokenTypes);
    if (ranges.length === 0) return verse.uthmani;

    const parts: ReactNode[] = [];
    let cursor = 0;

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];

      if (cursor < range.start) {
        parts.push(verse.uthmani.slice(cursor, range.start));
      }

      const segment = verse.uthmani.slice(range.start, range.end);
      parts.push(
        <span
          key={`${range.start}-${range.end}-${i}`}
          className={`highlight highlight-${range.matchType}`}
        >
          {segment}
        </span>,
      );

      cursor = range.end;
    }

    if (cursor < verse.uthmani.length) {
      parts.push(verse.uthmani.slice(cursor));
    }

    return parts;
  }

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
      <div className="verse-arabic">{renderHighlightedVerse()}</div>
    </div>
  );
}
