import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, LayersControl, LayerGroup, useMap } from 'react-leaflet'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import './MapView.css'
import PatchNameModal from './PatchNameModal'
import ObservationModal from './ObservationModal'
import LocationSearch from './LocationSearch'
import { isPointInPatch } from '../utils/geometry'

const { BaseLayer } = LayersControl

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Component to control map view
function MapController({ locationToFly }) {
  const map = useMap()

  useEffect(() => {
    if (locationToFly) {
      if (locationToFly.bounds) {
        // Fit to bounds (for patches)
        map.flyToBounds(locationToFly.bounds, {
          padding: locationToFly.padding || [50, 50],
          duration: 1.5,
          maxZoom: 18
        })
      } else if (locationToFly.lat && locationToFly.lng) {
        // Fly to specific point (for location search)
        map.flyTo([locationToFly.lat, locationToFly.lng], locationToFly.zoom || 15, {
          duration: 1.5
        })
      }
    }
  }, [locationToFly, map])

  return null
}

// Component to handle keyboard navigation
function KeyboardControls() {
  const map = useMap()

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't pan if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const panAmount = 100 // pixels to pan

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          map.panBy([0, -panAmount])
          break
        case 'ArrowDown':
          e.preventDefault()
          map.panBy([0, panAmount])
          break
        case 'ArrowLeft':
          e.preventDefault()
          map.panBy([-panAmount, 0])
          break
        case 'ArrowRight':
          e.preventDefault()
          map.panBy([panAmount, 0])
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [map])

  return null
}

