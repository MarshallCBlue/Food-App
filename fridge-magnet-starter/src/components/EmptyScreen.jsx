import { colors } from '../theme'

// A placeholder for a screen that isn't built yet, so it still says
// something useful rather than showing nothing.
export default function EmptyScreen({ heading, note }) {
  return (
    <div style={styles.wrap}>
      <h1 style={styles.heading}>{heading}</h1>
      <p style={styles.note}>{note}</p>
    </div>
  )
}

const styles = {
  wrap: {
    marginTop: '2rem',
    textAlign: 'center',
  },
  heading: {
    fontSize: '1.4rem',
    margin: '0 0 0.5rem 0',
  },
  note: {
    color: colors.mutedText,
    margin: 0,
  },
}
