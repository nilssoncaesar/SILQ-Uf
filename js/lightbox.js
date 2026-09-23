/* SILQ — förstorad produktbild.

   Klick på en bild med data-lightbox öppnar den över hela skärmen.
   Bilder med samma data-lightbox-grupp blir en serie med pilar.

   Zoom: scrollhjul, pinch, dubbelklick. Är bilden inzoomad går den att
   dra. Stängs med X, Esc eller klick utanför bilden.

   Ingen HTML behövs på sidorna — överlägget byggs här vid första klicket. */

(function () {
  'use strict';

  var MAX = 5;      // hur långt in det går att zooma
  var MIN = 1;      // utzoomat = passa skärmen

  var overlay, bildEl, stangKnapp, forraKnapp, nastaKnapp, raknare, bildtext;
  var serie = [], index = 0;
  var skala = 1, tx = 0, ty = 0;
  var drar = false, dragStart = null;
  var pekare = {}, pinchStart = null;
  var fokusFore = null;

  /* ---------- Bygg överlägget ---------- */

  function bygg() {
    overlay = document.createElement('div');
    overlay.className = 'lb';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Förstorad produktbild');

    overlay.innerHTML =
      '<button class="lb__stang" type="button" aria-label="Stäng förstorad bild">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" fill="none"/></svg>' +
      '</button>' +
      '<button class="lb__pil lb__pil--forra" type="button" aria-label="Föregående bild">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M15 4L7 12l8 8" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
      '</button>' +
      '<button class="lb__pil lb__pil--nasta" type="button" aria-label="Nästa bild">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M9 4l8 8-8 8" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' +
      '</button>' +
      '<div class="lb__scen"><img class="lb__bild" alt=""></div>' +
      '<div class="lb__fot">' +
        '<p class="lb__text"></p>' +
        '<p class="lb__raknare"></p>' +
        '<p class="lb__hjalp">Scrolla eller nyp för att zooma · dra för att flytta</p>' +
      '</div>';

    document.body.appendChild(overlay);

    bildEl     = overlay.querySelector('.lb__bild');
    stangKnapp = overlay.querySelector('.lb__stang');
    forraKnapp = overlay.querySelector('.lb__pil--forra');
    nastaKnapp = overlay.querySelector('.lb__pil--nasta');
    raknare    = overlay.querySelector('.lb__raknare');
    bildtext   = overlay.querySelector('.lb__text');

    stangKnapp.addEventListener('click', stang);
    forraKnapp.addEventListener('click', function () { bladdra(-1); });
    nastaKnapp.addEventListener('click', function () { bladdra(1); });

    /* Klick vid sidan av bilden stänger. Klick på bilden gör det inte —
       där betyder klick "zooma". */
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('lb__scen')) stang();
    });

    bildEl.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (skala > MIN) nollstall();
      else zoomaMot(2.5, e.clientX, e.clientY);
      rita();
    });

    overlay.addEventListener('wheel', function (e) {
      e.preventDefault();
      var faktor = Math.exp(-e.deltaY * 0.0015);
      zoomaMot(skala * faktor, e.clientX, e.clientY);
      rita();
    }, { passive: false });

    bildEl.addEventListener('pointerdown', pekareNer);
    overlay.addEventListener('pointermove', pekareFlytt);
    overlay.addEventListener('pointerup', pekareUpp);
    overlay.addEventListener('pointercancel', pekareUpp);

    document.addEventListener('keydown', tangent);
  }

  /* ---------- Zoom och panorering ---------- */

  /* Zoomar så att punkten under muspekaren står stilla. Utan det glider
     bilden iväg under fingret och känns trasig. */
  function zoomaMot(nySkala, klientX, klientY) {
    nySkala = Math.max(MIN, Math.min(MAX, nySkala));
    var r = bildEl.getBoundingClientRect();
    var mittX = r.left + r.width / 2;
    var mittY = r.top + r.height / 2;
    var k = nySkala / skala;

    tx = klientX - mittX - (klientX - mittX - tx) * k;
    ty = klientY - mittY - (klientY - mittY - ty) * k;
    skala = nySkala;
    if (skala === MIN) { tx = 0; ty = 0; }
    begransa();
  }

  /* Håller bilden kvar över skärmen i stället för att låta den dras ut
     i tomma intet. */
  function begransa() {
    if (skala <= MIN) { tx = 0; ty = 0; return; }
    var r = bildEl.getBoundingClientRect();
    var basB = r.width / skala, basH = r.height / skala;
    var maxX = Math.max(0, (basB * skala - Math.min(basB, window.innerWidth)) / 2);
    var maxY = Math.max(0, (basH * skala - Math.min(basH, window.innerHeight)) / 2);
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  function nollstall() { skala = 1; tx = 0; ty = 0; }

  function rita() {
    bildEl.style.transform =
      'translate(' + tx + 'px,' + ty + 'px) scale(' + skala + ')';
    bildEl.classList.toggle('is-zoomad', skala > MIN);
    overlay.classList.toggle('is-zoomad', skala > MIN);
  }

  /* ---------- Pekare: dra och nyp ---------- */

  function pekareNer(e) {
    pekare[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pekare);

    if (ids.length === 2) {
      pinchStart = { avstand: avstand(), skala: skala };
      drar = false;
      return;
    }
    if (skala > MIN) {
      drar = true;
      dragStart = { x: e.clientX - tx, y: e.clientY - ty };
      bildEl.setPointerCapture(e.pointerId);
    }
  }

  function pekareFlytt(e) {
    if (!(e.pointerId in pekare)) return;
    pekare[e.pointerId] = { x: e.clientX, y: e.clientY };

    var ids = Object.keys(pekare);
    if (ids.length === 2 && pinchStart) {
      var nu = avstand();
      if (pinchStart.avstand > 0) {
        var m = mittpunkt();
        zoomaMot(pinchStart.skala * (nu / pinchStart.avstand), m.x, m.y);
        rita();
      }
      return;
    }
    if (drar) {
      tx = e.clientX - dragStart.x;
      ty = e.clientY - dragStart.y;
      begransa();
      rita();
    }
  }

  function pekareUpp(e) {
    delete pekare[e.pointerId];
    if (Object.keys(pekare).length < 2) pinchStart = null;
    drar = false;
  }

  function avstand() {
    var p = Object.keys(pekare).map(function (k) { return pekare[k]; });
    if (p.length < 2) return 0;
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  function mittpunkt() {
    var p = Object.keys(pekare).map(function (k) { return pekare[k]; });
    if (p.length < 2) return { x: innerWidth / 2, y: innerHeight / 2 };
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
  }

  /* ---------- Öppna, bläddra, stäng ---------- */

  function visa(i) {
    index = (i + serie.length) % serie.length;
    var post = serie[index];
    nollstall();
    bildEl.src = post.src;
    bildEl.alt = post.alt || '';
    bildtext.textContent = post.alt || '';
    raknare.textContent = serie.length > 1 ? (index + 1) + ' / ' + serie.length : '';
    var flera = serie.length > 1;
    forraKnapp.hidden = !flera;
    nastaKnapp.hidden = !flera;
    rita();
  }

  function bladdra(steg) { visa(index + steg); }

  function oppna(lista, start) {
    if (!overlay) bygg();
    fokusFore = document.activeElement;
    serie = lista;
    overlay.hidden = false;
    document.body.classList.add('lb-oppen');
    visa(start);
    stangKnapp.focus();
  }

  function stang() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('lb-oppen');
    bildEl.src = '';
    nollstall();
    if (fokusFore && fokusFore.focus) fokusFore.focus();
  }

  function tangent(e) {
    if (!overlay || overlay.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); stang(); }
    else if (e.key === 'ArrowLeft' && serie.length > 1) bladdra(-1);
    else if (e.key === 'ArrowRight' && serie.length > 1) bladdra(1);
    else if (e.key === 'Tab') { e.preventDefault(); stangKnapp.focus(); }
  }

  /* ---------- Koppla sidans bilder ---------- */

  function samla(el) {
    var grupp = el.getAttribute('data-lightbox-grupp');
    var noder = grupp
      ? document.querySelectorAll('[data-lightbox-grupp="' + grupp + '"]')
      : [el];
    var lista = [], start = 0;
    Array.prototype.forEach.call(noder, function (n, i) {
      if (n === el) start = i;
      lista.push({
        src: n.getAttribute('data-full') || n.getAttribute('src') || n.href,
        alt: n.getAttribute('alt') || n.getAttribute('data-alt') || ''
      });
    });
    return { lista: lista, start: start };
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-lightbox]').forEach(function (el) {
      el.classList.add('kan-forstoras');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('aria-label')) {
        el.setAttribute('aria-label',
          'Förstora bilden' + (el.getAttribute('alt') ? ': ' + el.getAttribute('alt') : ''));
      }
      el.addEventListener('click', function () {
        var s = samla(el);
        oppna(s.lista, s.start);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var s = samla(el);
          oppna(s.lista, s.start);
        }
      });
    });
  });

  window.SILQlightbox = { oppna: oppna, stang: stang };
})();
