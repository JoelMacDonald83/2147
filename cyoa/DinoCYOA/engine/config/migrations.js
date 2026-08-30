import {SCHEMA_VERSION} from "./schema.js"


const migrateContentV1toV2 = (content)=>{
  return{
    ...content,
    version: 2,
    groups: content.groups.map(group=>({
      ...group,
      children:[]
    }))
  }
}

const CONTENT_MIGRATIONS = {
  1: migrateContentV1toV2
}

// v1 → v2 for rules: shape unchanged — stamp-only.
const migrateRulesV1toV2 = (rules) => {
  return { ...rules, version: 2 }
}

const RULES_MIGRATIONS = {
  1: migrateRulesV1toV2
}

const migrateThemesV1toV2 = (themes) => {
  return { ...themes, version: 2 }
}

const THEMES_MIGRATIONS = {
  1: migrateThemesV1toV2
}

const runMigrations = (data, steps) => {
  let current = data
  while (current.version < SCHEMA_VERSION) {
    const step = steps[current.version]
    if (!step) {
      throw new Error(`No migration step from version ${current.version}`)
    }
    current = step(current)
  }
  return current
}

export const migrateContent = (content) => runMigrations(content, CONTENT_MIGRATIONS)
export const migrateRules = (rules) => runMigrations(rules, RULES_MIGRATIONS)
export const migrateThemes = (themes) => runMigrations(themes, THEMES_MIGRATIONS)