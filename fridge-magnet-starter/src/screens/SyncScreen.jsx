import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../state/AuthProvider'
import { useLocations } from '../state/useLocations'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'

// Where tapping the fridge's NFC tag lands. Shows what's about to move,
// waits for confirmation, then does it all in one atomic database call —
// either every checked item transfers, or none do.
export default function SyncScreen() {
  const [searchParams] = useSearchParams()
  const tagCode = searchParams.get('t')
  const { household } = useAuth()
  const navigate = useNavigate()
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

  // After the move: what went in, and a way to put it straight back.
  if (result) {
    return (
      <div>
        <PageHeader
          title={undone ? 'Put back' : 'Moved in'}
          subtitle={
            undone
              ? 'Everything is back on the shopping list.'
              : `${result.moved.length} item${result.moved.length === 1 ? '' : 's'} went into the inventory.`
          }
        />

        {!undone && (
          <section className="fm-group">
            <div className="fm-rail">
              <h2 className="fm-rail__name">Now in the inventory</h2>
              <span className="fm-rail__count">{result.moved.length}</span>
            </div>
            {result.moved.map((row) => (
              <div key={row.item_id} className="fm-row">
                <div className="fm-row__main">
                  <span className="fm-row__label" style={{ flex: 1 }}>
                    <span className="fm-row__name">{row.name}</span>
                  </span>
                  <span className="fm-row__qty">
                    {row.quantity}
                    {row.unit ? ` ${row.unit}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {error && (
          <p className="fm-error">
            <Icon name="alert" />
            {error}
          </p>
        )}

        <div className="fm-stack" style={{ marginTop: '1rem' }}>
          <button type="button" className="fm-btn fm-btn--block" onClick={() => navigate('/inventory')}>
            See the inventory
          </button>
          {!undone && (
            <button type="button" className="fm-btn fm-btn--secondary fm-btn--block" onClick={handleUndo}>
              Undo this
            </button>
          )}
        </div>
      </div>
    )
  }

  if (rows === null) {
    return (
      <div>
        <PageHeader title="Putting the shopping away" />
        <SkeletonRows rows={4} />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="Nothing to move" />
        <EmptyState
          icon="basket"
          title="Nothing is ticked off"
          body="Tick things off the shopping list as they go in the trolley, then tap the fridge tag when you get home."
          action={
            <button type="button" className="fm-btn" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/')}>
              Open the shopping list
            </button>
          }
        />
      </div>
    )
  }

  const missingLocation = rows.filter((row) => !row.item.default_location_id)
  const canConfirm = missingLocation.every((row) => overrides[row.id])

  return (
    <div>
      <PageHeader
        title="Putting the shopping away"
        subtitle={`${rows.length} ticked item${rows.length === 1 ? '' : 's'} ready to move into the inventory`}
      />

      {tagMismatch && (
        <p className="fm-note fm-panel" style={{ marginBottom: '1rem' }}>
          This tag does not look like it belongs to {household.name}. It can only ever move your own
          household's list, so it is safe to carry on if that is expected.
        </p>
      )}

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">Moving in</h2>
          <span className="fm-rail__count">{rows.length}</span>
        </div>

        {rows.map((row) => (
          <div key={row.id} className="fm-row">
            <div className="fm-row__main">
              <span className="fm-row__label" style={{ flex: 1 }}>
                <span className="fm-row__name">{row.item.name}</span>
              </span>
              <span className="fm-row__qty">
                {row.quantity}
                {row.unit ? ` ${row.unit}` : ''}
              </span>
            </div>
            {!row.item.default_location_id && (
              <div style={{ paddingBottom: '0.75rem' }}>
                <select
                  className="fm-field"
                  value={overrides[row.id] || ''}
                  onChange={(event) =>
                    setOverrides((current) => ({ ...current, [row.id]: event.target.value }))
                  }
                  aria-label={`Where does ${row.item.name} live?`}
                >
                  <option value="">Where does this live?</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </section>

      {error && (
        <p className="fm-error">
          <Icon name="alert" />
          {error}
        </p>
      )}

      <button
        type="button"
        className="fm-btn fm-btn--block"
        style={{ marginTop: '1rem' }}
        onClick={handleConfirm}
        disabled={!canConfirm || submitting}
      >
        {submitting ? 'Moving' : `Move ${rows.length} item${rows.length === 1 ? '' : 's'} in`}
      </button>
      {!canConfirm && (
        <p className="fm-note" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
          Say where each new item lives first.
        </p>
      )}
    </div>
  )
}
