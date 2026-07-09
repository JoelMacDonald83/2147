// One rule: "selector { prop: value; ... }"
function rule(selector, props) {
  const lines = Object.entries(props)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');
  return `${selector} {\n${lines}\n}\n`;
}

// CSS for one spec ({tag, style, states}) rendered under a class name
function specCss(spec, name) {
  let css = '';
  if (spec.style) {
    css += rule('.' + name, spec.style);
  }
  for (const [suffix, props] of Object.entries(spec.states ?? {})) {
    css += rule('.' + name + suffix, props);      // e.g. ".sections-choices-item" + ".selected"
  }
  return css;
}

// Walk the nested entries, generating class rules from each path
function entriesCss(entries, path) {
  let css = '';
  for (const [key, entry] of Object.entries(entries)) {
    const name = [...path, key].join('-');
    if (entry.item) {                             // array entry: container + item + fields
      if (entry.container) css += specCss(entry.container, name);
      css += specCss(entry.item, name + '-item');
      css += entriesCss(entry.entries ?? {}, [...path, key]);
    } else {                                      // plain field
      css += specCss(entry, name);
    }
  }
  return css;
}

// Turn the whole styles.json object into CSS text
function buildCss(styles) {
  let css = '';
  for (const [selector, props] of Object.entries(styles.global)) {
    css += rule(selector, props);                 // used as-is: body, button, .light...
  }
  css += entriesCss(styles.entries, []);
  for (const [id, props] of Object.entries(styles.byId)) {
    css += rule('.' + id, props);                 // data ids with linked styles
  }
  return css;
}

// Append one paragraph's worth of text: single newlines become <br>.
// element.append(string) makes a TEXT node — it is never parsed as HTML.
function appendLines(element, text) {
  text.split('\n').forEach((line, i) => {
    if (i > 0) element.append(document.createElement('br'));
    element.append(line);
  });
}

// Fill an element from a text value.
// Blank lines split the text into <p class="para"> paragraphs.
function setText(element, value) {
  const paragraphs = String(value)
    .split(/\n\s*\n/)          // blank line = paragraph break
    .map(part => part.trim())
    .filter(part => part !== '');

  if (paragraphs.length <= 1) {
    appendLines(element, paragraphs[0] ?? '');
  } else {
    for (const part of paragraphs) {
      const p = document.createElement('p');
      p.className = 'para';
      appendLines(p, part);
      element.append(p);
    }
  }
}

// Make ONE element: the spec says the tag, the path-derived name becomes the class
function createEl(spec, name, text) {
  const element = document.createElement(spec.tag);
  element.className = name;
  if (text !== undefined) {
    setText(element, text);
  }
  return element;
}

// The generic walk: move through any data object, find the matching
// entry in styles.json for each key, and build elements from it.
// Knows nothing about titles, sections, or cards.
function renderFields(data, entries, styles, path) {
  const elements = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;                   // metadata, handled by the item below
    const entry = entries?.[key];
    if (!entry) continue;                         // no entry in styles.json -> not rendered
    const name = [...path, key].join('-');

    if (Array.isArray(value)) {
      // one element per item, each item's fields rendered recursively
      const items = value.map(item => {
        const el = createEl(entry.item, name + '-item');
        if (item.id) {
          el.id = item.id;
          if (styles.byId[item.id]) {
            el.classList.add(item.id);            // link: data id -> its byId style
          }
        }
        el.append(...renderFields(item, entry.entries, styles, [...path, key]));
        return el;
      });

      if (entry.container) {
        const container = createEl(entry.container, name);
        container.append(...items);
        elements.push(container);
      } else {
        elements.push(...items);                  // no container -> items sit at this level
      }
    } else {
      elements.push(createEl(entry, name, value)); // plain field -> one text element
    }
  }

  return elements;
}

export function render() {
  Promise.all([
    fetch('./data.json').then(response => response.json()),
    fetch('./styles.json').then(response => response.json())
  ])
    .then(([project, styles]) => {   // project AND styles only exist in HERE

      // Inject the styles from styles.json as a runtime stylesheet
      let sheet = document.getElementById('json-styles');
      if (!sheet) {
        sheet = document.createElement('style');
        sheet.id = 'json-styles';
        document.head.appendChild(sheet);
      }
      sheet.textContent = buildCss(styles);

      // Walk the data, build the page
      document.getElementById('app').replaceChildren(
        ...renderFields(project, styles.entries, styles, [])
      );
    });
}