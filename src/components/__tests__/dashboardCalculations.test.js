import { describe, it, expect } from 'vitest'

// Helper to simulate dashboard stats calculation
function calculateDashboardStats(species) {
  if (!species || species.length === 0) {
    return {
      totalSpecies: 0,
      cumulativeData: [],
      yearlyData: [],
      topDays: [],
      monthlyData: []
    }
  }

  // Cumulative species curve
  const firstSightingsByDate = {}
  species.forEach(speciesRecord => {
    const dateStr = speciesRecord.date
    if (!dateStr) return
    if (!firstSightingsByDate[dateStr]) {
      firstSightingsByDate[dateStr] = []
    }
    firstSightingsByDate[dateStr].push(speciesRecord.species)
  })

  const sortedDates = Object.keys(firstSightingsByDate).sort((a, b) =>
    new Date(a) - new Date(b)
  )

  const cumulativeData = []
  const seenSpecies = new Set()

  sortedDates.forEach(dateStr => {
    firstSightingsByDate[dateStr].forEach(sp => seenSpecies.add(sp))
    cumulativeData.push({
      date: dateStr,
      count: seenSpecies.size
    })
  })

  // Year-over-year
  const speciesPerYear = {}
  species.forEach(speciesRecord => {
    const dates = speciesRecord.allDates || [speciesRecord.date]
    dates.forEach(dateStr => {
      if (!dateStr) return
      const year = dateStr.split('-')[0]
      if (!year) return
      if (!speciesPerYear[year]) {
        speciesPerYear[year] = new Set()
      }
      speciesPerYear[year].add(speciesRecord.species)
    })
  })

  const yearlyData = Object.entries(speciesPerYear)
    .map(([year, speciesSet]) => ({
      year,
      count: speciesSet.size
    }))
    .sort((a, b) => a.year.localeCompare(b.year))

  // Top days
  const speciesByDate = {}
  species.forEach(speciesRecord => {
    const dates = speciesRecord.allDates || [speciesRecord.date]
    dates.forEach(dateStr => {
      if (!dateStr) return
      if (!speciesByDate[dateStr]) {
        speciesByDate[dateStr] = new Set()
      }
      speciesByDate[dateStr].add(speciesRecord.species)
    })
  })

  const topDays = Object.entries(speciesByDate)
    .map(([date, speciesSet]) => ({
      date,
      count: speciesSet.size
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Monthly aggregation
  const speciesPerMonth = {}
  species.forEach(speciesRecord => {
    const dates = speciesRecord.allDates || [speciesRecord.date]
    dates.forEach(dateStr => {
      if (!dateStr) return
      const monthNumber = parseInt(dateStr.split('-')[1], 10)
      if (!monthNumber) return
      if (!speciesPerMonth[monthNumber]) {
        speciesPerMonth[monthNumber] = new Set()
      }
      speciesPerMonth[monthNumber].add(speciesRecord.species)
    })
  })

  const monthlyData = []
  for (let month = 1; month <= 12; month++) {
    monthlyData.push({
      month,
      count: speciesPerMonth[month] ? speciesPerMonth[month].size : 0
    })
  }

  return {
    totalSpecies: species.length,
    cumulativeData,
    yearlyData,
    topDays,
    monthlyData
  }
}

describe('Dashboard Calculations', () => {
  describe('Cumulative Species Curve', () => {
    it('should handle normal species growth', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'B', date: '2023-02-01', allDates: ['2023-02-01'] },
        { species: 'C', date: '2023-03-01', allDates: ['2023-03-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.cumulativeData).toEqual([
        { date: '2023-01-01', count: 1 },
        { date: '2023-02-01', count: 2 },
        { date: '2023-03-01', count: 3 }
      ])
    })

    it('should aggregate multiple species on same day', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'B', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'C', date: '2023-02-01', allDates: ['2023-02-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.cumulativeData).toEqual([
        { date: '2023-01-01', count: 2 },
        { date: '2023-02-01', count: 3 }
      ])
    })

    it('should handle single species', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.cumulativeData).toEqual([
        { date: '2023-01-01', count: 1 }
      ])
    })

    it('should sort dates chronologically', () => {
      const species = [
        { species: 'A', date: '2023-03-01', allDates: ['2023-03-01'] },
        { species: 'B', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'C', date: '2023-02-01', allDates: ['2023-02-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.cumulativeData[0].date).toBe('2023-01-01')
      expect(stats.cumulativeData[1].date).toBe('2023-02-01')
      expect(stats.cumulativeData[2].date).toBe('2023-03-01')
    })
  })

  describe('Year-over-Year Comparison', () => {
    it('should handle single year', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'B', date: '2023-02-01', allDates: ['2023-02-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.yearlyData).toEqual([
        { year: '2023', count: 2 }
      ])
    })

    it('should handle multiple years', () => {
      const species = [
        { species: 'A', date: '2022-01-01', allDates: ['2022-01-01', '2023-01-01'] },
        { species: 'B', date: '2023-02-01', allDates: ['2023-02-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.yearlyData).toEqual([
        { year: '2022', count: 1 },
        { year: '2023', count: 2 }
      ])
    })

    it('should count species once per year even with multiple observations', () => {
      const species = [
        {
          species: 'A',
          date: '2023-01-01',
          allDates: ['2023-01-01', '2023-02-01', '2023-03-01']
        }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.yearlyData).toEqual([
        { year: '2023', count: 1 }
      ])
    })
  })

  describe('Top Birding Days', () => {
    it('should rank days by species count', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'B', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'C', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'D', date: '2023-02-01', allDates: ['2023-02-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.topDays[0]).toEqual({ date: '2023-01-01', count: 3 })
      expect(stats.topDays[1]).toEqual({ date: '2023-02-01', count: 1 })
    })

    it('should return maximum 5 days', () => {
      const species = Array(10).fill(0).map((_, i) => ({
        species: `Species ${i}`,
        date: `2023-01-${String(i + 1).padStart(2, '0')}`,
        allDates: [`2023-01-${String(i + 1).padStart(2, '0')}`]
      }))

      const stats = calculateDashboardStats(species)

      expect(stats.topDays.length).toBeLessThanOrEqual(5)
    })

    it('should handle fewer than 5 days', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] },
        { species: 'B', date: '2023-02-01', allDates: ['2023-02-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.topDays.length).toBe(2)
    })
  })

  describe('Monthly Species Aggregation', () => {
    it('should aggregate species by month across years', () => {
      const species = [
        { species: 'A', date: '2022-01-01', allDates: ['2022-01-15', '2023-01-20'] },
        { species: 'B', date: '2023-01-01', allDates: ['2023-01-10'] }
      ]

      const stats = calculateDashboardStats(species)

      // January should have 2 unique species
      expect(stats.monthlyData[0]).toEqual({ month: 1, count: 2 })
    })

    it('should return all 12 months', () => {
      const species = [
        { species: 'A', date: '2023-01-01', allDates: ['2023-01-01'] }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.monthlyData.length).toBe(12)
    })

    it('should return 0 for months with no species', () => {
      const species = [
        { species: 'A', date: '2023-06-01', allDates: ['2023-06-01'] }
      ]

      const stats = calculateDashboardStats(species)

      // January should be 0
      expect(stats.monthlyData[0]).toEqual({ month: 1, count: 0 })
      // June should be 1
      expect(stats.monthlyData[5]).toEqual({ month: 6, count: 1 })
    })

    it('should count species once per month even with multiple observations', () => {
      const species = [
        {
          species: 'A',
          date: '2023-01-01',
          allDates: ['2023-01-01', '2023-01-15', '2023-01-30']
        }
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.monthlyData[0]).toEqual({ month: 1, count: 1 })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty species array', () => {
      const stats = calculateDashboardStats([])

      expect(stats.totalSpecies).toBe(0)
      expect(stats.cumulativeData).toEqual([])
      expect(stats.yearlyData).toEqual([])
      expect(stats.topDays).toEqual([])
      expect(stats.monthlyData).toEqual([])
    })

    it('should handle null species', () => {
      const stats = calculateDashboardStats(null)

      expect(stats.totalSpecies).toBe(0)
    })

    it('should handle missing allDates (fallback to date)', () => {
      const species = [
        { species: 'A', date: '2023-01-01' } // No allDates
      ]

      const stats = calculateDashboardStats(species)

      expect(stats.monthlyData[0].count).toBe(1)
      expect(stats.yearlyData[0].count).toBe(1)
    })
  })
})
