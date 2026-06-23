const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { serialize } = require("./serialize");

const EHBO_VRAGEN_FILES = Array.from({ length: 13 }, (_, i) => `data-vragen-${i + 1}.js`);
const EHBT_VRAGEN_FILES = Array.from({ length: 19 }, (_, i) => `data-vragen-${i + 1}.js`);

/** Per site: hoe databestanden worden opgebouwd bij opslaan. */
const FILE_LAYOUTS = {
  ehbo: {
    "data-boeken.js": {
      header: `// ============================================================
// EHBO — Boekenkast: gerenommeerde boeken en onderzoeksbronnen
// ============================================================
`,
      exports: ["BOEKEN", "THEMAS", "LEEFTIJDEN"],
      footer: `
const BOEK_IDS = Object.keys(BOEKEN);

function maakKoopLinks(boek) {
  const zoekterm = encodeURIComponent(\`\${boek.titel} \${boek.auteur}\`);
  return [
    { label: "Bol.com", url: \`https://www.bol.com/be/nl/s/?searchtext=\${zoekterm}\` },
    { label: "Standaard Boekhandel", url: \`https://www.standaardboekhandel.be/search?query=\${zoekterm}\` },
    { label: "Amazon", url: \`https://www.amazon.com/s?k=\${zoekterm}\` }
  ];
}

BOEK_IDS.forEach(id => {
  BOEKEN[id].cover = \`img/covers/\${id}.jpg\`;
  BOEKEN[id].koopLinks = maakKoopLinks(BOEKEN[id]);
});
`
    },
    "data-extra.js": {
      header: `// ============================================================
// EHBO — Noodhulp (acute situaties), Mythes & Gouden regels
// ============================================================
`,
      exports: ["NOODHULP", "MYTHES", "MYTHE_LEEFTIJDEN", "REGELS"],
      footer: `
MYTHES.forEach(mythe => {
  mythe.leeftijd = mythe.leeftijd || MYTHE_LEEFTIJDEN[mythe.id] || ["baby", "peuter", "kind", "tiener"];
});
`
    },
    "data-onderzoeken.js": {
      header: `// ============================================================
// EHBO — Onderzoeken
// ============================================================
`,
      exports: ["ONDERZOEKEN"]
    }
  },
  ehbt: {
    "data-boeken.js": {
      header: `// ============================================================
// EHBT — Boeken (bronnen), thema's & doelgroepen
// Alle samenvattingen zijn onafhankelijk geschreven, geïnspireerd
// door de genoemde werken — geen overgenomen boektekst.
// ============================================================

function zoekLinks(titel, auteur) {
  const q = encodeURIComponent(\`\${titel} \${auteur}\`);
  return [
    { label: "Bol.com", url: \`https://www.bol.com/be/nl/s/?searchtext=\${q}\` },
    { label: "Standaard Boekhandel", url: \`https://www.standaardboekhandel.be/zoeken?text=\${q}\` }
  ];
}
`,
      exports: ["BOEKEN", "THEMAS", "LEEFTIJDEN"],
      footer: ""
    },
    "data-extra.js": {
      header: `// ============================================================
// EHBT — Crisislijnen, acute plannen, mythes & grondbeginselen
// Onafhankelijk geschreven. De acute plannen zijn grounding-hulp,
// geen behandeling. Bij gevaar: bel 112, 1813 of 106.
// ============================================================
`,
      exports: ["CRISISLIJNEN", "NOODHULP", "MYTHES", "REGELS"]
    },
    "data-therapieen.js": {
      header: `// ============================================================
// EHBT — Therapieën
// Onafhankelijk geschreven, geïnspireerd door de vakliteratuur.
// Evidentieniveaus zijn algemene, oriënterende inschattingen — geen
// behandeladvies. Bespreek de keuze altijd met een professional.
// ============================================================
`,
      exports: ["THERAPIEEN", "THERAPIE_WEGWIJZERS"]
    },
    "data-uitgelegd.js": {
      header: `// ============================================================
// EHBT — Trauma uitgelegd: concepten, hechtingsstijlen, stoornissen
// Onafhankelijk geschreven, educatief en niet-stigmatiserend.
// Geen diagnose-instrument. Geen overgenomen boektekst.
// ============================================================
`,
      exports: ["CONCEPTEN", "HECHTINGSSTIJLEN", "STOORNISSEN"]
    }
  }
};

function jsDir(sitePath) {
  return path.join(sitePath, "js");
}

function readFile(sitePath, filename) {
  return fs.readFileSync(path.join(jsDir(sitePath), filename), "utf8");
}

function detectExports(code) {
  return [...code.matchAll(/^const ([A-Z_][A-Z0-9_]*)\s*=/gm)].map(m => m[1]);
}

