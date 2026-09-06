/**
 * Thailand's public holidays, for the "Working the Holiday" achievement (§5).
 *
 * These cannot be computed. Roughly half are fixed dates, but Makha Bucha,
 * Visakha Bucha and Asahna Bucha follow the lunar calendar and move every year,
 * and any holiday falling at a weekend gets a substitution day decided by
 * announcement rather than by rule. So this is a transcribed table, taken from
 * the Bank of Thailand's annual financial-institution holiday list, which is
 * published about a year ahead.
 *
 * When the table runs out, the interface says so rather than guessing: a wrong
 * date here would hand out an achievement that was never earned.
 *
 * Sources:
 *   2026 — https://www.humanresourcesonline.net/full-list-of-thailand-s-2026-public-holidays
 *   2027 — https://www.nationthailand.com/news/general/40070369
 */

export type Holiday = { date: string; name: string };

export const THAI_HOLIDAYS: Record<number, Holiday[]> = {
  2026: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-02", name: "Additional special holiday" },
    { date: "2026-03-03", name: "Makha Bucha Day" },
    { date: "2026-04-06", name: "Chakri Memorial Day" },
    { date: "2026-04-13", name: "Songkran" },
    { date: "2026-04-14", name: "Songkran" },
    { date: "2026-04-15", name: "Songkran" },
    { date: "2026-05-01", name: "National Labour Day" },
    { date: "2026-05-04", name: "Coronation Day" },
    { date: "2026-06-01", name: "Visakha Bucha Day (substitute)" },
    { date: "2026-06-03", name: "Queen Suthida's Birthday" },
    { date: "2026-07-28", name: "King Vajiralongkorn's Birthday" },
    { date: "2026-07-29", name: "Asahna Bucha Day" },
    { date: "2026-08-12", name: "Queen Sirikit's Birthday and Mother's Day" },
    { date: "2026-10-13", name: "King Bhumibol Memorial Day" },
    { date: "2026-10-23", name: "Chulalongkorn Day" },
    { date: "2026-12-07", name: "King Bhumibol's Birthday (substitute)" },
    { date: "2026-12-10", name: "Constitution Day" },
    { date: "2026-12-31", name: "New Year's Eve" },
  ],
  2027: [
    { date: "2027-01-01", name: "New Year's Day" },
    { date: "2027-02-22", name: "Makha Bucha Day (substitute)" },
    { date: "2027-04-06", name: "Chakri Memorial Day" },
    { date: "2027-04-13", name: "Songkran" },
    { date: "2027-04-14", name: "Songkran" },
    { date: "2027-04-15", name: "Songkran" },
    { date: "2027-05-03", name: "National Labour Day (substitute)" },
    { date: "2027-05-04", name: "Coronation Day" },
    { date: "2027-05-20", name: "Visakha Bucha Day" },
    { date: "2027-06-03", name: "Queen Suthida's Birthday" },
    { date: "2027-07-19", name: "Asahna Bucha Day (substitute)" },
    { date: "2027-07-28", name: "King Vajiralongkorn's Birthday" },
    { date: "2027-08-12", name: "Queen Sirikit's Birthday and Mother's Day" },
    { date: "2027-10-13", name: "Nawaminthararachin Day" },
    { date: "2027-10-25", name: "Chulalongkorn Day (substitute)" },
    { date: "2027-12-06", name: "King Bhumibol's Birthday (substitute)" },
    { date: "2027-12-10", name: "Constitution Day" },
    { date: "2027-12-31", name: "New Year's Eve" },
  ],
};

/** Years the table covers, oldest first. */
export function knownThaiYears(): number[] {
  return Object.keys(THAI_HOLIDAYS)
    .map(Number)
    .sort((a, b) => a - b);
}

export function thaiHolidaysFor(year: number): Holiday[] {
  return THAI_HOLIDAYS[year] ?? [];
}

/** The last year covered, so the interface can say when it needs topping up. */
export function lastKnownThaiYear(): number {
  return knownThaiYears().at(-1) ?? 0;
}
