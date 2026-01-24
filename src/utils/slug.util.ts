/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate unique slug from max number returned by database query
 * maxNumber = 0 → use baseSlug, maxNumber > 0 → use baseSlug-(maxNumber+1)
 */
export function generateUniqueSlugFromMax(baseSlug: string, maxNumber: number): string {
  return maxNumber === 0 ? baseSlug : `${baseSlug}-${maxNumber + 1}`;
}

