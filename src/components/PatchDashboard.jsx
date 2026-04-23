import { useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import './PatchDashboard.css'

// Helper functions
const formatMonthLabel = (monthNumber) => {
  const date = new Date(2000, monthNumber - 1) // Use arbitrary year
  return date.toLocaleDateString('en-US', { month: 'short' })
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const [year, month, day] = dateString.split('-')
  if (!year || !month || !day) return 'Unknown'
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function PatchDashboard({ patch, onClose }) {
  const [sortBy, setSortBy] = useState('taxonomic') // 'taxonomic', 'recentlyAdded', 'lastSeen', 'observations', 'individuals', 'maxCount', 'frequency'
  const [sortReverse, setSortReverse] = useState(false)
  const [chartView, setChartView] = useState('month') // 'month', 'year', or 'season'

  const stats = useMemo(() => {
    if (!patch.ebirdData || !patch.ebirdData.species) {
      return {
        totalSpecies: 0,
        totalObservations: 0,
        recentAddition: null,
        monthlyData: []
      }
    }

    const species = patch.ebirdData.species
    const totalSpecies = species.length
    const totalObservations = patch.ebirdData.totalObservations || 0
    const totalChecklists = patch.ebirdData.totalChecklists || 0

    // Enrich species data with additional metrics
    const enrichedSpecies = species.map(sp => {
      const observations = sp.allDates ? sp.allDates.length : 1

      // Calculate total individuals and max count: sum/max all numeric counts, treating X as 0
      let totalIndividuals = 0
      let maxCount = 0
      let maxCountSubid = null

      if (sp.allObservations && Array.isArray(sp.allObservations)) {
        sp.allObservations.forEach(obs => {
          if (obs.count === 'X' || obs.count === 'x') return
          const numCount = parseInt(obs.count, 10)
          if (!isNaN(numCount)) {
            totalIndividuals += numCount
            if (numCount > maxCount) {
              maxCount = numCount
              maxCountSubid = obs.subid
            }
          }
        })
      }

      const frequency = totalChecklists > 0 && sp.allSubids
        ? (sp.allSubids.length / totalChecklists) * 100
        : 0

      let lastSeen = sp.date || null
      let lastSeenSubid = null
      if (sp.allObservations && sp.allObservations.length > 0) {
        const latest = sp.allObservations.reduce((best, obs) =>
          obs.date > best.date ? obs : best
        )
        lastSeen = latest.date
        lastSeenSubid = latest.subid
      }

      return {
        ...sp,
        observations,
        totalIndividuals,
        maxCount,
        maxCountSubid,
        frequency,
        lastSeen,
        lastSeenSubid
      }
    })

    // Find most recent species addition (species with most recent FIRST sighting date)
    // Note: .date is the first sighting date for each species, set during import
    const sortedByDate = [...species].sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    )
    const recentAddition = sortedByDate[0] || null

    // Calculate unique species per month (across all years)
    const speciesPerMonth = {} // month -> Set of species

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

    // Create array with all 12 months showing unique species count
    const monthlyData = []
    for (let month = 1; month <= 12; month++) {
      const uniqueSpeciesCount = speciesPerMonth[month] ? speciesPerMonth[month].size : 0
      monthlyData.push({
        month: formatMonthLabel(month),
        count: uniqueSpeciesCount,
        sortKey: month
      })
    }

    // Year-over-year comparison
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

    // Top 5 birding days
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

    // Seasonal species count
    const speciesPerSeason = {
      'Spring': new Set(),
      'Summer': new Set(),
      'Fall': new Set(),
      'Winter': new Set()
    }

    species.forEach(speciesRecord => {
      const dates = speciesRecord.allDates || [speciesRecord.date]
      dates.forEach(dateStr => {
        if (!dateStr) return
        const month = parseInt(dateStr.split('-')[1], 10)
        if (!month) return

        let season
        if (month >= 3 && month <= 5) season = 'Spring'
        else if (month >= 6 && month <= 8) season = 'Summer'
        else if (month >= 9 && month <= 11) season = 'Fall'
        else season = 'Winter'

        speciesPerSeason[season].add(speciesRecord.species)
      })
    })

    const seasonalData = [
      { season: 'Winter', count: speciesPerSeason['Winter'].size },
      { season: 'Spring', count: speciesPerSeason['Spring'].size },
      { season: 'Summer', count: speciesPerSeason['Summer'].size },
      { season: 'Fall', count: speciesPerSeason['Fall'].size }
    ]

    return {
      totalSpecies,
      totalObservations,
      totalChecklists,
      recentAddition,
      monthlyData,
      yearlyData,
      seasonalData,
      topDays,
      enrichedSpecies
    }
  }, [patch])

  if (!patch.ebirdData || stats.totalSpecies === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content dashboard-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{patch.name}</h2>
            <button onClick={onClose} className="close-button">✕</button>
          </div>
          <div className="no-data">
            <p>No eBird data for this patch yet.</p>
            <p className="help-text">Import your eBird data to see statistics and charts!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dashboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{patch.name}</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card stat-primary">
              <div className="stat-value">{stats.totalSpecies}</div>
              <div className="stat-label">Total Species</div>
              <div className="stat-sublabel">All-Time</div>
            </div>

            <div className="stat-card stat-secondary">
              <div className="stat-value">{stats.totalObservations}</div>
              <div className="stat-label">Observations</div>
              <div className="stat-sublabel">Total Records</div>
            </div>

            <div className="stat-card stat-secondary">
              <div className="stat-value">{stats.totalChecklists}</div>
              <div className="stat-label">Checklists</div>
              <div className="stat-sublabel">Total Submitted</div>
            </div>
          </div>

          {stats.recentAddition && (
            <div className="recent-addition">
              <h3>Most Recent Addition</h3>
              {stats.recentAddition.subid ? (
                <a
                  href={`https://ebird.org/checklist/${stats.recentAddition.subid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="addition-card addition-card-link"
                >
                  <div className="addition-info">
                    <div className="addition-species">{stats.recentAddition.species}</div>
                    <div className="addition-date">{formatDate(stats.recentAddition.date)}</div>
                  </div>
                  <div className="addition-arrow">→</div>
                </a>
              ) : (
                <div className="addition-card">
                  <div className="addition-species">{stats.recentAddition.species}</div>
                  <div className="addition-date">{formatDate(stats.recentAddition.date)}</div>
                </div>
              )}
            </div>
          )}

          {(stats.topDays.length > 0 || (patch.ebirdData.topChecklists && patch.ebirdData.topChecklists.length > 0)) && (
            <div className="top-section-grid">
              {stats.topDays.length > 0 && (
                <div className="chart-section">
                  <h3>Top Birding Days</h3>
                  <div className="top-days-list">
                    {stats.topDays.map((day, index) => (
                      <div key={index} className="top-day-item">
                        <div className="top-day-rank">#{index + 1}</div>
                        <div className="top-day-info">
                          <div className="top-day-date">{formatDate(day.date)}</div>
                          <div className="top-day-count">{day.count} species</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {patch.ebirdData.topChecklists && patch.ebirdData.topChecklists.length > 0 && (
                <div className="chart-section">
                  <h3>Top Checklists</h3>
                  <div className="top-checklists-list">
                    {patch.ebirdData.topChecklists.map((checklist, index) => (
                      <a
                        key={checklist.subid}
                        href={`https://ebird.org/checklist/${checklist.subid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="checklist-item"
                      >
                        <div className="checklist-rank">#{index + 1}</div>
                        <div className="checklist-info">
                          <div className="checklist-species-count">{checklist.speciesCount} species</div>
                          <div className="checklist-date">{formatDate(checklist.date)}</div>
                        </div>
                        <div className="checklist-arrow">→</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="chart-section">
            <div className="chart-section-header">
              <h3>
                {chartView === 'month' && 'Species by Month'}
                {chartView === 'year' && 'Species by Year'}
                {chartView === 'season' && 'Species by Season'}
              </h3>
              <div className="chart-toggle">
                <button
                  className={chartView === 'month' ? 'active' : ''}
                  onClick={() => setChartView('month')}
                >
                  Month
                </button>
                <button
                  className={chartView === 'year' ? 'active' : ''}
                  onClick={() => setChartView('year')}
                >
                  Year
                </button>
                <button
                  className={chartView === 'season' ? 'active' : ''}
                  onClick={() => setChartView('season')}
                >
                  Season
                </button>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                {chartView === 'month' && (
                  <BarChart data={stats.monthlyData}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      formatter={(value) => [`${value} species`, 'Count']}
                    />
                    <Bar
                      dataKey="count"
                      fill="#40718f"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
                {chartView === 'year' && (
                  <BarChart data={stats.yearlyData}>
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      formatter={(value) => [`${value} species`, 'Count']}
                    />
                    <Bar
                      dataKey="count"
                      fill="#40718f"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
                {chartView === 'season' && (
                  <BarChart data={stats.seasonalData}>
                    <XAxis
                      dataKey="season"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      formatter={(value) => [`${value} species`, 'Count']}
                    />
                    <Bar
                      dataKey="count"
                      fill="#40718f"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {stats.enrichedSpecies && stats.enrichedSpecies.length > 0 && (
            <div className="species-list-section">
              <h3>Species List ({stats.enrichedSpecies.length})</h3>
              <div className="species-list-table">
                <div className="species-list-header-row">
                  <span
                    className={`col-header col-species ${sortBy === 'taxonomic' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'taxonomic') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('taxonomic')
                        setSortReverse(false)
                      }
                    }}
                  >
                    Species {sortBy === 'taxonomic' && (sortReverse ? '↓' : '↑')}
                  </span>
                  <span
                    className={`col-header col-date ${sortBy === 'recentlyAdded' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'recentlyAdded') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('recentlyAdded')
                        setSortReverse(false)
                      }
                    }}
                  >
                    First {sortBy === 'recentlyAdded' && (sortReverse ? '↓' : '↑')}
                  </span>
                  <span
                    className={`col-header col-date ${sortBy === 'lastSeen' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'lastSeen') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('lastSeen')
                        setSortReverse(false)
                      }
                    }}
                  >
                    Last {sortBy === 'lastSeen' && (sortReverse ? '↓' : '↑')}
                  </span>
                  <span
                    className={`col-header col-obs ${sortBy === 'observations' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'observations') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('observations')
                        setSortReverse(false)
                      }
                    }}
                  >
                    Obs {sortBy === 'observations' && (sortReverse ? '↓' : '↑')}
                  </span>
                  <span
                    className={`col-header col-indiv ${sortBy === 'individuals' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'individuals') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('individuals')
                        setSortReverse(false)
                      }
                    }}
                  >
                    Indiv {sortBy === 'individuals' && (sortReverse ? '↓' : '↑')}
                  </span>
                  <span
                    className={`col-header col-max ${sortBy === 'maxCount' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'maxCount') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('maxCount')
                        setSortReverse(false)
                      }
                    }}
                  >
                    High {sortBy === 'maxCount' && (sortReverse ? '↓' : '↑')}
                  </span>
                  <span
                    className={`col-header col-freq ${sortBy === 'frequency' ? 'active' : ''}`}
                    onClick={() => {
                      if (sortBy === 'frequency') {
                        setSortReverse(!sortReverse)
                      } else {
                        setSortBy('frequency')
                        setSortReverse(false)
                      }
                    }}
                  >
                    Freq {sortBy === 'frequency' && (sortReverse ? '↓' : '↑')}
                  </span>
                </div>
                {stats.enrichedSpecies
                  .sort((a, b) => {
                    let result
                    if (sortBy === 'taxonomic') {
                      result = (a.taxonOrder || 999999) - (b.taxonOrder || 999999)
                    } else if (sortBy === 'recentlyAdded') {
                      result = new Date(b.date) - new Date(a.date)
                    } else if (sortBy === 'lastSeen') {
                      result = new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0)
                    } else if (sortBy === 'observations') {
                      result = b.observations - a.observations
                    } else if (sortBy === 'individuals') {
                      result = b.totalIndividuals - a.totalIndividuals
                    } else if (sortBy === 'maxCount') {
                      result = b.maxCount - a.maxCount
                    } else if (sortBy === 'frequency') {
                      result = b.frequency - a.frequency
                    }
                    return sortReverse ? -result : result
                  })
                  .map((sp, index) => (
                    <div key={index} className="species-item-row">
                      <span className="col-species">{sp.species}</span>
                      {sp.subid ? (
                        <a
                          href={`https://ebird.org/checklist/${sp.subid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="col-date"
                        >
                          {formatDate(sp.date)}
                        </a>
                      ) : (
                        <span className="col-date">{formatDate(sp.date)}</span>
                      )}
                      {sp.lastSeenSubid ? (
                        <a
                          href={`https://ebird.org/checklist/${sp.lastSeenSubid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="col-date"
                        >
                          {formatDate(sp.lastSeen)}
                        </a>
                      ) : (
                        <span className="col-date">{formatDate(sp.lastSeen)}</span>
                      )}
                      <span className="col-obs">{sp.observations}</span>
                      <span className="col-indiv">{sp.totalIndividuals}</span>
                      {sp.maxCountSubid ? (
                        <a
                          href={`https://ebird.org/checklist/${sp.maxCountSubid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="col-max"
                        >
                          {sp.maxCount}
                        </a>
                      ) : (
                        <span className="col-max">{sp.maxCount}</span>
                      )}
                      <span className="col-freq">{sp.frequency.toFixed(1)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PatchDashboard
