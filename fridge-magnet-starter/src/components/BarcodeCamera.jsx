import { useBarcodeScanner } from '../state/useBarcodeScanner'
import { colors } from '../theme'

export default function BarcodeCamera({ active, onDetect, onManualEntry }) {
  const { videoRef, error, ready } = useBarcodeScanner({ active, onDetect })

  return (
    <div style={styles.wrap}>
      <div style={styles.frame}>
        <video ref={videoRef} style={styles.video} muted playsInline />
        {!ready && !error && <p style={styles.overlayText}>Starting camera…</p>}
      </div>

      {error && (
        <p style={styles.error}>
          Couldn't open the camera ({error}). You can still type the barcode below.
        </p>
      )}

      <button type="button" style={styles.manualButton} onClick={onManualEntry}>
        Enter barcode instead
      </button>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    alignItems: 'center',
  },
  frame: {
    position: 'relative',
    width: '100%',
    maxWidth: '24rem',
    aspectRatio: '4 / 3',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    background: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlayText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    margin: 0,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    fontSize: '0.9rem',
    maxWidth: '22rem',
  },
  manualButton: {
    border: 'none',
    background: 'none',
    color: colors.primary,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
}
