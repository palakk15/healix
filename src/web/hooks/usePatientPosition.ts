import { useEffect, useMemo, useState } from "react";
import { getDevicePosition } from "../lib/geolocation";
import { useSession } from "../store";

export interface PatientPosition {
  lat: number;
  lng: number;
}

export function usePatientPosition(): PatientPosition | null {
  const home = useSession((state) => state.user?.home);
  const locationAllowed = useSession((state) => state.consents.location);
  const [device, setDevice] = useState<PatientPosition | null>(null);

  useEffect(() => {
    if (!locationAllowed) return undefined;
    let active = true;
    getDevicePosition(6000)
      .then((position) => {
        if (active) setDevice(position);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [locationAllowed]);

  return useMemo(() => {
    if (device) return device;
    return home ? { lat: home.lat, lng: home.lng } : null;
  }, [device, home]);
}
