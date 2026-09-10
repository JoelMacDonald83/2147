import { SCHEMA_VERSION, BOOK_ID, BOOK_FILES, BOOK_FILE_SHEETS, metaSchema, pageThemeSchema, groupRulesSchema, listSectionsOf, thingKeys } from "./schema.js"
import { FILE_NAMES, validateFile, validateBookFile, crossChecks } from "./validate.js"
// NEW: the one walk over every id position (engine/config/ids.js). bookRules reads its
// DEFINING half — see the note there. ids.js imports schema/query/visibility/demands and
// nothing else, so it is a leaf under this file and the graph stays acyclic.
import { eachId } from "./ids.js"

// The MERGE. A game used to be five files and nothing else; now it is the LAST
// layer of a stack. Under it sit the books it pins, each a folder on the shelf
// carrying the same shapes a game carries (types, things, and — the one shape
// only a book has — proposals). This file flattens that stack back into one
// plain, book-less v5 set: exactly what hydrate has always eaten, so the engine
// below the merge never learns that books exist.
//
// Three ideas carry the whole file.
//
//   1. LAYERS, in a computed order. A layer is one book (or the game). The order
//      is NOT the order the pins are written in — it is computed from `requires`
//      (Kahn's algorithm, ties broken by name), with the game always last. So
//      "the game's own stuff is its own book, loaded last" is literally true, and
//      re-ordering `content.books` cannot change what a player sees.
//
//   2. ADD-ONLY. A later layer may ADD (a new sheet, a section on someone's
//      sheet, a field in someone's section, things on someone's shelf, rows it
//      proposes). It may never EDIT or REMOVE what a lower layer defined. So an
//      id may be defined once, by one layer — which is what makes `origins`
//      (id → layer label) a total function and the editor's badges honest.
//
//   3. THE CASCADE. A book PROPOSES (rows, their min/max, a budget); the game
//      DECIDES. Per key, like CSS: a key the game wrote wins, an absent key lets
//      the proposal show through. Two books proposing DIFFERENT values for one
//      key is the one thing the merge cannot settle — so it says so out loud
//      (F13/F14), uses the first, and waits for the game to decide.
//
// Nothing here is silent. Every disagreement lands in `faults` as one
// { path, message } — the validator's own format, so the editor's banner, the
// server's refusal and the engine's console.warn all print the same sentence.
// A book with a fault OF ITS OWN is skipped WHOLE (fail closed): half a book is
// a cascade of dangling ids that hides the one cause.
//
// Pure, DOM-free, fetch-free, no work at import time: node runs it (the server,
// the export, the rebuild, the oracles) and the browser runs it (the engine at
// load, the editor at every paint). Inputs are never mutated — everything is
// structuredCloned on the way in, so the caller may keep (and freeze) its own.


// ── names, small helpers ─────────────────────────────────────────────────────

export const GAME_LAYER = "game"                                                  // the origin label of the game's own layer
export const bookLabel  = (manifest) => `${manifest.name} ${manifest.edition}`    // "basic 1" — the origin label of a book layer

const RULE_KEYS = groupRulesSchema.map(entry => entry.key)                        // ["min", "max"] — read from the sheet, never spelled twice
const SKIPPED   = "; the book is skipped"                                         // the tail every "this pin did not make it" sentence shares