function runJsFile(code) {
  const exportNames = detectExports(code);
  const sandbox = { __capture: {} };
  vm.createContext(sandbox);
  const assignBack = exportNames.map(name => `__capture[${JSON.stringify(name)}] = ${name};`).join("\n");
  vm.runInContext(`${code}\n${assignBack}`, sandbox, { filename: "data.js", timeout: 10000 });
  for (const name of exportNames) {
    sandbox[name] = sandbox.__capture[name];
  }
  return sandbox;
}

let extraVraagHelper = null;

function getExtraVraagHelper(sitePath) {
  if (extraVraagHelper) return extraVraagHelper;
  const content = readFile(sitePath, "data-vragen-7.js");
  const match = content.match(/function extraVraag[\s\S]*?\n\}/);
  extraVraagHelper = match ? `${match[0]}\n\n` : "";
  return extraVraagHelper;
}

function runVragenFile(sitePath, file, content) {
  const needsHelper = content.includes("extraVraag(") && !content.includes("function extraVraag");
  const code = needsHelper ? getExtraVraagHelper(sitePath) + content : content;
  return runJsFile(code);
}

function extractHeaderFromFile(content, exportNames) {
  const firstExport = content.indexOf(`const ${exportNames[0]} =`);
  if (firstExport === -1) return "";
  return content.slice(0, firstExport);
}