// Create custom marker icon based on shape and color
function createCustomIcon(shape = 'pin', color = '#1e88e5') {
  const size = 24 // Smaller than default Leaflet marker (which is ~41px tall)

  let iconHtml = ''

  switch (shape) {
    case 'circle':
      iconHtml = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `
      break
    case 'square':
      iconHtml = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 3px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `
      break
    case 'star':
      iconHtml = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="${color}"
                stroke="white"
                stroke-width="1.5"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
        </svg>
      `
      break
    case 'pin':
    default:
      // Custom SVG pin that's smaller than default
      iconHtml = `
        <svg width="${size}" height="${size * 1.2}" viewBox="0 0 24 29" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 16 9 16s9-10.75 9-16c0-4.97-4.03-9-9-9z"
                fill="${color}"
                stroke="white"
                stroke-width="2"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
          <circle cx="12" cy="9" r="3" fill="white"/>
        </svg>
      `
      break
  }

  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker-icon',
    iconSize: [size, size * 1.2],
    iconAnchor: [size / 2, size * 1.2],
    popupAnchor: [0, -size * 1.2]
  })
}

// Component to handle observations on the map
function ObservationsLayer({ patches, onObservationClick }) {
  const map = useMap()
  const markersRef = useRef(new Map())

  useEffect(() => {
    // Clear all markers
    markersRef.current.forEach(marker => map.removeLayer(marker))
    markersRef.current.clear()

    // Add markers for all observations
    patches.forEach(patch => {
      if (!patch.observations) return

      patch.observations.forEach(obs => {
        if (!obs.marker) {
          const icon = createCustomIcon(obs.markerShape, obs.markerColor)
          const marker = L.marker([obs.lat, obs.lng], { icon }).addTo(map)
          marker.on('click', () => onObservationClick(patch.id, obs))
          markersRef.current.set(obs.id, marker)
        }
      })
    })

    return () => {
      markersRef.current.forEach(marker => map.removeLayer(marker))
      markersRef.current.clear()
    }
  }, [patches, map, onObservationClick])

  return null
}

// Build a marker for an eBird checklist location
function createEBirdLocationMarker(loc, size, zIndexOffset = 0) {
  const rounded = Math.round(size)

  const icon = L.divIcon({
    html: `<div class="ebird-location-marker" style="width:${rounded}px;height:${rounded}px"></div>`,
    className: 'ebird-location-icon',
    iconSize: [rounded, rounded],
    iconAnchor: [rounded / 2, rounded / 2],
  })

  const marker = L.marker([loc.lat, loc.lng], { icon, snapIgnore: true, zIndexOffset })
  const name = loc.locationName || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
  const speciesText = loc.locationId
    ? `<a href="https://ebird.org/lifelist/${loc.locationId}" target="_blank" rel="noopener noreferrer">${loc.speciesCount} species</a>`
    : `${loc.speciesCount} species`
  const checklistText = loc.locationId
    ? `<a href="https://ebird.org/mychecklists/${loc.locationId}" target="_blank" rel="noopener noreferrer">${loc.checklistCount} checklist${loc.checklistCount !== 1 ? 's' : ''}</a>`
    : `${loc.checklistCount} checklist${loc.checklistCount !== 1 ? 's' : ''}`
  marker.bindPopup(
    `<div style="font-size:13px;line-height:1.4">` +
    `<strong>${name}</strong><br>` +
    `${speciesText}<br>` +
    `${checklistText}` +
    `</div>`,
    { offset: [0, -rounded / 2] }
  )
  return marker
}

// Component to display eBird checklist location markers with optional clustering
function EBirdLocationsLayer({ patches, showEBirdLocations, clusterPins, onToggleCluster }) {
  const map = useMap()
  const layerGroupRef = useRef(null)
  const controlRef = useRef(null)

  useEffect(() => {
    // Clean up previous layer group
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current)
      layerGroupRef.current = null
    }

    // Collect all visible locations to determine size scaling
    const allLocations = []
    patches.forEach(patch => {
      if (!showEBirdLocations.has(patch.id)) return
      if (!patch.ebirdData?.checklistLocations) return
      allLocations.push(...patch.ebirdData.checklistLocations)
    })

    if (allLocations.length === 0) {
      // Remove toggle control when no pins are visible
      if (controlRef.current) {
        map.removeControl(controlRef.current)
        controlRef.current = null
      }
      return
    }

    const maxSpecies = Math.max(...allLocations.map(l => l.speciesCount))
    const minSize = 8
    const maxSize = 24

    // Collect all locations with their computed sizes, then sort ascending
    // so larger pins are added last and appear on top
    const locationsWithSize = []
    patches.forEach(patch => {
      if (!showEBirdLocations.has(patch.id)) return
      if (!patch.ebirdData?.checklistLocations) return

      patch.ebirdData.checklistLocations.forEach(loc => {
        const size = maxSpecies > 1
          ? minSize + (loc.speciesCount / maxSpecies) * (maxSize - minSize)
          : (minSize + maxSize) / 2
        locationsWithSize.push({ loc, size })
      })
    })
    locationsWithSize.sort((a, b) => a.size - b.size)
    const markers = locationsWithSize.map(({ loc, size }, i) => createEBirdLocationMarker(loc, size, i))

    if (clusterPins) {
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      })
      cluster.addLayers(markers)
      map.addLayer(cluster)
      layerGroupRef.current = cluster
    } else {
      const group = L.layerGroup(markers)
      group.addTo(map)
      layerGroupRef.current = group
    }

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current)
        layerGroupRef.current = null
      }
    }
  }, [patches, showEBirdLocations, clusterPins, map])

  // Manage the cluster toggle control separately so it doesn't rebuild all markers
  useEffect(() => {
    const hasPins = patches.some(p =>
      showEBirdLocations.has(p.id) && p.ebirdData?.checklistLocations?.length > 0
    )

    if (hasPins && !controlRef.current) {
      const Toggle = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd() {
          const container = L.DomUtil.create('div', 'leaflet-bar ebird-cluster-toggle')
          L.DomEvent.disableClickPropagation(container)
          this._btn = L.DomUtil.create('a', '', container)
          this._btn.href = '#'
          this._btn.title = clusterPins ? 'Show all pins' : 'Cluster pins'
          this._btn.textContent = clusterPins ? 'Show All' : 'Cluster'
          L.DomEvent.on(this._btn, 'click', (e) => {
            L.DomEvent.preventDefault(e)
            onToggleCluster()
          })
          return container
        }
      })
      controlRef.current = new Toggle()
      map.addControl(controlRef.current)
    } else if (hasPins && controlRef.current) {
      controlRef.current._btn.textContent = clusterPins ? 'Show All' : 'Cluster'
      controlRef.current._btn.title = clusterPins ? 'Show all pins' : 'Cluster pins'
    } else if (!hasPins && controlRef.current) {
      map.removeControl(controlRef.current)
      controlRef.current = null
    }

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current)
        controlRef.current = null
      }
    }
  }, [showEBirdLocations, patches, clusterPins, map, onToggleCluster])

  return null
}

// Component to initialize Geoman controls
function GeomanControls({
  patches,
  selectedPatchId,
  editingPatchId,
  onPatchCreated,
  onPatchUpdate,
  onPatchDelete,
  onPatchClick,
  onPatchLayerCreated,
  editCancelledRef,
  onEditComplete,
  pendingLayer,
  setPendingLayer,
  pendingMarker,
  setPendingMarker
}) {
  const map = useMap()
  const layersRef = useRef(new Map())
  const restoredPatchesRef = useRef(new Set())

  useEffect(() => {
    // Add Geoman controls to the map
    map.pm.addControls({
      position: 'topright',
      drawCircle: true,
      drawCircleMarker: false,
      drawMarker: true,
      drawPolyline: false,
      drawRectangle: false,
      drawPolygon: true,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    })

    // Set polygon style
    map.pm.setGlobalOptions({
      pathOptions: {
        color: '#1e88e5',
        fillColor: '#1e88e5',
        fillOpacity: 0.2,
        weight: 3,
      },
    })

    // Handle shape and marker creation
    const handleCreate = (e) => {
      const layer = e.layer

      if (e.shape === 'Circle') {
        setPendingLayer(layer)
      } else if (layer instanceof L.Polygon) {
        setPendingLayer(layer)
      } else if (layer instanceof L.Marker) {
        setPendingMarker(layer)
      }
    }

    // Handle polygon removal
    const handleRemove = (e) => {
      const layer = e.layer
      // Find the patch associated with this layer
      for (const [id, storedLayer] of layersRef.current) {
        if (storedLayer === layer) {
          onPatchDelete(id)
          layersRef.current.delete(id)
          break
        }
      }
    }

    // Handle polygon edit - save coordinates during editing
    // Note: This fires during editing (while dragging), not when complete
    // Final update with eBird re-matching happens when editing completes (see editingPatchId useEffect)
    const handleEdit = (e) => {
      const layer = e.layer
      for (const [id, storedLayer] of layersRef.current) {
        if (storedLayer === layer) {
          const patch = patches.find(p => p.id === id)
          if (!patch) break

          let updatedPatch = { ...patch }

          if (layer instanceof L.Circle) {
            const center = layer.getLatLng()
            updatedPatch.center = { lat: center.lat, lng: center.lng }
            updatedPatch.radius = layer.getRadius()
          } else {
            const latLngs = layer.getLatLngs()[0]
            updatedPatch.coordinates = latLngs.map(latLng => ({
              lat: latLng.lat,
              lng: latLng.lng
            }))
          }

          onPatchUpdate(updatedPatch)
          break
        }
      }
    }

    map.on('pm:create', handleCreate)
    map.on('pm:remove', handleRemove)
    map.on('pm:edit', handleEdit)

    return () => {
      map.off('pm:create', handleCreate)
      map.off('pm:remove', handleRemove)
      map.off('pm:edit', handleEdit)
      map.pm.removeControls()
    }
  }, [map, patches, onPatchDelete, onPatchUpdate, onEditComplete, setPendingLayer])

  // Track previous editing patch to detect when editing completes
  const prevEditingPatchIdRef = useRef(null)
  const editRadiusTooltipRef = useRef(null)
  const editRadiusListenerRef = useRef(null)

  // Enable editing mode for a specific patch
  useEffect(() => {
    const prevEditingPatchId = prevEditingPatchIdRef.current

    if (editingPatchId) {
      const layer = layersRef.current.get(editingPatchId)
      if (layer) {
        // Disable editing on all other layers
        layersRef.current.forEach((l, id) => {
          if (id !== editingPatchId && l.pm) {
            l.pm.disable()
          }
        })

        // Enable editing on the selected layer
        layer.pm.enable({
          allowSelfIntersection: false,
        })

        // Show radius tooltip while editing a circle, following the mouse cursor
        if (layer instanceof L.Circle) {
          const formatRadius = (meters) => {
            const miles = meters / 1609.344
            return miles < 0.1
              ? `${(miles * 5280).toFixed(0)} ft`
              : `${miles.toFixed(2)} mi`
          }

          const tooltip = L.DomUtil.create('div', 'radius-tooltip', map.getContainer())
          tooltip.textContent = formatRadius(layer.getRadius())
          tooltip.style.display = 'block'
          editRadiusTooltipRef.current = tooltip

          const onMouseMove = (e) => {
            if (!editRadiusTooltipRef.current) return
            const pt = map.latLngToContainerPoint(e.latlng)
            editRadiusTooltipRef.current.style.left = (pt.x + 15) + 'px'
            editRadiusTooltipRef.current.style.top = (pt.y - 15) + 'px'
          }
          map.on('mousemove', onMouseMove)

          const onEdit = () => {
            if (!editRadiusTooltipRef.current) return
            editRadiusTooltipRef.current.textContent = formatRadius(layer.getRadius())
          }
          layer.on('pm:change', onEdit)
          editRadiusListenerRef.current = { layer, editHandler: onEdit, moveHandler: onMouseMove }
        }
      }
    } else {
      // Clean up edit radius tooltip
      if (editRadiusTooltipRef.current) {
        editRadiusTooltipRef.current.remove()
        editRadiusTooltipRef.current = null
      }
      if (editRadiusListenerRef.current) {
        editRadiusListenerRef.current.layer.off('pm:change', editRadiusListenerRef.current.editHandler)
        map.off('mousemove', editRadiusListenerRef.current.moveHandler)
        editRadiusListenerRef.current = null
      }

      // Disable editing on all layers when no patch is being edited
      layersRef.current.forEach(layer => {
        if (layer.pm) {
          layer.pm.disable()
        }
      })

      if (prevEditingPatchId !== null) {
        if (editCancelledRef.current) {
          // Cancel: remove the stale layer so the sync useEffect rebuilds
          // it from the restored snapshot data
          const layer = layersRef.current.get(prevEditingPatchId)
          if (layer) {
            map.removeLayer(layer)
            layersRef.current.delete(prevEditingPatchId)
            restoredPatchesRef.current.delete(prevEditingPatchId)
          }
          editCancelledRef.current = false
        } else {
          // Save: layer already has correct geometry from live editing,
          // trigger a final update for eBird re-matching
          const patch = patches.find(p => p.id === prevEditingPatchId)
          const layer = layersRef.current.get(prevEditingPatchId)
          if (patch && layer) {
            let updatedPatch = { ...patch }
            if (layer instanceof L.Circle) {
              const center = layer.getLatLng()
              updatedPatch.center = { lat: center.lat, lng: center.lng }
              updatedPatch.radius = layer.getRadius()
            } else {
              const latLngs = layer.getLatLngs()[0]
              updatedPatch.coordinates = latLngs.map(latLng => ({
                lat: latLng.lat,
                lng: latLng.lng
              }))
            }
            onPatchUpdate(updatedPatch)
          }
        }
      }
    }

    prevEditingPatchIdRef.current = editingPatchId
  }, [editingPatchId, patches, onPatchUpdate])

  // Restore patches loaded from localStorage and sync patches with map layers
  useEffect(() => {
    patches.forEach(patch => {
      if (patch.type === 'world') return
      if (!patch.layer && !restoredPatchesRef.current.has(patch.id)) {
        let layer

        if (patch.type === 'circle' && patch.center && patch.radius) {
          layer = L.circle(
            [patch.center.lat, patch.center.lng],
            {
              radius: patch.radius,
              color: '#1e88e5',
              fillColor: '#1e88e5',
              fillOpacity: 0.2,
              weight: 3,
            }
          ).addTo(map)
        } else {
          const latLngs = patch.coordinates.map(coord => [coord.lat, coord.lng])
          layer = L.polygon(latLngs, {
            color: '#1e88e5',
            fillColor: '#1e88e5',
            fillOpacity: 0.2,
            weight: 3,
          }).addTo(map)
        }

        // Add click handler to the layer
        layer.on('click', () => {
          if (onPatchClick) {
            onPatchClick(patch.id)
          }
        })

        layersRef.current.set(patch.id, layer)
        restoredPatchesRef.current.add(patch.id)

        // Notify parent to update patch with layer reference
        if (onPatchLayerCreated) {
          onPatchLayerCreated(patch.id, layer)
        }
      } else if (patch.layer && !layersRef.current.has(patch.id)) {
        // New patch with layer already set
        layersRef.current.set(patch.id, patch.layer)

        // Add click handler to existing layer
        patch.layer.on('click', () => {
          if (onPatchClick) {
            onPatchClick(patch.id)
          }
        })
      }
    })

    // Remove deleted patches from map
    for (const [id, layer] of layersRef.current) {
      if (!patches.find(p => p.id === id)) {
        map.removeLayer(layer)
        layersRef.current.delete(id)
        restoredPatchesRef.current.delete(id)
      }
    }
  }, [patches, map, onPatchClick, onPatchLayerCreated])

  // Show radius tooltip in miles during circle drawing
  useEffect(() => {
    let radiusTooltip = null

    const handleRadiusMove = (e) => {
      if (!radiusTooltip) return
      const drawCircle = map.pm.Draw.Circle
      if (!drawCircle._centerMarker) return

      const center = drawCircle._centerMarker.getLatLng()
      const meters = center.distanceTo(e.latlng)
      const miles = meters / 1609.344

      radiusTooltip.textContent = miles < 0.1
        ? `${(miles * 5280).toFixed(0)} ft`
        : `${miles.toFixed(2)} mi`
      radiusTooltip.style.display = 'block'

      const point = map.latLngToContainerPoint(e.latlng)
      radiusTooltip.style.left = (point.x + 15) + 'px'
      radiusTooltip.style.top = (point.y - 15) + 'px'
    }

    const cleanup = () => {
      map.off('click', handleCenterPlaced)
      map.off('mousemove', handleRadiusMove)
      if (radiusTooltip) {
        radiusTooltip.remove()
        radiusTooltip = null
      }
    }

    const handleCenterPlaced = () => {
      map.off('click', handleCenterPlaced)
      radiusTooltip = L.DomUtil.create('div', 'radius-tooltip', map.getContainer())
      map.on('mousemove', handleRadiusMove)
    }

    const handleDrawStart = (e) => {
      if (e.shape === 'Circle') {
        map.on('click', handleCenterPlaced)
      }
    }

    const handleDrawEnd = () => cleanup()
    const handleCreate = () => cleanup()

    map.on('pm:drawstart', handleDrawStart)
    map.on('pm:drawend', handleDrawEnd)
    map.on('pm:create', handleCreate)

    return () => {
      cleanup()
      map.off('pm:drawstart', handleDrawStart)
      map.off('pm:drawend', handleDrawEnd)
      map.off('pm:create', handleCreate)
    }
  }, [map])

  // Highlight selected patch
  useEffect(() => {
    layersRef.current.forEach((layer, id) => {
      if (id === selectedPatchId) {
        layer.setStyle({
          color: '#ff6b00',
          fillColor: '#ff6b00',
          fillOpacity: 0.3,
          weight: 4,
        })
      } else {
        layer.setStyle({
          color: '#2c5f2d',
          fillColor: '#2c5f2d',
          fillOpacity: 0.2,
          weight: 3,
        })
      }
    })
  }, [selectedPatchId])

  return null
}

function MapView({
  patches,
  selectedPatchId,
  patchToFlyTo,
  editingPatchId,
  editCancelledRef,
  showEBirdLocations,
  clusterPins,
  onToggleCluster,
  onPatchCreated,
  onPatchUpdate,
  onPatchDelete,
  onPatchClick,
  onObservationAdd,
  onObservationUpdate,
  onObservationDelete,
  onEditComplete
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false)
  const [pendingLayer, setPendingLayer] = useState(null)
  const [pendingMarker, setPendingMarker] = useState(null)
  const [currentObservation, setCurrentObservation] = useState(null)
  const [currentObservationPatch, setCurrentObservationPatch] = useState(null)
  const [locationToFly, setLocationToFly] = useState(null)

  // Fly to patch when clicked in sidebar
  useEffect(() => {
    if (patchToFlyTo) {
      setLocationToFly(patchToFlyTo)
    }
  }, [patchToFlyTo])

  const handlePatchNamed = (name) => {
    if (pendingLayer) {
      let patch = {
        id: Date.now(),
        name: name,
        createdAt: new Date().toISOString(),
        layer: pendingLayer
      }

      if (pendingLayer instanceof L.Circle) {
        const center = pendingLayer.getLatLng()
        patch.type = 'circle'
        patch.center = { lat: center.lat, lng: center.lng }
        patch.radius = pendingLayer.getRadius()
      } else {
        const coordinates = pendingLayer.getLatLngs()[0].map(latlng => ({
          lat: latlng.lat,
          lng: latlng.lng
        }))
        patch.type = 'polygon'
        patch.coordinates = coordinates
      }

      onPatchCreated(patch)
      setPendingLayer(null)
    }
    setIsModalOpen(false)
  }

  const handleModalClose = () => {
    // If user cancels, remove the pending layer
    if (pendingLayer) {
      pendingLayer.remove()
      setPendingLayer(null)
    }
    setIsModalOpen(false)
  }

  const handlePatchLayerCreated = (patchId, layer) => {
    // Update the patch with its layer reference
    const updatedPatch = patches.find(p => p.id === patchId)
    if (updatedPatch) {
      onPatchUpdate({ ...updatedPatch, layer })
    }
  }

  const handleLocationSelect = (location) => {
    setLocationToFly(location)
  }

  const findPatchForPoint = (lat, lng) => {
    for (const patch of patches) {
      if (!patch.layer) continue

      const point = L.latLng(lat, lng)
      const bounds = patch.layer.getBounds()

      if (bounds.contains(point)) {
        if (isPointInPatch([lng, lat], patch)) {
          return patch
        }
      }
    }
    return null
  }

  const handleObservationClick = (patchId, observation) => {
    const patch = patches.find(p => p.id === patchId)
    if (patch) {
      setCurrentObservation(observation)
      setCurrentObservationPatch(patch)
      setIsObservationModalOpen(true)
    }
  }

  const handleObservationSave = (observation) => {
    if (currentObservation && currentObservation.id) {
      // Update existing observation
      onObservationUpdate(currentObservationPatch.id, observation)
    } else {
      // New observation from pending marker
      const latlng = pendingMarker.getLatLng()
      const patch = findPatchForPoint(latlng.lat, latlng.lng)

      if (!patch) {
        alert('Please place the marker within a patch')
        pendingMarker.remove()
        setPendingMarker(null)
        setIsObservationModalOpen(false)
        return
      }

      const newObservation = {
        ...observation,
        id: Date.now(),
        lat: latlng.lat,
        lng: latlng.lng,
        createdAt: new Date().toISOString()
      }

      onObservationAdd(patch.id, newObservation)
      setPendingMarker(null)
    }

    setIsObservationModalOpen(false)
    setCurrentObservation(null)
    setCurrentObservationPatch(null)
  }

  const handleObservationDelete = (observationId) => {
    if (currentObservationPatch) {
      onObservationDelete(currentObservationPatch.id, observationId)
    }
    setIsObservationModalOpen(false)
    setCurrentObservation(null)
    setCurrentObservationPatch(null)
  }

  const handleObservationModalClose = () => {
    if (pendingMarker) {
      pendingMarker.remove()
      setPendingMarker(null)
    }
    setIsObservationModalOpen(false)
    setCurrentObservation(null)
    setCurrentObservationPatch(null)
  }

  // Open modal when a new layer is created
  useEffect(() => {
    if (pendingLayer) {
      setIsModalOpen(true)
    }
  }, [pendingLayer])

  // Open observation modal when a new marker is created
  useEffect(() => {
    if (pendingMarker) {
      const latlng = pendingMarker.getLatLng()
      const patch = findPatchForPoint(latlng.lat, latlng.lng)
      setCurrentObservationPatch(patch)
      setCurrentObservation(null)
      setIsObservationModalOpen(true)
    }
  }, [pendingMarker])

  return (
    <div className="map-view">
      <LocationSearch onLocationSelect={handleLocationSelect} />

      <MapContainer
        center={[40.7128, -74.0060]} // Default to NYC
        zoom={13}
        className="map-container"
      >
        <LayersControl position="topright">
          <BaseLayer checked name="Street Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </BaseLayer>
          <BaseLayer name="Hybrid">
            <LayerGroup>
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayerGroup>
          </BaseLayer>
        </LayersControl>
        <MapController locationToFly={locationToFly} />
        <KeyboardControls />
        <GeomanControls
          patches={patches}
          selectedPatchId={selectedPatchId}
          editingPatchId={editingPatchId}
          onPatchCreated={onPatchCreated}
          onPatchUpdate={onPatchUpdate}
          onPatchDelete={onPatchDelete}
          onPatchClick={onPatchClick}
          onPatchLayerCreated={handlePatchLayerCreated}
          editCancelledRef={editCancelledRef}
          onEditComplete={onEditComplete}
          pendingLayer={pendingLayer}
          setPendingLayer={setPendingLayer}
          pendingMarker={pendingMarker}
          setPendingMarker={setPendingMarker}
        />
        <ObservationsLayer
          patches={patches}
          onObservationClick={handleObservationClick}
        />
        <EBirdLocationsLayer
          patches={patches}
          showEBirdLocations={showEBirdLocations}
          clusterPins={clusterPins}
          onToggleCluster={onToggleCluster}
        />
      </MapContainer>

      <PatchNameModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handlePatchNamed}
        defaultName={`Patch ${patches.length + 1}`}
      />

      <ObservationModal
        isOpen={isObservationModalOpen}
        observation={currentObservation}
        patchName={currentObservationPatch?.name}
        onClose={handleObservationModalClose}
        onSave={handleObservationSave}
        onDelete={handleObservationDelete}
      />
    </div>
  )
}

export default MapView
