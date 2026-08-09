import styles from './styles.json' with { type: 'json' }

const displayArea = document.getElementById("display-area");

const renderEntry = (entry, parent, onClick) => {
  const style = styles[entry.type];
  const area = document.createElement(style.tag);
  Object.assign(area.style, style.elementStyle);
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