import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'

// The cupboards, shelves and drawers things actually live in. These are
// the headings the inventory is grouped under.
export default function LocationManagerScreen() {
  const { household } = useAuth()
  const { locations, addLocation, renameLocation, deleteLocation } = useLocations(household.id)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  async function handleAdd(event) {
    event.preventDefault()
    if (!newName.trim()) return
    try {
      await addLocation(newName.trim())
      setNewName('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(location) {
    setError(null)
    try {
      await deleteLocation(location.id)
    } catch (err) {
      setError(
        err.code === '23503'
          ? `Move or use up everything in "${location.name}" before deleting it.`
          : err.message
      )
    }
  }

  return (
    <div>
      <PageHeader
        backTo="/inventory"
        title="Places"
        subtitle="The cupboards, shelves and drawers your inventory is grouped under"
      />

      {error && (
        <p className="fm-error" style={{ marginBottom: '1rem' }}>
          <Icon name="alert" />
          {error}
        </p>
      )}

      <form onSubmit={handleAdd} className="fm-composer">
        <div className="fm-inline">
          <input
            className="fm-field"
            placeholder="e.g. Top shelf of the fridge"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            aria-label="New place name"
          />
          <button className="fm-btn" type="submit" disabled={!newName.trim()}>
            <Icon name="plus" />
            Add
          </button>
        </div>
      </form>

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">Where things live</h2>
          <span className="fm-rail__count">{locations.length}</span>
        </div>

        {locations.map((location) => (
          <LocationRow
            key={location.id}
            location={location}
            onRename={(name) => renameLocation(location.id, name)}
            onDelete={() => setPendingDelete(location)}
          />
        ))}
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          body="It has to be empty first. Anything still stored there has to be moved or used up."
          confirmLabel="Delete place"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            handleDelete(pendingDelete)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function LocationRow({ location, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)

  return (
    <div className="fm-row">
      <div className="fm-row__main">
        {editing ? (
          <input
            className="fm-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              setEditing(false)
              if (name.trim() && name.trim() !== location.name) onRename(name.trim())
            }}
            aria-label={`Rename ${location.name}`}
            autoFocus
          />
        ) : (
          <button type="button" className="fm-row__button" onClick={() => setEditing(true)}>
            <span className="fm-row__name">{location.name}</span>
          </button>
        )}

        <button
          type="button"
          className="fm-icon-btn fm-icon-btn--danger"
          onClick={onDelete}
          aria-label={`Delete ${location.name}`}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  )
}
