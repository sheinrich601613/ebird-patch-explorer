/**
 * Development utilities for debugging
 * Only active in development mode
 */

const STORAGE_KEY = 'patch-explorer-patches'
const EBIRD_STORAGE_KEY = 'patch-explorer-ebird-data'

/**
 * Clear localStorage and reload the page
 */
export function clearStorageAndReload() {
  if (import.meta.env.DEV) {
    console.log('🗑️ Clearing localStorage...')
    localStorage.clear()
    console.log('✅ localStorage cleared')
    console.log('🔄 Reloading...')
    window.location.reload()
  }
}

/**
 * Clear only eBird data from patches (keep patch definitions)
 */
export function clearEBirdData() {
  if (import.meta.env.DEV) {
    try {
      // Clear the raw eBird observations store
      localStorage.removeItem(EBIRD_STORAGE_KEY)

      // Clear ebirdData from each patch
      const patches = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      const cleaned = patches.map(p => {
        const { ebirdData, ...rest } = p
        return rest
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
      console.log('🗑️ eBird data cleared from all patches and observation store')
      console.log('🔄 Reloading...')
      window.location.reload()
    } catch (error) {
      console.error('Failed to clear eBird data:', error)
    }
  }
}

/**
 * Show current localStorage state
 */
export function inspectStorage() {
  if (import.meta.env.DEV) {
    console.group('📦 localStorage Inspector')
    console.log('Total keys:', Object.keys(localStorage).length)

    Object.keys(localStorage).forEach(key => {
      const value = localStorage.getItem(key)
      const size = new Blob([value]).size
      console.log(`\n${key}:`)
      console.log(`  Size: ${(size / 1024).toFixed(2)} KB`)

      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          console.log(`  Type: Array (${parsed.length} items)`)
        } else {
          console.log(`  Type: Object`)
          console.log(`  Keys:`, Object.keys(parsed))
        }
      } catch {
        console.log(`  Type: String`)
      }
    })
    console.groupEnd()
  }
}

/**
 * Set up keyboard shortcuts for dev tools
 * Ctrl+Shift+L: Clear localStorage and reload
 * Ctrl+Shift+E: Clear eBird data only
 * Ctrl+Shift+I: Inspect localStorage
 */
export function setupDevKeyboardShortcuts() {
  if (import.meta.env.DEV) {
    document.addEventListener('keydown', (e) => {
      // Skip if typing in an input
      if (e.target.matches('input, textarea')) return

      // Ctrl+Shift+L: Clear all localStorage
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        if (confirm('Clear ALL localStorage and reload?')) {
          clearStorageAndReload()
        }
      }

      // Ctrl+Shift+E: Clear eBird data only
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        if (confirm('Clear eBird data from all patches?')) {
          clearEBirdData()
        }
      }

      // Ctrl+Shift+I: Inspect storage
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        inspectStorage()
      }
    })

    console.log(
      '%c🔧 Dev Tools Active',
      'background: #2c5f2d; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
    )
    console.log('Keyboard shortcuts:')
    console.log('  Ctrl+Shift+L - Clear localStorage & reload')
    console.log('  Ctrl+Shift+E - Clear eBird data only')
    console.log('  Ctrl+Shift+I - Inspect localStorage')
  }
}
