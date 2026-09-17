import { guessCategoryName } from './categoryGuess'

// Open Food Facts is a free, public product database with strong UK
// coverage. No API key, no auth — just the barcode.
const API_BASE = 'https://world.openfoodfacts.org/api/v2/product'

// Returns { name, categoryGuess } or null if the barcode isn't in Open
// Food Facts (or the lookup failed for any other reason — this is a
// convenience, not something the rest of the scan flow depends on).
export async function lookupBarcode(barcode) {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(barcode)}.json?fields=product_name,categories_tags`)
    if (!response.ok) return null

    const data = await response.json()
    if (data.status !== 1 || !data.product?.product_name) return null

    return {
      name: data.product.product_name,
      categoryGuess: guessCategoryName(data.product.categories_tags),
    }
  } catch (err) {
    console.warn('Open Food Facts lookup failed', err)
    return null
  }
}
