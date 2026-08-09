import styles from './styles.json' with { type: 'json' }

const displayArea = document.getElementById("display-area");



const renderEntry = (entry, parent, onClick) => {
  const style = styles[entry.type];
  if (!style) console.warn(`renderEntry: no style for type "${entry.type}"`);
  const { tag, elementStyle } = style ?? styles.default;
  const area = document.createElement(tag);
  Object.assign(area.style, elementStyle);
  area.textContent = entry.text;
  if (onClick) area.addEventListener("click", () => onClick(entry));
  parent.appendChild(area);

  const entries = entry.entries ?? [];
  entries.forEach(child => renderEntry(child, area, onClick));
};

export const render = (displayState, onClick) => {
  displayArea.innerHTML = "";
  const entries = displayState.entries ?? [];
  entries.forEach(entry => renderEntry(entry, displayArea, onClick));
};