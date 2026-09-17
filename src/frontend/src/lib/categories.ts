/**
 * The one category vocabulary of the product: creator profiles, campaigns,
 * video orders, brand industries and discovery filters all pick from here, so
 * a "Mat & Dryck" campaign actually matches a "Mat & Dryck" creator.
 * Values are stored as-is (Swedish); `categoryLabel` in lib/utils translates
 * them and maps the older names that may still be around.
 */
export const CATEGORIES = [
  'Mat & Dryck', 'Skönhet', 'Mode', 'Sport & Hälsa', 'Hem & Inredning', 'Teknik', 'Gaming',
  'Musik', 'Resor', 'Barn & Familj', 'Livsstil', 'Humor & Nöje', 'Tjänster', 'Övrigt',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Older stored values → today's name. The same mapping runs once in the database migration. */
export const LEGACY_CATEGORY: Record<string, Category> = {
  Mat: 'Mat & Dryck', Sport: 'Sport & Hälsa', Fitness: 'Sport & Hälsa', 'Hälsa': 'Sport & Hälsa',
  Humor: 'Humor & Nöje', 'Nöje': 'Humor & Nöje',
  Fashion: 'Mode', Beauty: 'Skönhet', Food: 'Mat & Dryck', 'Food & Drink': 'Mat & Dryck', Tech: 'Teknik',
  Technology: 'Teknik', Travel: 'Resor', Music: 'Musik', Sports: 'Sport & Hälsa', Health: 'Sport & Hälsa',
  Lifestyle: 'Livsstil', Other: 'Övrigt',
};

export const canonicalCategory = (value?: string | null): string => (value ? LEGACY_CATEGORY[value] ?? value : '');
