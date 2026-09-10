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

// ── step 4: v4 → v5 ──
// A type's flat field list becomes ONE field section, "Identity" — the section every sheet
// has; books add more beside it. Its id is DERIVED from the type's (type.id + ".identity"),
// never minted, so migrating twice is byte-identical and no uuid appears or disappears.
// content gains the empty shelf pins (a v4 game knew no books) and the empty house rules;
// types gains the two empty addition cabinets; rules, themes and things are stamped — a
// written budget is the game's own and stays so; thing values stay flat by key.
// FROZEN HISTORY: "identity"/"Identity" and the section shape are spelled out here and
// never imported from schema.js — schema.js describes TODAY, a migration describes the past.
const migrateSetV4toV5 = (set) => ({
  content: { version: 5, meta: set.content.meta, books: [], groups: set.content.groups, rowOverrides: {} },
  rules:   stamp(set.rules, 5),
  themes:  stamp(set.themes, 5),
  types:   set.types === null ? null : {
    version: 5,
    types: set.types.types.map(type => ({
      id: type.id,
      label: type.label,
      sections: [{ id: `${type.id}.identity`, key: "identity", caption: "Identity", kind: "fields", fields: type.fields }]
    })),
    sectionsFor: {},
    fieldsFor: {}
  },
  things:  stamp(set.things, 5)
})

// ── step 5: v5 → v6 ──
// The player's sheet arrives. A game gains ONE key (`sheet`: which type the player
// builds) and every row gains one (`fills`: which section of it a pick lands in).
// Both are born EMPTY, and "" means exactly what v5 meant: this game is a menu and
// this row is a plain picker. That is why every v5 game keeps playing identically.
// Both are WRITTEN here rather than left absent, in their canonical slots, so the
// editor never has to insert a key into the middle of a file — it only ever
// assigns to a key that is already there, and assigning never moves one.
// Rows are rebuilt key by key — the same move v3 → v4 made — so the canonical order
// holds whatever order a v5 file happened to have.
// Nothing is minted, nothing is read from anywhere, nothing depends on the books:
// the step is a pure function of the set and byte-identical run twice.
// FROZEN HISTORY: "" and the row's six keys are spelled out here and never imported
// from schema.js — schema.js describes TODAY, a migration describes the past.
const migrateSetV5toV6 = (set) => {
  const convertRow = (row) => ({
    id: row.id, label: row.label, query: row.query, fills: "",
    showWhen: row.showWhen, children: row.children.map(convertRow)
  })
  return {
    content: { version: 6, meta: set.content.meta, books: set.content.books, sheet: "",
               groups: set.content.groups.map(convertRow), rowOverrides: set.content.rowOverrides },
    rules:  stamp(set.rules,  6),
    themes: stamp(set.themes, 6),
    types:  stamp(set.types,  6),
    things: stamp(set.things, 6)
  }
}

// ── step 6: v6 → v7 ──
// NEW. An entry may now DEMAND something of the player's sheet. The `demands` key is
// RESERVED and OPTIONAL and born ABSENT: "this entry demands nothing" is spelled by the
// key not being there, which is what every thing on the shelf and in both games already
// means. So there is nothing to write into any file, and this step HAS NO BODY.
//
// It is written anyway, and it MUST be. Without it a v6 engine would read a v7 file,
// ignore a `demands` key in silence, and sell what the rules forbid — and a prerequisite
// nobody can see is worse than one that refuses the click. The version line is what turns
// that silence into one useful sentence ("must be 6 (found 7)") instead of a dozen
// ("unexpected key").
//
// Pure, deterministic, mint-free, set-level, generic — and byte-identical run twice by
// HAVING NO BODY, rather than by care. `stamp` (above) is reused for all five files so a
// null keeps being a null and migrateSet can still NAME the file that is missing.
const migrateSetV6toV7 = (set) => ({
  content: stamp(set.content, 7), rules: stamp(set.rules, 7), themes: stamp(set.themes, 7),
  types:   stamp(set.types,   7), things: stamp(set.things, 7)
})

const MIGRATIONS = {
  1: migrateSetV1toV2,
  2: migrateSetV2toV3,
  3: migrateSetV3toV4,
  4: migrateSetV4toV5,
  5: migrateSetV5toV6,
  6: migrateSetV6toV7   // NEW
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
// The border's promise — nothing leaves here missing. A game at version 3,
// 4 or 5 whose types.json was deleted by hand is an error that NAMES the
// file, not a null that blows up later inside hydration. (Steps 3 and 4 keep
// that promise by carrying a null through untouched — see stamp above.)
// A set already at SCHEMA_VERSION comes back as the SAME object, untouched:
// the export's version gate relies on that identity, and it is what makes
// "migrate twice" trivially equal "migrate once".
export const migrateSet = (set) => {
  const migrated = runMigrations(set)
  const missing = Object.keys(migrated).filter(name => migrated[name] === null)
  if (missing.length > 0) {
    throw new Error(`Missing data files for version ${SCHEMA_VERSION}: ${missing.join(", ")}`)
  }
  return migrated
}
