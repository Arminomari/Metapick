// Predefined tag list used for both campaign content-type tags and creator profile tags.
// Brands pick what content types they're looking for; creators pick what they specialize in.

export const PLATFORM_TAGS = [
  'TikTok Video',
  'TikTok Live',
  'TikTok Stories',
  'Instagram Reels',
  'Instagram Stories',
  'Instagram Post',
  'YouTube Shorts',
  'YouTube Video',
  'Pinterest',
  'Snapchat',
  'Facebook',
  'Podcast',
  'UGC (Unboxing/Review)',
];

export const CREATOR_TYPE_TAGS = [
  'UGC Creator',
  'Lifestyle Creator',
  'Fashion Creator',
  'Beauty Creator',
  'Tech Creator',
  'Gaming Creator',
  'Fitness Creator',
  'Food Creator',
  'Travel Creator',
  'Family/Mom Creator',
  'Pet Creator',
  'Business Creator',
  'Finance Creator',
  'Comedy Creator',
  'Dance Creator',
  'Music Creator',
  'Art & Design Creator',
  'Education Creator',
];

export const NICHE_TAGS = [
  'Hudvård',
  'Makeup',
  'Hår & Skönhet',
  'Mode & Kläder',
  'Smycken & Accessoarer',
  'Hälsa & Wellness',
  'Träning & Fitness',
  'Mat & Dryck',
  'Hem & Inredning',
  'Resor',
  'Böcker & Litteratur',
  'Musik',
  'Film & TV',
  'Gaming',
  'Tech & Gadgets',
  'Fordon',
  'Sport',
  'Barn & Familj',
  'Djur',
  'Finans',
  'Utbildning',
  'Hållbarhet & Miljö',
];

export const ALL_TAGS = [...PLATFORM_TAGS, ...CREATOR_TYPE_TAGS, ...NICHE_TAGS];
