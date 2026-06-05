#!/usr/bin/env node
// Fetches per-game stats CSVs from Basketball Reference for each season,
// extracts player name + team abbreviation, and writes a merged CSV.
// Run: node scrape-bball-ref.js
// Output: player_teams_bref.csv

const https = require('https')
const fs = require('fs')

const START_YEAR = 2010
const END_YEAR = 2025
const OUT_FILE = 'player_teams_bref.csv'
const DELAY_MS = 4000 // Stay well under their 20 req/min limit

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.basketball-reference.com/',
      }
    }
    https.get(url, opts, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    }).on('error', reject)
  })
}

// Basketball Reference embeds CSV data in an export link.
// The per-game table id is "per_game_stats".
function extractPlayerTeams(html, season) {
  const results = new Map() // "name|team" -> true (dedup)

  // Find the table — it may be inside an HTML comment
  let tableHtml = html
  const commentMatch = html.match(/<!--([\s\S]*?id="per_game_stats"[\s\S]*?)-->/)
  if (commentMatch) tableHtml = commentMatch[1]

  // Extract rows: look for <td data-stat="player"> and <td data-stat="team_id">
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const row = rowMatch[1]
    const playerMatch = row.match(/data-stat="player"[^>]*>(?:<[^>]+>)*([^<]+)/)
    const teamMatch = row.match(/data-stat="team_id"[^>]*>(?:<[^>]+>)*([A-Z]{2,3})/)
    if (playerMatch && teamMatch) {
      const name = playerMatch[1].trim()
      const team = teamMatch[1].trim()
      if (name && team && team !== 'TOT' && name !== 'Player') {
        results.set(`${name}|||${team}`, { name, team, season })
      }
    }
  }
  return [...results.values()]
}

async function main() {
  console.log(`Fetching Basketball Reference data for ${START_YEAR}–${END_YEAR}...`)
  console.log(`Output: ${OUT_FILE}\n`)

  // name -> Set of teams
  const playerTeams = new Map()

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const url = `https://www.basketball-reference.com/leagues/NBA_${year}_per_game.html`
    process.stdout.write(`Season ${year-1}-${year}... `)

    try {
      const { status, body } = await fetch(url)
      if (status !== 200) {
        console.log(`HTTP ${status} — skipping`)
        await sleep(DELAY_MS * 2)
        continue
      }

      const rows = extractPlayerTeams(body, year)
      let newPairs = 0
      for (const { name, team } of rows) {
        if (!playerTeams.has(name)) playerTeams.set(name, new Set())
        const before = playerTeams.get(name).size
        playerTeams.get(name).add(team)
        if (playerTeams.get(name).size > before) newPairs++
      }
      console.log(`${rows.length} rows, ${newPairs} new player-team pairs`)
    } catch (err) {
      console.log(`Error: ${err.message}`)
    }

    await sleep(DELAY_MS)
  }

  // Write output CSV
  const lines = ['name,teams']
  for (const [name, teams] of [...playerTeams.entries()].sort()) {
    lines.push(`"${name.replace(/"/g, '""')}","${[...teams].sort().join('|')}"`)
  }
  fs.writeFileSync(OUT_FILE, lines.join('\n'))

  console.log(`\nDone! ${playerTeams.size} players written to ${OUT_FILE}`)
  console.log(`Upload ${OUT_FILE} to Claude to import into Gridlore.`)
}

main().catch(console.error)
