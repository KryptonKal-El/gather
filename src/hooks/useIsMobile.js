import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 700;

/**
 * Hook that tracks whether the viewport is mobile-sized (≤700px).
 * @returns {boolean} True if viewport width is at or below the mobile breakpoint.
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handleChange = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
};
