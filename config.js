/* SILQ — all business-critical values live here.
   Ändra här, inte i sidorna. */

window.SILQ = {
  // --- Produkt ---
  produkt: {
    namn: 'SILQ Satinfodrad mossa',
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
  // Sätts när Swish Företag-numret finns. Tills dess är kassan "mörk":
  // ordern tas emot, men QR-koden visas inte.
  swish: {
    nummer: null,         // t.ex. '1234567890' (10 siffror, utan bindestreck)
    mottagare: 'SILQ UF'
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
