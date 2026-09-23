/* SILQ — all business-critical values live here.
   Ändra här, inte i sidorna. */

window.SILQ = {

  /* --- Sortiment ---
     Lägg till en ny produkt genom att lägga ett nytt objekt i listan.
     Den dyker då upp av sig själv i butiken, på startsidan och i kassan.

     id        unik, kort, gemener-med-bindestreck. Används i varukorgen.
               Byt ALDRIG id på en produkt som redan sålts — gamla
               varukorgar slutar hitta den.
     status    'i-lager' | 'slut' | 'kommer'  — styr om den går att köpa.
     bilder    första bilden är omslaget i listor och varukorg.
     modell3d  true visar 3D-vyn på produkten. Bara skullcapen har en
               modell just nu. */
  produkter: [
    {
      id: 'skullcap-svart',
      namn: 'Satinfodrad skullcap',
      variant: 'Svart',
      pris: 199,
      maxAntal: 10,
      status: 'i-lager',
      sida: 'produkten.html',
      modell3d: true,
      kort: 'Ren svart skullcap med satinfoder. Snygg utanpå, skonsam mot håret.',
      bilder: [
        { src: 'assets/produkt/hero-vit.jpg',   alt: 'SILQ satinfodrad skullcap i svart' },
        { src: 'assets/produkt/foder.jpg',      alt: 'SILQ-skullcaps med det silvriga satinfodret synligt' },
        { src: 'assets/produkt/detalj-vit.jpg', alt: 'Närbild på SILQ-logotypen på skullcapens mudd' }
      ]
    }

    /* Exempel — kopiera, fyll i, ta bort kommentaren:
    ,{
      id: 'durag-svart',
      namn: 'Silkesdurag',
      variant: 'Svart',
      pris: 149,
      maxAntal: 10,
      status: 'kommer',
      sida: 'produkten.html',
      modell3d: false,
      kort: 'Kort säljande mening om produkten.',
      bilder: [
        { src: 'assets/produkt/durag.jpg', alt: 'SILQ silkesdurag i svart' }
      ]
    }
    */
  ],

  // --- Frakt ---
  frakt: {
    avgift: 49,           // kr, fast fraktavgift oavsett antal varor
    beskrivning: 'PostNord, 2–5 arbetsdagar',
    friFran: null         // kr — sätt t.ex. 499 för fri frakt över den summan
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

/* Slår upp en produkt på id. Returnerar null om den inte finns — t.ex. när
   en gammal varukorg pekar på en produkt som tagits bort ur sortimentet. */
window.SILQ.hittaProdukt = function (id) {
  var lista = window.SILQ.produkter;
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].id === id) return lista[i];
  }
  return null;
};

/* Produkter som faktiskt går att lägga i varukorgen. */
window.SILQ.kopbara = function () {
  return window.SILQ.produkter.filter(function (p) { return p.status === 'i-lager'; });
};
