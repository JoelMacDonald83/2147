// CHANGED: the receipt names its file, and a server that does not answer (or answers
// without a JSON body) is a receipt too — never an unhandled throw that takes the whole
// Promise.all in main.js down with it.
export const save = async (name, data) => {
  try {
    const res = await fetch(`/api/save/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    return { name, ...(await res.json()) }
  } catch (error) {
    return { name, ok: false, error: `no answer from the server (${error.message})` }
  }
}
