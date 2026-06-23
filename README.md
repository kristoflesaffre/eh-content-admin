# EHBO & EHBT — Contentbeheer

Beheerinterface om alle teksten van beide websites te bewerken en terug te schrijven naar de `js/data-*.js` bestanden.

## Starten

```bash
cd eh-content-admin
node server/index.js
```

Open daarna **http://localhost:4180** in je browser.

Zorg dat de publieke sites ook draaien als je wilt previewen:

- EHBO: `npx serve . -l 4173` (in de map `website opvoeden`)
- EHBT: `npx serve . -l 4174` (in de map `website trauma`)

## Gebruik

1. Kies **EHBO** of **EHBT** bovenaan.
2. Kies een sectie links (vragen, boeken, mythes, …).
3. Zoek en selecteer een item.
4. Pas teksten aan en klik **Toepassen in geheugen**.
5. Klik **Bewaar alles** om alle wijzigingen naar de website-bestanden te schrijven.

**Bewaar sectie** slaat alleen de huidige sectie op (sneller als je maar één onderdeel wijzigde).

## Paden

Paden staan in `config.json`:

- `ehbo.path` → map van de opvoed-site (standaard `../website opvoeden`)
- `ehbt.path` → map van de trauma-site (standaard `../website trauma`)

Pas deze aan als je mappen ergens anders staan.

## Veiligheid

- Wijzigingen worden direct naar de `.js` databestanden geschreven. Maak een backup of gebruik git voordat je grotere aanpassingen doet.
- Optioneel: zet `adminToken` in `config.json` en stuur die mee als header `X-Admin-Token` bij save-requests.

## LLM-workflow (vragen)

1. Open een vraag in sectie **Vragen & antwoorden**
2. Klik **Copy for LLM** — prompt + huidige inhoud worden gekopieerd
3. Plak in ChatGPT/Claude en vraag om te herschrijven
4. Kopieer het LLM-antwoord en plak terug in de admin met **⌘V** (Mac) of **Ctrl+V** (Windows)
5. Controleer de velden en klik **Bewaar alles**

Het antwoord moet de markers `<<<ADMIN_VRAAG_ANTWOORD>>>` en `<<<EIND>>>` bevatten (staan in de prompt).

## Techniek

De server laadt JavaScript-databestanden via Node's `vm`-module en schrijft ze opnieuw met behoud van helpercode (zoals `maakKoopLinks` en `MYTHES.forEach`).
