import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthProvider'
import { useCategories } from '../state/useCategories'
import { colors } from '../theme'

export default function AisleManagerScreen() {
  const { household } = useAuth()
  const { categories, addCategory, renameCategory, deleteCategory, moveCategory } = useCategories(household.id)
  const navigate = useNavigate()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)

  async function handleAdd(event) {
    event.preventDefault()
    if (!newName.trim()) return
    try {
      await addCategory(newName.trim())
      setNewName('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <button type="button" style={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 style={styles.title}>Aisles</h2>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <ul style={styles.list}>
        {categories.map((category, index) => (
          <AisleRow
            key={category.id}
            category={category}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
            onRename={(name) => renameCategory(category.id, name)}
            onDelete={() => {
              if (window.confirm(`Delete "${category.name}"? Items in it move to Other.`)) {
                deleteCategory(category.id)
              }
            }}
            onMoveUp={() => moveCategory(category.id, 'up')}
            onMoveDown={() => moveCategory(category.id, 'down')}
          />
        ))}
      </ul>

      <form onSubmit={handleAdd} style={styles.addForm}>
        <input
          style={styles.input}
          placeholder="New aisle"
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

function AisleRow({ category, isFirst, isLast, onRename, onDelete, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  return (
    <li style={styles.row}>
      {editing ? (
        <input
          style={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            setEditing(false)
            if (name.trim() && name.trim() !== category.name) onRename(name.trim())
          }}
          autoFocus
        />
      ) : (
        <button type="button" style={styles.nameButton} onClick={() => setEditing(true)}>
          {category.name}
        </button>
      )}

      <div style={styles.rowActions}>
        <button type="button" style={styles.iconButton} onClick={onMoveUp} disabled={isFirst} aria-label="Move up">
          ↑
        </button>
        <button type="button" style={styles.iconButton} onClick={onMoveDown} disabled={isLast} aria-label="Move down">
          ↓
        </button>
        <button type="button" style={styles.deleteButton} onClick={onDelete} aria-label="Delete aisle">
          ✕
        </button>
      </div>
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
  rowActions: {
    display: 'flex',
    gap: '0.25rem',
  },
  iconButton: {
    width: '2rem',
    height: '2rem',
    borderRadius: '0.4rem',
    border: `1px solid ${colors.border}`,
    background: colors.card,
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
