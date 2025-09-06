export const getTopCategories = (
  categoryCounts: Record<string, number>,
  limit: number = 3
): string[] => {
  return Object.entries(categoryCounts)
    .sort((a, b) => {
      const diff = b[1] - a[1];
      return diff !== 0 ? diff : a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([category]) => category);
};
