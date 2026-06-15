import { useEffect, useState } from "react";
import { getRouteInfo } from "@/services/naverRouteService";

export function useRouteInfo(startAddress?: string, endAddress?: string) {
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startAddress || !endAddress) {
      setDistanceKm(null);
      setDurationMin(null);
      setError(null);
      return;
    }

    const start = startAddress;
    const end = endAddress;
    let isMounted = true;

    async function fetchRoute() {
      setLoading(true);
      setError(null);

      try {
        const data = await getRouteInfo(start, end);
        if (!isMounted) return;
        setDistanceKm(data.distanceKm);
        setDurationMin(data.durationMin);
      } catch (routeError) {
        if (!isMounted) return;
        setError(routeError instanceof Error ? routeError.message : "Failed to fetch route info");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [startAddress, endAddress]);

  return { distanceKm, durationMin, loading, error };
}
