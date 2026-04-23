import { describe, it, expect, beforeEach } from 'vitest'

// Extracted from App.jsx for testing
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

const matchPatchToEBirdData = (patch, processedObservations) => {
  if (!processedObservations || processedObservations.length === 0) {
    return null
  }

  const patchObservations = []

  processedObservations.forEach(obs => {
    const { lat, lng } = obs
    if (patch.coordinates && patch.coordinates.length > 0) {
      if (isPointInPolygon([lng, lat], patch.coordinates)) {
        patchObservations.push(obs)
      }
    }
  })

  if (patchObservations.length === 0) {
    return null
  }

  // Get unique species with ALL dates and first sighting date
  const speciesMap = new Map()
  patchObservations.forEach(obs => {
    if (!speciesMap.has(obs.species)) {
      speciesMap.set(obs.species, {
        species: obs.species,
        date: obs.date,
        allDates: [obs.date],
        lat: obs.lat,
        lng: obs.lng,
        count: obs.count,
        taxonOrder: obs.taxonOrder
      })
    } else {
      const existing = speciesMap.get(obs.species)
      existing.allDates.push(obs.date)
      if (new Date(obs.date) < new Date(existing.date)) {
        existing.date = obs.date
        existing.lat = obs.lat
        existing.lng = obs.lng
      }
    }
  })

  const uniqueSpecies = Array.from(speciesMap.values())

  return {
    species: uniqueSpecies,
    totalSpecies: uniqueSpecies.length,
    totalObservations: patchObservations.length
  }
}

describe('Auto-Matching Logic', () => {
  let mockEBirdData

  beforeEach(() => {
    // Mock processed eBird observations (what ebirdDataStore contains)
    mockEBirdData = [
      {
        species: 'American Robin',
        lat: 42.52,
        lng: -71.25,
        date: '2023-01-01',
        count: 1,
        taxonOrder: 100
      },
      {
        species: 'American Robin',
        lat: 42.53,
        lng: -71.26,
        date: '2023-02-01',
        count: 2,
        taxonOrder: 100
      },
      {
        species: 'Blue Jay',
        lat: 42.52,
        lng: -71.25,
        date: '2023-01-15',
        count: 1,
        taxonOrder: 200
      },
      {
        species: 'Northern Cardinal',
        lat: 45.0,
        lng: -75.0, // Far away, outside patch
        date: '2023-01-01',
        count: 1,
        taxonOrder: 300
      }
    ]
  })

  describe('matchPatchToEBirdData', () => {
    it('should match observations inside patch boundaries', () => {
      const patch = {
        id: '123',
        name: 'Test Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ]
      }

      const result = matchPatchToEBirdData(patch, mockEBirdData)

      expect(result).not.toBeNull()
      expect(result.totalSpecies).toBe(2) // Robin and Blue Jay
      expect(result.totalObservations).toBe(3) // 3 observations total
    })

    it('should track first sighting date for species with multiple observations', () => {
      const patch = {
        id: '123',
        name: 'Test Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ]
      }

      const result = matchPatchToEBirdData(patch, mockEBirdData)

      const robin = result.species.find(s => s.species === 'American Robin')
      expect(robin).toBeDefined()
      expect(robin.date).toBe('2023-01-01') // Earlier of Jan 1 and Feb 1
      expect(robin.allDates).toEqual(['2023-01-01', '2023-02-01'])
    })

    it('should return null when no observations match', () => {
      const patch = {
        id: '123',
        name: 'Far Away Patch',
        coordinates: [
          { lat: 30.0, lng: -90.0 },
          { lat: 30.0, lng: -89.0 },
          { lat: 31.0, lng: -89.0 },
          { lat: 31.0, lng: -90.0 }
        ]
      }

      const result = matchPatchToEBirdData(patch, mockEBirdData)

      expect(result).toBeNull()
    })

    it('should return null when ebirdDataStore is empty', () => {
      const patch = {
        id: '123',
        name: 'Test Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ]
      }

      const result = matchPatchToEBirdData(patch, [])

      expect(result).toBeNull()
    })

    it('should return null when ebirdDataStore is null', () => {
      const patch = {
        id: '123',
        name: 'Test Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ]
      }

      const result = matchPatchToEBirdData(patch, null)

      expect(result).toBeNull()
    })

    it('should preserve taxonomic order for sorting', () => {
      const patch = {
        id: '123',
        name: 'Test Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ]
      }

      const result = matchPatchToEBirdData(patch, mockEBirdData)

      const robin = result.species.find(s => s.species === 'American Robin')
      const blueJay = result.species.find(s => s.species === 'Blue Jay')

      expect(robin.taxonOrder).toBe(100)
      expect(blueJay.taxonOrder).toBe(200)
    })
  })

  describe('End-to-End Auto-Matching Workflow', () => {
    it('should auto-populate new patch when ebirdDataStore exists', () => {
      // Simulate: User has already imported eBird data
      const ebirdDataStore = mockEBirdData

      // Simulate: User creates a new patch
      const newPatch = {
        id: Date.now().toString(),
        name: 'New Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ],
        observations: []
      }

      // Simulate: handlePatchCreated logic
      const ebirdData = matchPatchToEBirdData(newPatch, ebirdDataStore)

      if (ebirdData) {
        newPatch.ebirdData = ebirdData
      }

      // Verify: Patch has eBird data attached
      expect(newPatch.ebirdData).toBeDefined()
      expect(newPatch.ebirdData.totalSpecies).toBe(2)
      expect(newPatch.ebirdData.species).toHaveLength(2)

      // Verify species names
      const speciesNames = newPatch.ebirdData.species.map(s => s.species).sort()
      expect(speciesNames).toEqual(['American Robin', 'Blue Jay'])
    })

    it('should NOT auto-populate when ebirdDataStore is null (before import)', () => {
      const ebirdDataStore = null

      const newPatch = {
        id: Date.now().toString(),
        name: 'New Patch',
        coordinates: [
          { lat: 42.5, lng: -71.3 },
          { lat: 42.5, lng: -71.2 },
          { lat: 42.6, lng: -71.2 },
          { lat: 42.6, lng: -71.3 }
        ],
        observations: []
      }

      const ebirdData = matchPatchToEBirdData(newPatch, ebirdDataStore)

      if (ebirdData) {
        newPatch.ebirdData = ebirdData
      }

      expect(newPatch.ebirdData).toBeUndefined()
    })

    it('should handle patch with no matching observations', () => {
      const ebirdDataStore = mockEBirdData

      // Patch far from any observations
      const newPatch = {
        id: Date.now().toString(),
        name: 'Empty Patch',
        coordinates: [
          { lat: 30.0, lng: -90.0 },
          { lat: 30.0, lng: -89.0 },
          { lat: 31.0, lng: -89.0 },
          { lat: 31.0, lng: -90.0 }
        ],
        observations: []
      }

      const ebirdData = matchPatchToEBirdData(newPatch, ebirdDataStore)

      if (ebirdData) {
        newPatch.ebirdData = ebirdData
      }

      expect(newPatch.ebirdData).toBeUndefined()
    })
  })
})
