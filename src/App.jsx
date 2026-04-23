import { useState, useEffect, useRef } from 'react'
import './App.css'
import MapView from './components/MapView'
import PatchesSidebar from './components/PatchesSidebar'
import EBirdImport from './components/EBirdImport'
import PatchDashboard from './components/PatchDashboard'
import { setupDevKeyboardShortcuts } from './utils/devTools'
import { isPointInPatch } from './utils/geometry'

const STORAGE_KEY = 'patch-explorer-patches'
const EBIRD_STORAGE_KEY = 'patch-explorer-ebird-data'
const WORLD_PATCH = {
  id: 'world',
  name: 'World',
  type: 'world',
  createdAt: '2000-01-01T00:00:00.000Z',
  observations: []
}

function App() {
  const [patches, setPatches] = useState([])
  const [selectedPatchId, setSelectedPatchId] = useState(null)
  const [patchToFlyTo, setPatchToFlyTo] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showEBirdImport, setShowEBirdImport] = useState(false)
  const [dashboardPatch, setDashboardPatch] = useState(null)
  const [ebirdDataStore, setEbirdDataStore] = useState(null)
  const [editingPatchId, setEditingPatchId] = useState(null)
  const [showEBirdLocations, setShowEBirdLocations] = useState(new Set())
  const [clusterPins, setClusterPins] = useState(true)
  const editingSnapshotRef = useRef(null)
  const editCancelledRef = useRef(false)

  // Set up dev tools (only in development)
  useEffect(() => {
    setupDevKeyboardShortcuts()
  }, [])

  // Load patches from localStorage on mount, ensuring world patch exists
  useEffect(() => {
    try {
      const savedPatches = localStorage.getItem(STORAGE_KEY)
      let parsed = savedPatches ? JSON.parse(savedPatches) : []
      if (!parsed.find(p => p.id === 'world')) {
        parsed = [{ ...WORLD_PATCH }, ...parsed]
      }
      setPatches(parsed)
    } catch (error) {
      console.error('Failed to load patches from localStorage:', error)
      setPatches([{ ...WORLD_PATCH }])
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Load eBird data from localStorage on mount
  useEffect(() => {
    try {
      const savedEbirdData = localStorage.getItem(EBIRD_STORAGE_KEY)
      if (savedEbirdData) {
        const parsed = JSON.parse(savedEbirdData)
        setEbirdDataStore(parsed)
      }
    } catch (error) {
      console.error('Failed to load eBird data from localStorage:', error)
    }
  }, [])

  // Re-match eBird data on load if checklistLocations is missing (migration)
  useEffect(() => {
    if (!isLoaded || !ebirdDataStore) return
    const needsUpdate = patches.some(p => p.ebirdData && !p.ebirdData.checklistLocations)
    if (!needsUpdate) return

    setPatches(prev => prev.map(p => {
      if (p.ebirdData && !p.ebirdData.checklistLocations) {
        const ebirdData = matchPatchToEBirdData(p, ebirdDataStore)
        return ebirdData ? { ...p, ebirdData } : p
      }
      return p
    }))
  }, [isLoaded, ebirdDataStore])

  // Save patches to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return // Don't save on initial load

    try {
      // Serialize patches without the layer property
      const patchesToSave = patches.map(({ layer, ...patch }) => patch)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patchesToSave))
    } catch (error) {
      console.error('Failed to save patches to localStorage:', error)
    }
  }, [patches, isLoaded])

  // Save eBird data to localStorage whenever it changes
  useEffect(() => {
    if (ebirdDataStore === null) return // Don't save null state

    try {
      const dataStr = JSON.stringify(ebirdDataStore)

      // Check size before saving (warn if > 4MB)
      const sizeInMB = new Blob([dataStr]).size / (1024 * 1024)
      if (sizeInMB > 4) {
        console.warn(`eBird data is ${sizeInMB.toFixed(1)}MB - approaching localStorage limits`)
      }

      localStorage.setItem(EBIRD_STORAGE_KEY, dataStr)
    } catch (error) {
      console.error('Failed to save eBird data to localStorage:', error)
      // Could be quota exceeded - warn user
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. eBird data may not persist.')
      }
    }
  }, [ebirdDataStore])

  const matchPatchToEBirdData = (patch, processedObservations) => {
    if (!processedObservations || processedObservations.length === 0) {
      return null
    }

    let patchObservations

    if (patch.type === 'world') {
      patchObservations = processedObservations
    } else {
      patchObservations = []
      processedObservations.forEach(obs => {
        const { lat, lng } = obs
        if (isPointInPatch([lng, lat], patch)) {
          patchObservations.push(obs)
        }
      })
    }

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
          subid: obs.subid,
          allDates: [obs.date],
          allCounts: [obs.count],
          allSubids: obs.subid ? [obs.subid] : [],
          allObservations: [{ date: obs.date, count: obs.count, subid: obs.subid }],
          lat: obs.lat,
          lng: obs.lng,
          count: obs.count,
          taxonOrder: obs.taxonOrder
        })
      } else {
        const existing = speciesMap.get(obs.species)
        existing.allDates.push(obs.date)
        existing.allCounts.push(obs.count)
        existing.allObservations.push({ date: obs.date, count: obs.count, subid: obs.subid })
        if (obs.subid && !existing.allSubids.includes(obs.subid)) {
          existing.allSubids.push(obs.subid)
        }
        if (new Date(obs.date) < new Date(existing.date)) {
          existing.date = obs.date
          existing.subid = obs.subid
          existing.lat = obs.lat
          existing.lng = obs.lng
        }
      }
    })

    const uniqueSpecies = Array.from(speciesMap.values())

    // Aggregate by checklist (subid)
    const checklistMap = new Map()
    patchObservations.forEach(obs => {
      if (!obs.subid) return

      if (!checklistMap.has(obs.subid)) {
        checklistMap.set(obs.subid, {
          subid: obs.subid,
          date: obs.date,
          lat: obs.lat,
          lng: obs.lng,
          locationName: obs.locationName || '',
          locationId: obs.locationId || '',
          species: new Set()
        })
      }
      checklistMap.get(obs.subid).species.add(obs.species)
    })

    // Convert to array and calculate species counts
    const checklists = Array.from(checklistMap.values()).map(checklist => ({
      subid: checklist.subid,
      date: checklist.date,
      lat: checklist.lat,
      lng: checklist.lng,
      locationName: checklist.locationName,
      locationId: checklist.locationId,
      speciesCount: checklist.species.size
    }))

    // Sort by species count descending and take top 5
    const topChecklists = checklists
      .sort((a, b) => b.speciesCount - a.speciesCount)
      .slice(0, 5)

    // Aggregate unique checklist locations
    const locationMap = new Map()
    checklists.forEach(cl => {
      const key = `${cl.lat},${cl.lng}`
      if (!locationMap.has(key)) {
        locationMap.set(key, { lat: cl.lat, lng: cl.lng, locationName: cl.locationName || '', locationId: cl.locationId || '', checklistCount: 0, speciesCount: 0, species: new Set() })
      }
      const loc = locationMap.get(key)
      loc.checklistCount++
      if (!loc.locationName && cl.locationName) loc.locationName = cl.locationName
      if (!loc.locationId && cl.locationId) loc.locationId = cl.locationId
    })
    // Second pass to count unique species per location from raw observations
    patchObservations.forEach(obs => {
      const key = `${obs.lat},${obs.lng}`
      if (locationMap.has(key)) {
        locationMap.get(key).species.add(obs.species)
      }
    })
    const checklistLocations = Array.from(locationMap.values()).map(({ species, ...rest }) => ({
      ...rest,
      speciesCount: species.size
    }))

    return {
      species: uniqueSpecies,
      totalSpecies: uniqueSpecies.length,
      totalObservations: patchObservations.length,
      totalChecklists: checklists.length,
      topChecklists,
      checklistLocations
    }
  }

  const handlePatchCreated = (patch) => {
    const newPatch = { ...patch, observations: [] }

    // Auto-match to eBird data if available
    if (ebirdDataStore) {
      const ebirdData = matchPatchToEBirdData(newPatch, ebirdDataStore)
      if (ebirdData) {
        newPatch.ebirdData = ebirdData
      }
    }

    setPatches(prev => [...prev, newPatch])
  }

  const handlePatchUpdate = (updatedPatch) => {
    // Re-match to eBird data if available
    if (ebirdDataStore) {
      const ebirdData = matchPatchToEBirdData(updatedPatch, ebirdDataStore)
      if (ebirdData) {
        updatedPatch.ebirdData = ebirdData
      } else {
        // No observations match the new coordinates
        delete updatedPatch.ebirdData
      }
    }

    setPatches(prev => prev.map(p =>
      p.id === updatedPatch.id ? updatedPatch : p
    ))
  }

  const handlePatchRename = (id, newName) => {
    setPatches(prev => prev.map(p =>
      p.id === id ? { ...p, name: newName } : p
    ))
  }

  const handlePatchDelete = (id) => {
    if (id === 'world') return
    setPatches(prev => prev.filter(p => p.id !== id))
  }

  const handlePatchClick = (patch) => {
    setSelectedPatchId(patch.id)
    if (patch.type === 'world') return

    let bounds

    if (patch.type === 'circle' && patch.center && patch.radius) {
      const latOffset = (patch.radius / 1000) / 111.32
      const lngOffset = (patch.radius / 1000) /
                        (111.32 * Math.cos(patch.center.lat * Math.PI / 180))

      bounds = [
        [patch.center.lat - latOffset, patch.center.lng - lngOffset],
        [patch.center.lat + latOffset, patch.center.lng + lngOffset]
      ]
    } else if (patch.coordinates && patch.coordinates.length > 0) {
      const lats = patch.coordinates.map(c => c.lat)
      const lngs = patch.coordinates.map(c => c.lng)

      bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ]
    }

    if (bounds) {
      setPatchToFlyTo({
        bounds,
        padding: [50, 50]
      })
    }
  }

  const handleObservationAdd = (patchId, observation) => {
    setPatches(prev => prev.map(p => {
      if (p.id === patchId) {
        const observations = p.observations || []
        return { ...p, observations: [...observations, observation] }
      }
      return p
    }))
  }

  const handleObservationUpdate = (patchId, updatedObservation) => {
    setPatches(prev => prev.map(p => {
      if (p.id === patchId) {
        const observations = (p.observations || []).map(obs =>
          obs.id === updatedObservation.id ? updatedObservation : obs
        )
        return { ...p, observations }
      }
      return p
    }))
  }

  const handleObservationDelete = (patchId, observationId) => {
    setPatches(prev => prev.map(p => {
      if (p.id === patchId) {
        const observations = (p.observations || []).filter(obs => obs.id !== observationId)
        return { ...p, observations }
      }
      return p
    }))
  }

  const handleEBirdImport = (patchUpdates, processedObservations) => {
    // Store the processed observations for future patch matching
    setEbirdDataStore(processedObservations)

    // Update existing patches with eBird data
    setPatches(prev => prev.map(p => {
      if (patchUpdates[p.id]) {
        return {
          ...p,
          ebirdData: patchUpdates[p.id]
        }
      }
      return p
    }))
  }

  const handleShowDashboard = (patch) => {
    setDashboardPatch(patch)
  }

  const handlePatchEdit = (patchId) => {
    if (patchId) {
      const patch = patches.find(p => p.id === patchId)
      if (patch) {
        editingSnapshotRef.current = JSON.parse(JSON.stringify(
          { ...patch, layer: undefined, marker: undefined }
        ))
        handlePatchClick(patch)
      }
    } else {
      editingSnapshotRef.current = null
    }
    setEditingPatchId(patchId)
  }

  const handleToggleEBirdLocations = (patchId) => {
    setShowEBirdLocations(prev => {
      const next = new Set(prev)
      if (next.has(patchId)) {
        next.delete(patchId)
      } else {
        next.add(patchId)
      }
      return next
    })
  }

  const handleEditCancel = () => {
    const snapshot = editingSnapshotRef.current
    if (snapshot) {
      setPatches(prev => prev.map(p => p.id === snapshot.id ? { ...snapshot } : p))
    }
    editingSnapshotRef.current = null
    editCancelledRef.current = true
    setEditingPatchId(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Patch Explorer</h1>
            <p>Define your birdwatching patches by drawing polygons or circles on the map</p>
          </div>
          <button
            onClick={() => setShowEBirdImport(true)}
            className="import-button"
            title="Import eBird data"
          >
            Import eBird Data
          </button>
        </div>
      </header>
      <main className="app-main">
        <PatchesSidebar
          patches={patches}
          selectedPatchId={selectedPatchId}
          onPatchClick={handlePatchClick}
          onPatchRename={handlePatchRename}
          onPatchDelete={handlePatchDelete}
          onShowDashboard={handleShowDashboard}
          onPatchEdit={handlePatchEdit}
          onEditCancel={handleEditCancel}
          editingPatchId={editingPatchId}
          showEBirdLocations={showEBirdLocations}
          onToggleEBirdLocations={handleToggleEBirdLocations}
        />
        <MapView
          patches={patches}
          selectedPatchId={selectedPatchId}
          patchToFlyTo={patchToFlyTo}
          editingPatchId={editingPatchId}
          editCancelledRef={editCancelledRef}
          showEBirdLocations={showEBirdLocations}
          clusterPins={clusterPins}
          onToggleCluster={() => setClusterPins(prev => !prev)}
          onPatchCreated={handlePatchCreated}
          onPatchUpdate={handlePatchUpdate}
          onPatchDelete={handlePatchDelete}
          onPatchClick={(patchId) => setSelectedPatchId(patchId)}
          onObservationAdd={handleObservationAdd}
          onObservationUpdate={handleObservationUpdate}
          onObservationDelete={handleObservationDelete}
          onEditComplete={() => setEditingPatchId(null)}
        />
      </main>

      {showEBirdImport && (
        <EBirdImport
          patches={patches}
          onImportComplete={handleEBirdImport}
          onClose={() => setShowEBirdImport(false)}
        />
      )}

      {dashboardPatch && (
        <PatchDashboard
          patch={dashboardPatch}
          onClose={() => setDashboardPatch(null)}
        />
      )}
    </div>
  )
}

export default App
