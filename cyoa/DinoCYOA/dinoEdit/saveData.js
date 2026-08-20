export const save = async(name, data) => {
  const res = await fetch(`/api/save/${name}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(data)
  })
  return res.json()
}

