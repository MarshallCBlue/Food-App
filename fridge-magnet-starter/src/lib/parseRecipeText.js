// Turns a block of pasted recipe text into a recipe name and a list of
// ingredients that the New recipe form can show for checking.
// It works with text copied from FamilyWall share pages and from most
// recipe websites, because nearly all of them lay recipes out the same
// way: a title, an "Ingredients" heading, one ingredient per line, then
// an "Instructions" or "Method" heading.

const UNITS = [
  'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'cups', 'oz', 'lb',
  'pinch', 'clove', 'cloves', 'tin', 'tins', 'can', 'cans',
]

const INGREDIENTS_HEADING = /^ingredients?\b/i
const END_HEADING = /^(instructions|method|directions|steps|preparation\b(?! time)|save$)/i
const DETAIL_LINE = /^(preparation time|prep time|cooking time|cook time|total time|servings|serves)\b/i

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
const AMOUNT = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*/

function toNumber(raw) {
  const text = raw.trim()
  if (FRACTIONS[text]) return FRACTIONS[text]
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const fraction = text.match(/^(\d+)\/(\d+)$/)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  return Number(text.replace(',', '.'))
}

// "200g rice" -> { name: 'rice', quantity: '200', unit: 'g' }
// "2 large eggs" -> { name: 'large eggs', quantity: '2', unit: '' }
// "Garlic" -> { name: 'Garlic', quantity: '1', unit: '' }
function parseIngredientLine(line) {
  let rest = line
  let quantity = '1'
  let unit = ''

  const amount = rest.match(AMOUNT)
  if (amount) {
    const value = toNumber(amount[1])
    if (Number.isFinite(value) && value > 0) quantity = String(Math.round(value * 100) / 100)
    rest = rest.slice(amount[0].length)

    const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s+(.+)$/)
    if (unitMatch && UNITS.includes(unitMatch[1].toLowerCase())) {
      unit = unitMatch[1].toLowerCase()
      rest = unitMatch[2]
    }
  }

  const name = rest.replace(/^of\s+/i, '').trim()
  return { name, quantity, unit }
}

export function parseRecipeText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*·▢☐]+/, '').trim())
    .filter(Boolean)

  if (lines.length === 0) return null

  const headingIndex = lines.findIndex((line) => INGREDIENTS_HEADING.test(line) && line.length < 25)
  const firstIngredientIndex = headingIndex === -1 ? 1 : headingIndex + 1

  const titleLine = lines.find(
    (line, index) => index < firstIngredientIndex && !DETAIL_LINE.test(line) && !INGREDIENTS_HEADING.test(line)
  )

  const ingredients = []
  for (const line of lines.slice(firstIngredientIndex)) {
    if (END_HEADING.test(line)) break
    if (DETAIL_LINE.test(line)) continue
    const ingredient = parseIngredientLine(line)
    if (ingredient.name) ingredients.push(ingredient)
  }

  return { name: titleLine || '', ingredients }
}
