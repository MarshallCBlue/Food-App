import { supabase } from '../supabaseClient'

// Looks a barcode up in the household's own catalogue — the first and
// fastest of the scan flow's three lookup steps.
export async function findItemByBarcode(householdId, barcode) {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, category_id, default_location_id, default_unit')
    .eq('household_id', householdId)
    .eq('barcode', barcode)
    .maybeSingle()

  if (error) {
    console.error('Could not look up barcode in the catalogue', error)
    return null
  }
  return data
}

// Saves a scanned item against its barcode once, so this lookup only ever
// has to happen the first time that product is scanned.
export async function createCatalogueItem({ householdId, name, barcode, categoryId, locationId, unit }) {
  const { data, error } = await supabase
    .from('items')
    .insert({
      household_id: householdId,
      name: name.trim(),
      barcode: barcode || null,
      category_id: categoryId || null,
      default_location_id: locationId || null,
      default_unit: unit || null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