const quoted   = (value) => JSON.stringify(value)                                 // "basic" — the validator's own way of showing a name
const bucketAt = (path, key) => `${path}[${JSON.stringify(key)}]`                 // cabinet/bucket coordinates: things.things["basic:place"]
const pinText  = (pin) => pin === null || pin === undefined ? "a pinned book" : `${quoted(pin.name)} ${pin.edition}`
// a, b and c — the one place a list of layer labels becomes English (F13)
const andList  = (list) => list.length < 2 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`
// an OWN property of a plain object, or undefined. Ids come from files, and a
// file may name a slot "__proto__" or "toString"; a bare lookup would answer
// with Object.prototype's member instead of the file's (validate.js refuses
// those ids, but the merge runs over unvalidated files too — loadData calls it).
const slotOf = (holder, key) => holder !== null && typeof holder === "object" && Object.hasOwn(holder, key) ? holder[key] : undefined
// the defaults of a sheet, as an object — emptyGame's meta and page, read from
// the schema rather than copied out of it
const defaultsOf = (sheet) => Object.fromEntries(sheet.map(entry => [entry.key, structuredClone(entry.default)]))

// The five files of a game with nothing in it. Two callers: validateBook (a book
// is merged against an empty game — it has no game) and the fixtures. Written
// key by key in the canonical order (§2.8) like every other writer, and note what
// is ABSENT: `rules.totalBudget` (a game that says nothing lets a book's proposal
// through) and `things.order` (nothing to arrange yet).
export const emptyGame = () => ({
  content: { version: SCHEMA_VERSION, meta: defaultsOf(metaSchema), books: [], groups: [], rowOverrides: {} },
  rules:   { version: SCHEMA_VERSION, groupRules: {} },
  themes:  { version: SCHEMA_VERSION, page: defaultsOf(pageThemeSchema), groupThemes: {} },
  types:   { version: SCHEMA_VERSION, types: [], sectionsFor: {}, fieldsFor: {} },
  things:  { version: SCHEMA_VERSION, things: {} }
})


// ── the shapes of a book, checked at the border ──────────────────────────────

// A loaded layer is { pin, manifest, types, things, proposals } with each data
// file null when it is not on disk (Basic and Stats ship only book.json +
// types.json). The merge is TOTAL — it never meets a shape it did not check — so
// every present file goes through the validator first and a book with a problem
// never reaches the union. Paths are the book's coordinates:
// books["stats"].types.fieldsFor["basic:nope"][0].id.
const bookShapeProblems = (layer) => {
  const name   = layer.pin?.name ?? layer.manifest?.name ?? ""
  const prefix = bucketAt("books", name) + "."
  const under  = (file, value) => validateBookFile(file, value).map(({ path, message }) => ({ path: prefix + path, message }))
  return [
    ...under("book", layer.manifest),
    ...BOOK_FILES.flatMap(file => layer[file] === null || layer[file] === undefined ? [] : under(file, layer[file]))
  ]
}


// ── step 0–2: who survives, and in what order (F1–F5, F2b) ───────────────────

// orderBooks answers one question — which of these loaded layers may take part,
// and in which order — and it answers it three times over:
//
//   step 0  SHAPES   a book whose own files are malformed is skipped (F2b)
//   step 1  PINS     a pin that loaded nothing (F1), or a book.json that
//                    disagrees with the folder the pin names (F2)
//   step 2  REQUIRES every entry of `requires` present at EXACTLY that edition
//                    among the survivors (F3/F4) — and no cycle (F5)
//
// Step 2 CASCADES: a book whose requirement was itself skipped is skipped too,
// which is why it loops to a fixpoint. That is the fail-closed rule: nothing of a
// book whose foundation is absent reaches the game. Loading it anyway would turn
// one cause ("Stats is not pinned") into a page of dangling-id faults.
//
// The ORDER is computed, never stored: repeatedly take the survivor whose
// requires are all placed, smallest name first (localeCompare). Because the
// answer is a function of the SET of pins, every permutation of `content.books`
// merges to the same thing — oracle K1.
//
// `options` is for the merge itself, which knows things this function cannot:
// where each pin is WRITTEN (`sites` — a null layer cannot name itself, the pin
// is the caller's), and whether the sentences should say "the book is skipped"
// at all (validateBook is judging one book, not a game's shelf).
export const orderBooks = (books, options = {}) => {
  const {
    sites          = books.map((layer, i) => ({ path: `content.books[${i}]`, pin: layer?.pin ?? null })),
    skippedSuffix  = SKIPPED,
    pinsPath       = "content.books",
    quietSubject   = false                       // book mode: the book under test is skipped without a second sentence
  } = options

  const faults  = []
  const skipped = []
  const alive   = []
  const drop = (site, layer, message, quiet = false) => {
    const fault = { path: site.path, message }
    if (!quiet) faults.push(fault)
    skipped.push({ pin: site.pin, layer, fault })
  }

  books.forEach((layer, i) => {
    const site = sites[i] ?? { path: `content.books[${i}]`, pin: layer?.pin ?? null }
    if (layer === null || layer === undefined) {                                  // F1: the folder or its book.json is not there
      drop(site, null, `${pinText(site.pin)} is not on the shelf${skippedSuffix}`)
      return
    }
    const shape = bookShapeProblems(layer)                                        // F2b: the validator's own sentences, then the tail on the FIRST
    if (shape.length > 0) {
      shape[0] = { path: shape[0].path, message: shape[0].message + skippedSuffix }
      faults.push(...shape)
      skipped.push({ pin: site.pin, layer, fault: shape[0] })
      return
    }
    const manifest = layer.manifest
    if (site.pin && (manifest.name !== site.pin.name || manifest.edition !== site.pin.edition)) {   // F2: the folder and the manifest disagree
      drop(site, layer, `${pinText(site.pin)} has a book.json that says ${quoted(manifest.name)} ${manifest.edition}${skippedSuffix}`)
      return
    }
    alive.push({ layer, site, subject: site.subject === true })
  })

  // step 2, to a fixpoint. Restarting the scan after every removal keeps the
  // faults in pin order and lets one missing book take its dependants with it.
  for (let changed = true; changed; ) {
    changed = false
    const byName = new Map(alive.map(entry => [entry.layer.manifest.name, entry]))
    for (const entry of alive) {
      const manifest = entry.layer.manifest
      const said = (message) => {
        drop(entry.site, entry.layer, message, quietSubject && entry.subject)
        alive.splice(alive.indexOf(entry), 1)
        changed = true
      }
      const unmet = (manifest.requires ?? []).find(req => byName.get(req.name) === undefined || byName.get(req.name).layer.manifest.edition !== req.edition)
      if (unmet === undefined) continue
      const have = byName.get(unmet.name)
      said(have === undefined
        ? `${quoted(manifest.name)} ${manifest.edition} requires ${quoted(unmet.name)} ${unmet.edition} — not pinned${skippedSuffix}`
        : `${quoted(manifest.name)} ${manifest.edition} requires ${quoted(unmet.name)} ${unmet.edition} — this game pins edition ${have.layer.manifest.edition}${skippedSuffix}`)
      break
    }
  }

  // Kahn. Every survivor's requires are satisfied by now, so the only way a book
  // can fail to be placed is that it waits on a book that waits on it (F5).
  const ordered   = []
  const placed    = new Set()
  const remaining = [...alive]
  while (remaining.length > 0) {
    const ready = remaining
      .filter(entry => (entry.layer.manifest.requires ?? []).every(req => placed.has(req.name)))
      .sort((a, b) => a.layer.manifest.name.localeCompare(b.layer.manifest.name))
    if (ready.length === 0) {
      const labels = remaining.map(entry => bookLabel(entry.layer.manifest)).sort((a, b) => a.localeCompare(b))
      const fault  = { path: pinsPath, message: `books require each other in a cycle: ${labels.join(", ")}; they are skipped` }
      faults.push(fault)
      remaining.forEach(entry => skipped.push({ pin: entry.site.pin, layer: entry.layer, fault }))
      break
    }
    const next = ready[0]
    ordered.push(next.layer)
    placed.add(next.layer.manifest.name)
    remaining.splice(remaining.indexOf(next), 1)
  }

  return { ordered, skipped, faults }
}


// ── the merge itself ─────────────────────────────────────────────────────────

// Where the pin that asked for a layer is WRITTEN — the coordinates a fault about
// that pin uses. A game pins in content.books; validateBook merges a book against
// its own `requires`, so there the sites are book.requires[i] and the last layer
// is the book under test itself.
const sitesFor = (layers, own, mode) => mode === "game"
  ? layers.map((layer, i) => ({ path: `content.books[${i}]`, pin: own.content?.books?.[i] ?? layer?.pin ?? null }))
  : layers.map((layer, i) => i === layers.length - 1
      ? { path: "book", pin: layer?.pin ?? null, subject: true }
      : { path: `book.requires[${i}]`, pin: layers[layers.length - 1]?.manifest?.requires?.[i] ?? layer?.pin ?? null })

// A section, rebuilt key by key in the canonical order (§2.8). The merge is a
// WRITER — the export serialises what it returns — so it produces canonical
// shapes by construction rather than trusting the order a file happened to use.
const canonicalSection = (section, fields) => section.kind === "list"
  ? { id: section.id, key: section.key, caption: section.caption, kind: section.kind, of: section.of, placement: fields }
  : { id: section.id, key: section.key, caption: section.caption, kind: section.kind, fields }

export const mergeLayers = ({ books, game }) => {
  // Mode: a real game underneath (the engine, the editor, the export), or none
  // at all (validateBook, which judges one book against the books it requires).
  const mode   = game === null || game === undefined ? "book" : "game"
  const layers = structuredClone(books ?? [])
  const own    = mode === "book" ? emptyGame() : structuredClone(game)

  const faults = []
  const fault  = (path, message) => faults.push({ path, message })

  // ── steps 0–2 ──
  const { ordered } = (() => {
    const sites  = sitesFor(layers, own, mode)
    const result = orderBooks(layers, {
      sites,
      skippedSuffix: mode === "game" ? SKIPPED : "",
      pinsPath:      mode === "game" ? "content.books" : "book.requires",
      quietSubject:  mode === "book"
    })
    faults.push(...result.faults)
    return result
  })()

  // One record per layer, so every step below is the same loop over the same
  // list: a label (for origins and for the sentences), a path prefix (a book's
  // files live under books["<name>"]., the game's are the bare file names) and
  // the three files that take part in the union.
  const bookLayers = ordered.map(layer => ({
    label:  bookLabel(layer.manifest),
    prefix: bucketAt("books", layer.pin?.name ?? layer.manifest.name) + ".",
    types: layer.types, things: layer.things, proposals: layer.proposals, isGame: false
  }))
  const gameLayer = { label: GAME_LAYER, prefix: "", types: own.types, things: own.things, proposals: null, isGame: true }
  const allLayers = [...bookLayers, gameLayer]
  const order     = bookLayers.map(layer => layer.label)

  // `origins` is BOTH the answer the editor paints as a badge ("from Basic 1")
  // and the id registry the add-only rule needs: one map, so an id names exactly
  // one thing in the merged world whatever KIND of thing it is. claim() is the
  // add-only rule, in three lines.
  const origins = new Map()
  const claim = (id, label, path) => {
    const owner = origins.get(id)
    if (owner !== undefined) { fault(path, `duplicate id ${quoted(id)} — already defined by ${owner}; this one is skipped`); return false }   // F6
    origins.set(id, label)
    return true
  }

  // ── step 3: sheets ──
  // Union by id over every layer in order. A sheet's sections, their fields and
  // their placement fields are claimed with it — an id inside a skipped sheet is
  // never claimed, so the sheet that DID survive keeps its own.
  const sheets   = new Map()   // sheet id → the merged type { id, label, sections }
  const sections = new Map()   // section id → { section, sheetId, path } — where it was defined, for F11's path
  const addSection = (sheet, section, layer, path) => {
    if (!claim(section.id, layer.label, `${path}.id`)) return
    const inner  = (list, what) => (list ?? []).filter((field, k) => claim(field.id, layer.label, `${path}.${what}[${k}].id`))
    const merged = canonicalSection(section, section.kind === "list" ? inner(section.placement, "placement") : inner(section.fields, "fields"))
    sheet.sections.push(merged)
    sections.set(section.id, { section: merged, sheetId: sheet.id, path })
  }
  allLayers.forEach(layer => (layer.types?.types ?? []).forEach((type, i) => {
    const path = `${layer.prefix}types.types[${i}]`
    if (!claim(type.id, layer.label, `${path}.id`)) return
    const sheet = { id: type.id, label: type.label, sections: [] }
    sheets.set(type.id, sheet)
    ;(type.sections ?? []).forEach((section, j) => addSection(sheet, section, layer, `${path}.sections[${j}]`))
  }))

  // ── step 4: sections added to someone else's sheet ──
  // AFTER every sheet is known, so a book may add to a sheet defined by a book
  // that happens to load later. Stats adds nothing here; Dinosaur Age adds
  // nothing either — but this is the door a "Vehicles" book would come through.
  allLayers.forEach(layer => Object.entries(layer.types?.sectionsFor ?? {}).forEach(([sheetId, list]) => {
    const path  = bucketAt(`${layer.prefix}types.sectionsFor`, sheetId)
    const sheet = sheets.get(sheetId)
    if (sheet === undefined) { fault(path, `adds sections to a sheet that does not exist (${sheetId}); they are skipped`); return }   // F7
    ;(list ?? []).forEach((section, i) => addSection(sheet, section, layer, `${path}[${i}]`))
  }))

  // ── step 5: fields added to someone else's section ──
  // This is how Stats puts Strength, Dexterity, Intelligence and Health inside
  // Basic's empty Attributes section. Three ways to get it wrong: the section is
  // not there (F8), it is a LIST section and holds placements rather than fields
  // (F9), or the field's key is already taken on that sheet (F10) — two fields
  // under one key would be one value, and the second author would never know.
  allLayers.forEach(layer => Object.entries(layer.types?.fieldsFor ?? {}).forEach(([sectionId, list]) => {
    const path  = bucketAt(`${layer.prefix}types.fieldsFor`, sectionId)
    const found = sections.get(sectionId)
    if (found === undefined)             { fault(path, `adds fields to a section that does not exist (${sectionId}); they are skipped`); return }              // F8
    if (found.section.kind === "list")   { fault(path, `adds fields to a list section (${sectionId}) — only a field section holds fields; they are skipped`); return }   // F9
    const sheet = sheets.get(found.sheetId)
    ;(list ?? []).forEach((field, i) => {
      const fieldPath = `${path}[${i}]`
      if (!claim(field.id, layer.label, `${fieldPath}.id`)) return
      if (thingKeys(sheet).includes(field.key)) { fault(`${fieldPath}.key`, `key ${quoted(field.key)} is already used on sheet ${sheet.id}; the field is skipped`); return }   // F10
      found.section.fields.push(field)
    })
  }))

  // ── step 6: every list section must point at a sheet that exists ──
  // The section STAYS (removing it would drop the values things already store
  // under its key); hydrate reads a missing shelf as empty. The fault says why
  // the "+ Add" is offering nothing.
  sheets.forEach(sheet => listSectionsOf(sheet).forEach(section => {
    if (!sheets.has(section.of)) fault(`${sections.get(section.id).path}.of`, `lists entries of a sheet that does not exist (${section.of}); the section offers nothing`)   // F11
  }))

  // ── step 7: things, then the game's arrangement ──
  // Every merged sheet gets a bucket even when nothing fills it, so hydrate and
  // the editor never have to ask whether a shelf exists. A BOOK bucket keyed by a
  // sheet nobody defines is a fault (F12); the GAME's is a LEFTOVER, carried
  // through untouched — it is exactly the state after un-pinning a book, and the
  // Things tab lists it under "Not on any sheet" so the author can rescue it.
  const buckets = new Map()
  sheets.forEach((sheet, id) => buckets.set(id, []))
  allLayers.forEach(layer => Object.entries(layer.things?.things ?? {}).forEach(([sheetId, list]) => {
    const path = bucketAt(`${layer.prefix}things.things`, sheetId)
    if (!sheets.has(sheetId) && !layer.isGame) { fault(path, `holds things of a sheet that does not exist (${sheetId}); they are skipped`); return }   // F12
    if (!buckets.has(sheetId)) buckets.set(sheetId, [])
    const bucket = buckets.get(sheetId)
    ;(list ?? []).forEach((thing, i) => { if (claim(thing.id, layer.label, `${path}[${i}].id`)) bucket.push(thing) })
  }))

  // The game ARRANGES the merged shelf: the ids it lists come first, in that
  // order, and everything else follows in merge order. That is what lets the
  // rebuilt dino show its Lair row in exactly the v4 order even though the
  // book's lairs and the game's own joke lairs come from different layers.
  Object.entries(slotOf(own.things, "order") ?? {}).forEach(([sheetId, list]) => {
    const path   = bucketAt("things.order", sheetId)
    const bucket = buckets.get(sheetId)
    if (bucket === undefined) { fault(path, `arranges a shelf that does not exist (${sheetId}); it is ignored`); return }   // F15
    const left  = new Map(bucket.map(thing => [thing.id, thing]))
    const first = []
    ;(list ?? []).forEach((id, i) => {
      const thing = left.get(id)
      if (thing === undefined) { fault(`${path}[${i}]`, `arranges a thing that is not on shelf ${sheetId} (${id}); it is ignored`); return }   // F15
      first.push(thing)
      left.delete(id)
    })
    buckets.set(sheetId, [...first, ...bucket.filter(thing => left.has(thing.id))])
  })

  // ── step 8: what the books propose ──
  // Rows first (the id space is the same one — a game row may not reuse a
  // proposed row's id), then the min/max each book proposes per row, then the
  // budget. Nothing is decided here: this step only records who proposed what,
  // so step 9 can see a disagreement as a disagreement.
  const pruneRows = (rows, label, path) => (rows ?? []).flatMap((row, i) => {
    const rowPath = `${path}[${i}]`
    if (!claim(row.id, label, `${rowPath}.id`)) return []
    return [{ ...row, children: pruneRows(row.children, label, `${rowPath}.children`) }]
  })
  const proposedRows  = []          // [{ row, from }] — top level; children hang off each row
  const proposedRules = new Map()   // row id → Map(key → { value, from, proposers, values })
  const budgets       = []          // [{ value, from }] in layer order
  bookLayers.forEach(layer => {
    const proposals = layer.proposals
    if (proposals === null || proposals === undefined) return
    pruneRows(proposals.groups, layer.label, `${layer.prefix}proposals.groups`).forEach(row => proposedRows.push({ row, from: layer.label }))
    Object.entries(proposals.groupRules ?? {}).forEach(([rowId, slot]) => RULE_KEYS.forEach(key => {
      const value = slotOf(slot, key)
      if (value === undefined) return
      if (!proposedRules.has(rowId)) proposedRules.set(rowId, new Map())
      const byKey = proposedRules.get(rowId)
      if (byKey.has(key)) { const entry = byKey.get(key); entry.proposers.push(layer.label); entry.values.push(value) }
      else byKey.set(key, { value, from: layer.label, proposers: [layer.label], values: [value] })
    }))
    if (proposals.totalBudget !== undefined) budgets.push({ value: proposals.totalBudget, from: layer.label })
  })
  const ownRows = pruneRows(own.content.groups, GAME_LAYER, "content.groups")     // claimed in the SAME id space as the proposals

  // ── step 9: the game decides ──
  // A conflict is two books proposing DIFFERENT values for one key (the same
  // value twice is agreement, not conflict). The merge never picks a winner
  // quietly: it uses the first proposal in layer order AND says so, unless the
  // game has already written its own value at that key — then there is nothing
  // to decide and the fault is gone.
  const ownGroupRules = own.rules?.groupRules ?? {}
  const ownBudget     = slotOf(own.rules, "totalBudget")
  proposedRules.forEach((byKey, rowId) => byKey.forEach((entry, key) => {
    if (new Set(entry.values).size < 2) return
    entry.conflict = entry.proposers                                              // the editor shows it even once the game has decided
    if (slotOf(slotOf(ownGroupRules, rowId), key) !== undefined) return
    fault(bucketAt("rules.groupRules", rowId) + `.${key}`,                        // F13
      `${andList(entry.proposers)} propose different values for ${key} of row ${rowId} — this game must set its own (using ${entry.value}, the first)`)
  }))
  const budgetConflict = new Set(budgets.map(each => each.value)).size > 1
  if (budgetConflict && ownBudget === undefined)
    fault("rules.totalBudget",                                                    // F14
      `${budgets.map(each => `${each.from} proposes ${each.value}`).join(", ")} — this game must set its own budget (using ${budgets[0].value}, the first)`)

  // The cascade, per key. A row's slot is the proposal with the game's own
  // values written over it — `{ min: 2 }` against a proposed `{ min: 1, max: 3 }`
  // is `{ min: 2, max: 3 }`, not `{ min: 2 }`. Rebuilt in sheet order so the
  // merged rules.json is canonical whichever half each key came from.
  const groupRules = {}
  const ruleRowIds = [...new Set([...proposedRules.keys(), ...Object.keys(ownGroupRules)])]
  ruleRowIds.forEach(rowId => {
    const proposed = proposedRules.get(rowId)
    const decided  = slotOf(ownGroupRules, rowId)
    const merged   = {}
    RULE_KEYS.forEach(key => {
      const mine = slotOf(decided, key)
      if (mine !== undefined) merged[key] = mine
      else if (proposed?.has(key)) merged[key] = proposed.get(key).value
    })
    groupRules[rowId] = merged
  })
  const totalBudget = ownBudget !== undefined ? ownBudget : budgets[0]?.value      // absent when nothing proposes: hydrate's own 10 applies

  // ── step 10: the game's house rules on a proposed row ──
  // Per key again: `hidden: true` drops the row and everything nested in it;
  // label/query/showWhen are replaced only where the game wrote one. A key the
  // game never wrote lets the book's proposal show through, so a later edition
  // that improves a label improves it here too.
  const rowOverrides = own.content?.rowOverrides ?? {}
  const applyOverrides = (rows) => rows.flatMap(row => {
    const over = slotOf(rowOverrides, row.id)
    if (slotOf(over, "hidden") === true) return []
    const pick = (key) => { const mine = slotOf(over, key); return mine !== undefined ? mine : row[key] }
    // NEW: `fills` joins the per-key cascade. A game may re-aim a proposed row at a
    // section of the player's sheet exactly as it may relabel one — and that is the
    // ONLY way a game binds rows a FROZEN book proposes, without a new edition.
    // Written ONLY when somebody wrote one (the book, or the game's override), so a
    // row nobody bound carries no `fills` key at all: the merged file never holds a
    // no-op, and a row nothing new was said about stays byte-identical to its v5 self.
    const bound = pick("fills")
    return [{ id: row.id, label: pick("label"), query: pick("query"),
              ...(bound !== undefined ? { fills: bound } : {}),
              showWhen: pick("showWhen"), children: applyOverrides(row.children) }]
  })
  const groups = [...applyOverrides(proposedRows.map(entry => entry.row)), ...ownRows]

  // ── step 11: one plain, book-less v5 set ──
  // `books: []` and empty `rowOverrides`/`sectionsFor`/`fieldsFor` are not
  // laziness: the merged set IS the flattened world, so there is nothing left to
  // pin and nothing left to override. No `order` key either — it has been applied
  // to the buckets. That is why the published folder (which the export writes
  // from exactly this) runs the engine's no-books path unchanged.
  // NEW, in `content`: the game's declaration of which sheet the PLAYER builds. A
  // book cannot propose one yet, so this is `own` and nothing more — no cascade, no
  // conflict sentence. Like `fills` it is written only when the game HAS the key, so
  // a book-less game that declares nothing still merges to ITSELF, byte for byte.
  const set = {
    content: { version: SCHEMA_VERSION, meta: own.content.meta, books: [],
               ...(slotOf(own.content, "sheet") !== undefined ? { sheet: own.content.sheet } : {}),
               groups, rowOverrides: {} },
    rules:   { version: SCHEMA_VERSION, ...(totalBudget !== undefined ? { totalBudget } : {}), groupRules },
    themes:  own.themes,
    types:   { version: SCHEMA_VERSION, types: [...sheets.values()], sectionsFor: {}, fieldsFor: {} },
    things:  { version: SCHEMA_VERSION, things: Object.fromEntries(buckets) }
  }
  const proposed = {
    rows:  proposedRows,
    rules: Object.fromEntries([...proposedRules].map(([rowId, byKey]) =>
      [rowId, Object.fromEntries([...byKey].map(([key, entry]) =>
        [key, { value: entry.value, from: entry.from, ...(entry.conflict ? { conflict: entry.conflict } : {}) }]))])),
    totalBudget: budgets.length === 0 ? null
      : { value: budgets[0].value, from: budgets[0].from, ...(budgetConflict ? { conflict: budgets.map(each => each.from) } : {}) }
  }
  return { set, origins, proposed, order, faults }
}

// The export's data: the merged set and nothing else. Its fixed point is what
// makes a published folder honest — merging a flattened game with no books gives
// the same five files back (oracle K8), so the dist engine and the live engine
// are running the same code over the same shapes.
export const flattenGame = ({ books, game }) => mergeLayers({ books, game }).set


// ── the three validators ─────────────────────────────────────────────────────

// A whole game, judged: shapes first (the rest of the walk assumes them), then
// the merge's own faults, then the references — over the MERGED set, because a
// row may legitimately show basic:character and only the merge knows that sheet
// exists. This is the editor's pre-flight, the server's gate on content.json and
// the export's contract gate: one function, three callers, one answer.
export const validateGame = ({ own, books }) => {
  const shape = FILE_NAMES.flatMap(name => own[name] == null ? [{ path: name, message: "missing" }] : validateFile(name, own[name]))
  if (shape.length > 0) return shape
  const { set, faults } = mergeLayers({ books, game: own })
  return [...faults, ...crossChecks(set)]
}

// The book-less case, which is what validateSet always was. It lives here rather
// than in validate.js because judging a set needs the merge, and merge.js already
// imports validate.js — the other direction would be a cycle. Written as the
// special case it is, so "a game with no books" can never drift from "a game".
export const validateSet = (set) => validateGame({ own: set, books: [] })

// The sentences a BOOK must obey that no sheet can say. Paths are rooted at the
// file the fault is in (book.json is `book`), because validateBook is judging
// THIS book — the book's name is the answer, not part of the question.
const bookRules = (book) => {
  const out      = []
  const fault    = (path, message) => out.push({ path, message })
  const manifest = book.manifest
  const pin      = book.pin ?? {}

  // The folder is the truth: a manifest that disagrees with where it lives would
  // make the same book answer to two names.
  if (pin.name !== undefined && manifest.name !== pin.name)          fault("book.name",    `must be ${quoted(pin.name)} — the folder's name (found ${quoted(manifest.name)})`)
  if (pin.edition !== undefined && manifest.edition !== pin.edition) fault("book.edition", `must be ${pin.edition} — the folder's edition (found ${manifest.edition})`)
  ;(manifest.requires ?? []).forEach((req, i) => { if (req.name === manifest.name) fault(`book.requires[${i}]`, `a book cannot require itself`) })

  // NAMESPACE = OWNERSHIP. A book may REFERENCE any id (its sections may hang off
  // Basic's sheets, its rows may query Basic's types) but it may only DEFINE ids
  // under its own name — that is what makes "already defined by basic 1" a
  // sentence an author can act on, and what keeps two shelves from colliding.
  // The FOLDER's name is the namespace, not the manifest's: a typo in book.json
  // is one sentence (above), not one per id in the book.
  const space = `${pin.name ?? manifest.name}:`
  const defines = (id, path) => {
    if (typeof id !== "string") return                                            // already reported by the shape walk
    if (!id.startsWith(space)) fault(path, `${quoted(id)} is not in this book's namespace (${space})`)
    else if (!BOOK_ID.test(id)) fault(path, `${quoted(id)} does not fit the id grammar (<book>:<slug>, lowercase, dots and dashes)`)
  }
  // CHANGED: the six hand-aimed walks that used to stand here are ONE walk now — ids.js's,
  // asked for its DEFINING half. "Where a book defines an id" and "where a rename must
  // rewrite one" were two lists of the same places, kept in step by hand; the day one grew
  // a position and the other did not, a book would be judged by a rule a rename ignored (or
  // the reverse) and nothing would say so. Same paths, same order, same two sentences: the
  // walk goes file by file in table order (types → things → proposals) and, inside a file,
  // in sheet order, which is exactly the order these lines used to run in.
  // `defining` is an element's own `id` and nothing else, which is precisely the half a
  // book OWNS — a bucket's key, a cabinet's key, a query's type and a gate's thing are all
  // REFERENCES, and a book may reference anything. The phonebook is empty on purpose:
  // nothing in the defining half needs a type (only a thing's PLACEMENTS do, and those are
  // references), so bookRules stays a pure function of one loaded layer.
  eachId({ book: manifest, types: book.types, things: book.things, proposals: book.proposals },
         [], (position) => { if (position.defining) defines(position.id, position.path) }, BOOK_FILE_SHEETS)

  // Arranging a shelf is a HOUSE rule: which of the merged things come first is
  // the game's taste, and a book that shipped one would overrule every game that
  // pins it.
  if (book.things?.order !== undefined) fault("things.order", `a book may not arrange a shelf (order is the game's)`)
  return out
}

