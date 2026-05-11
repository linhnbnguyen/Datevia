import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const LocationService: React.FC = () => {
  const { refreshLocation, detectedLocation, setDetectedLocation } = useStore();
  const detectionAttempted = useRef(false);

  useEffect(() => {
    // Only attempt once per session start (component mount)
    if (detectionAttempted.current) return;
    detectionAttempted.current = true;

    const initLocation = async () => {
      // 1. Clear "Thu Duc" if it's currently cached in store or localStorage
      const cachedCity = localStorage.getItem('datevia_last_city');
      if (detectedLocation?.city?.includes('Thu Duc') || cachedCity?.includes('Thu Duc')) {
        console.log('[LOCATION_SERVICE] Clearing Thu Duc placeholder');
        setDetectedLocation(null);
        localStorage.removeItem('datevia_last_city');
      }

      // 2. Always perform a fresh detection on session start
      await refreshLocation();
    };

    initLocation();
  }, [refreshLocation, detectedLocation, setDetectedLocation]);

  return null;
};
