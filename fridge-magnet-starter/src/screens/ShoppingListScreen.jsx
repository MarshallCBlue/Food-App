import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useCategories } from '../state/useCategories'
import { useShoppingList } from '../state/useShoppingList'
import AddItemForm from '../components/AddItemForm'
import ShoppingListRow from '../components/ShoppingListRow'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'

export default function ShoppingListScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const { categories } = useCategories(household.id)
  const { rows, loading, searchItems, addToList, toggleChecked, updateRow, removeRow } = useShoppingList(
    household.id
  )
  const [editingId, setEditingId] = useState(null)

  const groups = useMemo(() => groupByAisle(rows), [rows])
  const ticked = rows.filter((row) => row.checked).length

  return (
    <div>
      <PageHeader
        title="Shopping list"
        subtitle={
          rows.length > 0
            ? `${ticked} of ${rows.length} ticked off`
            : 'Everything you need on the next shop'
        }
        actions={
          <div className="fm-chips">
            <button type="button" className="fm-chip" onClick={() => navigate('/aisles')}>
              <Icon name="edit" />
              Aisles
            </button>
          </div>
        }
      />

      <AddItemForm categories={categories} searchItems={searchItems} onAdd={addToList} />

      {loading && <SkeletonRows rows={5} />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="basket"
          title="The list is empty"
          body="Add something above, or scan a barcode. Items you have bought before remember which aisle they live in."
        />
      )}

      {groups.map((group) => {
        const left = group.items.filter((row) => !row.checked).length
        return (
          <section key={group.name} className="fm-group">
            <div className="fm-rail">
              <h2 className="fm-rail__name">{group.name}</h2>
              <span className="fm-rail__count">{left === 0 ? 'all done' : `${left} left`}</span>
            </div>
            {group.items.map((row) => (
              <ShoppingListRow
                key={row.id}
                row={row}
                editing={editingId === row.id}
                onToggle={() => toggleChecked(row.id, !row.checked)}
                onOpen={() => setEditingId(editingId === row.id ? null : row.id)}
                onSave={(fields) => {
                  updateRow(row.id, fields)
                  setEditingId(null)
                }}
                onRemove={() => {
                  removeRow(row.id)
                  setEditingId(null)
                }}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

// Groups rows by aisle, aisles in their own display order and "Other" for
// anything whose category was deleted, items inside each group A-Z with
// ticked ones sunk to the bottom.
function groupByAisle(rows) {
  const map = new Map()

  for (const row of rows) {
    const category = row.item?.category
    const key = category?.id || 'uncategorised'
    if (!map.has(key)) {
      map.set(key, {
        name: category?.name || 'Other',
        order: category?.display_order ?? Number.MAX_SAFE_INTEGER,
        items: [],
      })
    }
    map.get(key).items.push(row)
  }

  for (const group of map.values()) {
    group.items.sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1
      return a.item.name.localeCompare(b.item.name)
    })
  }

  return Array.from(map.values()).sort((a, b) => a.order - b.order)
}
