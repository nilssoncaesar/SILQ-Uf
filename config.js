/* SILQ — all business-critical values live here.
   Ändra här, inte i sidorna. */

window.SILQ = {
  // --- Produkt ---
  produkt: {
    namn: 'SILQ Satinfodrad skullcap',
    pris: 199,            // kr, slutpris till kund (SILQ är ej momsregistrerat)
    farg: 'Svart',       // enda färgen just nu
    maxAntal: 10
  },

  // --- Frakt ---
  frakt: {
    avgift: 49,           // kr, fast fraktavgift — bekräfta med SILQ
    beskrivning: 'PostNord, 2–5 arbetsdagar'
  },

  // --- Betalning ---
  // Kassan är "mörk" så länge nummer är null: ordern tas emot, men ingen
  // QR-kod visas — kunden får besked om att betalinfo mejlas.
  //
  // typ: 'privat'  = en grundares mobilnummer. TILLFÄLLIG lösning.
  //      'foretag' = Swish Företag-nummer (börjar på 123).
  //
  // Byt till Swish Företag så snart det finns: sätt typ till 'foretag',
  // lägg in 123-numret och sätt mottagare till firmanamnet. Texten om vem
  // betalningen går till försvinner då av sig själv.
  swish: {
    nummer: '0736879615',  // privat: '0701234567'   företag: '1234567890'
    typ: 'privat',
    mottagare: 'Moaawia Alla Eddin' // MÅSTE matcha namnet Swish-appen visar
  },

  // --- Kontakt ---
  kontakt: {
    epost: 'kontakt.silquf@gmail.com',
    foretag: 'SILQ UF',
    orgnr: 'TODO'         // fylls i när UF-registreringen är klar
  },

  // --- Orderhantering ---
  // Formulärtjänst som mejlar ordern till kontakt-adressen ovan.
  form: {
    endpoint: 'TODO',     // Web3Forms access key sätts här
    ordernummerPrefix: 'SILQ-'
  }
};
