// Open Food Facts has no concept of "supermarket aisle" — it has hundreds
// of fine-grained category tags in whatever language the product was
// entered in. This turns those tags into a best-guess match against our
// own short list of aisles. It won't always be right, and it doesn't need
// to be: it just needs to save typing on the common case, the way the
// plan's own example (a tin of beans landing under Food Cupboard) does.
const KEYWORD_RULES = [
  // Frozen goes first: it's a storage question that overrides what the
  // item is made of — frozen dairy or meat still lives in the freezer,
  // not the dairy or meat aisle. Without this, "ice-cream" matches
  // Dairy & Eggs on the substring "cream" before Frozen ever gets a look.
  { category: 'Frozen', keywords: ['frozen', 'ice-cream', 'ice cream'] },
  { category: 'Dairy & Eggs', keywords: ['dairy', 'milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg'] },
  { category: 'Meat & Fish', keywords: ['meat', 'poultry', 'chicken', 'beef', 'pork', 'lamb', 'sausage', 'fish', 'seafood', 'bacon'] },
  { category: 'Fruit & Veg', keywords: ['fruit', 'vegetable', 'salad', 'potato'] },
  { category: 'Bakery', keywords: ['bread', 'bakery', 'cake', 'pastry', 'pastries', 'bun', 'roll', 'croissant'] },
  { category: 'Drinks', keywords: ['beverage', 'drink', 'juice', 'soda', 'water', 'tea', 'coffee', 'wine', 'beer', 'cola'] },
  { category: 'Household', keywords: ['clean', 'detergent', 'laundry', 'household', 'washing-up'] },
  { category: 'Health & Beauty', keywords: ['cosmetic', 'hygiene', 'health', 'beauty', 'shampoo', 'toothpaste', 'skin-care'] },
  { category: 'Chilled', keywords: ['chilled', 'fresh-ready-meals', 'ready-meals'] },
]

// Falls back to Food Cupboard — a reasonable home for the many shelf-stable
// things (tins, packets, jars) OFF's tags don't cleanly signal, and it's
// exactly the aisle the build plan's own worked example expects.
const DEFAULT_CATEGORY = 'Food Cupboard'

export function guessCategoryName(categoriesTags = []) {
  const haystack = categoriesTags.join(' ').toLowerCase()
  for (const { category, keywords } of KEYWORD_RULES) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category
    }
  }
  return DEFAULT_CATEGORY
}
