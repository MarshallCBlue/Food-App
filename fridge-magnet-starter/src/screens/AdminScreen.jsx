import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../state/AuthProvider'
import PageHeader from '../components/PageHeader'
import SkeletonRows from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'

// Every household and every account, for admins only. The database is
// what actually enforces this — each admin_* call refuses anyone who is
// not an admin — so hiding the screen is a courtesy, not the lock.
//
// Editing a household's list, inventory or recipes happens by opening
// that household: the normal screens then work on it exactly as they do
// on your own, with a bar across the top saying whose it is.
export default function AdminScreen() {
  const { isAdmin, session, viewHousehold, ownHousehold } = useAuth()
  const navigate = useNavigate()
  const [households, setHouseholds] = useState(null)
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [openRow, setOpenRow] = useState(null)
  const [pending, setPending] = useState(null) // { title, body, confirmLabel, run }

  const load = useCallback(async () => {
    const [householdResult, userResult] = await Promise.all([
      supabase.rpc('admin_list_households'),
      supabase.rpc('admin_list_users'),
    ])
    const firstError = householdResult.error || userResult.error
    if (firstError) {
      setError(firstError.message)
      return
    }
    setError(null)
    setHouseholds(householdResult.data)
    setUsers(userResult.data)
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (isAdmin === null) return <SkeletonRows rows={3} />
  if (!isAdmin) return <Navigate to="/" replace />

  function openHousehold(target) {
    viewHousehold({ id: target.id, name: target.name, secret_code: target.secret_code })
    navigate('/')
  }

  function confirm(action) {
    setPending(action)
  }

  async function runPending() {
    const action = pending
    setPending(null)
    const { error: runError } = await action.run()
    if (runError) setError(runError.message)
    setOpenRow(null)
    load()
  }

  const myId = session.user.id

  return (
    <div>
      <PageHeader title="Admin" subtitle="Every household and account" />

      {error && (
        <p className="fm-error" style={{ marginBottom: '1rem' }}>
          <Icon name="alert" />
          {error}
        </p>
      )}

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">Households</h2>
          {households && <span className="fm-rail__count">{households.length}</span>}
        </div>

        {!households && <SkeletonRows rows={2} />}

        {households?.map((row) => {
          const key = `household-${row.id}`
          const expanded = openRow === key
          const isMine = row.id === ownHousehold?.id
          return (
            <div className="fm-row" key={row.id}>
              <div className="fm-row__main">
                <button
                  type="button"
                  className="fm-row__button"
                  onClick={() => setOpenRow(expanded ? null : key)}
                  aria-expanded={expanded}
                >
                  <span className="fm-row__label">
                    <span className="fm-row__name">
                      {row.name}
                      {isMine && ' (yours)'}
                    </span>
                    <span className="fm-row__meta">
                      {row.members.length === 0
                        ? 'No members'
                        : row.members.map((member) => member.email).join(', ')}
                    </span>
                  </span>
                  <span className="fm-row__qty">
                    {row.shopping_list_count} list · {row.inventory_count} stock · {row.recipe_count} recipes
                  </span>
                </button>
              </div>

              {expanded && (
                <div className="fm-row__panel">
                  {row.members.map((member) => (
                    <div className="fm-inline" key={member.user_id} style={{ alignItems: 'center' }}>
                      <span className="fm-row__meta" style={{ flex: 1 }}>
                        {member.email}
                      </span>
                      <button
                        type="button"
                        className="fm-btn fm-btn--sm fm-btn--quiet"
                        onClick={() =>
                          confirm({
                            title: `Remove ${member.email} from ${row.name}?`,
                            body: 'They keep their account but lose access to this household.',
                            confirmLabel: 'Remove',
                            run: () =>
                              supabase.rpc('admin_remove_member', {
                                target_household_id: row.id,
                                target_user_id: member.user_id,
                              }),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="fm-inline">
                    <button type="button" className="fm-btn fm-btn--block" onClick={() => openHousehold(row)}>
                      <Icon name="forward" />
                      Open {isMine ? 'your household' : 'and edit'}
                    </button>
                    <button
                      type="button"
                      className="fm-icon-btn fm-icon-btn--bordered fm-icon-btn--danger"
                      aria-label={`Delete ${row.name}`}
                      onClick={() =>
                        confirm({
                          title: `Delete ${row.name}?`,
                          body: 'Its shopping list, inventory, recipes and history go with it. This cannot be undone.',
                          confirmLabel: 'Delete household',
                          run: () => supabase.rpc('admin_delete_household', { target_household_id: row.id }),
                        })
                      }
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section className="fm-group">
        <div className="fm-rail">
          <h2 className="fm-rail__name">Accounts</h2>
          {users && <span className="fm-rail__count">{users.length}</span>}
        </div>

        {!users && <SkeletonRows rows={2} />}

        {users?.map((row) => {
          const key = `user-${row.user_id}`
          const expanded = openRow === key
          const isMe = row.user_id === myId
          const householdNames = row.households.map((h) => h.name).join(', ') || 'No household yet'
          return (
            <div className="fm-row" key={row.user_id}>
              <div className="fm-row__main">
                <button
                  type="button"
                  className="fm-row__button"
                  onClick={() => setOpenRow(expanded ? null : key)}
                  aria-expanded={expanded}
                  disabled={isMe}
                >
                  <span className="fm-row__label">
                    <span className="fm-row__name">
                      {row.email}
                      {isMe && ' (you)'}
                    </span>
                    <span className="fm-row__meta">{householdNames}</span>
                  </span>
                  {row.is_admin && <span className="fm-badge fm-badge--ok">Admin</span>}
                </button>
              </div>

              {expanded && !isMe && (
                <div className="fm-row__panel">
                  <div className="fm-inline">
                    <button
                      type="button"
                      className="fm-btn fm-btn--secondary fm-btn--block"
                      onClick={() =>
                        confirm({
                          title: row.is_admin ? `Take admin away from ${row.email}?` : `Make ${row.email} an admin?`,
                          body: row.is_admin
                            ? 'They go back to seeing only their own household.'
                            : "They will be able to see, change and delete every household's data and every account.",
                          confirmLabel: row.is_admin ? 'Remove admin' : 'Make admin',
                          destructive: row.is_admin,
                          run: () =>
                            supabase.rpc('admin_set_admin', { target_user_id: row.user_id, make_admin: !row.is_admin }),
                        })
                      }
                    >
                      {row.is_admin ? 'Remove admin' : 'Make admin'}
                    </button>
                    <button
                      type="button"
                      className="fm-icon-btn fm-icon-btn--bordered fm-icon-btn--danger"
                      aria-label={`Delete ${row.email}`}
                      onClick={() =>
                        confirm({
                          title: `Delete ${row.email}?`,
                          body: 'Their account is removed, along with any household only they belong to. Shared households stay for everyone else. This cannot be undone.',
                          confirmLabel: 'Delete account',
                          run: () => supabase.rpc('admin_delete_user', { target_user_id: row.user_id }),
                        })
                      }
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {pending && (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          destructive={pending.destructive ?? true}
          onConfirm={runPending}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
