// The form specification sheet: everything the editor (and someday the engine)
// knows about the data's fields, as data. type names are OUR vocabulary:
//   "text"           → one-line text input
//   "number"         → number input, Number() at the border
//   "lines"          → textarea, one entry per line, array in storage
//   "optionalNumber" → number input where EMPTY means "key absent";
//                      default null = key not written at birth


// CONTENT SCHEMAS
export const metaSchema = [
  { key: "pageTitle", caption: "Page title", type: "text", default: "" },
  { key: "heroTitle", caption: "Hero title", type: "text", default: "" },
]

export const groupSchema = [
  { key: "label", caption: "Label", type: "text", default: "New group" }
  // TODO Phase 5: items as a container type ("itemSet")
]

export const itemSchema = [
  { key: "name",     caption: "Name",                  type: "text",   default: "New item" },
  { key: "label",    caption: "Label",                 type: "text",   default: "" },
  { key: "cost",     caption: "Cost",                  type: "number", default: 0 },
  { key: "imageURL", caption: "Image filename",        type: "text",   default: "" },
  { key: "traits",   caption: "Traits (one per line)", type: "lines",  default: [] }
]

// THEME SCHEMAS
export const pageThemeSchema = [
  { key: "bodyBackground",   caption: "Body background",   type: "text", default: "#ffffff" },
  { key: "fontFamily",       caption: "Font family",       type: "text", default: "'Segoe UI', system-ui, sans-serif" },
  { key: "heroImage",        caption: "Hero image",        type: "text", default: "" },
  { key: "statusBackground", caption: "Status background", type: "text", default: "#12101a" },
  { key: "statusColor",      caption: "Status color",      type: "text", default: "#ffd166" }
]

export const groupThemeSchema = [
  { key: "background", caption: "Background", type: "text", default: "" }
]

// RULE SCHEMAS
export const totalBudgetSchema = [
  { key: "totalBudget", caption: "Total budget", type: "number", default: 10 }
]

export const groupRulesSchema = [
  { key: "min", caption: "Min points", type: "optionalNumber", default: null },
  { key: "max", caption: "Max points", type: "optionalNumber", default: null },
]
