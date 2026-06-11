import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 5179);
const basePath = normalizeBasePath(process.env.BASE_PATH || "");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathFromBase = stripBasePath(url.pathname);
    if (pathFromBase === null) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const requested = pathFromBase === "/" ? "/index.html" : pathFromBase;
    const filePath = path.normalize(path.join(root, requested));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving repository at http://127.0.0.1:${port}${basePath || ""}/`);
});

function normalizeBasePath(value) {
  const trimmed = value.trim().replace(/\/+$/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function stripBasePath(urlPathname) {
  if (!basePath) return urlPathname;
  if (urlPathname === basePath) return "/";
  if (urlPathname.startsWith(`${basePath}/`)) return urlPathname.slice(basePath.length) || "/";
  return null;
}
