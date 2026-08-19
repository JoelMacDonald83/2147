import { createServer } from "http";
import { readFile } from "fs/promises";
import {fileURLToPath} from 'url'
import { dirname, join, sep, extname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
const server = createServer(async (req, res) => {
  console.log("Knock", req.method, req.url);
  const urlPath = req.url === '/' ? '/index.html' : req.url
  const requestedPath = join(__dirname, "public", urlPath);
  console.log("wants:", requestedPath);

  if (!requestedPath.startsWith(join(__dirname, "public") + sep)) {
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
