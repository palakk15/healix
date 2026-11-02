export interface Coordinates {
  lat: number;
  lng: number;
}

const earthRadiusKm = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(from: Coordinates, to: Coordinates): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function travelMinutesByAuto(distance: number): number {
  return Math.round(5 + distance * 6);
}
