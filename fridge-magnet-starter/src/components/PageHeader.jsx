import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

// The title block at the top of a screen, and — on any screen opened on
// top of a tab — the way back out of it. An installed app has no browser
// back button, so every such screen has to carry its own.
export default function PageHeader({ title, subtitle, backTo, actions }) {
  const navigate = useNavigate()

  return (
    <div>
      {backTo !== undefined && (
        <button
          type="button"
          className="fm-back"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        >
          <Icon name="back" size={16} />
          Back
        </button>
      )}

      <div className="fm-page-head">
        <div>
          <h1 className="fm-page-title">{title}</h1>
          {subtitle && <p className="fm-page-sub">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  )
}
