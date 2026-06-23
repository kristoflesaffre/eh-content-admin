/** Copy/paste-formaat voor LLM-bewerking van vragen. */
const LLM_MARKER = "<<<ADMIN_VRAAG_ANTWOORD>>>";
const LLM_END = "<<<EIND>>>";

const SITE_GUIDELINES = {
  ehbo: `Je schrijft voor EHBO (Eerste Hulp bij Opvoeden): warme, praktische antwoorden voor ouders.
Toon: begripvol, helder, niet belerend. Geen jargon zonder uitleg.
HTML mag in tekstblokken: <strong>, <em>, <br> — geen volledige HTML-pagina's.
Bronnen verwijzen naar boek-id's uit de lijst hieronder; wijzig id's niet tenzij nodig.`,
  ehbt: `Je schrijft voor EHBT (Eerste Hulp bij Trauma): rustige, onderbouwde uitleg voor mensen die trauma willen begrijpen.
Toon: validerend, niet-stigmatiserend, educatief — geen diagnose, geen behandeladvies.
HTML mag in tekstblokken: <strong>, <em>, <br>.
Bij crisis: verwijs naar professionele hulp. Bronnen via boek-id's uit de lijst.`
};

function stripHtmlForPrompt(text) {
  return String(text || "").replace(/<[^>]+>/g, m => {
    if (m === "<br>" || m === "<br/>") return "\n";
    return "";
  });
}

function formatBronnenForPrompt(bronnen) {
  if (!bronnen?.length) return "(geen)";
  return bronnen.map(b => {
    if (typeof b === "string") return `- ${b}`;
    return `- ${b.boek}${b.detail ? ` — ${stripHtmlForPrompt(b.detail)}` : ""}`;
  }).join("\n");
}

function formatBlokkenForPrompt(blokken) {
  if (!blokken?.length) return "(geen blokken)";
  return (blokken || []).map((b, i) => {
    const lines = [`[${i + 1}]`];
    if (b.kop) lines.push(`kop: ${b.kop}`);
    lines.push(`tekst: ${stripHtmlForPrompt(b.tekst)}`);
    if (b.zeg != null) lines.push(`zeg: ${b.zeg || "(leeg)"}`);
    return lines.join("\n");
  }).join("\n\n");
}

function formatBoekenlijst(boeken) {
  if (!boeken) return "";
  return Object.entries(boeken)
    .map(([id, b]) => `- ${id}: ${b.titel} — ${b.auteur}`)
    .join("\n");
}

function buildVraagPrompt(site, item, boeken) {
  const siteLabel = site === "ehbt" ? "EHBT" : "EHBO";
  const huidig = `
HUIDIGE INHOUD (te verbeteren)
──────────────────────────────
ID: ${item.id}
Vraag: ${item.vraag}
Thema: ${item.thema}
Leeftijd: ${(item.leeftijd || []).join(", ")}
Uitgelicht: ${item.uitgelicht ? "ja" : "nee"}
Tags: ${(item.tags || []).join(", ")}

KORT:
${item.kort || ""}

BLOKKEN:
${formatBlokkenForPrompt(item.blokken)}

DOE_DIT:
${(item.doeDit || []).map(x => `- ${x}`).join("\n") || "(leeg)"}

VERMIJD:
${(item.vermijd || []).map(x => `- ${x}`).join("\n") || "(leeg)"}

ZEG_DIT:
${item.zegDit || "(leeg)"}

BRONNEN:
${formatBronnenForPrompt(item.bronnen)}

GERELATEERD:
${(item.gerelateerd || []).join(", ") || "(geen)"}`;

  const outputFormat = `
VERPLICHT ANTWOORDFORMAAT
─────────────────────────
Geef je herschreven versie exact in dit formaat (kopieer de markers letterlijk):

${LLM_MARKER}
KORT:
(korte samenvatting, 1-2 zinnen)

BLOKKEN:
---
kop: (optionele titel — weglaten of leeg laten als niet nodig)
tekst: (alinea; HTML toegestaan)
---
(kopieer --- blok voor elk tekstblok)

DOE_DIT:
- (één regel per bullet)

VERMIJD:
- (één regel per bullet)

ZEG_DIT:
(zinnen gescheiden door komma, of leeg)

BRONNEN:
- boek-id | korte toelichting
(of alleen: - boek-id)

TAGS:
- (één tag per regel)

${LLM_END}

Wijzig ID, thema, leeftijd en gerelateerd NIET, tenzij ik dat expliciet vraag.`;

  return `Je bent redacteur voor ${siteLabel} — een Nederlandstalige hulpwebsite.

${SITE_GUIDELINES[site] || SITE_GUIDELINES.ehbo}

BESCHIKBARE BOEK-ID'S (voor bronnen)
────────────────────────────────────
${formatBoekenlijst(boeken) || "(geen boekenlijst geladen)"}

${huidig}

OPDRACHT
────────
Herschrijf en verbeter de inhoud hierboven. Maak het duidelijker, warmer en beter leesbaar.
Behoud de structuur en feitelijke kern. Verzin geen nieuwe bronnen buiten de boek-id's.

${outputFormat}`;
}

