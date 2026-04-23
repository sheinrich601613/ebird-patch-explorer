export function isPointInPolygon(point, polygon) {
  const x = point[0], y = point[1]
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat

    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}

export function isPointInCircle(point, center, radius) {
  const [lng, lat] = point
  const R = 6371000 // Earth radius in meters

  const dLat = (center.lat - lat) * Math.PI / 180
  const dLng = (center.lng - lng) * Math.PI / 180

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat * Math.PI / 180) *
            Math.cos(center.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return distance <= radius
}

export function isPointInPatch(point, patch) {
  if (patch.type === 'world') return true
  if (patch.type === 'circle') {
    return isPointInCircle(point, patch.center, patch.radius)
  }
  return isPointInPolygon(point, patch.coordinates)
}

export function calculatePatchArea(patch) {
  if (patch.type === 'circle') {
    return (Math.PI * patch.radius * patch.radius) / 1000000
  }

  const coordinates = patch.coordinates
  if (!coordinates || coordinates.length < 3) return 0

  let area = 0
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    area += coordinates[i].lng * coordinates[j].lat
    area -= coordinates[j].lng * coordinates[i].lat
  }
  area = Math.abs(area / 2)

  return area * 12364
}
