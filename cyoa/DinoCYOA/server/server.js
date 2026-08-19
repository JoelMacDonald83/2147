import { createServer } from "http";
import { readFileSync } from "fs";

const server = createServer((req, res) => {
  console.log("Knock", req.method, req.url);
  if (req.url === "/") {
    try {
      const content = readFileSync("test-page.html", 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8')

      res.end(content);
    } catch {
      res.statusCode = 500;
      res.end(`Something went wrong server side`);
    }
    return;
  }
  res.statusCode = 404;
  res.end("File not found");
});

server.listen(3000, () => {
  console.log("Server online at http://localhost:3000");
});
