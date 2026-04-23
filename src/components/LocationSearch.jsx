import { useState, useRef, useEffect } from 'react'
import './LocationSearch.css'

function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeoutRef = useRef(null)
  const searchBoxRef = useRef(null)

  useEffect(() => {
    // Close results when clicking outside
    const handleClickOutside = (event) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchLocation = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)

    try {
      // Try Photon API first (fast, modern OSM geocoder)
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=8`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        // Transform Photon GeoJSON format to our format
        const transformedResults = data.features.map((feature) => ({
          id: feature.properties.osm_id,
          name: feature.properties.name || feature.properties.street || 'Unknown',
          type: feature.properties.type || feature.properties.osm_key,
          city: feature.properties.city,
          state: feature.properties.state,
          country: feature.properties.country,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          properties: feature.properties
        }))
        setResults(transformedResults)
        setShowResults(true)
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)

    // Debounce the search - faster response
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(value)
    }, 300)
  }

  const handleResultClick = (result) => {
    onLocationSelect({
      lat: result.lat,
      lng: result.lng,
      name: result.name,
      zoom: 15
    })

    setQuery(result.name)
    setShowResults(false)
    setResults([])
  }

  const formatResultAddress = (result) => {
    const parts = []
    if (result.city && result.city !== result.name) parts.push(result.city)
    if (result.state) parts.push(result.state)
    if (result.country) parts.push(result.country)
    return parts.join(', ') || 'Location'
  }

  const getLocationIcon = (type) => {
    const iconMap = {
      city: '🏙️',
      town: '🏘️',
      village: '🏡',
      park: '🌳',
      street: '🛣️',
      house: '🏠',
      water: '💧',
      mountain: '⛰️',
      building: '🏢',
    }

    for (const [key, icon] of Object.entries(iconMap)) {
      if (type?.toLowerCase().includes(key)) return icon
    }
    return '📍'
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  return (
    <div className="location-search" ref={searchBoxRef}>
      <div className="search-input-container">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search for a location..."
          className="search-input"
        />
        {query && (
          <button onClick={handleClear} className="clear-button" title="Clear">
            ✕
          </button>
        )}
        <div className="search-icon">
          {isLoading ? '⌛' : '🔍'}
        </div>
      </div>

      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map((result, index) => (
            <div
              key={result.id || index}
              className="search-result-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="result-icon">{getLocationIcon(result.type)}</div>
              <div className="result-text">
                <div className="result-name">{result.name}</div>
                <div className="result-address">
                  {formatResultAddress(result)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && !isLoading && query.length >= 2 && results.length === 0 && (
        <div className="search-results">
          <div className="no-results">No locations found</div>
        </div>
      )}
    </div>
  )
}

export default LocationSearch
