import {esc} from './utils.js'

export function render() {
  fetch('./data.json')
    .then(response => response.json())
    .then(project => {                     // project only exists in HERE
      const app = document.getElementById('app');

      let html = `
        <h1 class="main-heading">${esc(project.title)}</h1>
        <p class="tagline">${esc(project.byline)}</p>
        <p class="intro-text">${esc(project.intro)}</p>
      `;

      for (const section of project.sections) {
        let cards = '';
        for (const choice of section.choices) {
          cards += `
            <div class="faction-card ${choice.id}">
              <h3 class="card-heading">${esc(choice.title)}</h3>
              <p class="card-desc">${esc(choice.text)}</p>
            </div>
          `;
        }
        html += `
          <div class="row" id="${section.id}">
            <h2>${esc(section.title)}</h2>
            <p class="flavor">${esc(section.flavor)}</p>
            <div class="card-container">${cards}</div>
          </div>
        `;
      }

      app.innerHTML = html;
    });
}