function buildFileContent(layout, values) {
  let out = layout.header || "";
  for (const name of layout.exports) {
    if (!(name in values)) {
      throw new Error(`Ontbrekende export: ${name}`);
    }
    out += `const ${name} = ${serialize(values[name])};\n\n`;
  }
  if (layout.footer) out += layout.footer.trimStart();
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

function loadVragen(siteKey, sitePath) {
  extraVraagHelper = null;
  const files = siteKey === "ehbo" ? EHBO_VRAGEN_FILES : EHBT_VRAGEN_FILES;
  const items = [];
  for (const file of files) {
    const content = readFile(sitePath, file);
    const sandbox = siteKey === "ehbo" ? runVragenFile(sitePath, file, content) : runJsFile(content);
    const exportName = Object.keys(sandbox).find(k => k.startsWith("VRAGEN_"));
    if (!exportName || !Array.isArray(sandbox[exportName])) continue;
    for (const item of sandbox[exportName]) {
      items.push({
        ...item,
        _meta: { file, export: exportName }
      });
    }
  }
  return items;
}

function saveVragen(siteKey, sitePath, items) {
  const files = siteKey === "ehbo" ? EHBO_VRAGEN_FILES : EHBT_VRAGEN_FILES;
  const byFile = Object.fromEntries(files.map(f => [f, []]));

  for (const item of items) {
    const { _meta, ...rest } = item;
    const file = _meta?.file;
    if (!file || !byFile[file]) {
      throw new Error(`Vraag "${rest.id}" heeft geen geldige _meta.file`);
    }
    byFile[file].push(rest);
  }

  for (const file of files) {
    const content = readFile(sitePath, file);
    const exportName = Object.keys(runVragenFile(sitePath, file, content)).find(k => k.startsWith("VRAGEN_"));
    const headerEnd = content.indexOf(`const ${exportName} =`);
    const header = content.slice(0, headerEnd);
    const body = `const ${exportName} = ${serialize(byFile[file])};\n`;
    fs.writeFileSync(path.join(jsDir(sitePath), file), header + body, "utf8");
  }
}

function loadNamedExport(sitePath, filename, exportName) {
  const sandbox = runJsFile(readFile(sitePath, filename));
  return sandbox[exportName];
}

function loadSiteData(siteKey, sitePath) {
  const layouts = FILE_LAYOUTS[siteKey];
  const data = {
    vragen: loadVragen(siteKey, sitePath),
    boeken: loadNamedExport(sitePath, "data-boeken.js", "BOEKEN"),
    themas: loadNamedExport(sitePath, "data-boeken.js", "THEMAS"),
    leeftijden: loadNamedExport(sitePath, "data-boeken.js", "LEEFTIJDEN")
  };

  if (siteKey === "ehbo") {
    data.noodhulp = loadNamedExport(sitePath, "data-extra.js", "NOODHULP");
    data.mythes = loadNamedExport(sitePath, "data-extra.js", "MYTHES");
    data.mytheLeeftijden = loadNamedExport(sitePath, "data-extra.js", "MYTHE_LEEFTIJDEN");
    data.regels = loadNamedExport(sitePath, "data-extra.js", "REGELS");
    data.onderzoeken = loadNamedExport(sitePath, "data-onderzoeken.js", "ONDERZOEKEN");
  } else {
    data.crisislijnen = loadNamedExport(sitePath, "data-extra.js", "CRISISLIJNEN");
    data.noodhulp = loadNamedExport(sitePath, "data-extra.js", "NOODHULP");
    data.mythes = loadNamedExport(sitePath, "data-extra.js", "MYTHES");
    data.regels = loadNamedExport(sitePath, "data-extra.js", "REGELS");
    data.therapieen = loadNamedExport(sitePath, "data-therapieen.js", "THERAPIEEN");
    data.therapieWegwijzers = loadNamedExport(sitePath, "data-therapieen.js", "THERAPIE_WEGWIJZERS");
    data.concepten = loadNamedExport(sitePath, "data-uitgelegd.js", "CONCEPTEN");
    data.hechtingsstijlen = loadNamedExport(sitePath, "data-uitgelegd.js", "HECHTINGSSTIJLEN");
    data.stoornissen = loadNamedExport(sitePath, "data-uitgelegd.js", "STOORNISSEN");
  }

  return data;
}

function saveSection(siteKey, sitePath, section, payload) {
  const layouts = FILE_LAYOUTS[siteKey];

  if (section === "vragen") {
    saveVragen(siteKey, sitePath, payload);
    return;
  }

  const fileMap = {
    boeken: { file: "data-boeken.js", export: "BOEKEN" },
    themas: { file: "data-boeken.js", export: "THEMAS" },
    leeftijden: { file: "data-boeken.js", export: "LEEFTIJDEN" },
    noodhulp: { file: "data-extra.js", export: "NOODHULP" },
    mythes: { file: "data-extra.js", export: "MYTHES" },
    regels: { file: "data-extra.js", export: "REGELS" },
    onderzoeken: { file: "data-onderzoeken.js", export: "ONDERZOEKEN" },
    crisislijnen: { file: "data-extra.js", export: "CRISISLIJNEN" },
    mytheLeeftijden: { file: "data-extra.js", export: "MYTHE_LEEFTIJDEN" },
    therapieen: { file: "data-therapieen.js", export: "THERAPIEEN" },
    therapieWegwijzers: { file: "data-therapieen.js", export: "THERAPIE_WEGWIJZERS" },
    concepten: { file: "data-uitgelegd.js", export: "CONCEPTEN" },
    hechtingsstijlen: { file: "data-uitgelegd.js", export: "HECHTINGSSTIJLEN" },
    stoornissen: { file: "data-uitgelegd.js", export: "STOORNISSEN" }
  };

  const map = fileMap[section];
  if (!map) throw new Error(`Onbekende sectie: ${section}`);

  const layout = layouts[map.file];
  const current = runJsFile(readFile(sitePath, map.file));
  const values = {};
  for (const name of layout.exports) {
    values[name] = name === map.export ? payload : current[name];
  }

  const out = buildFileContent(layout, values);
  fs.writeFileSync(path.join(jsDir(sitePath), map.file), out, "utf8");
}

function saveAll(siteKey, sitePath, data) {
  saveVragen(siteKey, sitePath, data.vragen);

  const layouts = FILE_LAYOUTS[siteKey];
  const fileValues = {};

  for (const [file, layout] of Object.entries(layouts)) {
    fileValues[file] = {};
    for (const name of layout.exports) {
      const key = exportToSectionKey(name);
      if (data[key] !== undefined) fileValues[file][name] = data[key];
    }
    const existing = runJsFile(readFile(sitePath, file));
    for (const name of layout.exports) {
      if (fileValues[file][name] === undefined) {
        fileValues[file][name] = existing[name];
      }
    }
    const out = buildFileContent(layout, fileValues[file]);
    fs.writeFileSync(path.join(jsDir(sitePath), file), out, "utf8");
  }
}

function exportToSectionKey(exportName) {
  const map = {
    BOEKEN: "boeken",
    THEMAS: "themas",
    LEEFTIJDEN: "leeftijden",
    NOODHULP: "noodhulp",
    MYTHES: "mythes",
    MYTHE_LEEFTIJDEN: "mytheLeeftijden",
    REGELS: "regels",
    ONDERZOEKEN: "onderzoeken",
    CRISISLIJNEN: "crisislijnen",
    THERAPIEEN: "therapieen",
    THERAPIE_WEGWIJZERS: "therapieWegwijzers",
    CONCEPTEN: "concepten",
    HECHTINGSSTIJLEN: "hechtingsstijlen",
    STOORNISSEN: "stoornissen"
  };
  return map[exportName] || exportName.toLowerCase();
}

module.exports = {
  loadSiteData,
  saveSection,
  saveAll,
  exportToSectionKey
};
