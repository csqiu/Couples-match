/** US state (and DC, territory) names → postal abbreviations. */
export const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'puerto rico': 'PR', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', guam: 'GU', 'virgin islands': 'VI',
};

export function stateAbbreviation(name: string): string | undefined {
  const s = name.trim();
  if (/^[A-Z]{2}$/.test(s)) return s;
  return US_STATES[s.toLowerCase()];
}

/** "LOS ANGELES" → "Los Angeles"; already mixed-case names are left alone. */
export function tidyCity(city: string): string {
  const c = city.trim().replace(/\s+/g, ' ');
  if (c !== c.toUpperCase()) return c;
  return c.toLowerCase().replace(/(^|[\s\-'.])([a-z])/g, (_, p: string, ch: string) => p + ch.toUpperCase()).replace(/\bMc([a-z])/g, (_, ch: string) => `Mc${ch.toUpperCase()}`);
}
