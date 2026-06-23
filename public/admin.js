const state = {
  site: "ehbo",
  config: null,
  data: null,
  section: "vragen",
  selectedId: null,
  dirty: false
};

const SECTIONS = {
  ehbo: [
    { id: "vragen", label: "Vragen & antwoorden", type: "array" },
    { id: "boeken", label: "Boeken", type: "object" },
    { id: "themas", label: "Thema's", type: "array" },
    { id: "leeftijden", label: "Leeftijden", type: "array" },
    { id: "noodhulp", label: "Noodhulp", type: "array" },
    { id: "mythes", label: "Mythes", type: "array" },
    { id: "mytheLeeftijden", label: "Mythe-leeftijden", type: "object" },
    { id: "regels", label: "Gouden regels", type: "array" },
    { id: "onderzoeken", label: "Onderzoeken", type: "array" }
  ],
  ehbt: [
    { id: "vragen", label: "Vragen & antwoorden", type: "array" },
    { id: "boeken", label: "Boeken", type: "object" },
    { id: "themas", label: "Thema's", type: "array" },
    { id: "leeftijden", label: "Leeftijden", type: "array" },
    { id: "crisislijnen", label: "Crisislijnen", type: "array" },
    { id: "noodhulp", label: "Acute plannen", type: "array" },
    { id: "mythes", label: "Mythes", type: "array" },
    { id: "regels", label: "Grondbeginselen", type: "array" },
    { id: "therapieen", label: "Therapieën", type: "array" },
    { id: "therapieWegwijzers", label: "Therapiewijzers", type: "array" },
    { id: "concepten", label: "Concepten", type: "array" },
    { id: "hechtingsstijlen", label: "Hechtingsstijlen", type: "array" },
    { id: "stoornissen", label: "Stoornissen", type: "array" }
  ]
};

const BEELD_SECTIES = {
  ehbt: new Set(["vragen", "therapieen", "therapieWegwijzers", "concepten", "hechtingsstijlen", "stoornissen"])
};

const BEELD_PADEN = {
  vragen: "img/vragen",
  therapieen: "img/therapieen",
  therapieWegwijzers: "img/therapieen",
  concepten: "img/concepten",
  hechtingsstijlen: "img/hechting",
  stoornissen: "img/stoornissen"
};

const $ = id => document.getElementById(id);

function setStatus(msg, type = "") {
  const el = $("status");
  el.textContent = msg;
  el.className = `status ${type}`;
}

function markDirty() {
  state.dirty = true;
  setStatus("Niet opgeslagen wijzigingen", "");
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function currentSearchQuery() {
  return $("search")?.value.trim() || "";
}

function sectionMeta() {
  return SECTIONS[state.site].find(s => s.id === state.section);
}

function sectionMetaById(sectionId) {
  return SECTIONS[state.site].find(s => s.id === sectionId);
}

function sectionLabel(sectionId) {
  return sectionMetaById(sectionId)?.label || sectionId;
}

function sectionData() {
  return state.data?.[state.section];
}

function sectionDataById(sectionId) {
  return state.data?.[sectionId];
}

function heeftBeeldEditor() {
  return Boolean(BEELD_SECTIES[state.site]?.has(state.section));
}

function siteAssetUrl(src, cacheBust = "") {
  if (!src) return "";
  const q = new URLSearchParams({ path: src });
  if (cacheBust) q.set("v", cacheBust);
  return `/api/${state.site}/asset?${q.toString()}`;
}

function itemTitle(item, sectionId) {
  if (!item) return "";
  if (sectionId === "vragen") return item.vraag || item.id;
  if (sectionId === "boeken") return item.titel || item.id;
  if (sectionId === "mythes") return item.mythe || item.id;
  if (sectionId === "noodhulp" || sectionId === "crisislijnen") return item.titel || item.naam || item.id;
  if (sectionId === "regels") return item.regel || item.titel || item.id;
  if (sectionId === "onderzoeken") return item.titel || item.id;
  if (sectionId === "therapieen") return item.naam || item.id;
  if (sectionId === "therapieWegwijzers") return item.titel || item.id;
  if (sectionId === "concepten") return item.titel || item.id;
  if (sectionId === "hechtingsstijlen" || sectionId === "stoornissen") return item.naam || item.id;
  if (sectionId === "themas" || sectionId === "leeftijden") return item.naam || item.id;
  return item.id || item.naam || item.titel || "Item";
}

function listItemsForSection(sectionId) {
  const data = sectionDataById(sectionId);
  const meta = sectionMetaById(sectionId);
  if (!data) return [];

  if (meta.type === "object") {
    if (sectionId === "mytheLeeftijden") {
      return Object.entries(data).map(([id, leeftijd]) => ({
        id,
        _display: id,
        leeftijd
      }));
    }
    return Object.entries(data).map(([id, item]) => ({ id, ...item }));
  }
  return data.map((item, index) => ({ ...item, _index: index }));
}

function listItems() {
  return listItemsForSection(state.section);
}

function findItem(id) {
  const items = listItemsForSection(state.section);
  return items.find(i => i.id === id);
}

const SEARCH_SKIP_KEYS = new Set(["_meta", "_index", "beeld", "cover"]);

function collectSearchParts(value, parts = []) {
  if (value === null || value === undefined) return parts;

  if (Array.isArray(value)) {
    value.forEach(entry => collectSearchParts(entry, parts));
    return parts;
  }

  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SEARCH_SKIP_KEYS.has(key)) continue;
      collectSearchParts(entry, parts);
    }
    return parts;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).replace(/\s+/g, " ").trim();
    if (text) parts.push(text);
  }
  return parts;
}

function snippetFromSearchParts(parts, title, id) {
  const skip = new Set([normalizeSearch(title), normalizeSearch(id)]);
  const candidate = parts.find(part => part.length > 32 && !skip.has(normalizeSearch(part)))
    || parts.find(part => !skip.has(normalizeSearch(part)))
    || "";
  if (!candidate) return "";
  return candidate.length > 150 ? `${candidate.slice(0, 147).trim()}…` : candidate;
}

function buildSearchResult(item, sectionId) {
  const title = itemTitle(item, sectionId);
  const parts = collectSearchParts(item, []);
  const contentText = parts.join(" · ");
  const haystack = normalizeSearch([sectionLabel(sectionId), item.id, title, contentText].join(" "));
  const titleHaystack = normalizeSearch([item.id, title].join(" "));
  return {
    sectionId,
    item,
    title,
    haystack,
    titleHaystack,
    snippet: snippetFromSearchParts(parts, title, item.id)
  };
}

function searchResults(query) {
  const q = normalizeSearch(query);
  if (!q) {
    return listItemsForSection(state.section).map(item => buildSearchResult(item, state.section));
  }

  return SECTIONS[state.site]
    .flatMap(section => listItemsForSection(section.id).map(item => buildSearchResult(item, section.id)))
    .filter(result => result.haystack.includes(q))
    .sort((a, b) => {
      const aRank = a.titleHaystack.includes(q) ? 0 : 1;
      const bRank = b.titleHaystack.includes(q) ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      const bySection = sectionLabel(a.sectionId).localeCompare(sectionLabel(b.sectionId), "nl");
      if (bySection !== 0) return bySection;
      return a.title.localeCompare(b.title, "nl");
    });
}

