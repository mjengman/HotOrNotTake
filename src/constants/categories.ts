export const MY_SKIPS_CATEGORY = 'my-skips';

export const CATEGORY_OPTIONS = [
  { value: 'all', label: '🎲 All Categories', emoji: '🎲' },
  { value: 'entertainment', label: '🎬 Entertainment', emoji: '🎬' },
  { value: 'environment', label: '🌱 Environment', emoji: '🌱' },
  { value: 'food', label: '🍕 Food', emoji: '🍕' },
  { value: 'life', label: '🌟 Life', emoji: '🌟' },
  { value: MY_SKIPS_CATEGORY, label: '⏭️ My Skips', emoji: '⏭️' },
  { value: 'pets', label: '🐕 Pets', emoji: '🐕' },
  { value: 'politics', label: '🗳️ Politics', emoji: '🗳️' },
  { value: 'relationships', label: '💕 Relationships', emoji: '💕' },
  { value: 'society', label: '🏛️ Society', emoji: '🏛️' },
  { value: 'sports', label: '⚽ Sports', emoji: '⚽' },
  { value: 'technology', label: '📱 Technology', emoji: '📱' },
  { value: 'travel', label: '✈️ Travel', emoji: '✈️' },
  { value: 'wellness', label: '💪 Wellness', emoji: '💪' },
  { value: 'work', label: '💼 Work', emoji: '💼' },
] as const;

export const isMySkipsCategory = (category?: string) =>
  category === MY_SKIPS_CATEGORY;
