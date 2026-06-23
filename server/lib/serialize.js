/** Zet een JSON-waarde om naar leesbare JavaScript-literal syntax. */

function serialize(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);

  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map(item => `${padIn}${serialize(item, indent + 1)}`).join(",\n")}\n${pad}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return `{\n${keys.map(key => {
      const safeKey = /^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `${padIn}${safeKey}: ${serialize(value[key], indent + 1)}`;
    }).join(",\n")}\n${pad}}`;
  }

  return JSON.stringify(value);
}

module.exports = { serialize };
