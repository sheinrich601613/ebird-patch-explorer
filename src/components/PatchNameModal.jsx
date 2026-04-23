import { useState, useEffect, useRef } from 'react'
import './PatchNameModal.css'

function PatchNameModal({ isOpen, onClose, onSave, defaultName }) {
  const [name, setName] = useState(defaultName || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isOpen])

  useEffect(() => {
    setName(defaultName || '')
  }, [defaultName])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) {
      onSave(name.trim())
      setName('')
    }
  }

  const handleCancel = () => {
    setName('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Name Your Patch</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="patch-name">Patch Name</label>
            <input
              ref={inputRef}
              id="patch-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Central Park North Woods"
              maxLength={50}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={handleCancel} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PatchNameModal
