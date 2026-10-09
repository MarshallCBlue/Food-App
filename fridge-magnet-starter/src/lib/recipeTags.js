// Small helpers for recipe tags, shared by the recipe form and the
// recipes list. Tags are compared ignoring capitals, so "quick" and
// "Quick" count as the same tag.

const MAX_TAG_LENGTH = 30

// Tidies typed text into a tag: trims the ends, squashes double spaces,
// and cuts it to a sensible length. Returns '' if nothing is left.
export function cleanTag(text) {
  return text.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH)
}

export function sameTag(a, b) {
  return a.toLowerCase() === b.toLowerCase()
}

// Every tag used on any recipe, each listed once, A to Z.
export function allTags(recipes) {
  const found = []
  for (const recipe of recipes) {
    for (const tag of recipe.tags || []) {
      if (!found.some((existing) => sameTag(existing, tag))) found.push(tag)
    }
  }
  return found.sort((a, b) => a.localeCompare(b))
}

// True when the recipe has every one of the chosen tags. With nothing
// chosen, every recipe matches.
export function hasAllTags(recipe, chosen) {
  const tags = recipe.tags || []
  return chosen.every((wanted) => tags.some((tag) => sameTag(tag, wanted)))
}
