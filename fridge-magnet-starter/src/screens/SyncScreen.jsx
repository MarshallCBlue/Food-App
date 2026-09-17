import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import { colors } from '../theme'

// Where tapping the fridge's NFC tag lands. Shows what's about to move,
// waits for confirmation, then does it all in one atomic database call —
// either every checked item transfers, or none do.
export default function SyncScreen() {
  const [searchParams] = useSearchParams()
  const tagCode = searchParams.get('t')
  const { household } = useAuth()
  const { locations } = useLocations(household.id)

  const [rows, setRows] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { syncRunId, moved }
  const [undone, setUndone] = useState(false)

  const tagMismatch = Boolean(tagCode) && tagCode !== household.secret_code

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('shopping_list_items')
        .select('id, quantity, unit, note, item:items ( id, name, default_location_id )')
        .eq('household_id', household.id)
        .eq('checked', true)

      if (cancelled) return
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setRows(data)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [household.id])

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      const { data: syncRunId, error: rpcError } = await supabase.rpc('sync_shopping_list_to_inventory', {
        location_overrides: overrides,
      })
      if (rpcError) throw rpcError

      // The RPC re-checks what's actually ticked at the moment it runs,
      // which can differ from this screen's snapshot if someone else in
      // the household changed the list in between — so what's shown here
      // comes from what the server recorded actually happened, not from
      // what we asked it to do.
      const { data: run, error: fetchError } = await supabase
        .from('sync_runs')
        .select('moved_items')
        .eq('id', syncRunId)
        .single()
      if (fetchError) throw fetchError

      setResult({ syncRunId, moved: run.moved_items })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUndo() {
    setError(null)
    try {
      const { error: undoError } = await supabase.rpc('undo_sync_run', {
        target_sync_run_id: result.syncRunId,
      })
      if (undoError) throw undoError
      setUndone(true)
    } catch (err) {
      setError(err.message)
    }
  }

  if (result) {
    return (
      <div style={styles.wrap}>
        <h2 style={styles.title}>{undone ? 'Undone' : `Moved ${result.moved.length} item(s) to the inventory`}</h2>
        {!undone && (
          <ul style={styles.list}>
            {result.moved.map((row) => (
              <li key={row.item_id} style={styles.listItem}>
                {row.name} — {row.quantity}
                {row.unit ? ` ${row.unit}` : ''}
              </li>
            ))}
          </ul>
        )}
        {error && <p style={styles.error}>{error}</p>}
        {!undone && (
          <button type="button" style={styles.secondaryButton} onClick={handleUndo}>
            Undo
          </button>
        )}
      </div>
    )
  }

  if (rows === null) {
    return (
      <div style={styles.wrap}>
        <p style={styles.muted}>Loading…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div style={styles.wrap}>
        <h2 style={styles.title}>Nothing to move</h2>
        <p style={styles.muted}>Tick things off your shopping list as you shop, then tap the tag.</p>
      </div>
    )
  }

  const missingLocation = rows.filter((row) => !row.item.default_location_id)
  const canConfirm = missingLocation.every((row) => overrides[row.id])

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Move {rows.length} item(s) into the inventory?</h2>

      {tagMismatch && (
        <p style={styles.warning}>
          This tag doesn't look like it belongs to {household.name} — it'll still only ever move
          your own household's list, so this is safe to ignore if that's expected.
        </p>
      )}

      <ul style={styles.list}>
        {rows.map((row) => (
          <li key={row.id} style={styles.listItem}>
            <span>
              {row.item.name} — {row.quantity}
              {row.unit ? ` ${row.unit}` : ''}
            </span>
            {!row.item.default_location_id && (
              <select
                style={styles.select}
                value={overrides[row.id] || ''}
                onChange={(event) => setOverrides((current) => ({ ...current, [row.id]: event.target.value }))}
              >
                <option value="">Where does this live?</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>

      {error && <p style={styles.error}>{error}</p>}

      <button type="button" style={styles.primaryButton} onClick={handleConfirm} disabled={!canConfirm || submitting}>
        {submitting ? 'Moving…' : 'Confirm'}
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    paddingTop: '1rem',
    maxWidth: '26rem',
    margin: '0 auto',
  },
  title: {
    margin: '0 0 0.75rem 0',
    fontSize: '1.2rem',
  },
  muted: {
    color: colors.mutedText,
    textAlign: 'center',
  },
  warning: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '0.5rem',
    padding: '0.75rem',
    fontSize: '0.85rem',
    color: colors.mutedText,
  },
  list: {
    listStyle: 'none',
    margin: '0 0 1rem 0',
    padding: 0,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  select: {
    padding: '0.4rem',
    borderRadius: '0.4rem',
    border: `1px solid ${colors.border}`,
    fontSize: '0.85rem',
  },
  primaryButton: {
    width: '100%',
    padding: '0.85rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: colors.primary,
    color: colors.primaryText,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '0.7rem 1rem',
    borderRadius: '0.5rem',
    border: `1px solid ${colors.primary}`,
    background: colors.card,
    color: colors.primary,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: colors.danger,
    fontSize: '0.9rem',
  },
}
