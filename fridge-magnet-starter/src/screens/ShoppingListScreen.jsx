import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useCategories } from '../state/useCategories'
import { useShoppingList } from '../state/useShoppingList'
import AddItemForm from '../components/AddItemForm'
import ShoppingListRow from '../components/ShoppingListRow'
import { colors } from '../theme'

export default function ShoppingListScreen() {
  const { household } = useAuth()
  const { categories } = useCategories(household.id)
  const { rows, loading, searchItems, addToList, toggleChecked, updateRow, removeRow } = useShoppingList(
    household.id
  )
  const [editingId, setEditingId] = useState(null)

  const groups = useMemo(() => groupByAisle(rows), [rows])

  return (
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <h2 style={styles.title}>Shopping list</h2>
        <Link to="/aisles" style={styles.aislesLink}>
          Edit aisles
        </Link>
      </div>

      <AddItemForm categories={categories} searchItems={searchItems} onAdd={addToList} />

      {loading && <p style={styles.muted}>Loading…</p>}
      {!loading && rows.length === 0 && <p style={styles.muted}>Nothing on the list. Add something above.</p>}

      {groups.map((group) => (
        <section key={group.name} style={styles.group}>
          <h3 style={styles.groupHeading}>{group.name}</h3>
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
      ))}
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

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  aislesLink: {
    color: colors.primary,
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  muted: {
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: '2rem',
  },
  group: {
    marginBottom: '1rem',
  },
  groupHeading: {
    margin: '0 0 0.25rem 0',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: colors.mutedText,
  },
}
