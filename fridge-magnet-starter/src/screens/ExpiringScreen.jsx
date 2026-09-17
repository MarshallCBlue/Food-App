import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../state/AuthProvider'
import { daysUntil, urgency, toLocalDateString } from '../lib/expiry'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SkeletonRows from '../components/Skeleton'
import Icon from '../components/Icon'

const BUCKETS = [
  { tier: 'overdue', heading: 'Past their date', rail: 'fm-rail fm-rail--signal' },
  { tier: 'soon', heading: 'Next 3 days', rail: 'fm-rail fm-rail--warn' },
  { tier: 'week', heading: 'This week', rail: 'fm-rail' },
]

// What needs cooking tonight — everything with a use-by date within the
// next week, oldest first, sorted into three buckets. Colour marks the
// urgency, but every row also says it in words, so this still works if
// you're colour-blind or the phone's in direct sun.
export default function ExpiringScreen() {
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
    <div>
      <PageHeader
        backTo="/inventory"
        title="Use these up"
        subtitle="Anything with a date in the next week, soonest first"
      />

      {error && (
        <p className="fm-error">
          <Icon name="alert" />
          {error}
        </p>
      )}

      {rows === null && !error && <SkeletonRows rows={4} />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon="check"
          title="Nothing going off this week"
          body="Use-by dates you add to inventory items show up here once they are within a week."
        />
      )}

      {rows &&
        BUCKETS.map(({ tier, heading, rail }) => {
          const bucketRows = rows.filter((row) => urgency(daysUntil(row.expires_on)).tier === tier)
          if (bucketRows.length === 0) return null

          return (
            <section key={tier} className="fm-group">
              <div className={rail}>
                <h2 className="fm-rail__name">{heading}</h2>
                <span className="fm-rail__count">{bucketRows.length}</span>
              </div>

              {bucketRows.map((row) => {
                const { label, tone } = urgency(daysUntil(row.expires_on))
                return (
                  <div key={row.id} className="fm-row">
                    <div className="fm-row__main">
                      <span className="fm-row__label" style={{ flex: 1 }}>
                        <span className="fm-row__name">{row.item.name}</span>
                        <span className="fm-row__meta">
                          {row.quantity}
                          {row.unit ? ` ${row.unit}` : ''} · {row.location.name}
                        </span>
                      </span>
                      <span className={`fm-badge fm-badge--${tone}`}>{label}</span>
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
    </div>
  )
}
