# SILQ

Webbplats för SILQ UF — silkesmossor.

Statisk sida, publicerad via GitHub Pages. Ingen server, inget bygg­steg.

## Ändra priser, frakt och Swish-nummer

Allt affärskritiskt ligger i **`config.js`**. Ändra där — inte i HTML-filerna.

| Värde | Var |
|---|---|
| Pris, färg, max antal | `config.js` → `produkt` |
| Fraktavgift | `config.js` → `frakt` |
| Swish-nummer | `config.js` → `swish.nummer` |
| E-post för ordrar | `config.js` → `kontakt.epost` |
| Formulärnyckel (Web3Forms) | `config.js` → `form.endpoint` |

## Betalning

Kunden beställer via formuläret i `kassa.html`. Ordern mejlas till SILQ och
kunden får en QR-kod att betala med i Swish-appen.

QR-koden byggs i webbläsaren från Swish payload-format
`C{nummer};{belopp};{meddelande};0` — sista siffran låser mottagare, belopp
och meddelande så kunden inte kan ändra dem.

**Så länge `config.js` → `swish.nummer` är `null` körs kassan "mörk":**
beställningen tas emot, men kunden får besked om att betalinformation
mejlas i stället för att se en QR-kod. Sätt numret när Swish Företag är på
plats, så visas QR-koden automatiskt.

Betalningar bekräftas manuellt: SILQ matchar ordernumret i Swish-appen mot
ordermejlet och skickar varan.

## Lokalt

```
python3 -m http.server 8000
```

Öppna http://localhost:8000
