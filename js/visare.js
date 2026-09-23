/* SILQ — 3D-visaren över hela skärmen.

   Öppnas när besökaren klickar på produktbilden. Bygger sitt eget
   överlägg vid första öppningen, precis som lightboxen, och river ner
   3D-scenen när den stängs så grafikkortet inte jobbar i bakgrunden.

   Går 3D inte att ladda — gammal webbläsare, blockerad CDN, ingen WebGL —
   visas fotot i stället med en förklaring. Produktbilden får aldrig bli
   en tom ruta.

   window.SILQvisare.oppna({ vy: 'fram' | 'sida' | 'bak' | 'insida', bild, alt }) */

(function () {
  'use strict';

  var overlay, scen, stangKnapp, vyKnappar, status, reserv;
  var vy = null, fokusFore = null, oppen = false, forsok = 0;

  var IKON_STANG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" fill="none"/></svg>';

  function bygg() {
    overlay = document.createElement('div');
    overlay.className = 'v3d';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'v3d-titel');

    overlay.innerHTML =
      '<div class="v3d__topp">' +
        '<div>' +
          '<p class="v3d__kicker">360&deg; &middot; 3D</p>' +
          '<h2 class="v3d__titel" id="v3d-titel">SILQ Satinfodrad skullcap</h2>' +
        '</div>' +
        '<button class="v3d__stang" type="button" aria-label="St&auml;ng 3D-visaren">' + IKON_STANG + '</button>' +
      '</div>' +
      '<div class="v3d__scen" data-v3d-scen>' +
        '<img class="v3d__reserv" alt="" data-v3d-reserv>' +
        '<p class="v3d__status" role="status" data-v3d-status></p>' +
      '</div>' +
      '<div class="v3d__fot">' +
        '<div class="v3d__vyer" role="group" aria-label="Visa fr&aring;n">' +
          '<button type="button" class="v3d__vy" data-v3d-vy="fram">Fram</button>' +
          '<button type="button" class="v3d__vy" data-v3d-vy="sida">Sida</button>' +
          '<button type="button" class="v3d__vy" data-v3d-vy="bak">Bak</button>' +
          '<button type="button" class="v3d__vy" data-v3d-vy="insida">Insida</button>' +
        '</div>' +
        '<p class="v3d__hjalp">' +
          '<span class="v3d__hjalp--mus">Dra f&ouml;r att vrida &middot; scrolla f&ouml;r att zooma &middot; dubbelklick &aring;terst&auml;ller</span>' +
          '<span class="v3d__hjalp--peka">Dra f&ouml;r att vrida &middot; nyp f&ouml;r att zooma</span>' +
        '</p>' +
      '</div>';

    document.body.appendChild(overlay);

    scen       = overlay.querySelector('[data-v3d-scen]');
    stangKnapp = overlay.querySelector('.v3d__stang');
    vyKnappar  = overlay.querySelectorAll('[data-v3d-vy]');
    status     = overlay.querySelector('[data-v3d-status]');
    reserv     = overlay.querySelector('[data-v3d-reserv]');

    stangKnapp.addEventListener('click', stang);
    vyKnappar.forEach(function (k) {
      k.addEventListener('click', function () {
        var namn = k.getAttribute('data-v3d-vy');
        markera(namn);
        if (vy) vy.visa(namn);
      });
    });

    document.addEventListener('keydown', tangent);
  }

  function markera(namn) {
    vyKnappar.forEach(function (k) {
      var pa = k.getAttribute('data-v3d-vy') === namn;
      k.classList.toggle('is-vald', pa);
      k.setAttribute('aria-pressed', String(pa));
    });
  }

  function tangent(e) {
    if (!oppen) return;
    if (e.key === 'Escape') { e.preventDefault(); stang(); return; }
    /* Fokusfälla: Tab ska inte kunna lämna dialogen. */
    if (e.key === 'Tab') {
      var fokuserbara = [stangKnapp].concat(Array.prototype.slice.call(vyKnappar))
        .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      var i = fokuserbara.indexOf(document.activeElement);
      e.preventDefault();
      var nasta = e.shiftKey ? i - 1 : i + 1;
      fokuserbara[(nasta + fokuserbara.length) % fokuserbara.length].focus();
    }
    /* Piltangenter vrider mössan — tangentbordsanvändare ska också kunna
       se den från alla håll. */
    var ordning = ['fram', 'sida', 'bak', 'insida'];
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && vy) {
      var vald = overlay.querySelector('.v3d__vy.is-vald');
      var nu = vald ? ordning.indexOf(vald.getAttribute('data-v3d-vy')) : 0;
      var ny = ordning[(nu + (e.key === 'ArrowRight' ? 1 : 3)) % 4];
      markera(ny);
      vy.visa(ny);
    }
  }

  function oppna(alt) {
    alt = alt || {};
    if (!overlay) bygg();
    if (oppen) return;
    oppen = true;
    fokusFore = document.activeElement;

    var startVy = alt.vy || 'fram';
    markera(startVy);
    reserv.src = alt.bild || '';
    reserv.alt = alt.alt || '';
    reserv.hidden = !alt.bild;
    status.textContent = 'Laddar 3D…';
    overlay.classList.remove('is-klar', 'is-fel');
    vyKnappar.forEach(function (k) { k.disabled = true; });

    overlay.hidden = false;
    document.body.classList.add('v3d-oppen');
    /* En bildruta senare så övergången hinner starta från osynligt. */
    requestAnimationFrame(function () { overlay.classList.add('is-synlig'); });
    stangKnapp.focus();

    var detta = ++forsok;
    window.SILQ3D.montera(scen, {
      vy: alt.vy,
      /* Vrider besökaren själv stämmer ingen snabbvy längre. */
      narDras: function () { markera(null); }
    }).then(function (v) {
      /* Hann besökaren stänga medan three.js laddades? Då ska scenen
         rivas direkt i stället för att ligga kvar osynlig. */
      if (!oppen || detta !== forsok) { v.stoppa(); return; }
      vy = v;
      overlay.classList.add('is-klar');
      status.textContent = '';
      vyKnappar.forEach(function (k) { k.disabled = false; });
    }).catch(function (fel) {
      if (window.console) console.warn('[SILQ] 3D kunde inte laddas:', fel);
      if (detta !== forsok) return;
      overlay.classList.add('is-fel');
      status.textContent = '3D-visningen kunde inte laddas på den här enheten. Här är fotot i stället.';
    });
  }

  function stang() {
    if (!oppen) return;
    oppen = false;
    forsok++;
    overlay.classList.remove('is-synlig');
    document.body.classList.remove('v3d-oppen');
    if (vy) { vy.stoppa(); vy = null; }
    overlay.hidden = true;
    reserv.src = '';
    if (fokusFore && fokusFore.focus) fokusFore.focus();
  }

  window.SILQvisare = { oppna: oppna, stang: stang };
})();
