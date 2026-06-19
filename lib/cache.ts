import fs from 'fs';
import path from 'path';

// Define the path for our JSON cache file
// Storing it in the root directory
const CACHE_FILE = path.join(process.cwd(), 'categories_cache.json');

/**
 * Read the current category cache from disk.
 * Returns an object mapping news unique IDs to category strings.
 */
export function getCategoryCache(): Record<string, string> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Cache] Error reading category cache:', error);
  }
  return {}; // Return empty object if file doesn't exist or error occurs
}

/**
 * Save the category cache back to disk.
 */
export function saveCategoryCache(cache: Record<string, string>) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Cache] Error writing category cache:', error);
  }
}