function parseListSection(body, key) {
  const re = new RegExp(`(?:^|\\n)${key}:\\s*\\n([\\s\\S]*?)(?=\\n+[A-Z][A-Z_]*:|\\n<<<|$)`, "i");
  const m = body.match(re);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map(l => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function parseBlokkenSection(body) {
  const m = body.match(/(?:^|\n)BLOKKEN:\s*\n([\s\S]*?)(?=\n+DOE_DIT:)/i);
  if (!m) return [];
  const raw = m[1].trim().replace(/^---\s*\n?/, "");
  const chunks = raw.split(/\n---\s*\n/).map(c => c.trim().replace(/\n?---\s*$/, "")).filter(Boolean);
  const blokken = [];
  for (const chunk of chunks) {
    const block = {};
    const kopM = chunk.match(/^kop:\s*(.*)$/im);
    const tekstM = chunk.match(/^tekst:\s*([\s\S]*)$/im);
    const zegM = chunk.match(/^zeg:\s*(.*)$/im);
    if (kopM) {
      const v = kopM[1].trim();
      if (v && v !== "(leeg)" && v !== "-") block.kop = v;
    }
    if (tekstM) block.tekst = tekstM[1].trim();
    if (zegM) {
      const v = zegM[1].trim();
      block.zeg = !v || v === "(leeg)" ? null : v;
    }
    if (block.tekst || block.kop) blokken.push(block);
  }
  return blokken;
}

function parseBronnenSection(body) {
  const lines = parseListSection(body, "BRONNEN");
  return lines.map(line => {
    const pipe = line.split("|").map(s => s.trim());
    if (pipe.length >= 2) return { boek: pipe[0], detail: pipe.slice(1).join("|").trim() };
    return line;
  });
}

function parseVraagResponse(text) {
  const start = text.indexOf(LLM_MARKER);
  if (start === -1) return null;
  let body = text.slice(start + LLM_MARKER.length);
  const end = body.indexOf(LLM_END);
  if (end !== -1) body = body.slice(0, end);
  body = body.trim();

  const kortM = body.match(/^KORT:\s*\n([\s\S]*?)(?=\n+BLOKKEN:)/i);
  const zegM = body.match(/(?:^|\n)ZEG_DIT:\s*\n([\s\S]*?)(?=\n+BRONNEN:)/i);

  const result = {};

  if (kortM) result.kort = kortM[1].trim();

  const blokken = parseBlokkenSection(body);
  if (blokken.length) result.blokken = blokken;

  const doeDit = parseListSection(body, "DOE_DIT");
  if (doeDit.length) result.doeDit = doeDit;

  const vermijd = parseListSection(body, "VERMIJD");
  if (vermijd.length) result.vermijd = vermijd;

  if (zegM) {
    const z = zegM[1].trim();
    result.zegDit = !z || z === "(leeg)" ? null : z;
  }

  const bronnen = parseBronnenSection(body);
  if (bronnen.length) result.bronnen = bronnen;

  const tags = parseListSection(body, "TAGS");
  if (tags.length) result.tags = tags;

  if (!Object.keys(result).length) return null;
  return result;
}

function applyVraagToForm(form, data, helpers) {
  if (data.kort != null) {
    const el = form.querySelector('[name="kort"]');
    if (el) el.value = data.kort;
  }
  if (data.zegDit !== undefined) {
    const el = form.querySelector('[name="zegDit"]');
    if (el) el.value = data.zegDit || "";
  }
  if (data.tags) {
    const el = form.querySelector('[name="tags"]');
    if (el) el.value = data.tags.join("\n");
  }
  if (data.doeDit) {
    const el = form.querySelector('[name="doeDit"]');
    if (el) el.value = data.doeDit.join("\n");
  }
  if (data.vermijd) {
    const el = form.querySelector('[name="vermijd"]');
    if (el) el.value = data.vermijd.join("\n");
  }
  if (data.blokken) {
    const repeater = form.querySelector('[data-repeater="blokken"]');
    if (repeater) {
      repeater.innerHTML = data.blokken.map((b, i) => helpers.blokItemHtml("blokken", i, b, false)).join("");
    }
  }
  if (data.bronnen) {
    const repeater = form.querySelector('[data-repeater="bronnen"]');
    if (repeater) {
      repeater.innerHTML = data.bronnen.map((b, i) => helpers.bronItemHtml(i, b)).join("");
    }
  }
}

window.LlmVraag = {
  MARKER: LLM_MARKER,
  buildPrompt: buildVraagPrompt,
  parseResponse: parseVraagResponse,
  applyToForm: applyVraagToForm
};
