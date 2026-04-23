import { describe, it, expect } from 'vitest'

// Point-in-polygon algorithm (extracted from EBirdImport.jsx)
const isPointInPolygon = (point, polygon) => {
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

describe('Point-in-Polygon Algorithm', () => {
  describe('Basic Containment', () => {
    it('should detect point inside square polygon', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 }
      ]
      const point = [0.5, 0.5] // [lng, lat]
      expect(isPointInPolygon(point, polygon)).toBe(true)
    })

    it('should detect point outside square polygon', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 }
      ]
      const point = [2, 2]
      expect(isPointInPolygon(point, polygon)).toBe(false)
    })

    it('should detect point inside triangle', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 2, lng: 1 },
        { lat: 0, lng: 2 }
      ]
      const point = [0.5, 0.5]
      expect(isPointInPolygon(point, polygon)).toBe(true)
    })

    it('should detect point outside triangle', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 2, lng: 1 },
        { lat: 0, lng: 2 }
      ]
      const point = [1.5, 1.5]
      expect(isPointInPolygon(point, polygon)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle point at polygon centroid', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 2 },
        { lat: 2, lng: 2 },
        { lat: 2, lng: 0 }
      ]
      const point = [1, 1] // Center
      expect(isPointInPolygon(point, polygon)).toBe(true)
    })

    it('should handle empty polygon', () => {
      const polygon = []
      const point = [0.5, 0.5]
      expect(isPointInPolygon(point, polygon)).toBe(false)
    })

    it('should handle polygon with only 2 vertices (line)', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 }
      ]
      const point = [0.5, 0.5]
      expect(isPointInPolygon(point, polygon)).toBe(false)
    })
  })

  describe('Complex Shapes', () => {
    it('should handle concave polygon (L-shape)', () => {
      const polygon = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 2 },
        { lat: 1, lng: 2 },
        { lat: 1, lng: 1 },
        { lat: 2, lng: 1 },
        { lat: 2, lng: 0 }
      ]

      // Point in main body
      const pointInside = [0.5, 0.5]
      expect(isPointInPolygon(pointInside, polygon)).toBe(true)

      // Point in the concave notch (should be outside)
      const pointInNotch = [1.5, 1.5]
      expect(isPointInPolygon(pointInNotch, polygon)).toBe(false)
    })

    it('should handle real-world coordinates', () => {
      // Approximate square in Massachusetts
      const polygon = [
        { lat: 42.5, lng: -71.3 },
        { lat: 42.5, lng: -71.2 },
        { lat: 42.6, lng: -71.2 },
        { lat: 42.6, lng: -71.3 }
      ]

      const pointInside = [-71.25, 42.55]
      const pointOutside = [-71.1, 42.55]

      expect(isPointInPolygon(pointInside, polygon)).toBe(true)
      expect(isPointInPolygon(pointOutside, polygon)).toBe(false)
    })
  })
})
