import {theme} from './theme.js'
import {render} from './render.js'
render()
theme()
console.log("A");
fetch("./data.json").then(response => {
  console.log("C — response arrived:", response);
});
console.log("B");