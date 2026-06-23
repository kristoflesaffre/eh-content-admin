const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VALID_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const RESPONSIVE_WIDTHS = [360, 720, 1200];

function fallbackExtFor(ext) {
  const normalized = String(ext || "").toLowerCase();
  if (normalized === ".png") return ".png";
  if (normalized === ".gif") return ".gif";
  return ".jpg";
}

function renderVariant(inputPath, outputPath, width, format, quality) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const args = [
    inputPath,
    "-auto-orient",
    "-strip",
    "-resize", `${width}x>`,
    "-quality", String(quality)
  ];

  if (format === "webp") {
    args.push("-define", "webp:method=6");
  }

  args.push(outputPath);
  execFileSync("magick", args, { stdio: "ignore" });
}

function generateResponsiveVariants(inputPath, widths = RESPONSIVE_WIDTHS) {
  if (!fs.existsSync(inputPath)) return;

  const ext = path.extname(inputPath).toLowerCase();
  if (!VALID_EXTS.has(ext)) return;

  const name = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const responsiveDir = path.join(dir, "_responsive");
  const fallbackExt = fallbackExtFor(ext);
  const srcStat = fs.statSync(inputPath);

  for (const width of widths) {
    const fallbackOut = path.join(responsiveDir, `${name}-${width}${fallbackExt}`);
    const webpOut = path.join(responsiveDir, `${name}-${width}.webp`);

    if (!fs.existsSync(fallbackOut) || fs.statSync(fallbackOut).mtimeMs < srcStat.mtimeMs) {
      renderVariant(inputPath, fallbackOut, width, fallbackExt.slice(1), 82);
    }

    if (!fs.existsSync(webpOut) || fs.statSync(webpOut).mtimeMs < srcStat.mtimeMs) {
      renderVariant(inputPath, webpOut, width, "webp", 78);
    }
  }

  return widths.slice();
}

module.exports = {
  generateResponsiveVariants,
  RESPONSIVE_WIDTHS
};
