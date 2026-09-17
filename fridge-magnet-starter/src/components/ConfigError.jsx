import Icon from './Icon'

// Shown instead of the app when VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY
// weren't set at build time — the single most common reason a fresh
// deploy shows a blank screen.
export default function ConfigError() {
  return (
    <main className="fm-centre">
      <Icon name="alert" className="fm-centre__mark" />
      <h1 className="fm-centre__title">Fridge Magnet is not configured yet</h1>
      <p className="fm-centre__sub">
        This site is missing the settings it needs to reach its database.
      </p>

      <div className="fm-centre__card" style={{ maxWidth: '26rem', textAlign: 'left' }}>
        <p className="fm-note">
          In Netlify, open <strong>Site settings → Environment variables</strong> and add:
        </p>
        <p className="fm-mono">VITE_SUPABASE_URL</p>
        <p className="fm-mono">VITE_SUPABASE_ANON_KEY</p>
        <p className="fm-note">
          Then go to <strong>Deploys → Trigger deploy → Deploy site</strong>. Environment variables
          only take effect on the next build, not the one that already ran.
        </p>
      </div>
    </main>
  )
}
