# SILQ

Webbplats för SILQ UF — satinfodrade skullcaps.

Statisk sida, publicerad via GitHub Pages. Ingen server, inget bygg­steg.

> Bygger du en ny sajt? Läs **[GUIDE.md](GUIDE.md)** — mönstren och koden
> från den här sajten, skrivna för att återanvändas.

## Ändra priser, frakt och Swish-nummer

Allt affärskritiskt ligger i **`config.js`**. Ändra där — inte i HTML-filerna.

| Värde | Var |
|---|---|
| Produkter: pris, färg, bilder, lagerstatus | `config.js` → `produkter` (lista — lägg till en rad per produkt) |
| Fri frakt över ett belopp | `config.js` → `frakt.friFran` |
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

## Publicera sidan

Pages måste slås på för hand en gång. Det går inte att automatisera:
både repo-API:et och Actions-tokenen nekas med
`Resource not accessible by integration`.

1. https://github.com/nilssoncaesar/SILQ-Uf/settings/pages
2. Source: **Deploy from a branch**
3. Branch: **main**, mapp: **/ (root)** → Save

Sidan ligger sedan på https://nilssoncaesar.github.io/SILQ-Uf/

`.nojekyll` finns redan, så Jekyll hoppas över och filer som börjar med
understreck serveras som de ska.

### När silquf.com kopplas på

Absoluta URL:er (canonical, og:url, sitemap, robots) pekar på
github.io-adressen. Byt dem i ett svep:

```
grep -rl 'nilssoncaesar.github.io/SILQ-Uf' . \
  | xargs sed -i 's|https://nilssoncaesar.github.io/SILQ-Uf|https://silquf.com|g'
```

Lägg också en fil `CNAME` i roten som bara innehåller `silquf.com`.

## Lokalt

```
node verktyg/server.js .
```

Öppna http://localhost:8765/ — servern skickar inga cache-huvuden, så
ändringar syns direkt vid omladdning. (`python3 -m http.server` går också
om Python finns.)

## Verktyg

`verktyg/` hör inte till sajten, men används när den byggs:

| Fil | Gör |
|---|---|
| `frilagg.js` | Frilägger produktfoton mot vit bakgrund |
| `server.js` | Lokal server utan cache |
| `test.js` | Öppnar sajten i headless Chrome, tar skärmdumpar på desktop och mobil, listar konsolfel |

Kör `npm install` i `verktyg/` först. Se GUIDE.md för hur de används.
