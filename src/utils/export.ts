import type { SearchResponse, QuranText } from '../types';

export type ExportFormat = 'json' | 'csv' | 'tsv';

const CSV_HEADERS = ['sura', 'aya', 'score', 'matchType', 'text'];

function escapeDelimitedValue(value: string, separator: string): string {
  const needsQuotes =
    value.includes(separator) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');

  if (!needsQuotes) {
    return value;
  }

  // Escape double quotes and wrap in double quotes
  return `"${value.replace(/"/g, '""')}"`;
}

function exportDelimited(response: SearchResponse<QuranText>, separator: string): string {
  const rows = response.results.map((verse) => {
    const values = [
      String(verse.sura_id ?? ''),
      String(verse.aya_id ?? ''),
      String(verse.matchScore ?? ''),
      verse.matchType,
      verse.standard,
    ];

    return values.map((value) => escapeDelimitedValue(value, separator)).join(separator);
  });
  return `\uFEFF${CSV_HEADERS.join(separator)}\n${rows.join('\n')}`;
}

export function exportResults(
  response: SearchResponse<QuranText>,
  format: ExportFormat = 'json',
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(response.results);
    case 'csv':
      return exportDelimited(response, ',');
    case 'tsv':
      return exportDelimited(response, '\t');
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