function syncSelectionWithResults(results) {
  const activeExists = results.some(result => result.sectionId === state.section && result.item.id === state.selectedId);
  if (activeExists) return;

  if (!results.length) {
    state.selectedId = null;
    return;
  }

  const first = results.find(result => result.sectionId === state.section) || results[0];
  if (state.section !== first.sectionId) {
    state.section = first.sectionId;
    renderSectionNav();
  }
  state.selectedId = first.item.id;
}

function updateItem(id, patch) {
  const meta = sectionMeta();
  const data = sectionData();

  if (meta.type === "object") {
    if (state.section === "mytheLeeftijden") {
      state.data.mytheLeeftijden[id] = patch.leeftijd;
    } else {
      state.data.boeken[id] = { ...state.data.boeken[id], ...patch };
    }
  } else {
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) return;
    data[idx] = { ...data[idx], ...patch };
  }
  markDirty();
}

async function loadConfig() {
  const res = await fetch("/api/config");
  state.config = await res.json();
}

async function loadData() {
  setStatus("Laden…");
  const res = await fetch(`/api/${state.site}/data`);
  if (!res.ok) throw new Error((await res.json()).error || "Laden mislukt");
  const json = await res.json();
  state.data = json.data;
  state.dirty = false;
  setStatus(`Geladen (${json.loadedAt.slice(11, 19)})`, "ok");
}

function renderSiteTabs() {
  const nav = $("site-tabs");
  nav.innerHTML = "";
  for (const [key, site] of Object.entries(state.config.sites)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `site-tab${key === state.site ? " active" : ""}`;
    btn.textContent = key.toUpperCase();
    btn.title = site.label;
    btn.addEventListener("click", async () => {
      if (state.dirty && !confirm("Je hebt niet-opgeslagen wijzigingen. Toch wisselen?")) return;
      state.site = key;
      state.selectedId = null;
      renderSiteTabs();
      renderSectionNav();
      await loadData();
      renderList();
      renderEditor();
      $("preview-link").href = site.previewUrl;
    });
    nav.appendChild(btn);
  }
  $("preview-link").href = state.config.sites[state.site].previewUrl;
}

function renderSectionNav() {
  const nav = $("section-nav");
  nav.innerHTML = "";
  for (const sec of SECTIONS[state.site]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `nav-btn${sec.id === state.section ? " active" : ""}`;
    btn.textContent = sec.label;
    btn.addEventListener("click", () => {
      state.section = sec.id;
      state.selectedId = null;
      renderSectionNav();
      renderList();
      renderEditor();
    });
    nav.appendChild(btn);
  }
}

function renderList() {
  const q = currentSearchQuery();
  const isGlobalSearch = Boolean(q);
  const results = searchResults(q);
  syncSelectionWithResults(results);

  const sectionCount = new Set(results.map(result => result.sectionId)).size;
  if (isGlobalSearch) {
    $("list-count").textContent = `${results.length} resultaat${results.length === 1 ? "" : "en"} in ${sectionCount} sectie${sectionCount === 1 ? "" : "s"}`;
  } else {
    $("list-count").textContent = `${results.length} item${results.length === 1 ? "" : "s"} in ${sectionLabel(state.section)}`;
  }

  const list = $("item-list");
  list.innerHTML = "";

  for (const result of results) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `item-btn${result.sectionId === state.section && result.item.id === state.selectedId ? " active" : ""}`;
    const metaHtml = isGlobalSearch
      ? `<div class="meta meta-row"><span class="section-pill">${escapeHtml(sectionLabel(result.sectionId))}</span><span>${escapeHtml(result.item.id)}</span></div>`
      : `<div class="meta">${escapeHtml(result.item.id)}</div>`;
    const snippetHtml = isGlobalSearch && result.snippet
      ? `<div class="snippet">${escapeHtml(result.snippet)}</div>`
      : "";
    btn.innerHTML = `<div class="title">${escapeHtml(result.title)}</div>${metaHtml}${snippetHtml}`;
    btn.addEventListener("click", () => {
      if (state.section !== result.sectionId) {
        state.section = result.sectionId;
        renderSectionNav();
      }
      state.selectedId = result.item.id;
      renderList();
      renderEditor();
    });
    list.appendChild(btn);
  }

  renderEditor();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label, html) {
  return `<div class="field">${label ? `<label>${escapeHtml(label)}</label>` : ""}${html}</div>`;
}

