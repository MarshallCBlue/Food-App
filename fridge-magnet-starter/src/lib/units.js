// Units, done the same way as the database (see unit_scale and
// convert_amount in 20261009160000_units_and_undo.sql), so the app's
// "in stock" ticks agree with what the Cook button will actually do.
//
// Weights convert between each other (g, kg, oz, lb), and so do volumes
// (ml, cl, l, tsp, tbsp). Anything else ("tin", "bag", no unit at all)
// only matches itself, ignoring capitals and a plural "s".

const ALIASES = {
  g: ['g', 'gram', 'grams', 'gr', 'grm'],
  kg: ['kg', 'kgs', 'kilogram', 'kilograms', 'kilo', 'kilos'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  ml: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  cl: ['cl', 'centilitre', 'centilitres', 'centiliter', 'centiliters'],
  l: ['l', 'litre', 'litres', 'liter', 'liters', 'ltr'],
  tsp: ['tsp', 'teaspoon', 'teaspoons'],
  tbsp: ['tbsp', 'tablespoon', 'tablespoons', 'tbs'],
}

const SCALE = {
  g: ['weight', 1],
  kg: ['weight', 1000],
  oz: ['weight', 28.3495],
  lb: ['weight', 453.592],
  ml: ['volume', 1],
  cl: ['volume', 10],
  l: ['volume', 1000],
  tsp: ['volume', 5],
  tbsp: ['volume', 15],
}

const LOOKUP = Object.fromEntries(
  Object.entries(ALIASES).flatMap(([unit, spellings]) => spellings.map((spelling) => [spelling, unit]))
)

// "Grams" → "g", "Tins" → "tin", nothing → "".
export function normaliseUnit(unit) {
  const clean = (unit || '').trim().toLowerCase().replace(/\.$/, '')
  if (LOOKUP[clean]) return LOOKUP[clean]
  if (clean.length > 3 && clean.endsWith('s')) return clean.slice(0, -1)
  return clean
}

function scaleOf(unit) {
  const normal = normaliseUnit(unit)
  return SCALE[normal] || [`count:${normal}`, 1]
}

// An amount turned from one unit into another, or null when they can't
// be compared (grams and tins, for example).
export function convertAmount(amount, fromUnit, toUnit) {
  const [fromFamily, fromFactor] = scaleOf(fromUnit)
  const [toFamily, toFactor] = scaleOf(toUnit)
  if (fromFamily !== toFamily) return null
  return Math.round(((Number(amount) * fromFactor) / toFactor) * 10000) / 10000
}

// How much of an ingredient the stock covers, in the recipe's own unit.
// `batches` are inventory rows ({ quantity, unit }) for that one food.
// Returns { have, unmatched, status }, where unmatched lists batches in
// units that can't be compared, and status is:
//   'ok'    — enough in stock
//   'check' — not enough that can be compared, but there are other
//             batches the person should look at themselves
//   'short' — not enough, and nothing else to check
export function stockFor(ingredient, batches) {
  let have = 0
  const unmatched = []
  for (const batch of batches) {
    const converted = convertAmount(batch.quantity, batch.unit, ingredient.unit)
    if (converted === null) unmatched.push(batch)
    else have += converted
  }
  have = Math.round(have * 10000) / 10000
  const need = Number(ingredient.quantity)
  const status = have >= need ? 'ok' : unmatched.length > 0 ? 'check' : 'short'
  return { have, unmatched, status }
}

// "2.5 kg", "3 tins", "4" — for showing amounts in sentences.
export function formatAmount(quantity, unit) {
  const number = Number(quantity)
  const display = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '')
  return unit ? `${display} ${unit}` : display
}
