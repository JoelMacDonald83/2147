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

const MIGRATIONS = {
  1: migrateSetV1toV2,
  2: migrateSetV2toV3
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
// NEW: the border's promise — nothing leaves here missing. A game already at
// version 3 whose types.json was deleted by hand is an error that NAMES the
// file, not a null that blows up later inside hydration.
export const migrateSet = (set) => {
  const migrated = runMigrations(set)
  const missing = Object.keys(migrated).filter(name => migrated[name] === null)
  if (missing.length > 0) {
    throw new Error(`Missing data files for version ${SCHEMA_VERSION}: ${missing.join(", ")}`)
  }
  return migrated
}