function textInput(name, value, multiline = false) {
  const v = value ?? "";
  if (multiline) {
    return `<textarea name="${name}" rows="4">${escapeHtml(v)}</textarea>`;
  }
  return `<input type="text" name="${name}" value="${escapeAttr(v)}">`;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function linesArea(name, value, label, hint = "Één regel per item.") {
  const lines = Array.isArray(value) ? value.join("\n") : "";
  return field(label, `<textarea name="${name}" rows="5">${escapeHtml(lines)}</textarea><p class="hint">${escapeHtml(hint)}</p>`);
}

function parseLines(val) {
  return (val || "").split("\n").map(l => l.trim()).filter(Boolean);
}

function splitList(val) {
  return (val || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
}

function beeldEditor(item) {
  const beeld = item.beeld || {};
  const previewSrc = beeld.src ? siteAssetUrl(beeld.src) : "";
  const titel = itemTitle(item, state.section);
  const padHint = BEELD_PADEN[state.section] || "img/mijn-beelden";
  return `
    <section class="beeld-editor">
      <div class="beeld-editor-head">
        <div>
          <h3 class="section-title">Beeld voor kaart en detail</h3>
          <p class="hint">Gebruik één afbeelding. De website doet zelf de crop, washout en blur voor de kaart.</p>
        </div>
      </div>
      <div class="beeld-editor-grid">
        <div class="beeld-preview-pane">
          <div class="beeld-preview" data-beeld-preview>
            ${previewSrc
              ? `<img src="${previewSrc}" alt="" data-preview-mode="remote">`
              : `<div class="beeld-preview-leeg">Nog geen beeld gekozen</div>`}
          </div>
          <div class="beeld-upload-rij">
            <label class="btn btn-secondary btn-small btn-file">
              Kies bestand
              <input type="file" name="beeldBestand" accept="image/png,image/jpeg,image/webp,image/avif,image/gif">
            </label>
            <button type="button" class="btn btn-secondary btn-small" data-paste-beeld>Plak uit klembord</button>
            <button type="button" class="btn btn-secondary btn-small" data-copy-beeld>Kopieer naar klembord</button>
            <button type="button" class="btn btn-secondary btn-small" data-upload-beeld>Upload</button>
            <button type="button" class="btn btn-secondary btn-small" data-download-beeld>Download</button>
            <button type="button" class="btn btn-secondary btn-small" data-clear-beeld>Leegmaken</button>
          </div>
          <p class="hint">Je kunt kiezen, plakken of manueel een pad invullen. Na upload bewaart de admin automatisch 360px, 720px en 1200px varianten.</p>
        </div>
        <div class="beeld-editor-velden">
          ${field("Titel van dit beeld", `<p class="hint beeld-titel-hint">${escapeHtml(titel)}</p>`)}
          ${field("Beeldpad", `<input type="text" name="beeld.src" value="${escapeAttr(beeld.src || "")}" placeholder="${escapeAttr(`${padHint}/mijn-beeld.jpg`)}">`)}
          ${field("Alt-tekst", `<input type="text" name="beeld.alt" value="${escapeAttr(beeld.alt || "")}" placeholder="Korte beschrijving van wat op de foto te zien is">`)}
          <div class="field-row">
            ${field("Crop op tegel", `<input type="text" name="beeld.kaartPos" value="${escapeAttr(beeld.kaartPos || "")}" placeholder="bijv. center center of 60% center">`)}
            ${field("Crop op detail", `<input type="text" name="beeld.detailPos" value="${escapeAttr(beeld.detailPos || "")}" placeholder="optioneel, anders tegel-crop">`)}
          </div>
          <p class="hint">Voorbeelden voor crop: <code>center center</code>, <code>center top</code>, <code>57% center</code>.</p>
        </div>
      </div>
    </section>`;
}

function blokItemHtml(name, i, blok, zeg) {
  const extraVelden = Object.fromEntries(
    Object.entries(blok || {}).filter(([k]) => k !== "kop" && k !== "tekst" && k !== "zeg")
  );
  const extraJson = Object.keys(extraVelden).length ? JSON.stringify(extraVelden) : "";
  return `
    <div class="repeater-item">
      <div class="repeater-item-head">
        <span class="repeater-num">Blok ${i + 1}</span>
        <button type="button" class="btn-icon" data-remove="${name}" title="Verwijderen" aria-label="Verwijderen">×</button>
      </div>
      ${extraJson ? `<input type="hidden" data-field="extra" value="${escapeAttr(extraJson)}">` : ""}
      <div class="field">
        <label>Titel (optioneel)</label>
        <input type="text" data-field="kop" value="${escapeAttr(blok.kop || "")}">
      </div>
      <div class="field">
        <label>Tekst</label>
        <textarea data-field="tekst" rows="5">${escapeHtml(blok.tekst || "")}</textarea>
      </div>
      ${zeg ? `<div class="field"><label>Zeg dit (optioneel)</label><textarea data-field="zeg" rows="2">${escapeHtml(blok.zeg || "")}</textarea></div>` : ""}
    </div>`;
}

function blokkenEditor(name, blokken = [], { zeg = false, label = "Tekstblokken" } = {}) {
  const items = blokken.length ? blokken : [{ tekst: "" }];
  const itemsHtml = items.map((b, i) => blokItemHtml(name, i, b, zeg)).join("");
  return `
    <div class="field repeater-field">
      <div class="repeater-head">
        <label>${escapeHtml(label)}</label>
        <button type="button" class="btn btn-secondary btn-small" data-add="${name}" data-kind="blokken" data-zeg="${zeg}">+ Blok toevoegen</button>
      </div>
      <div class="repeater" data-repeater="${name}" data-kind="blokken" data-zeg="${zeg}">
        ${itemsHtml}
      </div>
      <p class="hint">HTML is toegestaan (bijv. &lt;strong&gt;, &lt;em&gt;).</p>
    </div>`;
}

function bronItemHtml(i, bron) {
  const isObj = bron && typeof bron === "object";
  const boek = isObj ? (bron.boek || "") : (bron || "");
  const detail = isObj ? (bron.detail || "") : "";
  return `
    <div class="repeater-item">
      <div class="repeater-item-head">
        <span class="repeater-num">Bron ${i + 1}</span>
        <button type="button" class="btn-icon" data-remove="bronnen" title="Verwijderen" aria-label="Verwijderen">×</button>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Boek-id</label>
          <input type="text" data-field="boek" value="${escapeAttr(boek)}">
        </div>
        <div class="field">
          <label>Toelichting (optioneel)</label>
          <input type="text" data-field="detail" value="${escapeAttr(detail)}">
        </div>
      </div>
    </div>`;
}

function bronnenEditor(name, bronnen = [], label = "Bronnen") {
  const items = bronnen.length ? bronnen : [""];
  const itemsHtml = items.map((b, i) => bronItemHtml(i, b)).join("");
  return `
    <div class="field repeater-field">
      <div class="repeater-head">
        <label>${escapeHtml(label)}</label>
        <button type="button" class="btn btn-secondary btn-small" data-add="${name}" data-kind="bronnen">+ Bron toevoegen</button>
      </div>
      <div class="repeater" data-repeater="${name}" data-kind="bronnen">
        ${itemsHtml}
      </div>
    </div>`;
}

function linkItemHtml(i, link) {
  return `
    <div class="repeater-item">
      <div class="repeater-item-head">
        <span class="repeater-num">Link ${i + 1}</span>
        <button type="button" class="btn-icon" data-remove="koopLinks" title="Verwijderen" aria-label="Verwijderen">×</button>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Label</label>
          <input type="text" data-field="label" value="${escapeAttr(link.label || "")}">
        </div>
        <div class="field">
          <label>URL</label>
          <input type="text" data-field="url" value="${escapeAttr(link.url || "")}">
        </div>
      </div>
    </div>`;
}

function linksEditor(name, links = [], label = "Kooplinks") {
  const items = links?.length ? links : [{ label: "", url: "" }];
  const itemsHtml = items.map((l, i) => linkItemHtml(i, l)).join("");
  return `
    <div class="field repeater-field">
      <div class="repeater-head">
        <label>${escapeHtml(label)}</label>
        <button type="button" class="btn btn-secondary btn-small" data-add="${name}" data-kind="links">+ Link toevoegen</button>
      </div>
      <div class="repeater" data-repeater="${name}" data-kind="links">
        ${itemsHtml}
      </div>
    </div>`;
}

function feitItemHtml(i, item) {
  return `
    <div class="repeater-item">
      <div class="repeater-item-head">
        <span class="repeater-num">Item ${i + 1}</span>
        <button type="button" class="btn-icon" data-remove="feitVsFabel" title="Verwijderen" aria-label="Verwijderen">×</button>
      </div>
      <div class="field">
        <label>Mythe / fabel</label>
        <textarea data-field="mythe" rows="2">${escapeHtml(item.mythe || "")}</textarea>
      </div>
      <div class="field">
        <label>Feit</label>
        <textarea data-field="feit" rows="3">${escapeHtml(item.feit || "")}</textarea>
      </div>
    </div>`;
}

function feitVsFabelEditor(name, items = []) {
  const list = items.length ? items : [{ mythe: "", feit: "" }];
  const itemsHtml = list.map((item, i) => feitItemHtml(i, item)).join("");
  return `
    <div class="field repeater-field">
      <div class="repeater-head">
        <label>Feit vs. fabel</label>
        <button type="button" class="btn btn-secondary btn-small" data-add="${name}" data-kind="feitVsFabel">+ Item toevoegen</button>
      </div>
      <div class="repeater" data-repeater="${name}" data-kind="feitVsFabel">
        ${itemsHtml}
      </div>
    </div>`;
}

const LINE_FIELDS = new Set([
  "doeDit", "vermijd", "bullets", "kernpunten", "herkenbaar", "geschiktBij",
  "gerelateerd", "tags", "boeken", "watHelpt", "herkenJe", "nietDoen"
]);

const BLOKKEN_FIELDS = {
  blokken: { label: "Tekstblokken", zeg: false },
  stappen: { label: "Stappen", zeg: true },
  hoeWerkt: { label: "Hoe het werkt", zeg: true },
  watHetIs: { label: "Wat het is", zeg: false }
};

const SKIP_FIELDS = new Set(["_meta", "_index", "cover", "beeld"]);

const FIELD_LABELS = {
  id: "ID", vraag: "Vraag", thema: "Thema", kort: "Korte samenvatting",
  titel: "Titel", naam: "Naam", auteur: "Auteur", jaar: "Jaar", icoon: "Icoon",
  kleur: "Kleur", accent: "Accentkleur", kern: "Kern", uitleg: "Uitleg",
  mythe: "Mythe", feit: "Feit", bron: "Bron", bronDetail: "Bron detail",
  regel: "Regel", tekst: "Tekst", nummer: "Nummer", voluit: "Volledige naam",
  voorWie: "Voor wie", evidentie: "Evidentie", evidentieNiveau: "Evidentieniveau",
  haakje: "Haakje", wat: "Wat onderzocht", bleek: "Wat bleek", thuis: "Thuis",
  nuance: "Nuance", primaireBron: "Primaire bron", leeswijzer: "Leeswijzer",
  categorie: "Categorie", inEenZin: "In één zin", ontstaan: "Ontstaan",
  inRelaties: "In relaties", groei: "Groei", ookGenoemd: "Ook genoemd",
  vaakVerwardMet: "Vaak verward met", binnenkant: "Van binnenuit", zegDit: "Zeg dit",
  subtitel: "Subtitel", label: "Label", gerelateerdeTherapieen: "Gerelateerde therapieën"
};

function scalarField(key, value) {
  const label = FIELD_LABELS[key] || key;
  if (typeof value === "boolean") {
    const checked = value ? " checked" : "";
    return field(label, `<div class="checkbox-row"><input type="checkbox" name="${key}" id="f_${key}"${checked}><label for="f_${key}">${escapeHtml(label)}</label></div>`);
  }
  if (typeof value === "number") {
    return field(label, `<input type="number" name="${key}" value="${value ?? ""}">`);
  }
  const long = ["kort", "kern", "uitleg", "feit", "mythe", "tekst", "voorWie", "evidentie", "wat", "bleek", "thuis", "nuance", "primaireBron", "inEenZin", "ontstaan", "inRelaties", "groei", "vaakVerwardMet", "binnenkant", "zegDit", "voluit"].includes(key);
  return field(label, textInput(key, value, long));
}

function renderRepeaterField(key, value) {
  if (key === "bronnen") return bronnenEditor(key, value);
  if (key === "koopLinks") return linksEditor(key, value);
  if (key === "feitVsFabel") return feitVsFabelEditor(key, value);
  if (BLOKKEN_FIELDS[key]) {
    const cfg = BLOKKEN_FIELDS[key];
    return blokkenEditor(key, value, cfg);
  }
  if (LINE_FIELDS.has(key) || Array.isArray(value)) {
    const hint = key === "gerelateerd" || key === "tags" ? "Één id of tag per regel." : "Één regel per item.";
    return linesArea(key, value, FIELD_LABELS[key] || key, hint);
  }
  return "";
}

function buildGenericForm(item) {
  const scalarKeys = [];
  const repeaterKeys = [];

  for (const key of Object.keys(item)) {
    if (SKIP_FIELDS.has(key)) continue;
    const val = item[key];
    if (val === null || val === undefined) {
      scalarKeys.push(key);
      continue;
    }
    if (typeof val === "object" && !Array.isArray(val)) continue;
    if (Array.isArray(val) || BLOKKEN_FIELDS[key] || key === "bronnen" || key === "koopLinks" || key === "feitVsFabel" || LINE_FIELDS.has(key)) {
      repeaterKeys.push(key);
    } else {
      scalarKeys.push(key);
    }
  }

  const order = (a, b) => {
    if (a === "id") return -1;
    if (b === "id") return 1;
    return a.localeCompare(b);
  };
  scalarKeys.sort(order);
  repeaterKeys.sort(order);

  let html = '<div class="field-grid">';
  for (const key of scalarKeys) {
    html += scalarField(key, item[key] ?? "");
  }
  if (heeftBeeldEditor()) {
    html += beeldEditor(item);
  }
  if (repeaterKeys.length) {
    html += '<h3 class="section-title">Lijsten & blokken</h3>';
    for (const key of repeaterKeys) {
      html += renderRepeaterField(key, item[key]);
    }
  }
  html += "</div>";
  return html;
}

function parseRepeaterFromForm(form, name) {
  const root = form.querySelector(`[data-repeater="${name}"]`);
  if (!root) return undefined;
  const kind = root.dataset.kind;

  if (kind === "blokken") {
    const zeg = root.dataset.zeg === "true";
    return [...root.querySelectorAll(".repeater-item")].map(el => {
      const extraRaw = el.querySelector('[data-field="extra"]')?.value || "";
      let block = {};
      try { if (extraRaw) block = { ...JSON.parse(extraRaw) }; } catch {}
      const kop = el.querySelector('[data-field="kop"]')?.value?.trim();
      const tekst = el.querySelector('[data-field="tekst"]')?.value?.trim();
      const zegVal = el.querySelector('[data-field="zeg"]');
      if (kop) block.kop = kop;
      else delete block.kop;
      if (tekst) block.tekst = tekst;
      else delete block.tekst;
      if (zegVal) block.zeg = zegVal.value.trim() || null;
      return block;
    }).filter(b => b.tekst || b.kop || b.lijst);
  }

  if (kind === "bronnen") {
    return [...root.querySelectorAll(".repeater-item")].map(el => {
      const boek = el.querySelector('[data-field="boek"]')?.value?.trim();
      const detail = el.querySelector('[data-field="detail"]')?.value?.trim();
      if (!boek && !detail) return null;
      if (detail) return { boek, detail };
      return boek;
    }).filter(Boolean);
  }

  if (kind === "links") {
    return [...root.querySelectorAll(".repeater-item")].map(el => ({
      label: el.querySelector('[data-field="label"]')?.value?.trim() || "",
      url: el.querySelector('[data-field="url"]')?.value?.trim() || ""
    })).filter(l => l.label || l.url);
  }

  if (kind === "feitVsFabel") {
    return [...root.querySelectorAll(".repeater-item")].map(el => ({
      mythe: el.querySelector('[data-field="mythe"]')?.value?.trim() || "",
      feit: el.querySelector('[data-field="feit"]')?.value?.trim() || ""
    })).filter(x => x.mythe || x.feit);
  }

  return undefined;
}

function parseGenericForm(form, item) {
  const out = { ...item };
  const fd = new FormData(form);

  if (heeftBeeldEditor()) {
    const src = (fd.get("beeld.src") || "").trim();
    const alt = (fd.get("beeld.alt") || "").trim();
    const kaartPos = (fd.get("beeld.kaartPos") || "").trim();
    const detailPos = (fd.get("beeld.detailPos") || "").trim();

    if (src || alt || kaartPos || detailPos) {
      out.beeld = {};
      if (src) out.beeld.src = src;
      if (alt) out.beeld.alt = alt;
      if (kaartPos) out.beeld.kaartPos = kaartPos;
      if (detailPos) out.beeld.detailPos = detailPos;
    } else {
      delete out.beeld;
    }
  }

  for (const key of Object.keys(item)) {
    if (SKIP_FIELDS.has(key)) continue;
    const val = item[key];

    if (form.querySelector(`[data-repeater="${key}"]`)) {
      out[key] = parseRepeaterFromForm(form, key);
      continue;
    }

    if (typeof val === "boolean") {
      out[key] = form.querySelector(`[name="${key}"]`)?.checked || false;
      continue;
    }

    if (LINE_FIELDS.has(key) || (Array.isArray(val) && typeof val[0] === "string")) {
      out[key] = parseLines(fd.get(key));
      continue;
    }

    if (typeof val === "number") {
      const raw = fd.get(key);
      out[key] = raw === "" || raw === null ? val : Number(raw);
      continue;
    }

    if (typeof val === "string" || val === null || val === undefined) {
      const raw = fd.get(key);
      if (raw !== null) out[key] = raw;
    }
  }

  if (item._meta) out._meta = item._meta;
  return out;
}

function wireRepeaterForm(form) {
  form.addEventListener("click", e => {
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      e.preventDefault();
      const name = addBtn.dataset.add;
      const kind = addBtn.dataset.kind;
      const repeater = form.querySelector(`[data-repeater="${name}"]`);
      const i = repeater.querySelectorAll(".repeater-item").length;
      let html = "";
      if (kind === "blokken") html = blokItemHtml(name, i, {}, addBtn.dataset.zeg === "true");
      if (kind === "bronnen") html = bronItemHtml(i, "");
      if (kind === "links") html = linkItemHtml(i, {});
      if (kind === "feitVsFabel") html = feitItemHtml(i, {});
      repeater.insertAdjacentHTML("beforeend", html);
      markDirty();
      return;
    }

    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      e.preventDefault();
      const item = removeBtn.closest(".repeater-item");
      const repeater = removeBtn.closest(".repeater");
      if (repeater.querySelectorAll(".repeater-item").length > 1) {
        item.remove();
        repeater.querySelectorAll(".repeater-item").forEach((el, idx) => {
          const num = el.querySelector(".repeater-num");
          if (num) num.textContent = num.textContent.replace(/\d+/, String(idx + 1));
        });
        markDirty();
      }
    }
  });
}

