import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import { useInventory, addItemToShoppingList } from '../state/useInventory'
import AddInventoryItemForm from '../components/AddInventoryItemForm'
import InventoryRow from '../components/InventoryRow'
import { colors } from '../theme'

export default function InventoryScreen() {
  const { household } = useAuth()
  const { locations } = useLocations(household.id)
  const { rows, loading, searchItems, addToInventory, takeSome, clearAll, setExpiryDate } = useInventory(
    household.id
  )
  const [editingId, setEditingId] = useState(null)
  const [justEmptied, setJustEmptied] = useState(null)

  const groups = useMemo(() => groupByLocation(rows), [rows])

  async function handleTakeSome(row, amount) {
    const depleted = await takeSome(row, amount)
    setEditingId(null)
    if (depleted) setJustEmptied({ itemId: row.item.id, name: row.item.name, unit: row.unit })
  }

  async function handleClearAll(row) {
    await clearAll(row)
    setEditingId(null)
    setJustEmptied({ itemId: row.item.id, name: row.item.name, unit: row.unit })
  }

  async function handleAddToShoppingList() {
    await addItemToShoppingList(household.id, justEmptied.itemId, justEmptied.unit)
    setJustEmptied(null)
  }

  return (
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <h2 style={styles.title}>Inventory</h2>
        <div style={styles.headerLinks}>
          <Link to="/recipes" style={styles.locationsLink}>
            Recipes
          </Link>
          <Link to="/expiring" style={styles.locationsLink}>
            Expiring
          </Link>
          <Link to="/locations" style={styles.locationsLink}>
            Edit locations
          </Link>
        </div>
      </div>

      {justEmptied && (
        <div style={styles.banner}>
          <span>Out of {justEmptied.name}.</span>
          <button type="button" style={styles.bannerButton} onClick={handleAddToShoppingList}>
            Add to shopping list
          </button>
          <button
            type="button"
            style={styles.bannerDismiss}
            onClick={() => setJustEmptied(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <AddInventoryItemForm locations={locations} searchItems={searchItems} onAdd={addToInventory} />

      {loading && <p style={styles.muted}>Loading…</p>}
      {!loading && rows.length === 0 && <p style={styles.muted}>Nothing in the inventory yet.</p>}

      {groups.map((group) => (
        <section key={group.name} style={styles.group}>
          <h3 style={styles.groupHeading}>{group.name}</h3>
          {group.items.map((row) => (
            <InventoryRow
              key={row.id}
              row={row}
              editing={editingId === row.id}
              onOpen={() => setEditingId(editingId === row.id ? null : row.id)}
              onTakeSome={(amount) => handleTakeSome(row, amount)}
              onClearAll={() => handleClearAll(row)}
              onSetExpiry={(date) => setExpiryDate(row.id, date)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

// Groups rows by location, in the household's location order, items
// inside each group A-Z.
function groupByLocation(rows) {
  const map = new Map()

  for (const row of rows) {
    const location = row.location
    const key = location?.id || 'unspecified'
    if (!map.has(key)) {
      map.set(key, {
        name: location?.name || 'Unspecified',
        order: location?.display_order ?? Number.MAX_SAFE_INTEGER,
        items: [],
      })
    }
    map.get(key).items.push(row)
  }

  for (const group of map.values()) {
    group.items.sort((a, b) => a.item.name.localeCompare(b.item.name))
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
  headerLinks: {
    display: 'flex',
    gap: '0.75rem',
  },
  locationsLink: {
    color: colors.primary,
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    background: colors.card,
    border: `1px solid ${colors.border}`,
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  bannerButton: {
    marginLeft: 'auto',
    padding: '0.4rem 0.7rem',
    borderRadius: '0.4rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  bannerDismiss: {
    border: 'none',
    background: 'none',
    color: colors.mutedText,
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0 0.2rem',
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
