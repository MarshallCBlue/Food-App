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

// The aisles worth asking a quick "use-by date?" for when scanning
// something into the inventory — chilled and fresh goods, per the plan.
// Everything else (tins, drinks, cleaning products…) stays out of the way.
const PERISHABLE_CATEGORIES = new Set(['Dairy & Eggs', 'Meat & Fish', 'Chilled', 'Frozen', 'Fruit & Veg'])

export function isPerishableCategory(categoryName) {
  return PERISHABLE_CATEGORIES.has(categoryName)
}

// ── Guessing an aisle from a plain name ─────────────────────────────
// Recipe ingredients and quick adds arrive as just a name ("red onion",
// "chicken thighs"), with no Open Food Facts tags to go on. These rules
// match whole words only, so "butternut squash" is not mistaken for
// butter and "eggplant" is not mistaken for egg. Plurals ("onions",
// "tomatoes") count as a match too.
//
// Order matters: the first aisle with a matching word wins, so the more
// specific aisles come first (frozen peas are Frozen, not Fruit & Veg).
// The aisle names must match the ones on the Aisles screen; any that you
// have renamed or deleted are simply skipped.
const NAME_RULES = [
  { category: 'Frozen', keywords: ['frozen', 'ice cream', 'ice lolly'] },
  { category: 'Chilled', keywords: ['hummus', 'houmous', 'pesto', 'tofu', 'fresh pasta', 'ready meal'] },
  // Before Fruit & Veg and Dairy so "tinned tomatoes", "ground ginger" and
  // "peanut butter" land in the cupboard, not the fresh aisles.
  {
    category: 'Food Cupboard',
    keywords: [
      'tin', 'tinned', 'can', 'canned', 'jar', 'dried', 'ground', 'powder', 'stock', 'stock cube', 'flour',
      'rice', 'pasta', 'noodle', 'sugar', 'oil', 'vinegar', 'salt', 'spice', 'sauce', 'paste', 'peanut butter',
      'coconut milk', 'lentil', 'chickpea', 'oat', 'cereal', 'honey', 'jam', 'baking powder', 'yeast', 'flake',
    ],
  },
  {
    category: 'Fruit & Veg',
    keywords: [
      'fruit', 'vegetable', 'veg', 'salad', 'potato', 'onion', 'spring onion', 'shallot', 'garlic', 'ginger',
      'carrot', 'parsnip', 'leek', 'celery', 'tomato', 'cucumber', 'lettuce', 'spinach', 'kale', 'cabbage',
      'broccoli', 'cauliflower', 'courgette', 'aubergine', 'pepper', 'chilli', 'chili', 'mushroom', 'pea',
      'bean sprout', 'sweetcorn', 'squash', 'pumpkin', 'avocado', 'lemon', 'lime', 'orange', 'apple', 'pear',
      'banana', 'grape', 'berry', 'strawberry', 'raspberry', 'blueberry', 'melon', 'mango', 'pineapple',
      'coriander', 'parsley', 'basil', 'mint', 'rosemary', 'thyme', 'herb', 'rocket', 'beetroot', 'asparagus',
    ],
  },
  {
    category: 'Meat & Fish',
    keywords: [
      'meat', 'chicken', 'beef', 'pork', 'lamb', 'mince', 'steak', 'sausage', 'bacon', 'ham', 'chorizo',
      'turkey', 'duck', 'fish', 'salmon', 'cod', 'haddock', 'tuna', 'prawn', 'mackerel', 'seafood',
    ],
  },
  {
    category: 'Dairy & Eggs',
    keywords: [
      'milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'halloumi', 'yogurt', 'yoghurt', 'butter',
      'cream', 'creme fraiche', 'egg',
    ],
  },
  { category: 'Bakery', keywords: ['bread', 'loaf', 'baguette', 'bun', 'roll', 'wrap', 'tortilla', 'pitta', 'naan', 'croissant', 'bagel'] },
  { category: 'Drinks', keywords: ['juice', 'water', 'tea', 'coffee', 'wine', 'beer', 'cola'] },
  { category: 'Household', keywords: ['foil', 'cling film', 'bin bag', 'washing up liquid', 'detergent', 'kitchen roll'] },
]

// Plurals: "onions", "tomatoes", "berries" all reduce to their keyword.
function matchesWord(word, keyword) {
  return (
    word === keyword ||
    word === `${keyword}s` ||
    word === `${keyword}es` ||
    (keyword.endsWith('y') && word === `${keyword.slice(0, -1)}ies`)
  )
}

// Returns an aisle name, or null when nothing matches. Unlike the barcode
// guess above there is no Food Cupboard fallback here — "flour" and
// "rice" really do belong there, but so would every typo, so the caller
// decides what an unmatched name should do.
export function guessCategoryFromName(name = '') {
  const clean = name.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!clean) return null
  const words = clean.split(' ')
  const padded = ` ${clean} `

  for (const { category, keywords } of NAME_RULES) {
    for (const keyword of keywords) {
      const found = keyword.includes(' ')
        ? padded.includes(` ${keyword} `) || padded.includes(` ${keyword}s `)
        : words.some((word) => matchesWord(word, keyword))
      if (found) return category
    }
  }
  return null
}
