import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import { useInventory, addItemToShoppingList } from '../state/useInventory'
import { daysUntil } from '../lib/expiry'
import AddInventoryItemForm from '../components/AddInventoryItemForm'
import InventoryRow from '../components/InventoryRow'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import Toast from '../components/Toast'
import Icon from '../components/Icon'

export default function InventoryScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const { locations } = useLocations(household.id)
  const { rows, loading, searchItems, addToInventory, takeSome, clearAll, setExpiryDate } = useInventory(
    household.id
  )
  const [editingId, setEditingId] = useState(null)
  const [justEmptied, setJustEmptied] = useState(null)

  const groups = useMemo(() => groupByLocation(rows), [rows])

  // How many things need eating this week — shown on the way into the
  // expiring screen so the number is visible without going looking.
  const pressing = useMemo(
    () => rows.filter((row) => row.expires_on && daysUntil(row.expires_on) <= 3).length,
    [rows]
  )

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
    <div>
      <PageHeader
        title="Inventory"
        subtitle={
          rows.length > 0
            ? `${rows.length} thing${rows.length === 1 ? '' : 's'} in ${groups.length} place${
                groups.length === 1 ? '' : 's'
              }`
            : "What's in the cupboards, fridge and freezer"
        }
        actions={
          <div className="fm-chips">
            <button
              type="button"
              className={`fm-chip${pressing > 0 ? ' fm-chip--alert' : ''}`}
              onClick={() => navigate('/expiring')}
            >
              <Icon name="clock" />
              {pressing > 0 ? `${pressing} to use` : 'Expiring'}
            </button>
            <button type="button" className="fm-chip" onClick={() => navigate('/locations')}>
              <Icon name="edit" />
              Places
            </button>
          </div>
        }
      />

      <AddInventoryItemForm locations={locations} searchItems={searchItems} onAdd={addToInventory} />

      {loading && <SkeletonRows rows={5} />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="fridge"
          title="Nothing in the inventory yet"
          body="Add something above, or tick items off your shopping list and tap the fridge tag to move them all in at once."
        />
      )}

      {groups.map((group) => (
        <section key={group.name} className="fm-group">
          <div className="fm-rail">
            <h2 className="fm-rail__name">{group.name}</h2>
            <span className="fm-rail__count">{group.items.length}</span>
          </div>
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

      {justEmptied && (
        <Toast
          message={`Out of ${justEmptied.name}.`}
          actionLabel="Add to list"
          onAction={handleAddToShoppingList}
          onDismiss={() => setJustEmptied(null)}
        />
      )}
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
