import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import {fileURLToPath} from 'url'
import { dirname, join, sep, extname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const GAME_DIR = join(__dirname, "..", "revisedDino")
const EDITOR_DIR = join(__dirname, "..", "dinoEdit")

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
};

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}


const server = createServer(async (req, res) => {
  let root = GAME_DIR
  console.log("Knock", req.method, req.url);
  res.setHeader("Cache-Control", "no-store");
  if (req.method === 'POST' && req.url === '/api/save/content') {
    const body = await readBody(req)
    console.log('Package contents:', body)
    let parsed
try {
  parsed = JSON.parse(body)
} catch {
  res.statusCode = 400
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ ok: false, error: 'Body is not valid JSON' }))
  return
} await writeFile(
  join(GAME_DIR, "data", "content.json"),
  JSON.stringify(parsed, null, 2) + "\n"
)


    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: true }))
    return
  }

  let urlPath = req.url === '/' ? '/index.html' : req.url
  if (urlPath === '/dinoEdit') {
    res.statusCode = 302
    res.setHeader('Location', '/dinoEdit/')
    res.end()
    return
  }
  if (urlPath.startsWith('/dinoEdit/')) {
    root = EDITOR_DIR
    urlPath = urlPath.slice('/dinoEdit'.length)  // '/dinoEdit/main.js' → '/main.js'
    if (urlPath === '/') urlPath = '/index.html'
  }
  const requestedPath = join(root, urlPath);
  console.log("wants:", requestedPath);

  if (!requestedPath.startsWith(root + sep)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(requestedPath);
    const type = MIME_TYPES[extname(requestedPath)] ?? "application/octet-stream";
    res.setHeader('Content-Type', type);
    res.end(content);
  } catch (err) {
    if (err.code === "ENOENT") {
      res.statusCode = 404;
      res.end("File not found");
    } else {
      res.statusCode = 500;
      res.end("Something went wrong server side");
    }
  }
});

server.listen(3000, () => {
  console.log("Server online at http://localhost:3000");
});
