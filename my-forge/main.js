const project = {
  title: "Metal Wars",
  byline: "The legacy of the Metal Wars",
  intro: "When man fought Machine, and Machines won.",
  sections: [
    {
      id: "faction",
      title: "Choose a faction",
      flavor: "Pick your patron",
      choices: [
        {
          id: "biodread",
          title: "Biodread Empire",
          text: "The dominant power"
        },
        {
          id: "phoenix",
          title: "Phoenix Force",
          text: "The resistance"
        },
        {
          id: "firestorm",
          title: "Firestormers",
          text: "Tough guys of the Badlands"
        }
      ]
    }
  ]
};

const app = document.getElementById('app');

// Escapes the four characters the HTML parser treats as structural,
// so data can't smuggle in tags or attributes. & goes first so its
// replacement doesn't corrupt the &s introduced by the later steps.
function esc(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  let html = `
    <h1 class="main-heading">${esc(project.title)}</h1>
    <p class="tagline">${esc(project.byline)}</p>
    <p class="intro-text">${esc(project.intro)}</p>
  `;

  for (const section of project.sections) {
    let cards = '';
    for (const choice of section.choices) {
      // choice.id stays unescaped — it's used as a class name, which
      // needs its literal characters intact for CSS matching.
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
}

render();

const themeBtn = document.getElementById('theme-btn');
themeBtn.addEventListener('click', () => {
  document.body.classList.contains('light')
    ? document.body.classList.replace('light', 'dark')
    : document.body.classList.replace('dark', 'light');
});