function setBeeldPreview(form, src, { local = false } = {}) {
  const preview = form.querySelector("[data-beeld-preview]");
  if (!preview) return;
  if (!src) {
    preview.innerHTML = `<div class="beeld-preview-leeg">Nog geen beeld gekozen</div>`;
    return;
  }
  const finalSrc = local ? src : siteAssetUrl(src, String(Date.now()));
  preview.innerHTML = `<img src="${escapeAttr(finalSrc)}" alt="" data-preview-mode="${local ? "local" : "remote"}">`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Bestand kon niet gelezen worden"));
    reader.readAsDataURL(file);
  });
}

const pendingBeeldUploads = new WeakMap();

function mimeNaarExtensie(mime) {
  const map = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif"
  };
  return map[String(mime || "").toLowerCase()] || "png";
}

function maakClipboardBestandsnaam(blob, item) {
  const basis = item?.id || "clipboard-beeld";
  const ext = mimeNaarExtensie(blob?.type);
  return `${basis}.${ext}`;
}

function bestandsNaamVanPad(src, fallback = "beeld") {
  const pad = String(src || "").split("?")[0];
  const naam = pad.split("/").filter(Boolean).pop();
  return naam || fallback;
}

function downloadBlobAlsBestand(blob, naam) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = naam;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function maakPngBlobVanBeeld(blob) {
  if (blob.type === "image/png") return blob;
  if (typeof createImageBitmap !== "function") {
    throw new Error("Deze browser kan dit beeld niet omzetten voor het klembord.");
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas initialiseren mislukt.");
    }
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(pngBlob => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("Omzetten naar PNG mislukt."));
      }, "image/png");
    });
  } finally {
    bitmap.close();
  }
}

