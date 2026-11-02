import type { Food } from '../store/types'
/**
 * Reference foods, values per 100 g (or 100 ml for liquids).
 * IMPORTANT: these are rounded reference estimates in the range of USDA FoodData Central and
 * FAO/INFOODS-style tables. Kenyan home-cooked dishes (githeri, sukuma wiki, chapati, ugali) vary
 * a lot with oil, water and recipe, so treat them as estimates and create a custom food for accuracy.
 */
const F = (id: string, name: string, group: string, kcal: number, protein: number, carbs: number, fat: number, state?: Food['state'], servings?: Food['servings'], note?: string): Food =>
  ({ id, name, group, kcal, protein, carbs, fat, state, servings, source: 'reference', note })
export const REFERENCE_FOODS: Food[] = [
  F('ugali', 'Ugali (maize meal, cooked)', 'ugali', 115, 2.6, 24.5, 0.6, 'cooked', [{ label: 'small serving', grams: 200 }, { label: 'medium serving', grams: 300 }, { label: 'large serving', grams: 400 }]),
  F('maize-meal', 'Maize meal / unga (dry)', 'ugali', 360, 8, 76, 3, 'raw', [{ label: '1 cup', grams: 130 }]),
  F('rice-cooked', 'Rice, white (cooked)', 'rice', 130, 2.7, 28, 0.3, 'cooked', [{ label: '1 cup cooked', grams: 160 }]),
  F('rice-raw', 'Rice, white (uncooked)', 'rice', 360, 7, 79, 0.6, 'raw', [{ label: '1 cup dry', grams: 185 }]),
  F('beans-cooked', 'Beans (maharagwe, cooked)', 'beans', 127, 8.7, 22.8, 0.5, 'cooked', [{ label: '1 cup cooked', grams: 180 }]),
  F('beans-raw', 'Beans (dry)', 'beans', 337, 22, 61, 1, 'raw'),
  F('ndengu-cooked', 'Ndengu / green grams (cooked)', 'ndengu', 105, 7, 19, 0.4, 'cooked', [{ label: '1 cup cooked', grams: 200 }]),
  F('ndengu-raw', 'Ndengu / green grams (dry)', 'ndengu', 347, 24, 63, 1.2, 'raw'),
  F('githeri', 'Githeri (maize & beans, little oil)', 'githeri', 115, 5, 20, 1.5, 'cooked', [{ label: 'plate', grams: 350 }], 'Estimate; varies by bean/maize ratio and oil.'),
  F('chapati', 'Chapati', 'chapati', 300, 7.5, 47, 9, 'prepared', [{ label: '1 chapati', grams: 80 }], 'Estimate; depends on oil used.'),
  F('mandazi', 'Mandazi', 'mandazi', 360, 6.5, 48, 16, 'prepared', [{ label: '1 piece', grams: 50 }]),
  F('egg', 'Egg, boiled', 'egg', 155, 12.6, 1.1, 10.6, 'cooked', [{ label: '1 egg', grams: 50 }]),
  F('milk', 'Milk, whole (fresh)', 'milk', 61, 3.2, 4.8, 3.3, undefined, [{ label: '1 cup (250 ml)', grams: 258 }, { label: '1 glass (200 ml)', grams: 206 }]),
  F('yoghurt', 'Yoghurt, plain whole milk', 'milk', 61, 3.5, 4.7, 3.3, undefined, [{ label: '1 cup', grams: 245 }]),
  F('oats-raw', 'Oats (dry)', 'oats', 389, 16.9, 66, 6.9, 'raw', [{ label: '1/2 cup dry', grams: 40 }]),
  F('oats-porridge', 'Oat porridge (made with water)', 'oats', 71, 2.5, 12, 1.5, 'cooked', [{ label: '1 bowl', grams: 250 }]),
  F('banana', 'Banana', 'banana', 89, 1.1, 23, 0.3, undefined, [{ label: '1 medium', grams: 118 }]),
  F('matoke', 'Matoke / green banana (boiled)', 'banana', 116, 0.8, 31, 0.2, 'cooked', [{ label: '1 serving', grams: 250 }]),
  F('sukuma', 'Sukuma wiki (kale, cooked with a little oil)', 'greens', 45, 3, 5.5, 1.8, 'cooked', [{ label: '1 serving', grams: 120 }], 'Estimate; depends on oil.'),
  F('cabbage-raw', 'Cabbage (raw)', 'cabbage', 25, 1.3, 5.8, 0.1, 'raw'),
  F('cabbage-boiled', 'Cabbage (boiled)', 'cabbage', 23, 1.3, 5.5, 0.1, 'cooked', [{ label: '1 serving', grams: 120 }]),
  F('potato', 'Irish potato (boiled)', 'potato', 87, 1.9, 20, 0.1, 'cooked', [{ label: '1 medium', grams: 170 }]),
  F('sweet-potato', 'Sweet potato (boiled)', 'sweet-potato', 76, 1.4, 17.7, 0.1, 'cooked', [{ label: '1 medium', grams: 150 }]),
  F('sweet-potato-raw', 'Sweet potato (raw)', 'sweet-potato', 86, 1.6, 20, 0.1, 'raw'),
  F('cassava', 'Cassava (boiled)', 'cassava', 160, 1.4, 38, 0.3, 'cooked'),
  F('beef-stew', 'Beef, stewed', 'meat', 230, 26, 0, 13, 'cooked', [{ label: '1 serving', grams: 120 }], 'Estimate; fat varies by cut.'),
  F('goat', 'Goat meat, roasted', 'meat', 143, 27, 0, 3, 'cooked', [{ label: '1 serving', grams: 120 }]),
  F('chicken-breast', 'Chicken breast (cooked, skinless)', 'chicken', 165, 31, 0, 3.6, 'cooked', [{ label: '1 breast', grams: 120 }]),
  F('chicken-thigh', 'Chicken thigh (cooked)', 'chicken', 209, 26, 0, 11, 'cooked', [{ label: '1 thigh', grams: 100 }]),
  F('tilapia', 'Tilapia (cooked)', 'fish', 128, 26, 0, 2.7, 'cooked', [{ label: '1 fillet', grams: 130 }]),
  F('omena', 'Omena / dagaa (dried, rough estimate)', 'fish', 320, 60, 0, 8, 'raw', undefined, 'Rough estimate; varies by batch.'),
  F('bread', 'Bread, white', 'bread', 265, 9, 49, 3.2, undefined, [{ label: '1 slice', grams: 30 }]),
  F('peanut-butter', 'Peanut butter', 'nuts', 588, 25, 20, 50, undefined, [{ label: '1 tablespoon', grams: 16 }]),
  F('groundnuts', 'Groundnuts (roasted)', 'nuts', 585, 24, 21, 50, undefined, [{ label: 'small handful', grams: 30 }]),
  F('avocado', 'Avocado', 'fruit', 160, 2, 8.5, 14.7, undefined, [{ label: '1/2 avocado', grams: 100 }]),
  F('mango', 'Mango', 'fruit', 60, 0.8, 15, 0.4, undefined, [{ label: '1 medium', grams: 200 }]),
  F('orange', 'Orange', 'fruit', 47, 0.9, 12, 0.1, undefined, [{ label: '1 medium', grams: 130 }]),
  F('chai', 'Chai (tea with milk and sugar)', 'drink', 45, 1.2, 7, 1.5, 'prepared', [{ label: '1 cup', grams: 250 }], 'Estimate; depends on sugar and milk.'),
  F('oil', 'Cooking oil', 'oil', 884, 0, 0, 100, undefined, [{ label: '1 tablespoon', grams: 14 }]),
  F('sugar', 'Sugar', 'sugar', 387, 0, 100, 0, undefined, [{ label: '1 teaspoon', grams: 4 }]),
  F('whey', 'Whey protein powder', 'supplement', 400, 80, 8, 6, undefined, [{ label: '1 scoop', grams: 30 }], 'Check your product label.')
]
export const foodById = (id: string, custom: Food[] = []) => REFERENCE_FOODS.find(f => f.id === id) ?? custom.find(f => f.id === id)
export const allFoods = (custom: Food[]) => [...custom, ...REFERENCE_FOODS]
/** Find foods by name (case-insensitive). Used by the food search box and by Jarvis. */
export function searchFoods(q: string, custom: Food[], limit = 30): Food[] {
  const s = q.trim().toLowerCase(); const all = allFoods(custom)
  if (!s) return all.slice(0, limit)
  return all.filter(f => f.name.toLowerCase().includes(s) || f.group.includes(s)).slice(0, limit)
}
