/* SILQ — kassa och Swish-betalning.
   QR-koden byggs i webbläsaren. Ingen server, inget API-anrop.

   Swish QR-format:  C{nummer};{belopp};{meddelande};{lås}
   Låset börjar på 7 och minskar med 1 (nummer), 2 (belopp), 4 (meddelande).
   0 = alla tre låsta, vilket är vad vi vill ha. */

(function () {
  'use strict';

  var C = window.SILQ;
  if (!C) return;

  /* ---------- Ordernummer ---------- */

  function nyttOrdernummer() {
    var tid = Date.now().toString(36).slice(-5).toUpperCase();
    var slump = Math.random().toString(36).slice(2, 4).toUpperCase();
    return C.form.ordernummerPrefix + tid + slump;
  }

  /* ---------- Summering ---------- */

  function summera(antal) {
    var varor = C.produkt.pris * antal;
    return { antal: antal, varor: varor, frakt: C.frakt.avgift, total: varor + C.frakt.avgift };
  }

  function kr(n) { return n.toLocaleString('sv-SE') + ' kr'; }

  function ritaSummering(el, s) {
    if (!el) return;
    el.innerHTML =
      rad(C.produkt.namn + ' × ' + s.antal, kr(s.varor)) +
      rad('Frakt — ' + C.frakt.beskrivning, kr(s.frakt)) +
      rad('Att betala', kr(s.total), true);
  }

  function rad(namn, varde, total) {
    return '<div class="summary__line' + (total ? ' summary__line--total' : '') + '">' +
           '<span>' + namn + '</span><span>' + varde + '</span></div>';
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
    var s = summera(order.antal);

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

    var data = swishStrang(C.swish.nummer, s.total, order.ordernummer);

    root.innerHTML = offlineNotis +
      '<div class="swish">' +
        '<h3>Betala ' + kr(s.total) + ' med Swish</h3>' +
        '<div class="swish__qr" id="qr"></div>' +
        '<p>Skanna med Swish-appen, eller betala manuellt:</p>' +
        '<p><strong>' + esc(C.swish.mottagare) + '</strong><br>' +
        'Swish-nummer: <strong>' + esc(C.swish.nummer) + '</strong><br>' +
        'Belopp: <strong>' + kr(s.total) + '</strong></p>' +
        mottagarnotis() +
        '<p>Meddelande — måste anges:</p>' +
        '<p><span class="swish__ref">' + esc(order.ordernummer) + '</span></p>' +
        '<p><button type="button" class="btn btn--ghost" id="kopiera">Kopiera ordernummer</button></p>' +
        '<p class="field__hint">Vi skickar din mossa när betalningen kommit in, ' +
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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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

  /* Reserv när formulärtjänsten inte är konfigurerad: kunden får en
     färdigskriven mejllänk i stället för ett felmeddelande, så beställningen
     går fram ändå. */
  function mailtoLank(order) {
    var s = summera(order.antal);
    var rader = [
      'Ordernummer: ' + order.ordernummer,
      'Produkt: ' + C.produkt.namn + ' (' + C.produkt.farg + ')',
      'Antal: ' + order.antal,
      'Att betala: ' + s.total + ' kr (varav frakt ' + s.frakt + ' kr)',
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
        produkt: C.produkt.namn,
        antal: order.antal,
        att_betala: summera(order.antal).total + ' kr',
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

    var antalFalt = document.getElementById('antal');
    var summeringEl = document.getElementById('summering');
    var betalningEl = document.getElementById('betalning');
    var fel = document.getElementById('kassa-fel');

    function uppdatera() {
      ritaSummering(summeringEl, summera(parseInt(antalFalt.value, 10) || 1));
    }
    if (antalFalt) { antalFalt.addEventListener('change', uppdatera); uppdatera(); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fel.textContent = '';
      if (!validera(form)) return;

      var knapp = form.querySelector('[type="submit"]');
      knapp.disabled = true;
      knapp.textContent = 'Skickar…';

      var data = new FormData(form);
      var order = {
        ordernummer: nyttOrdernummer(),
        antal: parseInt(data.get('antal'), 10) || 1,
        namn: data.get('namn'),
        epost: data.get('epost'),
        telefon: data.get('telefon'),
        adress: data.get('adress'),
        postnummer: data.get('postnummer'),
        ort: data.get('ort')
      };

      skicka(order).then(function (res) {
        form.hidden = true;
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
