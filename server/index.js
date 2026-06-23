const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadSiteData, saveAll, saveSection } = require("./lib/dataFiles");
const { generateResponsiveVariants, RESPONSIVE_WIDTHS } = require("./lib/responsiveImages");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const IMAGE_DIRS = {
  vragen: "img/vragen",
  therapieen: "img/therapieen",
  therapieWegwijzers: "img/therapieen",
  concepten: "img/concepten",
  hechtingsstijlen: "img/hechting",
  stoornissen: "img/stoornissen"
};

function resolveSitePath(siteKey) {
  const rel = config.sites[siteKey]?.path;
  if (!rel) return null;
  return path.resolve(ROOT, rel);
}

function safeResolve(root, relPath) {
  const absRoot = path.resolve(root);
  const absPath = path.resolve(absRoot, relPath);
  return absPath === absRoot || absPath.startsWith(`${absRoot}${path.sep}`) ? absPath : null;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif"
  };
  return types[ext] || "application/octet-stream";
}

function slugify(value) {
  return String(value || "beeld")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "beeld";
}

function imageExtension(filename, dataUrl = "") {
  const ext = path.extname(filename || "").toLowerCase();
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
  if (allowed.has(ext)) return ext === ".jpeg" ? ".jpg" : ext;

  const mime = String(dataUrl).match(/^data:([^;]+);base64,/)?.[1] || "";
  const mimeToExt = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif"
  };
  return mimeToExt[mime] || "";
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Ongeldig afbeeldingsformaat");
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Niet gevonden");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(data);
  });
}

function checkAuth(req) {
  if (!config.adminToken) return true;
  return req.headers["x-admin-token"] === config.adminToken;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/config" && req.method === "GET") {
      return sendJson(res, 200, {
        sites: Object.fromEntries(
          Object.entries(config.sites).map(([key, site]) => [key, {
            label: site.label,
            previewUrl: site.previewUrl
          }])
        )
      });
    }

    const dataMatch = url.pathname.match(/^\/api\/(ehbo|ehbt)\/data$/);
    if (dataMatch && req.method === "GET") {
      const siteKey = dataMatch[1];
      const sitePath = resolveSitePath(siteKey);
      if (!sitePath || !fs.existsSync(path.join(sitePath, "js"))) {
        return sendJson(res, 404, { error: "Sitepad niet gevonden" });
      }
      const data = loadSiteData(siteKey, sitePath);
      return sendJson(res, 200, { data, loadedAt: new Date().toISOString() });
    }

    const saveAllMatch = url.pathname.match(/^\/api\/(ehbo|ehbt)\/save-all$/);
    if (saveAllMatch && req.method === "POST") {
      if (!checkAuth(req)) return sendJson(res, 401, { error: "Niet geautoriseerd" });
      const siteKey = saveAllMatch[1];
      const sitePath = resolveSitePath(siteKey);
      const body = await readBody(req);
      saveAll(siteKey, sitePath, body.data);
      return sendJson(res, 200, { ok: true, message: "Alle wijzigingen opgeslagen" });
    }

    const saveSectionMatch = url.pathname.match(/^\/api\/(ehbo|ehbt)\/save\/([\w]+)$/);
    if (saveSectionMatch && req.method === "POST") {
      if (!checkAuth(req)) return sendJson(res, 401, { error: "Niet geautoriseerd" });
      const [, siteKey, section] = saveSectionMatch;
      const sitePath = resolveSitePath(siteKey);
      const body = await readBody(req);
      saveSection(siteKey, sitePath, section, body.data);
      return sendJson(res, 200, { ok: true, message: `Sectie “${section}” opgeslagen` });
    }

    const assetMatch = url.pathname.match(/^\/api\/(ehbo|ehbt)\/asset$/);
    if (assetMatch && req.method === "GET") {
      const siteKey = assetMatch[1];
      const sitePath = resolveSitePath(siteKey);
      const relPath = url.searchParams.get("path") || "";
      if (!sitePath || !relPath || !relPath.startsWith("img/")) {
        return sendJson(res, 404, { error: "Bestand niet gevonden" });
      }
      const filePath = safeResolve(sitePath, relPath);
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return sendJson(res, 404, { error: "Bestand niet gevonden" });
      }
      return sendFile(res, filePath);
    }

    const uploadMatch = url.pathname.match(/^\/api\/(ehbo|ehbt)\/upload-image$/);
    if (uploadMatch && req.method === "POST") {
      if (!checkAuth(req)) return sendJson(res, 401, { error: "Niet geautoriseerd" });
      const siteKey = uploadMatch[1];
      const sitePath = resolveSitePath(siteKey);
      const body = await readBody(req);
      const { section, itemId, filename, dataUrl } = body;
      const targetDirRel = IMAGE_DIRS[section];

      if (!sitePath || !targetDirRel) {
        return sendJson(res, 400, { error: "Deze sectie ondersteunt geen beeldupload." });
      }

      const ext = imageExtension(filename, dataUrl);
      if (!ext) {
        return sendJson(res, 400, { error: "Gebruik een png, jpg, webp, gif of avif." });
      }

      const { buffer } = decodeDataUrl(dataUrl);
      const targetDir = safeResolve(sitePath, targetDirRel);
      if (!targetDir) {
        return sendJson(res, 400, { error: "Ongeldige uploadmap." });
      }
      fs.mkdirSync(targetDir, { recursive: true });

      const basename = slugify(itemId || path.basename(filename, ext) || "beeld");
      const outFile = `${basename}${ext}`;
      const outPath = path.join(targetDir, outFile);
      fs.writeFileSync(outPath, buffer);
      try {
        generateResponsiveVariants(outPath, RESPONSIVE_WIDTHS);
      } catch (err) {
        console.warn(`Kon geen responsive varianten maken voor ${outFile}: ${err.message}`);
      }

      return sendJson(res, 200, {
        ok: true,
        src: `${targetDirRel}/${outFile}`.replace(/\\/g, "/"),
        responsiveWidths: RESPONSIVE_WIDTHS
      });
    }

    let staticPath = url.pathname === "/" ? "/index.html" : url.pathname;
    staticPath = path.normalize(staticPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC, staticPath);
    if (filePath.startsWith(PUBLIC) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return sendFile(res, filePath);
    }

    res.writeHead(404);
    res.end("Niet gevonden");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message || "Serverfout" });
  }
});

server.listen(config.port, () => {
  console.log(`Admin draait op http://localhost:${config.port}`);
  for (const [key, site] of Object.entries(config.sites)) {
    const p = resolveSitePath(key);
    const ok = p && fs.existsSync(path.join(p, "js"));
    console.log(`  ${key}: ${ok ? "✓" : "✗"} ${p}`);
  }
});
