// One-off helper: April holds hand-picked accent/tint per picture. Because the day images were
// shuffled, the same picture sits on a different day in every month, so the colours can only be
// matched by image CONTENT, not by day number. This maps April's picture -> accent/tint and applies
// it to the other four months, changing nothing else.
//
//   node tools/apply-month-colors.js [--write]
//
const fs = require('fs')
const crypto = require('crypto')

const CONFIG = 'data/bg-default.json'
const SOURCE = 'april'
const TARGETS = ['may', 'june', 'july', 'august']
const write = process.argv.includes('--write')

const raw = fs.readFileSync(CONFIG, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const trailingNewline = raw.endsWith('\n')
const cfg = JSON.parse(raw)

// content hash, so two copies of the same picture match even across folders
const hashOf = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')

const keyOf = {}
for (const [k, v] of Object.entries(cfg.months)) keyOf[String(v.name).toLowerCase()] = k

const daysOf = name => cfg.months[keyOf[name]].days

// 1. the reference map, from the hand-picked month
const map = new Map()
const conflicts = []
for (const [day, entry] of Object.entries(daysOf(SOURCE))) {
  if (!entry.image || !fs.existsSync(entry.image)) { console.log('ABORT: ' + SOURCE + ' day ' + day + ' has no image on disk'); process.exit(1) }
  if (entry.accentColor === undefined || entry.tint === undefined) { console.log('ABORT: ' + SOURCE + ' day ' + day + ' has no accent/tint'); process.exit(1) }
  const h = hashOf(entry.image)
  const prev = map.get(h)
  if (prev && (prev.accentColor !== entry.accentColor || prev.tint !== entry.tint)) {
    conflicts.push(SOURCE + '/' + prev.day + ' vs ' + SOURCE + '/' + day)
  } else if (!prev) {
    map.set(h, { accentColor: entry.accentColor, tint: entry.tint, day })
  }
}
console.log('reference: ' + SOURCE + ' -> ' + map.size + ' distinct pictures')
if (conflicts.length) { console.log('ABORT: same picture given different colours in ' + SOURCE + ': ' + conflicts.join(', ')); process.exit(1) }

// 2. every picture in the target months must be covered, or nothing is written
const uncovered = []
for (const m of TARGETS) for (const [day, entry] of Object.entries(daysOf(m))) if (!map.has(hashOf(entry.image))) uncovered.push(m + '/' + day)
if (uncovered.length) { console.log('ABORT: ' + uncovered.length + ' days have a picture absent from ' + SOURCE + ': ' + uncovered.slice(0, 8).join(', ')); process.exit(1) }

// 3. apply, preserving the existing key order and every other field
let changed = 0
const perMonth = {}
for (const m of TARGETS) {
  const days = daysOf(m)
  let n = 0
  for (const [day, entry] of Object.entries(days)) {
    const want = map.get(hashOf(entry.image))
    if (entry.accentColor === want.accentColor && entry.tint === want.tint) continue
    const next = {}
    for (const k of Object.keys(entry)) next[k] = k === 'accentColor' ? want.accentColor : k === 'tint' ? want.tint : entry[k]
    if (!('accentColor' in next)) next.accentColor = want.accentColor
    if (!('tint' in next)) next.tint = want.tint
    days[day] = next
    n++; changed++
  }
  perMonth[m] = n
}
for (const m of TARGETS) console.log('  ' + m.padEnd(7) + perMonth[m] + ' of ' + Object.keys(daysOf(m)).length + ' days updated')
console.log('total days updated: ' + changed)

if (!write) { console.log('\n(dry run - pass --write to save)'); process.exit(0) }

const out = JSON.stringify(cfg, null, 2) + (trailingNewline ? '\n' : '')
if (eol === '\r\n') fs.writeFileSync(CONFIG, out.replace(/\n/g, '\r\n'))
else fs.writeFileSync(CONFIG, out)
console.log('written to ' + CONFIG + ' (indent 2, eol ' + (eol === '\r\n' ? 'CRLF' : 'LF') + ')')