// One book on the shelf, judged: its own shapes, its own rules, then a real merge
// against the books it requires — because "does this book fit together with what
// it stands on?" is a question only the merge can answer. `shelf` is
// { [name]: { [edition]: layer } }; a requirement that is not on it comes back as
// a null layer and the merge names it (F1, at book.requires[i]).
export const validateBook = (book, shelf) => {
  const name   = book.pin?.name ?? ""
  const prefix = bucketAt("books", name) + "."
  const shape  = [
    ...validateBookFile("book", book.manifest),
    ...BOOK_FILES.flatMap(file => book[file] === null || book[file] === undefined ? []
      : validateBookFile(file, book[file]).map(({ path, message }) => ({ path: prefix + path, message })))
  ]
  if (shape.length > 0) return shape
  const rules = bookRules(book)
  if (rules.length > 0) return rules
  const required = (book.manifest.requires ?? []).map(pin => shelf?.[pin.name]?.[pin.edition] ?? null)
  const { set, faults } = mergeLayers({ books: [...required, book], game: null })
  // CHANGED: the audit is told which MODE it is running in — "book", the same word
  // mergeLayers uses two lines up. It changes exactly one question: a proposed row's
  // `fills`. A book may propose a binding (a section id is global across the merged
  // library, and it needs no local declaration to be meaningful), so asking it here
  // against an empty game's absent sheet only ever produced "fills a section but this game
  // builds no sheet" — a refusal aimed at an author who has no sheet to give it. The
  // question belongs to validateGame, which asks it against the game's own declaration and
  // is untouched. Passed, never inferred: `sheet` is default:"" AND optional:true, so a
  // game that legitimately lacks the key would otherwise be judged a book — failing OPEN.
  return [...faults, ...crossChecks(set, "book")]
}
