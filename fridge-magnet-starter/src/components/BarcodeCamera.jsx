import { useBarcodeScanner } from '../state/useBarcodeScanner'
import Icon from './Icon'

export default function BarcodeCamera({ active, onDetect, onManualEntry }) {
  const { videoRef, error, ready } = useBarcodeScanner({ active, onDetect })

  return (
    <div className="fm-stack fm-stack--loose">
      <div className="fm-camera">
        <video ref={videoRef} muted playsInline />
        {/* The bracket gives the barcode somewhere to go, so people are
            not guessing where the camera is actually looking. */}
        {ready && !error && (
          <>
            <div className="fm-camera__target" />
            <p className="fm-camera__hint">Line the barcode up inside the box</p>
          </>
        )}
        {!ready && !error && <p className="fm-camera__hint">Starting the camera</p>}
      </div>

      {error && (
        <p className="fm-error">
          <Icon name="alert" />
          The camera would not open ({error}). You can type the number underneath instead.
        </p>
      )}

      <button type="button" className="fm-btn fm-btn--quiet fm-btn--block" onClick={onManualEntry}>
        <Icon name="keyboard" />
        Type the number instead
      </button>
    </div>
  )
}
