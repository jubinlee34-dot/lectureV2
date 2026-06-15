import { useState, useEffect } from "react";
import { getRouteInfo } from "../services/naverRouteService";

export function useRouteInfo(startAddress?: string, endAddress?: string) {
  const [distanceKm, setDistanceKm] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startAddress || !endAddress) {
      setDistanceKm(null);
      setDurationMin(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchRoute = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRouteInfo(startAddress, endAddress);
        if (isMounted) {
          setDistanceKm(data.distance);
          setDurationMin(data.duration);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to fetch route info");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [startAddress, endAddress]);

  return { distanceKm, durationMin, loading, error };
}