async function kopieerBlobNaarClipboard(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Deze browser ondersteunt afbeeldingen kopiëren naar het klembord niet.");
  }
  const pngBlob = await maakPngBlobVanBeeld(blob);
  await navigator.clipboard.write([
    new ClipboardItem({
      [pngBlob.type]: pngBlob
    })
  ]);
}

function clearPendingBeeldUpload(form) {
  pendingBeeldUploads.delete(form);
}

async function zetPendingBeeldUpload(form, item, blob, { localStatus } = {}) {
  const file = blob instanceof File
    ? blob
    : new File([blob], maakClipboardBestandsnaam(blob, item), { type: blob.type || "image/png" });
  const dataUrl = await fileToDataUrl(file);
  pendingBeeldUploads.set(form, { file, dataUrl });
  setBeeldPreview(form, dataUrl, { local: true });
  if (localStatus) {
    setStatus(localStatus, "");
  }
}

async function leesClipboardBeeld() {
  if (!navigator.clipboard?.read) {
    throw new Error("Deze browser laat klembordafbeeldingen alleen toe via plakken met Ctrl/⌘+V.");
  }

  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find(type => type.startsWith("image/"));
    if (imageType) {
      return item.getType(imageType);
    }
  }
  throw new Error("Geen afbeelding gevonden in het klembord.");
}

