import styles from './styles.json' with { type: 'json' }

const displayArea = document.getElementById("display-area");

export const render = (displayState, onClick) => {
  displayArea.innerHTML = "";
  for (const entry of displayState) {
    const style = styles[entry.type];
    const area = document.createElement(style.tag);
    Object.assign(area.style, style.elementStyle);
    area.textContent = entry.text;
    if (onClick) area.addEventListener("click", () => onClick(entry));
    displayArea.appendChild(area);
  }
};