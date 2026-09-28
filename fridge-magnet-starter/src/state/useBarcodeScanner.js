import { useEffect, useRef, useState } from 'react'
import { isNativeBarcodeDetectorSupported, createNativeDetector } from '../lib/nativeBarcodeDetector'

// Opens the camera and watches for a barcode while `active` is true,
// calling onDetect once with whatever it finds first. Picks Android
// Chrome's built-in reader when it's there, ZXing (a JS decoder) when it
// isn't — see nativeBarcodeDetector.js for why.
export function useBarcodeScanner({ active, onDetect }) {
  const videoRef = useRef(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setError(null)
    setReady(false)
    if (!active) return

    let cancelled = false
    let stream = null
    let rafId = null
    let zxingControls = null

    async function startNative() {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (cancelled) return
      setReady(true)

      const detector = await createNativeDetector()
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      const tick = async () => {
        if (cancelled) return
        const video = videoRef.current
        if (video && video.videoWidth) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0)
          try {
            const results = await detector.detect(canvas)
            if (results.length > 0) {
              onDetectRef.current(results[0].rawValue)
              return
            }
          } catch {
            // A single frame failing to decode isn't fatal — keep scanning.
          }
        }
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }

    async function startZxing() {
      // ZXing is a sizeable JS decoder (needed on iPhone, since Safari has
      // no built-in barcode reader) — loaded on demand rather than shipped
      // to every visitor, most of whom never open the Scan tab at all.
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      zxingControls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result) => {
          if (!cancelled && result) onDetectRef.current(result.getText())
        }
      )
      if (!cancelled) setReady(true)
    }

    const start = isNativeBarcodeDetectorSupported() ? startNative : startZxing
    start().catch((err) => {
      if (!cancelled) setError(err.message)
    })

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      if (zxingControls) zxingControls.stop()
      if (stream) stream.getTracks().forEach((track) => track.stop())
    }
  }, [active])

  return { videoRef, error, ready }
}
