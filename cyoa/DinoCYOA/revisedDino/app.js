const loadJSON = async (url) => {
  const res = await fetch(url)
  return res.json()
}

const [content, rules, theme] = await Promise.all([
  loadJSON("/data/content.json"),
  loadJSON("/data/rules.json"),
  loadJSON("/data/theme.json")
])

console.log(content, rules, theme)