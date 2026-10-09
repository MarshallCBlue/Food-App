import { supabase } from '../supabaseClient'
import { guessCategoryFromName } from './categoryGuess'
import { normaliseUnit } from './units'

// Everything that puts something on the shopping list goes through here —
// typing it in, scanning it, the "out of this, add to list?" prompt, and
// cooking a recipe — so they all behave the same way:
//   1. an item with no aisle gets one guessed from its name, and
//   2. an item already on the list gets its amount added to, not a
//      second line.

// Finds the id of the aisle a name probably belongs in, or null.
// `fallbackName` is used when the name matches nothing (recipes pass
// "Food Cupboard", since that is where most unmatched ingredients live).
export async function guessAisleId(householdId, name, fallbackName = null) {
  const guessedName = guessCategoryFromName(name) ?? fallbackName
  if (!guessedName) return null

  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('household_id', householdId)
    .ilike('name', guessedName)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

// If a catalogue item has no aisle yet, guess one and save it on the item,
// so it is filed properly now and every time it is added in future.
// Items that already have an aisle are left exactly as they are.
async function ensureItemHasAisle(householdId, itemId) {
  const { data: item } = await supabase
    .from('items')
    .select('id, name, category_id')
    .eq('id', itemId)
    .maybeSingle()
  if (!item || item.category_id) return item

  const categoryId = await guessAisleId(householdId, item.name, 'Food Cupboard')
  if (categoryId) {
    await supabase.from('items').update({ category_id: categoryId }).eq('id', itemId)
  }
  return item
}

// "Grams", "gram" and "g" are the same unit; so are "tins" and "tin".
// The spelling rules live in units.js, shared with cooking.
export function sameUnit(a, b) {
  return normaliseUnit(a) === normaliseUnit(b)
}

function joinNotes(a, b) {
  if (!a) return b || null
  if (!b || a === b) return a
  return `${a}; ${b}`
}

// Adds an item to the list, or tops up the line already there.
//
// confirmUnits is optional. When the units differ ("500 g" already on the
// list, "2 tins" being added), it is called with both amounts and must
// return a promise of one of:
//   { action: 'combine', quantity, unit }  — one line, with these values
//   { action: 'separate' }                 — keep two lines
//   null                                   — changed my mind, add nothing
// If it is not given, a different unit simply goes on its own line.
//
// Returns 'added', 'merged', 'separate' or 'cancelled'.
export async function addOrMergeShoppingItem(householdId, { itemId, quantity, unit, note }, confirmUnits) {
  const item = await ensureItemHasAisle(householdId, itemId)

  const incoming = {
    quantity: Number(quantity) || 1,
    unit: unit?.trim() || null,
    note: note?.trim() || null,
  }

  // Only lines not yet ticked off. A ticked line is already in the
  // trolley, so a fresh need is a fresh line.
  const { data: existing, error: findError } = await supabase
    .from('shopping_list_items')
    .select('id, quantity, unit, note')
    .eq('household_id', householdId)
    .eq('item_id', itemId)
    .eq('checked', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (findError) throw findError

  async function insertNewLine() {
    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: householdId,
      item_id: itemId,
      ...incoming,
    })
    if (error) throw error
  }

  if (!existing) {
    await insertNewLine()
    return 'added'
  }

  let merged
  if (sameUnit(existing.unit, incoming.unit)) {
    merged = {
      quantity: Number(existing.quantity) + incoming.quantity,
      unit: existing.unit || incoming.unit,
    }
  } else {
    const answer = confirmUnits
      ? await confirmUnits({
          name: item?.name ?? 'This item',
          existing: { quantity: Number(existing.quantity), unit: existing.unit },
          incoming,
        })
      : { action: 'separate' }

    if (!answer) return 'cancelled'
    if (answer.action === 'separate') {
      await insertNewLine()
      return 'separate'
    }
    merged = { quantity: Number(answer.quantity) || 1, unit: answer.unit?.trim() || null }
  }

  const { error } = await supabase
    .from('shopping_list_items')
    .update({ ...merged, note: joinNotes(existing.note, incoming.note) })
    .eq('id', existing.id)
  if (error) throw error
  return 'merged'
}
