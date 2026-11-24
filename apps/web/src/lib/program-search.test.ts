import { describe, expect, it } from 'vitest';
import { searchFilters, searchTerms } from './program-search';

describe('program search', () => {
  it('matches the NRMP directory’s abbreviations', () => {
    expect(searchTerms('Massachusetts General Hospital')).toEqual([
      ['massachusetts', 'mass'],
      ['general', 'gen'],
      ['hospital', 'hosp'],
    ]);
    expect(searchTerms('University of Chicago')).toEqual([['university', 'univ'], ['chicago']]);
  });

  it('drops filter-breaking characters and small words, and caps the number of words', () => {
    expect(searchTerms('NYU, (Grossman) & co*')).toEqual([['nyu'], ['grossman'], ['co']]);
    expect(searchTerms('a b c d e f g h')).toHaveLength(6);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('builds one filter per word over name, institution, city and NRMP code', () => {
    expect(searchFilters('1261140C0')).toEqual([
      'name.ilike.%1261140c0%,institution.ilike.%1261140c0%,city.ilike.%1261140c0%,nrmp_code.ilike.%1261140c0%',
    ]);
  });
});
