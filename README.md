# SILQ

Webbplats för SILQ UF — satinfodrade mossor.

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
mejlas i stället för att se en QR-kod. Sätt numret så visas QR-koden.

### Privat nummer eller Swish Företag

`swish.typ` styr vilket läge kassan är i:

| typ | nummer | mottagare |
|---|---|---|
| `'privat'` | en grundares mobilnummer, t.ex. `'0701234567'` | personens namn så som det visas i Swish-appen |
| `'foretag'` | Swish Företag-nummer, börjar på 123 | `'SILQ UF'` |

Med `'privat'` visas en förklaring i kassan om att betalningen tas emot av
en privatperson för SILQ:s räkning — annars ser kunden ett okänt personnamn
i Swish-appen och tror att något är fel.

**Privat Swish är en tillfällig lösning.** Swish egna villkor tillåter inte
att privatkonton används för företagsbetalningar, och pengarna blandas ihop
med privatekonomin. Byt till Swish Företag så snart det går: ändra `typ`
till `'foretag'`, lägg in 123-numret och sätt `mottagare` till `SILQ UF`.
Förklaringstexten försvinner då automatiskt.

Så länge privat nummer används: för egen lista över varje betalning
(datum, belopp, ordernummer) och för över pengarna till företagskontot när
det finns, så bokföringen går att följa.

Betalningar bekräftas manuellt: SILQ matchar ordernumret i Swish-appen mot
ordermejlet och skickar varan.

## Lokalt

```
python3 -m http.server 8000
```

Öppna http://localhost:8000
