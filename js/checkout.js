/* SILQ — kassa och Swish-betalning.
   QR-koden byggs i webbläsaren. Ingen server, inget API-anrop.

   Kassan äger inga antal själv: allt kommer ur varukorgen (cart.js), och
   ändrar kunden ett antal här skrivs det tillbaka dit. Därför visar menyns
   antalsbubbla alltid samma siffra som kassan.

   Swish QR-format:  C{nummer};{belopp};{meddelande};{lås}
   Låset börjar på 7 och minskar med 1 (nummer), 2 (belopp), 4 (meddelande).
   0 = alla tre låsta, vilket är vad vi vill ha. */

(function () {
  'use strict';

  var C = window.SILQ;
  var korg = window.SILQkorg;
  if (!C || !korg) return;

  /* ---------- Ordernummer ---------- */

  function nyttOrdernummer() {
    var tid = Date.now().toString(36).slice(-5).toUpperCase();
    var slump = Math.random().toString(36).slice(2, 4).toUpperCase();
    return C.form.ordernummerPrefix + tid + slump;
  }

  /* ---------- Hjälpare ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function kr(n) { return n.toLocaleString('sv-SE') + ' kr'; }

  function fulltNamn(p) {
    return p.variant ? p.namn + ' — ' + p.variant : p.namn;
  }

  /* Ordern fryser sin egen summering. Efter lagd order töms varukorgen, och
     då finns inget kvar att räkna på när betalsteget ritas. */
  function frysOrder(s) {
    return {
      rader: s.rader.map(function (r) {
        return {
          id: r.produkt.id,
          namn: fulltNamn(r.produkt),
          pris: r.produkt.pris,
          antal: r.antal,
          radsumma: r.radsumma
        };
      }),
      antalVaror: s.antalVaror,
      varor: s.varor,
      frakt: s.frakt,
      total: s.total
    };
  }

  /* ---------- Ordersammanfattning ---------- */

  function rad(namn, varde, total) {
    return '<div class="summary__line' + (total ? ' summary__line--total' : '') + '">' +
           '<span>' + namn + '</span><span>' + varde + '</span></div>';
  }

  /* Samma stegfält som på produktsidan: minus, skrivbart antal, plus.
     Själva stegandet sköts av cart.js; här ritas bara fältet. */
  function antalsvaljare(r) {
    var id = esc(r.produkt.id);
    var max = r.produkt.maxAntal || 10;
    var namn = esc(fulltNamn(r.produkt));
    return '<div class="antal antal--liten" data-antal data-antal-id="' + id + '">' +
      '<button type="button" class="antal__steg" data-steg="-1" aria-label="Minska antal — ' + namn + '"' +
        (r.antal <= 1 ? ' disabled' : '') + '>&minus;</button>' +
      '<input type="number" inputmode="numeric" min="1" max="' + max + '" value="' + r.antal + '" ' +
        'data-korg-antal="' + id + '" aria-label="Antal — ' + namn + '">' +
      '<button type="button" class="antal__steg" data-steg="1" aria-label="Öka antal — ' + namn + '"' +
        (r.antal >= max ? ' disabled' : '') + '>+</button>' +
    '</div>';
  }

  function ritaSummering(el, s) {
    if (!el) return;

    if (!s.rader.length) {
      el.innerHTML =
        '<p class="korg-tom">Varukorgen är tom.</p>' +
        '<p style="margin:0"><a class="btn btn--ghost" href="produkten.html">Till produkten</a></p>';
      return;
    }

    var rader = s.rader.map(function (r) {
      var bild = r.produkt.bilder && r.produkt.bilder[0];
      return '<div class="korgrad">' +
        (bild ? '<img class="korgrad__bild" src="' + esc(bild.src) + '" alt="" width="64" height="64">' : '') +
        '<div class="korgrad__text">' +
          '<p class="korgrad__namn">' + esc(fulltNamn(r.produkt)) + '</p>' +
          '<p class="korgrad__pris">' + kr(r.produkt.pris) + ' / st</p>' +
          '<button type="button" class="korgrad__bort" data-korg-bort="' + esc(r.produkt.id) + '">Ta bort</button>' +
        '</div>' +
        antalsvaljare(r) +
        '<span class="korgrad__summa">' + kr(r.radsumma) + '</span>' +
      '</div>';
    }).join('');

    var fraktText = s.frakt === 0
      ? 'Frakt — fri frakt'
      : 'Frakt — ' + esc(C.frakt.beskrivning);

    el.innerHTML =
      '<div class="korgrader">' + rader + '</div>' +
      rad('Varor', kr(s.varor)) +
      rad(fraktText, kr(s.frakt)) +
      rad('Att betala', kr(s.total), true);
  }

  /* Betalstegets radlista — samma innehåll, men utan knappar att ändra en
     order som redan är lagd. */
  function ritaOrderrader(order) {
    return order.rader.map(function (r) {
      return rad(esc(r.namn) + ' × ' + r.antal, kr(r.radsumma));
    }).join('') +
    rad(order.frakt === 0 ? 'Frakt — fri frakt' : 'Frakt', kr(order.frakt)) +
    rad('Att betala', kr(order.total), true);
  }

  /* ---------- Swish ---------- */

  function swishStrang(nummer, belopp, referens) {
    return 'C' + nummer + ';' + belopp + ';' + referens + ';0';
  }

  function ritaQr(el, data) {
    if (!el || typeof qrcode !== 'function') return false;
    var q = qrcode(0, 'M');
    q.addData(data);
    q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
    var svg = el.querySelector('svg');
    if (svg) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); }
    return true;
  }

  /* Betalar kunden till en privatpersons Swish visas ett annat namn än SILQ
     i appen. Utan förklaring ser det ut som ett bedrägeriförsök, så vi säger
     rakt ut vem som tar emot. Försvinner automatiskt när typ blir 'foretag'. */
  function mottagarnotis() {
    if (C.swish.typ !== 'privat') return '';
    return '<div class="notice" style="text-align:left;margin-top:8px">' +
           'Betalningen tas emot av <strong>' + esc(C.swish.mottagare) + '</strong> ' +
           'för SILQ UF:s räkning. Det är därför ett personnamn som visas i ' +
           'Swish-appen och inte SILQ. Din order hanteras av SILQ som vanligt.' +
           '</div>';
  }

  /* Visar betalsteget. Saknas Swish-numret i config körs kassan "mörk":
     ordern tas emot, men kunden får besked om att betalinfo mejlas. */
  function visaBetalning(root, order, offline) {
    var offlineNotis = offline
      ? '<div class="notice notice--wait" style="margin-bottom:16px">' +
        '<strong>Ett steg kvar.</strong> Din best&auml;llning &auml;r inte skickad &auml;nnu &mdash; ' +
        'tryck p&aring; knappen s&aring; &ouml;ppnas ett f&auml;rdigskrivet mejl till oss.<br><br>' +
        '<a class="btn" href="' + mailtoLank(order) + '">Skicka best&auml;llningen med mejl</a>' +
        '</div>'
      : '';

    if (!C.swish.nummer) {
      root.innerHTML = offlineNotis +
        '<div class="notice notice--wait">' +
        '<strong>Din beställning är registrerad.</strong><br>' +
        'Vi mejlar betalningsinformation till ' + esc(order.epost) +
        ' inom kort. Ange <strong>' + esc(order.ordernummer) + '</strong> som meddelande när du betalar.' +
        '</div>';
      return;
    }

    var data = swishStrang(C.swish.nummer, order.total, order.ordernummer);
    var varorna = order.antalVaror === 1 ? 'din skullcap' : 'dina varor';

    root.innerHTML = offlineNotis +
      '<div class="swish">' +
        '<h3>Betala ' + kr(order.total) + ' med Swish</h3>' +
        '<div class="swish__qr" id="qr"></div>' +
        '<p>Skanna med Swish-appen, eller betala manuellt:</p>' +
        '<p><strong>' + esc(C.swish.mottagare) + '</strong><br>' +
        'Swish-nummer: <strong>' + esc(C.swish.nummer) + '</strong><br>' +
        'Belopp: <strong>' + kr(order.total) + '</strong></p>' +
        mottagarnotis() +
        '<p>Meddelande — måste anges:</p>' +
        '<p><span class="swish__ref">' + esc(order.ordernummer) + '</span></p>' +
        '<p><button type="button" class="btn btn--ghost" id="kopiera">Kopiera ordernummer</button></p>' +
        '<p class="field__hint">Vi skickar ' + varorna + ' när betalningen kommit in, ' +
        'normalt samma eller nästa vardag.</p>' +
      '</div>';

    if (!ritaQr(document.getElementById('qr'), data)) {
      var q = document.getElementById('qr');
      if (q) q.style.display = 'none';
    }

    var knapp = document.getElementById('kopiera');
    if (knapp) {
      knapp.addEventListener('click', function () {
        navigator.clipboard.writeText(order.ordernummer).then(function () {
          knapp.textContent = 'Kopierat';
          setTimeout(function () { knapp.textContent = 'Kopiera ordernummer'; }, 2000);
        }).catch(function () { knapp.textContent = 'Kunde inte kopiera'; });
      });
    }
  }

  /* ---------- Formulär ---------- */

  function validera(form) {
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (f) {
      var falt = f.closest('.field');
      var giltig = f.checkValidity() && f.value.trim() !== '';
      if (falt) falt.classList.toggle('is-invalid', !giltig);
      if (!giltig && ok) { f.focus(); ok = false; }
    });
    return ok;
  }

  function orderrader(order) {
    return order.rader.map(function (r) {
      return '  ' + r.namn + ' × ' + r.antal + ' — ' + r.radsumma + ' kr';
    }).join('\n');
  }

  /* Reserv när formulärtjänsten inte är konfigurerad: kunden får en
     färdigskriven mejllänk i stället för ett felmeddelande, så beställningen
     går fram ändå. */
  function mailtoLank(order) {
    var rader = [
      'Ordernummer: ' + order.ordernummer,
      '',
      'Varor:',
      orderrader(order),
      'Frakt: ' + order.frakt + ' kr',
      'Att betala: ' + order.total + ' kr',
      '',
      'Namn: ' + order.namn,
      'E-post: ' + order.epost,
      'Telefon: ' + order.telefon,
      'Adress: ' + order.adress,
      order.postnummer + ' ' + order.ort
    ].join('\n');
    return 'mailto:' + C.kontakt.epost +
           '?subject=' + encodeURIComponent('Bestallning ' + order.ordernummer) +
           '&body=' + encodeURIComponent(rader);
  }

  function skicka(order) {
    if (!C.form.endpoint || C.form.endpoint === 'TODO') {
      return Promise.resolve({ offline: true });
    }
    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: C.form.endpoint,
        subject: 'Ny beställning ' + order.ordernummer,
        from_name: 'SILQ webbplats',
        ordernummer: order.ordernummer,
        varor: orderrader(order),
        antal_varor: order.antalVaror,
        frakt: order.frakt + ' kr',
        att_betala: order.total + ' kr',
        namn: order.namn,
        epost: order.epost,
        telefon: order.telefon,
        adress: order.adress,
        postnummer: order.postnummer,
        ort: order.ort
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('Kunde inte skicka beställningen.');
      return r.json();
    });
  }

  /* ---------- Start ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('kassa-form');
    if (!form) return;

    var summeringEl = document.getElementById('summering');
    var betalningEl = document.getElementById('betalning');
    var fel = document.getElementById('kassa-fel');
    var knapp = form.querySelector('[type="submit"]');
    var lagd = false;

    function uppdatera() {
      if (lagd) return;          // ordern är lagd och låst — rör inte summeringen

      /* Summeringen ritas om från grunden, så den som stegar med plus/minus
         tappar fokus. Kom ihåg var fokus satt och lägg tillbaka det. */
      var aktiv = document.activeElement;
      var falt = aktiv && summeringEl.contains(aktiv) && aktiv.closest('[data-antal]');
      var fokus = falt ? { id: falt.getAttribute('data-antal-id'), steg: aktiv.getAttribute('data-steg') } : null;

      var s = korg.summera();
      ritaSummering(summeringEl, s);

      if (fokus) {
        var rot = summeringEl.querySelector('[data-antal-id="' + fokus.id + '"]');
        var mal = rot && rot.querySelector(fokus.steg ? '[data-steg="' + fokus.steg + '"]' : 'input');
        if (mal && mal.disabled) mal = rot.querySelector('input');
        if (mal) mal.focus();
      }
      var tom = s.antalVaror === 0;
      form.hidden = tom;         // tom korg: be om varor, inte om adress
      if (knapp) knapp.disabled = tom;
    }

    /* Antalsväljarna och "ta bort" ritas om vid varje ändring, så vi lyssnar
       på behållaren i stället för på knappar som byts ut. */
    summeringEl.addEventListener('change', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-korg-antal');
      /* Tomt eller 0 i fältet tar inte bort varan — det gör "Ta bort". */
      if (id) korg.sattAntal(id, Math.max(1, parseInt(e.target.value, 10) || 1));
    });

    summeringEl.addEventListener('click', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-korg-bort');
      if (id) korg.sattAntal(id, 0);
    });

    korg.lyssna(uppdatera);
    uppdatera();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fel.textContent = '';
      if (!validera(form)) return;

      var s = korg.summera();
      if (!s.antalVaror) { uppdatera(); return; }

      knapp.disabled = true;
      knapp.textContent = 'Skickar…';

      var data = new FormData(form);
      var order = frysOrder(s);
      order.ordernummer = nyttOrdernummer();
      order.namn = data.get('namn');
      order.epost = data.get('epost');
      order.telefon = data.get('telefon');
      order.adress = data.get('adress');
      order.postnummer = data.get('postnummer');
      order.ort = data.get('ort');

      skicka(order).then(function (res) {
        lagd = true;
        form.hidden = true;
        /* Korgen töms först nu, när ordern gått iväg. Gick den inte fram
           står varorna kvar och kunden kan försöka igen. */
        korg.tomma();
        summeringEl.innerHTML =
          '<p class="korgrad__namn">Order ' + esc(order.ordernummer) + '</p>' +
          ritaOrderrader(order);
        visaBetalning(betalningEl, order, res && res.offline);
        betalningEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function (err) {
        fel.textContent = err.message + ' Mejla oss på ' + C.kontakt.epost + ' så hjälper vi dig.';
        knapp.disabled = false;
        knapp.textContent = 'Slutför beställning';
      });
    });
  });
})();
