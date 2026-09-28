import { useState } from 'react'
import { useAuth } from '../state/AuthProvider'
import { useCategories } from '../state/useCategories'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'

// The order of this list is the order you walk the shop, so the shopping
// list can be sorted to match your route round the supermarket.
export default function AisleManagerScreen() {
  const { household } = useAuth()
  const { categories, addCategory, renameCategory, deleteCategory, moveCategory } = useCategories(household.id)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

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
    <div>
      <PageHeader
        backTo="/"
        title="Aisles"
        subtitle="Put these in the order you walk the shop. The list follows the same order."
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
            placeholder="New aisle"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            aria-label="New aisle name"
          />
          <button className="fm-btn" type="submit" disabled={!newName.trim()}>
            <Icon name="plus" />
            Add
          </button>
        </div>
      </form>

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">In shop order</h2>
          <span className="fm-rail__count">{categories.length}</span>
        </div>

        {categories.map((category, index) => (
          <AisleRow
            key={category.id}
            category={category}
            isFirst={index === 0}
            isLast={index === categories.length - 1}
            onRename={(name) => renameCategory(category.id, name)}
            onDelete={() => setPendingDelete(category)}
            onMoveUp={() => moveCategory(category.id, 'up')}
            onMoveDown={() => moveCategory(category.id, 'down')}
          />
        ))}
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete the ${pendingDelete.name} aisle?`}
          body="Anything currently filed under it moves to Other. Nothing is removed from your list."
          confirmLabel="Delete aisle"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteCategory(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function AisleRow({ category, isFirst, isLast, onRename, onDelete, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

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
              if (name.trim() && name.trim() !== category.name) onRename(name.trim())
            }}
            aria-label={`Rename ${category.name}`}
            autoFocus
          />
        ) : (
          <button type="button" className="fm-row__button" onClick={() => setEditing(true)}>
            <span className="fm-row__name">{category.name}</span>
          </button>
        )}

        <button
          type="button"
          className="fm-icon-btn"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`Move ${category.name} earlier`}
        >
          <Icon name="up" />
        </button>
        <button
          type="button"
          className="fm-icon-btn"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`Move ${category.name} later`}
        >
          <Icon name="down" />
        </button>
        <button
          type="button"
          className="fm-icon-btn fm-icon-btn--danger"
          onClick={onDelete}
          aria-label={`Delete ${category.name}`}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  )
}
