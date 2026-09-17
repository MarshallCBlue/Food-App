import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import { colors } from '../theme'

export default function LocationManagerScreen() {
  const { household } = useAuth()
  const { locations, addLocation, renameLocation, deleteLocation } = useLocations(household.id)
  const navigate = useNavigate()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)

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
    if (!window.confirm(`Delete "${location.name}"?`)) return
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
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <button type="button" style={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 style={styles.title}>Locations</h2>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <ul style={styles.list}>
        {locations.map((location) => (
          <LocationRow
            key={location.id}
            location={location}
            onRename={(name) => renameLocation(location.id, name)}
            onDelete={() => handleDelete(location)}
          />
        ))}
      </ul>

      <form onSubmit={handleAdd} style={styles.addForm}>
        <input
          style={styles.input}
          placeholder="New location"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button style={styles.addButton} type="submit">
          Add
        </button>
      </form>
    </div>
  )
}

function LocationRow({ location, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)

  return (
    <li style={styles.row}>
      {editing ? (
        <input
          style={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            setEditing(false)
            if (name.trim() && name.trim() !== location.name) onRename(name.trim())
          }}
          autoFocus
        />
      ) : (
        <button type="button" style={styles.nameButton} onClick={() => setEditing(true)}>
          {location.name}
        </button>
      )}

      <button type="button" style={styles.deleteButton} onClick={onDelete} aria-label="Delete location">
        ✕
      </button>
    </li>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  backButton: {
    border: 'none',
    background: 'none',
    color: colors.primary,
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.6rem 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  nameButton: {
    flex: 1,
    textAlign: 'left',
    border: 'none',
    background: 'none',
    fontSize: '1rem',
    padding: '0.3rem 0',
    cursor: 'pointer',
  },
  deleteButton: {
    width: '2rem',
    height: '2rem',
    borderRadius: '0.4rem',
    border: `1px solid ${colors.border}`,
    background: colors.card,
    color: colors.danger,
    cursor: 'pointer',
  },
  addForm: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  },
  input: {
    flex: 1,
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.border}`,
    fontSize: '1rem',
  },
  addButton: {
    padding: '0 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: colors.danger,
    fontSize: '0.9rem',
  },
}
