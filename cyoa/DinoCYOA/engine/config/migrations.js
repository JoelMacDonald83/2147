import { SCHEMA_VERSION } from "./schema.js"

// CHANGED: migrations used to run one FILE at a time (migrateContent,
// migrateRules, migrateThemes). A v3 step has to move items OUT of
// content.json INTO things.json, so a step now receives the whole SET —
// all five files as one object:
//   { content, rules, themes, types, things }
// types and things are null when the game has no such file yet (a 404 —
// see loadOptionalJSON in helpers.js). The set's version is content.version:
// content.json is the file every game has always had, so it is the one that
// says which edition the set is — and every step stamps ALL the files
// together, so they can never drift apart.

// ── step 1: v1 → v2 ──
// The old three per-file steps, folded into one. Groups gain children: [];
// all three files get stamped 2. Same result per file as before.
// `...set` carries types and things (null at this point) through untouched.
const migrateSetV1toV2 = (set) => {
  return {
    ...set,
    content: {
      ...set.content,
      version: 2,
      groups: set.content.groups.map(group => ({ ...group, children: [] }))
    },
    rules:  { ...set.rules,  version: 2 },
    themes: { ...set.themes, version: 2 }
  }
}

// ── step 2: v2 → v3 ──
// Stuff leaves display. Every old group becomes ONE type (named after the
// group), its items become that type's bucket in things.json, and the group
// keeps only a pointer to the type (displayType). Nested groups get the same
// treatment by the same function — convertGroup calls itself for children.
//
// FROZEN HISTORY: the two fields below (label, traits) are what a v2 item had
// beyond the core three (name, cost, imageURL). They are written out here on
// purpose and must never be imported from schema.js — schema.js describes
// TODAY, and a migration describes the past.
const migrateSetV2toV3 = (set) => {
  const types = []      // filled as groups are visited, parents before children
  const buckets = {}    // type id → the things of that type

  const convertGroup = (group) => {
    const type = {
      id: crypto.randomUUID(),
      label: group.label,
      fields: [
        { id: crypto.randomUUID(), key: "label",  caption: "Label",                 type: "text"  },
        { id: crypto.randomUUID(), key: "traits", caption: "Traits (one per line)", type: "lines" }
      ]
    }
    types.push(type)
    // rebuilt key by key so every thing is stored in the same order the
    // editor's newborn uses: id, the core fields, then the type's fields
    buckets[type.id] = group.items.map(item => ({
      id:       item.id,
      name:     item.name,
      cost:     item.cost,
      imageURL: item.imageURL,
      label:    item.label,
      traits:   item.traits
    }))
    return {
      id:          group.id,
      label:       group.label,
      displayType: type.id,
      children:    group.children.map(convertGroup)
    }
  }

  return {
    content: { ...set.content, version: 3, groups: set.content.groups.map(convertGroup) },
    rules:   { ...set.rules,  version: 3 },
    themes:  { ...set.themes, version: 3 },
    types:   { version: 3, types },            // born here: a v2 game never had these two files
    things:  { version: 3, things: buckets }
  }
}

// NEW: a missing file stays null so migrateSet's "missing files" check can
// still NAME it. ({ ...null, version: 4 } would quietly become { version: 4 },
// slip past the check, and die later inside hydration.)
const stamp = (file, version) => file === null ? null : { ...file, version }

// ── step 3: v3 → v4 ──
// A row stops POINTING at a type (displayType) and starts QUERYING the
// library: { type, where }. where is null — a v3 row showed every thing of
// its type, and that is what "no condition" means. Every row also gains the
// empty gate. Nothing is minted: rows keep their ids and conditions carry no
// ids, so migrating twice is byte-identical (the oracle checks bytes, not
// uuid-normalised text as it must for v2 → v3). Rows are rebuilt key by key
// so the canonical order (id, label, query, showWhen, children) holds
// whatever order a v3 file had.
// FROZEN HISTORY: `displayType` is spelled out here and never imported.
const migrateSetV3toV4 = (set) => {
  const convertGroup = (group) => ({
    id:       group.id,
    label:    group.label,
    query:    { type: group.displayType, where: null },
    showWhen: { kind: "always" },
    children: group.children.map(convertGroup)
  })
  return {
    content: { ...set.content, version: 4, groups: set.content.groups.map(convertGroup) },
    rules:   stamp(set.rules,  4),
    themes:  stamp(set.themes, 4),
    types:   stamp(set.types,  4),
    things:  stamp(set.things, 4)
  }
}

const MIGRATIONS = {
  1: migrateSetV1toV2,
  2: migrateSetV2toV3,
  3: migrateSetV3toV4   // NEW
}

const setVersion = (set) => set.content.version

const runMigrations = (set) => {
  let current = set
  while (setVersion(current) < SCHEMA_VERSION) {
    const step = MIGRATIONS[setVersion(current)]
    if (!step) {
      throw new Error(`No migration step from version ${setVersion(current)}`)
    }
    current = step(current)
  }
  return current
}

// CHANGED: one doorway instead of migrateContent/migrateRules/migrateThemes.
// The border's promise — nothing leaves here missing. A game at version 3
// or 4 whose types.json was deleted by hand is an error that NAMES the
// file, not a null that blows up later inside hydration. (Step 3 keeps that
// promise by carrying a null through untouched — see stamp above.)
export const migrateSet = (set) => {
  const migrated = runMigrations(set)
  const missing = Object.keys(migrated).filter(name => migrated[name] === null)
  if (missing.length > 0) {
    throw new Error(`Missing data files for version ${SCHEMA_VERSION}: ${missing.join(", ")}`)
  }
  return migrated
}
