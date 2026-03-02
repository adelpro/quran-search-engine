import { describe, it, expect } from 'vitest';
import { parseBooleanQuery, hasBooleanOperators } from './boolean-parser';

describe('hasBooleanOperators', () => {
  it('returns false for plain query', () => {
    expect(hasBooleanOperators('الله الرحمن')).toBe(false);
  });

  it('returns true for | operator', () => {
    expect(hasBooleanOperators('الله | الرحمن')).toBe(true);
  });

  it('returns true for - prefix', () => {
    expect(hasBooleanOperators('الرحمن -الرحيم')).toBe(true);
  });

  it('returns true for + prefix', () => {
    expect(hasBooleanOperators('+الله الرحمن')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasBooleanOperators('')).toBe(false);
  });

  it('returns false for whitespace only', () => {
    expect(hasBooleanOperators('   ')).toBe(false);
  });

  it('returns true for | without surrounding spaces', () => {
    expect(hasBooleanOperators('الله|الرحمن')).toBe(true);
  });

  it('returns true for double pipe ||', () => {
    expect(hasBooleanOperators('الله || الرحمن')).toBe(true);
  });
});

describe('parseBooleanQuery', () => {
  it('parses plain AND query as single group of AND nodes', () => {
    const q = parseBooleanQuery('الله الرحمن');
    expect(q.type).toBe('boolean');
    expect(q.groups).toHaveLength(1);
    expect(q.groups[0].nodes).toHaveLength(2);
    expect(q.groups[0].nodes[0]).toEqual({ operator: 'and', term: 'الله' });
    expect(q.groups[0].nodes[1]).toEqual({ operator: 'and', term: 'الرحمن' });
  });

  it('parses OR query into two groups', () => {
    const q = parseBooleanQuery('الله | الرحمن');
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0].nodes[0]).toEqual({ operator: 'and', term: 'الله' });
    expect(q.groups[1].nodes[0]).toEqual({ operator: 'and', term: 'الرحمن' });
  });

  it('parses NOT term (leading -)', () => {
    const q = parseBooleanQuery('الرحمن -الرحيم');
    expect(q.groups[0].nodes[0]).toEqual({ operator: 'and', term: 'الرحمن' });
    expect(q.groups[0].nodes[1]).toEqual({ operator: 'not', term: 'الرحيم' });
  });

  it('parses + prefix as AND operator', () => {
    const q = parseBooleanQuery('+الله الرحمن');
    expect(q.groups[0].nodes[0]).toEqual({ operator: 'and', term: 'الله' });
    expect(q.groups[0].nodes[1]).toEqual({ operator: 'and', term: 'الرحمن' });
  });

  it('parses mixed OR with NOT', () => {
    const q = parseBooleanQuery('الرحمن -الرحيم | الله');
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0].nodes).toHaveLength(2);
    expect(q.groups[0].nodes[1].operator).toBe('not');
    expect(q.groups[1].nodes[0]).toEqual({ operator: 'and', term: 'الله' });
  });

  it('strips tashkeel from terms before storing', () => {
    const q = parseBooleanQuery('-ٱلرَّحِيمِ');
    expect(q.groups[0].nodes[0].term).toBe('الرحيم');
  });

  it('ignores empty tokens after split', () => {
    const q = parseBooleanQuery('  الله   الرحمن  ');
    expect(q.groups[0].nodes).toHaveLength(2);
  });

  it('returns single group with zero nodes for empty string', () => {
    const q = parseBooleanQuery('');
    expect(q.groups[0].nodes).toHaveLength(0);
  });

  it('returns single group with zero nodes for whitespace only', () => {
    const q = parseBooleanQuery('   ');
    expect(q.groups[0].nodes).toHaveLength(0);
  });

  it('does not confuse mid-word hyphen with NOT operator', () => {
    const q = parseBooleanQuery('الله-الرحمن');
    expect(q.groups[0].nodes[0].operator).toBe('and');
  });

  it('parses standalone | surrounded by Arabic text with diacritics', () => {
    const q = parseBooleanQuery('ٱللَّهِ | ٱلرَّحِيمِ');
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0].nodes[0].term).toBe('الله');
    expect(q.groups[1].nodes[0].term).toBe('الرحيم');
  });

  it('handles multiple OR groups', () => {
    const q = parseBooleanQuery('الله | الرحمن | الحمد');
    expect(q.groups).toHaveLength(3);
    expect(q.groups[0].nodes[0].term).toBe('الله');
    expect(q.groups[1].nodes[0].term).toBe('الرحمن');
    expect(q.groups[2].nodes[0].term).toBe('الحمد');
  });

  it('handles + and - after | in OR group', () => {
    const q = parseBooleanQuery('الله | +الرحمن -الرحيم');
    expect(q.groups).toHaveLength(2);
    expect(q.groups[1].nodes[0]).toEqual({ operator: 'and', term: 'الرحمن' });
    expect(q.groups[1].nodes[1]).toEqual({ operator: 'not', term: 'الرحيم' });
  });

  it('handles double pipe || as single OR', () => {
    const q = parseBooleanQuery('الله || الرحمن');
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0].nodes[0].term).toBe('الله');
    expect(q.groups[1].nodes[0].term).toBe('الرحمن');
  });

  it('handles pipe without spaces', () => {
    const q = parseBooleanQuery('الله|الرحمن');
    expect(q.groups).toHaveLength(2);
    expect(q.groups[0].nodes[0].term).toBe('الله');
    expect(q.groups[1].nodes[0].term).toBe('الرحمن');
  });

  it('strips stacked operators like +-term', () => {
    const q = parseBooleanQuery('+-الله');
    expect(q.groups[0].nodes[0]).toEqual({ operator: 'and', term: 'الله' });
  });
});
