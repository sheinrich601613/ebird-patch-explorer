import { useState, useEffect, useRef } from 'react'
import './EBirdImport.css'
import { isPointInPatch } from '../utils/geometry'

function EBirdImport({ patches, onImportComplete, onClose }) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState(null)
  const [taxonomy, setTaxonomy] = useState(null)
  const fileInputRef = useRef(null)

  // Load taxonomy on mount
  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const taxResponse = await fetch('/eBird_taxonomy_v2025.csv')
        const text = await taxResponse.text()
        const parsed = parseCSV(text)

        // First pass: create species code -> common name map
        const speciesCodeToName = {}
        parsed.forEach(row => {
          const code = row.SPECIES_CODE || row['SPECIES_CODE']
          const name = row.PRIMARY_COM_NAME || row['PRIMARY_COM_NAME']
          if (code && name) {
            speciesCodeToName[code] = name
          }
        })

        // Second pass: create common name -> taxonomy info map
        const taxMap = {}
        parsed.forEach(row => {
          const name = row.PRIMARY_COM_NAME || row['PRIMARY_COM_NAME']
          const category = row.CATEGORY || row['CATEGORY']
          const reportAsCode = row.REPORT_AS || row['REPORT_AS']
          const taxonOrder = parseFloat(row.TAXON_ORDER || row['TAXON_ORDER'])

          if (name) {
            taxMap[name] = {
              isSpecies: category === 'species',
              reportAsCode: reportAsCode || null,
              category,
              taxonOrder: !isNaN(taxonOrder) ? taxonOrder : 999999
            }
          }
        })

        setTaxonomy({ taxMap, speciesCodeToName })
      } catch (error) {
        console.error('Failed to load taxonomy:', error)
        // Continue without taxonomy - will treat all as species
      }
    }

    loadTaxonomy()
  }, [])

  const parseCSV = (text) => {
    // Remove BOM if present
    text = text.replace(/^\uFEFF/, '')

    // Parse CSV properly handling quoted fields with commas and newlines
    const rows = []
    let currentRow = []
    let currentField = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote (two quotes in a row)
          currentField += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        currentRow.push(currentField)
        currentField = ''
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // End of row
        if (char === '\r' && nextChar === '\n') {
          i++ // Skip \n in \r\n
        }
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField)
          rows.push(currentRow)
          currentRow = []
          currentField = ''
        }
      } else {
        currentField += char
      }
    }

    // Push last field and row if any
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField)
      rows.push(currentRow)
    }

    // First row is headers
    const headers = rows[0]
    const data = []

    for (let i = 1; i < rows.length; i++) {
      if (rows[i].length === 0) continue

      const row = {}
      headers.forEach((header, index) => {
        row[header] = rows[i][index] || ''
      })
      data.push(row)
    }

    return data
  }

  const getSpeciesName = (commonName) => {
    if (!taxonomy || !taxonomy.taxMap[commonName]) {
      return commonName
    }

    const taxInfo = taxonomy.taxMap[commonName]

    // If it's a species, return as is
    if (taxInfo.isSpecies) {
      return commonName
    }

    // If it has a reportAs code, look up the species name
    if (taxInfo.reportAsCode && taxonomy.speciesCodeToName[taxInfo.reportAsCode]) {
      return taxonomy.speciesCodeToName[taxInfo.reportAsCode]
    }

    // If we can't resolve, return original
    return commonName
  }

  const isSpeciesLevel = (commonName) => {
    if (!taxonomy || !taxonomy.taxMap[commonName]) {
      return true // Default to true if we don't have taxonomy data
    }

    return taxonomy.taxMap[commonName].isSpecies
  }

  const matchObservationToPatch = (lat, lng) => {
    for (const patch of patches) {
      if (isPointInPatch([lng, lat], patch)) {
        return patch.id
      }
    }
    return null
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!taxonomy) {
      alert('Taxonomy is still loading. Please wait a moment.')
      return
    }

    setIsProcessing(true)
    setResults(null)

    try {
      // Parse CSV entirely client-side
      const text = await file.text()
      const ebirdRows = parseCSV(text)

      // Process eBird data - map to species level and add taxonomic order
      const processedObservations = []
      const speciesByPatch = {}
      let totalRecords = 0
      let matchedRecords = 0

      ebirdRows.forEach(row => {
        const rawSpecies = row['Common Name'] || row['Common name'] || row['species']
        const latitude = row['Latitude'] || row['latitude']
        const longitude = row['Longitude'] || row['longitude']
        const date = row['Date'] || row['date']
        const countStr = row['Count'] || row['count'] || '1'
        const subid = row['Submission ID'] || row['SUBID'] || row['Checklist ID']
        const locationName = row['Location'] || row['Location Name'] || row['location'] || ''
        const locationId = row['Location ID'] || row['location_id'] || ''

        if (!rawSpecies || !latitude || !longitude) return

        const lat = parseFloat(latitude)
        const lng = parseFloat(longitude)
        const count = /^\d+$/.test(countStr) ? parseInt(countStr, 10) : 1

        if (isNaN(lat) || isNaN(lng) || count === 0) return

        totalRecords++

        // Map to species level
        const species = getSpeciesName(rawSpecies)

        // Only include if it maps to a species-level taxon
        if (!isSpeciesLevel(species)) {
          return
        }

        // Get taxonomic order
        const taxonOrder = taxonomy?.taxMap[species]?.taxonOrder || 999999

        const processedObs = {
          species,
          date,
          count,
          lat,
          lng,
          taxonOrder,
          subid,
          locationName,
          locationId
        }

        // Store all processed observations for future matching
        processedObservations.push(processedObs)

        // Match to patches
        const patchId = matchObservationToPatch(lat, lng)

        if (patchId) {
          matchedRecords++

          if (!speciesByPatch[patchId]) {
            speciesByPatch[patchId] = []
          }

          speciesByPatch[patchId].push(processedObs)
        }
      })

      // Calculate stats per patch
      const patchUpdates = {}
      Object.keys(speciesByPatch).forEach(patchId => {
        const observations = speciesByPatch[patchId]

        // Get unique species with ALL dates and first sighting date
        const speciesMap = new Map()
        observations.forEach(obs => {
          if (!speciesMap.has(obs.species)) {
            speciesMap.set(obs.species, {
              species: obs.species,
              date: obs.date, // First sighting
              subid: obs.subid, // Checklist for first sighting
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
            // Keep the EARLIER date as the first sighting
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
        observations.forEach(obs => {
          if (!obs.subid) return // Skip observations without subid

          if (!checklistMap.has(obs.subid)) {
            checklistMap.set(obs.subid, {
              subid: obs.subid,
              date: obs.date,
              species: new Set()
            })
          }
          checklistMap.get(obs.subid).species.add(obs.species)
        })

        // Convert to array and calculate species counts
        const checklists = Array.from(checklistMap.values()).map(checklist => ({
          subid: checklist.subid,
          date: checklist.date,
          speciesCount: checklist.species.size
        }))

        // Sort by species count descending and take top 5
        const topChecklists = checklists
          .sort((a, b) => b.speciesCount - a.speciesCount)
          .slice(0, 5)

        patchUpdates[patchId] = {
          species: uniqueSpecies,
          totalSpecies: uniqueSpecies.length,
          totalObservations: observations.length,
          totalChecklists: checklists.length,
          topChecklists
        }
      })

      setResults({
        totalRecords,
        matchedRecords,
        patchUpdates
      })

      onImportComplete(patchUpdates, processedObservations)
    } catch (error) {
      console.error('Error processing eBird data:', error)
      alert('Error processing eBird data: ' + error.message)
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ebird-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import eBird Data</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className="import-instructions">
          <h3>Import your eBird data:</h3>
          <ol>
            <li>Download your complete eBird data from <a href="https://ebird.org/downloadMyData" target="_blank" rel="noopener noreferrer">ebird.org/downloadMyData</a></li>
            <li>Upload the CSV file below</li>
          </ol>
          <p className="note">
            <strong>Note:</strong> Only species-level observations within your defined patches will be imported. Subspecies will be automatically mapped to their parent species.
          </p>
        </div>

        <div className="upload-section">
          {!taxonomy && (
            <div className="loading-taxonomy">Loading taxonomy...</div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="ebird-file-upload"
            disabled={!taxonomy}
          />
          <label
            htmlFor="ebird-file-upload"
            className={`upload-button ${!taxonomy ? 'disabled' : ''}`}
          >
            {isProcessing ? '⌛ Processing...' : '📤 Choose eBird CSV File'}
          </label>
        </div>

        {results && (
          <div className="import-results">
            <h3>Import Complete!</h3>
            <div className="results-grid">
              <div className="result-item">
                <div className="result-number">{results.totalRecords}</div>
                <div className="result-label">Total Records</div>
              </div>
              <div className="result-item">
                <div className="result-number">{results.matchedRecords}</div>
                <div className="result-label">Matched to Patches</div>
              </div>
              <div className="result-item">
                <div className="result-number">{Object.keys(results.patchUpdates).length}</div>
                <div className="result-label">Patches Updated</div>
              </div>
            </div>
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default EBirdImport
