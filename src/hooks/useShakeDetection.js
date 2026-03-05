import { useEffect, useRef } from 'react';

/** Minimum acceleration magnitude (m/s²) required to trigger a shake event */
const SHAKE_THRESHOLD = 15;

/** Minimum time (ms) between consecutive shake detections */
const SHAKE_DEBOUNCE_MS = 500;

/**
 * @typedef {Object} UseShakeDetectionOptions
 * @property {() => void} onShake - Callback fired when shake gesture is detected
 * @property {boolean} [enabled=true] - Whether shake detection is enabled
 */

/**
 * Hook that detects device shake gestures via the DeviceMotionEvent API.
 *
 * The hook is a no-op when:
 * - `enabled` is false
 * - `prefers-reduced-motion` is set
 * - DeviceMotionEvent is not supported
 * - iOS 13+ and motion permission has not been granted (stored in localStorage)
 *
 * @param {UseShakeDetectionOptions} options - Configuration options
 */
export const useShakeDetection = ({ onShake, enabled = true }) => {
  const lastShakeRef = useRef(0);
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('DeviceMotionEvent' in window)) return;

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const stored = localStorage.getItem('shake-motion-permission');
      if (stored !== 'granted') return;
    }

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acc) return;

      const { x, y, z } = acc;
      const magnitude = Math.sqrt((x ?? 0) ** 2 + (y ?? 0) ** 2 + (z ?? 0) ** 2);

      if (magnitude >= SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShakeRef.current >= SHAKE_DEBOUNCE_MS) {
          lastShakeRef.current = now;
          onShakeRef.current?.();
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [enabled]);
};

/**
 * Requests device motion permission on iOS 13+.
 * On non-iOS devices or older iOS versions, returns 'granted' immediately.
 * The result is stored in localStorage under 'shake-motion-permission'.
 *
 * @returns {Promise<'granted' | 'denied' | 'default'>} The permission result
 */
export const requestMotionPermission = async () => {
  if (typeof DeviceMotionEvent?.requestPermission !== 'function') {
    return 'granted';
  }

  try {
    const result = await DeviceMotionEvent.requestPermission();
    localStorage.setItem('shake-motion-permission', result);
    return result;
  } catch {
    return 'denied';
  }
};
