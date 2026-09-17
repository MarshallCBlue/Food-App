import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../state/AuthProvider'
import { daysUntil, urgency, toLocalDateString } from '../lib/expiry'
import { colors } from '../theme'

const BUCKETS = [
  { tier: 'overdue', heading: 'Past their date' },
  { tier: 'soon', heading: 'Next 3 days' },
  { tier: 'week', heading: 'This week' },
]

// What needs cooking tonight — everything with a use-by date within the
// next week, oldest first, sorted into three buckets. Colour marks the
// urgency, but every row also says it in words, so this still works if
// you're colour-blind or the phone's in direct sun.
export default function ExpiringScreen() {
  const navigate = useNavigate()
  const { household } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + 7)
      const cutoffDate = toLocalDateString(cutoff)

      const { data, error: fetchError } = await supabase
        .from('inventory_items')
        .select('id, quantity, unit, expires_on, item:items ( name ), location:locations ( name )')
        .eq('household_id', household.id)
        .not('expires_on', 'is', null)
        .lte('expires_on', cutoffDate)
        .order('expires_on', { ascending: true })

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

  return (
    <div style={{ paddingTop: '1rem' }}>
      <div style={styles.header}>
        <button type="button" style={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2 style={styles.title}>Expiring</h2>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {rows === null && !error && <p style={styles.muted}>Loading…</p>}
      {rows && rows.length === 0 && <p style={styles.muted}>Nothing expiring in the next week.</p>}

      {rows &&
        BUCKETS.map(({ tier, heading }) => {
          const bucketRows = rows.filter((row) => urgency(daysUntil(row.expires_on)).tier === tier)
          if (bucketRows.length === 0) return null

          return (
            <section key={tier} style={styles.group}>
              <h3 style={styles.groupHeading}>{heading}</h3>
              {bucketRows.map((row) => {
                const { label, color } = urgency(daysUntil(row.expires_on))
                return (
                  <div key={row.id} style={styles.row}>
                    <div>
                      <p style={styles.rowName}>{row.item.name}</p>
                      <p style={styles.rowMeta}>
                        {row.quantity}
                        {row.unit ? ` ${row.unit}` : ''} · {row.location.name}
                      </p>
                    </div>
                    <span style={{ ...styles.badge, color, borderColor: color }}>{label}</span>
                  </div>
                )
              })}
            </section>
          )
        })}
    </div>
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
  muted: {
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: '2rem',
  },
  error: {
    color: colors.danger,
  },
  group: {
    marginBottom: '1.25rem',
  },
  groupHeading: {
    margin: '0 0 0.4rem 0',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: colors.mutedText,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  rowName: {
    margin: 0,
    fontSize: '1rem',
  },
  rowMeta: {
    margin: 0,
    fontSize: '0.85rem',
    color: colors.mutedText,
  },
  badge: {
    flexShrink: 0,
    padding: '0.3rem 0.6rem',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
}
