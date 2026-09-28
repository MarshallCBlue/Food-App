// The colours the app uses, as names that point at the real values in
// styles.css. Keeping one copy means a colour can never drift out of step
// between the stylesheet and the JavaScript.
//
// Each value is a "var(--fm-…)" reference, which is what CSS expects, so
// these can be dropped straight into a style attribute where a component
// genuinely needs to pick a colour at runtime. Everywhere else, use the
// "fm-" classes in styles.css instead.
export const colors = {
  background: 'var(--fm-paper)',
  text: 'var(--fm-ink)',
  mutedText: 'var(--fm-muted)',
  card: 'var(--fm-slip)',
  primary: 'var(--fm-brand)',
  primaryText: 'oklch(100% 0 0)',
  border: 'var(--fm-line)',
  danger: 'var(--fm-signal)',
  warning: 'var(--fm-warn)',
}
