import { useState, useEffect, useRef } from 'react'
import './ObservationModal.css'

function ObservationModal({ isOpen, observation, patchName, onClose, onSave, onDelete }) {
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState([])
  const [markerShape, setMarkerShape] = useState('pin')
  const [markerColor, setMarkerColor] = useState('#1e88e5')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (observation) {
      setNotes(observation.notes || '')
      setPhotos(observation.photos || [])
      setMarkerShape(observation.markerShape || 'pin')
      setMarkerColor(observation.markerColor || '#1e88e5')
    } else {
      setNotes('')
      setPhotos([])
      setMarkerShape('pin')
      setMarkerColor('#1e88e5')
    }
  }, [observation])

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files)

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Photo is too large. Maximum size is 5MB.')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setPhotos(prev => [...prev, {
          id: Date.now() + Math.random(),
          data: event.target.result,
          name: file.name,
          date: new Date().toISOString()
        }])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = (photoId) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...observation,
      notes: notes.trim(),
      photos,
      markerShape,
      markerColor
    })
  }

  const handleDeleteObservation = () => {
    if (window.confirm('Delete this observation?')) {
      onDelete(observation.id)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content observation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Observation</h2>
            {patchName && <p className="patch-indicator">in {patchName}</p>}
          </div>
          <button onClick={onClose} className="close-button" title="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="observation-form">
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you observe? Species, behavior, weather..."
              rows={6}
            />
          </div>

          <div className="form-group">
            <label>Marker Appearance</label>
            <div className="marker-options">
              <div className="marker-option-group">
                <label htmlFor="marker-shape" className="sub-label">Shape</label>
                <select
                  id="marker-shape"
                  value={markerShape}
                  onChange={(e) => setMarkerShape(e.target.value)}
                  className="marker-select"
                >
                  <option value="pin">Pin</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                  <option value="star">Star</option>
                </select>
              </div>
              <div className="marker-option-group">
                <label htmlFor="marker-color" className="sub-label">Color</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    id="marker-color"
                    value={markerColor}
                    onChange={(e) => setMarkerColor(e.target.value)}
                    className="color-input"
                  />
                  <div className="color-presets">
                    {['#1e88e5', '#ff6b00', '#66bb6a', '#ef4444', '#8b5cf6', '#eab308'].map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-preset ${markerColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setMarkerColor(color)}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Photos</label>
            <div className="photo-upload-section">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
                id="photo-upload"
              />
              <label htmlFor="photo-upload" className="upload-button">
                Add Photos
              </label>
              <span className="photo-hint">Up to 5MB per photo</span>
            </div>

            {photos.length > 0 && (
              <div className="photo-grid">
                {photos.map(photo => (
                  <div key={photo.id} className="photo-item">
                    <img src={photo.data} alt="Observation" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="remove-photo-button"
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            {observation && observation.id && (
              <button
                type="button"
                onClick={handleDeleteObservation}
                className="btn-delete"
              >
                Delete
              </button>
            )}
            <div className="right-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ObservationModal
