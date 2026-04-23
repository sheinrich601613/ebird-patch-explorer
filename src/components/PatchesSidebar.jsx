import { useState } from 'react'
import './PatchesSidebar.css'

function PatchesSidebar({ patches, selectedPatchId, onPatchClick, onPatchRename, onPatchDelete, onShowDashboard, onPatchEdit, onEditCancel, editingPatchId, showEBirdLocations, onToggleEBirdLocations }) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const handleEditStart = (patch) => {
    setEditingId(patch.id)
    setEditName(patch.name)
  }

  const handleEditSave = (id) => {
    if (editName.trim()) {
      onPatchRename(id, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditName('')
  }

  const formatDate = (isoString) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const calculateArea = (coordinates) => {
    // Simple approximation - calculate area in km²
    // This is a rough calculation using the shoelace formula
    if (coordinates.length < 3) return 0

    let area = 0
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length
      area += coordinates[i].lng * coordinates[j].lat
      area -= coordinates[j].lng * coordinates[i].lat
    }
    area = Math.abs(area / 2)

    // Convert to approximate km² (very rough)
    const km2 = area * 12364 // rough conversion factor
    return km2.toFixed(2)
  }

  return (
    <div className="patches-sidebar">
      <div className="sidebar-header">
        <h2>My Patches</h2>
        <span className="patch-count">{patches.length} {patches.length === 1 ? 'patch' : 'patches'}</span>
      </div>

      {patches.length === 0 ? (
        <div className="empty-state">
          <p>No patches defined yet.</p>
          <p className="help-text">Click the polygon or circle tool on the map to create your first patch.</p>
        </div>
      ) : (
        <div className="patches-list">
          {patches.map((patch) => (
            <div key={patch.id} className={`patch-card ${selectedPatchId === patch.id ? 'patch-card-selected' : ''}`}>
              {editingId === patch.id ? (
                <div className="patch-edit">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave(patch.id)
                      if (e.key === 'Escape') handleEditCancel()
                    }}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button onClick={() => handleEditSave(patch.id)} className="btn-save">
                      Save
                    </button>
                    <button onClick={handleEditCancel} className="btn-cancel">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="patch-header" onClick={() => onPatchClick(patch)}>
                    <h3
                      onDoubleClick={patch.type === 'world' ? undefined : (e) => {
                        e.stopPropagation()
                        handleEditStart(patch)
                      }}
                      title={patch.type === 'world' ? undefined : "Double-click to rename"}
                    >
                      {patch.name}
                    </h3>
                    <div className="patch-meta">
                      {patch.type !== 'world' && (
                        <span className="patch-date">{formatDate(patch.createdAt)}</span>
                      )}
                      {patch.type === 'circle' ? (
                        <span className="patch-radius">
                          {patch.radius >= 1609.344
                            ? `${(patch.radius / 1609.344).toFixed(1)} mi radius`
                            : `${Math.round(patch.radius * 3.28084)} ft radius`}
                        </span>
                      ) : patch.type !== 'world' && (
                        <span className="patch-vertices">{patch.coordinates?.length || 0} vertices</span>
                      )}
                      {patch.ebirdData && patch.ebirdData.totalSpecies > 0 && (
                        <span className="patch-ebird-species">
                          {patch.ebirdData.totalSpecies} {patch.ebirdData.totalSpecies === 1 ? 'species' : 'species'}
                        </span>
                      )}
                      {patch.observations && patch.observations.length > 0 && (
                        <span className="patch-observations">
                          {patch.observations.length} {patch.observations.length === 1 ? 'observation' : 'observations'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="patch-actions patch-actions-grid">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onShowDashboard(patch)
                      }}
                      className="btn-icon btn-dashboard"
                      title="View dashboard"
                    >
                      Stats
                    </button>
                    {patch.ebirdData && patch.ebirdData.checklistLocations && patch.ebirdData.checklistLocations.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleEBirdLocations(patch.id)
                        }}
                        className={`btn-icon ${showEBirdLocations.has(patch.id) ? 'btn-pins-active' : 'btn-pins'}`}
                        title={showEBirdLocations.has(patch.id) ? "Hide checklist locations" : "Show checklist locations"}
                      >
                        Pins
                      </button>
                    ) : (
                      <span className="btn-icon btn-placeholder" />
                    )}
                    {patch.type !== 'world' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onPatchEdit(editingPatchId === patch.id ? null : patch.id)
                          }}
                          className={`btn-icon ${editingPatchId === patch.id ? 'btn-editing' : ''}`}
                          title={editingPatchId === patch.id ? "Save changes" : "Edit patch boundaries"}
                        >
                          {editingPatchId === patch.id ? 'Save' : 'Edit'}
                        </button>
                        {editingPatchId === patch.id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditCancel()
                            }}
                            className="btn-icon btn-cancel"
                            title="Cancel editing and revert changes"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onPatchDelete(patch.id)
                            }}
                            className="btn-icon btn-delete-icon"
                            title="Delete patch"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PatchesSidebar