function wireBeeldForm(form, item) {
  if (!heeftBeeldEditor()) return;

  const fileInput = form.querySelector('[name="beeldBestand"]');
  const uploadBtn = form.querySelector("[data-upload-beeld]");
  const pasteBtn = form.querySelector("[data-paste-beeld]");
  const copyBtn = form.querySelector("[data-copy-beeld]");
  const downloadBtn = form.querySelector("[data-download-beeld]");
  const clearBtn = form.querySelector("[data-clear-beeld]");
  const srcInput = form.querySelector('[name="beeld.src"]');

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      clearPendingBeeldUpload(form);
      setBeeldPreview(form, srcInput?.value?.trim() || "");
      return;
    }
    try {
      await zetPendingBeeldUpload(form, item, file, {
        localStatus: "Lokale preview klaar — klik nog op Upload en bewaar daarna."
      });
    } catch (err) {
      setStatus(err.message || "Preview laden mislukt", "err");
    }
  });

  srcInput?.addEventListener("change", () => {
    if (!fileInput?.files?.length && !pendingBeeldUploads.has(form)) {
      setBeeldPreview(form, srcInput.value.trim());
    }
  });

  pasteBtn?.addEventListener("click", async () => {
    try {
      setStatus("Afbeelding uit klembord ophalen…");
      const blob = await leesClipboardBeeld();
      if (fileInput) fileInput.value = "";
      await zetPendingBeeldUpload(form, item, blob, {
        localStatus: "Afbeelding uit klembord klaar — klik nog op Upload en bewaar daarna."
      });
    } catch (err) {
      setStatus(err.message || "Klembordafbeelding ophalen mislukt", "err");
    }
  });

  copyBtn?.addEventListener("click", async () => {
    try {
      const pending = pendingBeeldUploads.get(form);
      if (pending?.file) {
        await kopieerBlobNaarClipboard(pending.file);
        setStatus("Afbeelding gekopieerd naar het klembord.", "ok");
        return;
      }

      const src = srcInput?.value?.trim() || "";
      if (!src) {
        throw new Error("Nog geen afbeelding om te kopiëren.");
      }

      setStatus("Afbeelding kopiëren…");
      const res = await fetch(siteAssetUrl(src, String(Date.now())));
      if (!res.ok) {
        throw new Error("Ik kon dit beeld niet ophalen.");
      }
      const blob = await res.blob();
      await kopieerBlobNaarClipboard(blob);
      setStatus("Afbeelding gekopieerd naar het klembord.", "ok");
    } catch (err) {
      setStatus(err.message || "Kopiëren mislukt", "err");
    }
  });

  downloadBtn?.addEventListener("click", async () => {
    try {
      const pending = pendingBeeldUploads.get(form);
      if (pending?.file) {
        downloadBlobAlsBestand(pending.file, pending.file.name || maakClipboardBestandsnaam(pending.file, item));
        setStatus("Lokale afbeelding gedownload.", "ok");
        return;
      }

      const src = srcInput?.value?.trim() || "";
      if (!src) {
        throw new Error("Nog geen afbeelding om te downloaden.");
      }

      setStatus("Afbeelding downloaden…");
      const res = await fetch(siteAssetUrl(src, String(Date.now())));
      if (!res.ok) {
        throw new Error("Ik kon dit beeld niet ophalen.");
      }
      const blob = await res.blob();
      downloadBlobAlsBestand(blob, bestandsNaamVanPad(src, `${item.id || "beeld"}.jpg`));
      setStatus("Afbeelding gedownload.", "ok");
    } catch (err) {
      setStatus(err.message || "Downloaden mislukt", "err");
    }
  });

  form.addEventListener("paste", async e => {
    const imageItem = [...(e.clipboardData?.items || [])].find(entry => entry.type?.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) {
      setStatus("Ik vond wel een afbeelding in het klembord, maar kon ze niet uitlezen.", "err");
      return;
    }
    try {
      if (fileInput) fileInput.value = "";
      await zetPendingBeeldUpload(form, item, file, {
        localStatus: "Afbeelding geplakt — klik nog op Upload en bewaar daarna."
      });
    } catch (err) {
      setStatus(err.message || "Afbeelding plakken mislukt", "err");
    }
  });

  uploadBtn?.addEventListener("click", async () => {
    const pending = pendingBeeldUploads.get(form);
    const file = pending?.file || fileInput?.files?.[0];
    if (!file) {
      setStatus("Kies of plak eerst een afbeeldingsbestand.", "err");
      return;
    }

    try {
      setStatus("Beeld uploaden…");
      const dataUrl = pending?.dataUrl || await fileToDataUrl(file);
      const res = await fetch(`/api/${state.site}/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: state.section,
          itemId: item.id,
          filename: file.name,
          dataUrl
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Upload mislukt");
      }
      if (srcInput) srcInput.value = json.src;
      clearPendingBeeldUpload(form);
      if (fileInput) fileInput.value = "";
      setBeeldPreview(form, json.src);
      markDirty();
      const maten = Array.isArray(json.responsiveWidths) && json.responsiveWidths.length
        ? json.responsiveWidths.join(", ")
        : "360, 720, 1200";
      setStatus(`Beeld opgeladen in ${maten}px — vergeet niet op te slaan.`, "ok");
    } catch (err) {
      setStatus(err.message || "Upload mislukt", "err");
    }
  });

  clearBtn?.addEventListener("click", () => {
    if (srcInput) srcInput.value = "";
    const altInput = form.querySelector('[name="beeld.alt"]');
    const kaartPosInput = form.querySelector('[name="beeld.kaartPos"]');
    const detailPosInput = form.querySelector('[name="beeld.detailPos"]');
    if (altInput) altInput.value = "";
    if (kaartPosInput) kaartPosInput.value = "";
    if (detailPosInput) detailPosInput.value = "";
    if (fileInput) fileInput.value = "";
    clearPendingBeeldUpload(form);
    setBeeldPreview(form, "");
    markDirty();
    setStatus("Beeldvelden leeggemaakt — bewaar om dit definitief te maken.", "");
  });
}

function buildEditorForm(item) {
  const s = state.section;

  if (s === "vragen") {
    return `
      <div class="field-grid">
        ${field("ID", textInput("id", item.id))}
        ${field("Vraag", textInput("vraag", item.vraag))}
        <div class="field-row">
          ${field("Thema", textInput("thema", item.thema))}
          ${field("Uitgelicht", `<div class="checkbox-row"><input type="checkbox" name="uitgelicht" id="uitgelicht"${item.uitgelicht ? " checked" : ""}><label for="uitgelicht">Toon op homepage</label></div>`)}
        </div>
        ${field("Leeftijd", textInput("leeftijd", (item.leeftijd || []).join(", ")))}
        ${linesArea("tags", item.tags, "Tags", "Één tag per regel, of komma-gescheiden in één regel.")}
        ${field("Korte samenvatting", textInput("kort", item.kort, true))}
        ${heeftBeeldEditor() ? beeldEditor(item) : ""}
        ${blokkenEditor("blokken", item.blokken)}
        ${linesArea("doeDit", item.doeDit, "Doe dit")}
        ${linesArea("vermijd", item.vermijd, "Vermijd")}
        ${field("Zeg dit", textInput("zegDit", item.zegDit, true))}
        ${bronnenEditor("bronnen", item.bronnen)}
        ${linesArea("gerelateerd", item.gerelateerd, "Gerelateerde vragen", "Één vraag-id per regel.")}
      </div>`;
  }

  if (s === "boeken") {
    return `
      <div class="field-grid">
        ${field("ID (niet wijzigen)", textInput("id", item.id))}
        ${field("Titel", textInput("titel", item.titel))}
        ${field("Auteur", textInput("auteur", item.auteur))}
        <div class="field-row">
          ${field("Jaar", `<input type="number" name="jaar" value="${item.jaar ?? ""}">`)}
          ${field("Icoon", textInput("icoon", item.icoon))}
        </div>
        ${field("Kleur", textInput("kleur", item.kleur))}
        ${field("Kern", textInput("kern", item.kern, true))}
        ${linesArea("bullets", item.bullets, "Kernpunten")}
        ${field("Thema's", textInput("themas", (item.themas || []).join(", ")))}
        ${field("Leeftijd", textInput("leeftijd", (item.leeftijd || []).join(", ")))}
        ${linksEditor("koopLinks", item.koopLinks)}
      </div>`;
  }

  if (s === "mythes") {
    return `
      <div class="field-grid">
        ${field("ID", textInput("id", item.id))}
        ${field("Mythe", textInput("mythe", item.mythe, true))}
        ${field("Feit", textInput("feit", item.feit, true))}
        ${field("Bron (boek-id)", textInput("bron", item.bron))}
        ${field("Bron detail", textInput("bronDetail", item.bronDetail, true))}
        ${field("Leeftijd", textInput("leeftijd", (item.leeftijd || []).join(", ")))}
      </div>`;
  }

  if (s === "mytheLeeftijden") {
    return `
      <div class="field-grid">
        ${field("Mythe-id", textInput("id", item.id))}
        ${field("Leeftijden", textInput("leeftijd", (item.leeftijd || []).join(", ")))}
      </div>`;
  }

  if (s === "noodhulp") {
    return `
      <div class="field-grid">
        ${field("ID", textInput("id", item.id))}
        ${field("Titel", textInput("titel", item.titel))}
        ${field("Icoon", textInput("icoon", item.icoon))}
        ${field("Korte intro", textInput("kort", item.kort, true))}
        ${blokkenEditor("stappen", item.stappen, { zeg: true, label: "Stappen" })}
        ${bronnenEditor("bronnen", item.bronnen)}
      </div>`;
  }

  if (s === "crisislijnen") {
    return `
      <div class="field-grid">
        ${field("Naam", textInput("naam", item.naam))}
        ${field("Nummer", textInput("nummer", item.nummer))}
        ${field("Uitleg", textInput("uitleg", item.uitleg, true))}
      </div>`;
  }

  if (s === "regels") {
    return `
      <div class="field-grid">
        ${item.id ? field("ID", textInput("id", item.id)) : ""}
        ${field("Titel", textInput("titel", item.titel || item.regel))}
        ${field("Tekst", textInput("tekst", item.tekst || item.uitleg, true))}
        ${field("Bron (boek-id)", textInput("bron", item.bron))}
      </div>`;
  }

  if (s === "themas" || s === "leeftijden") {
    return `
      <div class="field-grid">
        ${field("ID", textInput("id", item.id))}
        ${field("Naam", textInput("naam", item.naam))}
        ${item.icoon !== undefined ? field("Icoon", textInput("icoon", item.icoon)) : ""}
        ${item.accent !== undefined ? field("Accentkleur", textInput("accent", item.accent)) : ""}
        ${item.uitleg !== undefined ? field("Uitleg", textInput("uitleg", item.uitleg, true)) : ""}
      </div>`;
  }

  if (s === "onderzoeken") {
    return `
      <div class="field-grid">
        ${field("ID", textInput("id", item.id))}
        ${field("Titel", textInput("titel", item.titel))}
        ${field("Haakje", textInput("haakje", item.haakje, true))}
        ${field("Thema", textInput("thema", item.thema))}
        ${field("Leeftijd", textInput("leeftijd", (item.leeftijd || []).join(", ")))}
        ${field("Wat onderzocht", textInput("wat", item.wat, true))}
        ${field("Wat bleek", textInput("bleek", item.bleek, true))}
        ${field("Thuis", textInput("thuis", item.thuis, true))}
        ${field("Nuance", textInput("nuance", item.nuance, true))}
        ${field("Primaire bron", textInput("primaireBron", item.primaireBron, true))}
        ${linesArea("boeken", item.boeken, "Gerelateerde boeken", "Één boek-id per regel.")}
        ${linesArea("tags", item.tags, "Tags")}
      </div>`;
  }

  return buildGenericForm(item);
}

function parseForm(form, item) {
  const s = state.section;
  const fd = new FormData(form);

  if (["therapieen", "therapieWegwijzers", "concepten", "hechtingsstijlen", "stoornissen"].includes(s)) {
    return parseGenericForm(form, item);
  }

  const out = { ...item };

  if (s === "vragen") {
    out.id = fd.get("id");
    out.vraag = fd.get("vraag");
    out.thema = fd.get("thema");
    out.uitgelicht = form.querySelector('[name="uitgelicht"]')?.checked || false;
    out.leeftijd = splitList(fd.get("leeftijd") || "");
    out.tags = parseLines(fd.get("tags"));
    out.kort = fd.get("kort");
    out.blokken = parseRepeaterFromForm(form, "blokken");
    out.doeDit = parseLines(fd.get("doeDit"));
    out.vermijd = parseLines(fd.get("vermijd"));
    out.zegDit = fd.get("zegDit") || null;
    out.bronnen = parseRepeaterFromForm(form, "bronnen");
    out.gerelateerd = parseLines(fd.get("gerelateerd"));
    if (heeftBeeldEditor()) {
      const src = (fd.get("beeld.src") || "").trim();
      const alt = (fd.get("beeld.alt") || "").trim();
      const kaartPos = (fd.get("beeld.kaartPos") || "").trim();
      const detailPos = (fd.get("beeld.detailPos") || "").trim();
      if (src || alt || kaartPos || detailPos) {
        out.beeld = {};
        if (src) out.beeld.src = src;
        if (alt) out.beeld.alt = alt;
        if (kaartPos) out.beeld.kaartPos = kaartPos;
        if (detailPos) out.beeld.detailPos = detailPos;
      } else {
        delete out.beeld;
      }
    }
    if (item._meta) out._meta = item._meta;
    return out;
  }

  if (s === "boeken") {
    out.titel = fd.get("titel");
    out.auteur = fd.get("auteur");
    out.jaar = Number(fd.get("jaar")) || item.jaar;
    out.icoon = fd.get("icoon");
    out.kleur = fd.get("kleur");
    out.kern = fd.get("kern");
    out.bullets = parseLines(fd.get("bullets"));
    out.themas = splitList(fd.get("themas") || "");
    out.leeftijd = splitList(fd.get("leeftijd") || "");
    out.koopLinks = parseRepeaterFromForm(form, "koopLinks");
    return out;
  }

  if (s === "mythes") {
    out.mythe = fd.get("mythe");
    out.feit = fd.get("feit");
    out.bron = fd.get("bron");
    out.bronDetail = fd.get("bronDetail");
    out.leeftijd = splitList(fd.get("leeftijd") || "");
    return out;
  }

  if (s === "mytheLeeftijden") {
    return { id: item.id, leeftijd: splitList(fd.get("leeftijd") || "") };
  }

  if (s === "noodhulp") {
    out.id = fd.get("id");
    out.titel = fd.get("titel");
    out.icoon = fd.get("icoon");
    out.kort = fd.get("kort");
    out.stappen = parseRepeaterFromForm(form, "stappen");
    out.bronnen = parseRepeaterFromForm(form, "bronnen");
    return out;
  }

  if (s === "crisislijnen") {
    out.naam = fd.get("naam");
    out.nummer = fd.get("nummer");
    out.uitleg = fd.get("uitleg");
    return out;
  }

  if (s === "regels") {
    if (fd.get("id")) out.id = fd.get("id");
    out.titel = fd.get("titel");
    out.tekst = fd.get("tekst");
    out.bron = fd.get("bron");
    delete out.regel;
    delete out.uitleg;
    return out;
  }

  if (s === "themas" || s === "leeftijden") {
    out.id = fd.get("id");
    out.naam = fd.get("naam");
    if (fd.get("icoon") !== null) out.icoon = fd.get("icoon");
    if (fd.get("accent") !== null) out.accent = fd.get("accent");
    if (fd.get("uitleg") !== null) out.uitleg = fd.get("uitleg");
    return out;
  }

  if (s === "onderzoeken") {
    out.id = fd.get("id");
    out.titel = fd.get("titel");
    out.haakje = fd.get("haakje");
    out.thema = fd.get("thema");
    out.leeftijd = splitList(fd.get("leeftijd") || "");
    out.wat = fd.get("wat");
    out.bleek = fd.get("bleek");
    out.thuis = fd.get("thuis");
    out.nuance = fd.get("nuance");
    out.primaireBron = fd.get("primaireBron");
    out.boeken = parseLines(fd.get("boeken"));
    out.tags = parseLines(fd.get("tags"));
    return out;
  }

  return out;
}

function renderEditor() {
  const panel = $("editor");
  if (!state.selectedId) {
    panel.innerHTML = `<p class="editor-empty">Kies een item in de lijst om te bewerken.</p>`;
    return;
  }

  const item = findItem(state.selectedId);
  if (!item) {
    panel.innerHTML = `<p class="editor-empty">Item niet gevonden.</p>`;
    return;
  }

  const title = itemTitle(item, state.section);
  const llmTools = state.section === "vragen" ? `
    <div class="llm-hint">
      LLM-workflow: klik <strong>Copy for LLM</strong>, plak in je LLM, en plak het antwoord terug met <kbd>⌘</kbd>+<kbd>V</kbd> (of <kbd>Ctrl</kbd>+<kbd>V</kbd>).
    </div>` : "";
  const llmButtons = state.section === "vragen" ? `
      <button type="button" class="btn btn-secondary" id="btn-copy-llm">Copy for LLM</button>` : "";

  panel.innerHTML = `
    <div class="editor-header">
      <h2>${escapeHtml(title)}</h2>
      <div class="editor-header-actions">
        ${llmButtons}
        <button type="button" class="btn btn-secondary" id="btn-apply">Toepassen in geheugen</button>
      </div>
    </div>
    ${llmTools}
    <form id="edit-form">${buildEditorForm(item)}</form>`;

  if (state.section === "vragen") {
    $("btn-copy-llm")?.addEventListener("click", () => copyVraagForLlm(item));
  }

  $("btn-apply").addEventListener("click", () => {
    const form = $("edit-form");
    const parsed = parseForm(form, item);
    if (!parsed) return;

    if (state.section === "mytheLeeftijden") {
      state.data.mytheLeeftijden[item.id] = parsed.leeftijd;
    } else if (sectionMeta().type === "object") {
      state.data.boeken[item.id] = parsed;
    } else {
      const idx = state.data[state.section].findIndex(i => i.id === item.id);
      if (idx >= 0) state.data[state.section][idx] = parsed;
    }
    markDirty();
    setStatus("Wijziging toegepast (nog niet opgeslagen)", "");
    renderList();
  });

  const form = $("edit-form");
  wireRepeaterForm(form);
  wireBeeldForm(form, item);
  form.addEventListener("change", e => {
    if (e.target?.matches?.('input[type="file"]')) return;
    markDirty();
  });
  form.addEventListener("input", e => {
    if (e.target?.matches?.('input[type="file"]')) return;
    markDirty();
  });
}

async function copyVraagForLlm(item) {
  const prompt = window.LlmVraag.buildPrompt(state.site, item, state.data?.boeken);
  try {
    await navigator.clipboard.writeText(prompt);
    setStatus("Prompt gekopieerd — plak in je LLM", "ok");
  } catch {
    setStatus("Kopiëren mislukt (browserrechten?)", "err");
  }
}

async function handleVraagLlmPaste(e) {
  if (state.section !== "vragen" || !state.selectedId) return;
  const text = e.clipboardData?.getData("text/plain") || "";
  if (!text.includes(window.LlmVraag.MARKER)) return;

  e.preventDefault();
  const form = $("edit-form");
  if (!form) return;

  const parsed = window.LlmVraag.parseResponse(text);
  if (!parsed) {
    setStatus("LLM-antwoord niet herkend — controleer het formaat", "err");
    return;
  }

  window.LlmVraag.applyToForm(form, parsed, {
    blokItemHtml,
    bronItemHtml
  });
  markDirty();
  setStatus("LLM-antwoord geplakt — controleer en bewaar", "ok");
}

function applyCurrentForm() {
  const form = $("edit-form");
  if (!form || !state.selectedId) return true;
  const item = findItem(state.selectedId);
  if (!item) return true;
  const parsed = parseForm(form, item);
  if (!parsed) return false;

  if (state.section === "mytheLeeftijden") {
    state.data.mytheLeeftijden[item.id] = parsed.leeftijd;
  } else if (sectionMeta().type === "object") {
    state.data.boeken[item.id] = parsed;
  } else {
    const idx = state.data[state.section].findIndex(i => i.id === item.id);
    if (idx >= 0) state.data[state.section][idx] = parsed;
  }
  return true;
}

async function uploadPendingBeeldAlsNodig() {
  const form = document.getElementById("edit-form");
  if (!form) return;
  const pending = pendingBeeldUploads.get(form);
  if (!pending?.file) return;
  const srcInput = form.querySelector('[name="beeld.src"]');
  const fileInput = form.querySelector('[name="beeldBestand"]');
  setStatus("Beeld uploaden voor opslaan…");
  const dataUrl = pending.dataUrl || await fileToDataUrl(pending.file);
  const res = await fetch(`/api/${state.site}/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section: state.section,
      itemId: findItem(state.selectedId)?.id,
      filename: pending.file.name,
      dataUrl
    })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Beeld uploaden mislukt");
  if (srcInput) srcInput.value = json.src;
  clearPendingBeeldUpload(form);
  if (fileInput) fileInput.value = "";
  // Gebruik de lokale dataUrl als preview zodat de admin-server niet de website-server hoeft te zijn
  setBeeldPreview(form, dataUrl, { local: true });
}

async function saveAll() {
  try {
    await uploadPendingBeeldAlsNodig();
  } catch (err) {
    setStatus(err.message || "Beeld uploaden mislukt", "err");
    return;
  }
  if (!applyCurrentForm()) return;
  setStatus("Opslaan…");
  const res = await fetch(`/api/${state.site}/save-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: state.data })
  });
  const json = await res.json();
  if (!res.ok) {
    setStatus(json.error || "Opslaan mislukt", "err");
    return;
  }
  state.dirty = false;
  setStatus(json.message, "ok");
}

async function saveSection() {
  try {
    await uploadPendingBeeldAlsNodig();
  } catch (err) {
    setStatus(err.message || "Beeld uploaden mislukt", "err");
    return;
  }
  if (!applyCurrentForm()) return;
  setStatus("Sectie opslaan…");
  const res = await fetch(`/api/${state.site}/save/${state.section}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: sectionData() })
  });
  const json = await res.json();
  if (!res.ok) {
    setStatus(json.error || "Opslaan mislukt", "err");
    return;
  }
  setStatus(json.message, "ok");
}

async function init() {
  await loadConfig();
  renderSiteTabs();
  renderSectionNav();
  await loadData();
  renderList();
  renderEditor();

  $("search").addEventListener("input", renderList);
  $("btn-reload").addEventListener("click", async () => {
    if (state.dirty && !confirm("Niet-opgeslagen wijzigingen gaan verloren. Doorgaan?")) return;
    await loadData();
    renderList();
    renderEditor();
  });
  $("btn-save-all").addEventListener("click", saveAll);
  $("btn-save-section").addEventListener("click", saveSection);
  document.addEventListener("paste", handleVraagLlmPaste);

  window.addEventListener("beforeunload", e => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

init().catch(err => setStatus(err.message, "err"));
