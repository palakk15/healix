export interface Position {
  lat: number;
  lng: number;
  source: "device" | "saved";
}

export interface SavedLocation {
  lat: number;
  lng: number;
}

export function getDevicePosition(timeoutMs = 8000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export async function resolvePosition(saved: SavedLocation | undefined, timeoutMs = 8000): Promise<Position> {
  try {
    const device = await getDevicePosition(timeoutMs);
    return { ...device, source: "device" };
  } catch {
    if (saved) return { ...saved, source: "saved" };
    throw new Error("no location available");
  }
}
