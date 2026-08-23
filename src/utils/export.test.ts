import { describe, expect, it } from 'vitest';
import { exportResults } from './export';
import type { SearchResponse, QuranText } from '../types';

const mockResponse: SearchResponse<QuranText> = {
  results: [
    {
      sura_id: 1,
      aya_id: 1,
      matchScore: 0.95,
      matchType: 'exact',
      standard: 'بسم الله الرحمن الرحيم الحمد لله رب العالمين',
    },
  ],
} as SearchResponse<QuranText>;

describe('exportResults', () => {
  it('should export results as JSON by default', () => {
    const result = exportResults(mockResponse);

    expect(JSON.parse(result)).toEqual(mockResponse.results);
  });

  it('should export results as CSV', () => {
    const result = exportResults(mockResponse, 'csv');

    expect(result).toContain('sura,aya,score,matchType,text');
    expect(result).toContain('1,1,0.95,exact,بسم الله الرحمن الرحيم الحمد لله رب العالمين');
  });

  it('should export results as TSV', () => {
    const result = exportResults(mockResponse, 'tsv');

    expect(result).toContain('sura\taya\tscore\tmatchType\ttext');
    expect(result).toContain('1\t1\t0.95\texact\tبسم الله الرحمن الرحيم الحمد لله رب العالمين');
  });

  it('should include UTF-8 BOM for CSV and TSV', () => {
    expect(exportResults(mockResponse, 'csv').startsWith('\uFEFF')).toBe(true);
    expect(exportResults(mockResponse, 'tsv').startsWith('\uFEFF')).toBe(true);
  });

  it('should escape commas and quotes in CSV', () => {
    const response: SearchResponse<QuranText> = {
      results: [
        {
          sura_id: 1,
          aya_id: 1,
          matchScore: 0.95,
          matchType: 'exact',
          standard: 'بسم الله، "اختبار"',
        },
      ],
    } as SearchResponse<QuranText>;

    const result = exportResults(response, 'csv');
    expect(result).toContain('"بسم الله، ""اختبار"""');
  });

  it('should escape newlines in CSV', () => {
    const response: SearchResponse<QuranText> = {
      results: [
        {
          sura_id: 1,
          aya_id: 1,
          matchScore: 0.95,
          matchType: 'exact',
          standard: 'بسم الله\nالحمد لله',
        },
      ],
    } as SearchResponse<QuranText>;

    const result = exportResults(response, 'csv');
    expect(result).toContain('1,1,0.95,exact,"بسم الله\nالحمد لله"');
  });
});
