import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import { useInventory, addItemToShoppingList } from '../state/useInventory'
import { daysUntil } from '../lib/expiry'
import { formatAmount } from '../lib/units'
import AddInventoryItemForm from '../components/AddInventoryItemForm'
import InventoryRow from '../components/InventoryRow'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import Toast from '../components/Toast'
import Icon from '../components/Icon'
import { useUnitConfirm } from '../components/UnitConfirmDialog'
import { useErrorToast } from '../components/useErrorToast'

export default function InventoryScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { locations } = useLocations(household.id)
  const { rows, loading, searchItems, addToInventory, takeSome, clearAll, updateItem, putBack } = useInventory(
    household.id
  )
  const [editingId, setEditingId] = useState(null)
  // The last thing taken out, kept so it can be undone, or added to the
  // shopping list if it ran out.
  const [lastChange, setLastChange] = useState(null)
  const [confirmUnits, unitDialog] = useUnitConfirm()
  const [attempt, errorToast] = useErrorToast()

  const groups = useMemo(() => groupByLocation(rows), [rows])

  // How many things need eating this week — shown on the way into the
  // expiring screen so the number is visible without going looking.
  const pressing = useMemo(
    () => rows.filter((row) => row.expires_on && daysUntil(row.expires_on) <= 3).length,
    [rows]
  )

  // Arriving from "Use these up" with ?open=<id> in the address: open
  // that item and scroll to it, then tidy the address back up.
  const openId = searchParams.get('open')
  useEffect(() => {
    if (!openId || loading) return
    if (rows.some((row) => row.id === openId)) {
      setEditingId(openId)
      requestAnimationFrame(() =>
        document.getElementById(`inventory-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      )
    }
    setSearchParams({}, { replace: true })
  }, [openId, loading, rows, setSearchParams])

  // Notes what just left the inventory: enough to put it back exactly
  // where it was (same place, unit and date).
  function remember(row, removed, emptied) {
    setLastChange({
      itemId: row.item.id,
      unit: row.unit,
      emptied,
      message: emptied ? `Out of ${row.item.name}.` : `Took ${formatAmount(removed, row.unit)} off ${row.item.name}.`,
      putBack: {
        itemId: row.item.id,
        locationId: row.location.id,
        quantity: removed,
        unit: row.unit,
        expiresOn: row.expires_on,
      },
    })
  }

  async function handleTakeSome(row, amount) {
    // Taking off more than is there only ever removes what was there.
    const removed = Math.min(amount, Number(row.quantity))
    const depleted = await takeSome(row, amount)
    setEditingId(null)
    remember(row, removed, depleted)
  }

  async function handleClearAll(row) {
    await clearAll(row)
    setEditingId(null)
    remember(row, Number(row.quantity), true)
  }

  // Saves the edited details. Setting the amount to 0 counts as "all
  // gone", so it can be undone or added to the shopping list.
  async function handleSave(row, changes) {
    const status = await updateItem(row, changes)
    setEditingId(null)
    if (status === 'removed') remember(row, Number(row.quantity), true)
  }

  async function handleUndo() {
    const change = lastChange
    setLastChange(null)
    await attempt(() => putBack(change.putBack))
  }

  async function handleAddToShoppingList() {
    const change = lastChange
    setLastChange(null)
    await attempt(() => addItemToShoppingList(household.id, change.itemId, change.unit, 1, confirmUnits))
  }

  const dismissChange = useCallback(() => setLastChange(null), [])

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
            <button type="button" className="fm-chip" onClick={() => navigate('/foods')}>
              <Icon name="box" />
              Foods
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
          body="Add something above, or tick items off your shopping list and tap Put away to move them all in at once."
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
              locations={locations}
              editing={editingId === row.id}
              onOpen={() => setEditingId(editingId === row.id ? null : row.id)}
              onTakeSome={(amount) => handleTakeSome(row, amount)}
              onClearAll={() => handleClearAll(row)}
              onSave={(changes) => handleSave(row, changes)}
            />
          ))}
        </section>
      ))}

      {lastChange && (
        <Toast
          message={lastChange.message}
          actions={[
            { label: 'Undo', onClick: handleUndo },
            ...(lastChange.emptied ? [{ label: 'Add to list', onClick: handleAddToShoppingList }] : []),
          ]}
          onDismiss={dismissChange}
        />
      )}

      {errorToast}
      {unitDialog}
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
