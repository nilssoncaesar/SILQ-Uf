/* SILQ — produktvisningen: galleri, 3D och förstoring.

   Galleriet: klick på en miniatyr byter huvudbild.
   Klick på huvudbilden öppnar 3D-visaren (visare.js). Visar huvudbilden
   fodret börjar 3D-visaren med insidan vänd mot besökaren.
   Förstoringsknappen öppnar fotona i lightboxen, med zoom.

   three.js börjar hämtas redan när pekaren närmar sig bilden, så att 3D
   är klart när klicket kommer. Den som aldrig rör bilden hämtar inget. */

(function () {
  'use strict';

  function koppla(rot) {
    var huvud = rot.querySelector('[data-galleri-huvud]');
    var knappar = Array.prototype.slice.call(rot.querySelectorAll('[data-galleri-bild]'));
    var knapp3d = rot.querySelector('[data-oppna-3d]');
    var forstora = rot.querySelector('[data-forstora]');
    var scen = rot.querySelector('.media__scen');
    if (!huvud) return;

    var valdIndex = 0;

    function valj(i) {
      var knapp = knappar[i];
      if (!knapp) return;
      valdIndex = i;
      var src = knapp.getAttribute('data-galleri-bild');
      huvud.classList.add('is-byter');
      /* Vänta in den nya bilden innan den tonas in, annars blinkar det. */
      var ny = new Image();
      ny.onload = ny.onerror = function () {
        huvud.src = src;
        huvud.alt = knapp.getAttribute('data-galleri-alt') || '';
        huvud.classList.remove('is-byter');
      };
      ny.src = src;
      knappar.forEach(function (k, j) {
        k.classList.toggle('is-vald', j === i);
        k.setAttribute('aria-current', j === i ? 'true' : 'false');
      });
    }

    knappar.forEach(function (k, i) {
      k.addEventListener('click', function () { valj(i); });
    });

    /* Svep i sidled mellan bilderna på mobil. Ett tryck utan svep öppnar
       3D som vanligt. */
    var svep = null;
    huvud.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      svep = { x: e.clientX, y: e.clientY };
    });
    huvud.addEventListener('pointerup', function (e) {
      if (!svep) return;
      var dx = e.clientX - svep.x, dy = e.clientY - svep.y;
      svep = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        huvud.dataset.svepte = '1';
        valj((valdIndex + (dx < 0 ? 1 : knappar.length - 1)) % knappar.length);
      }
    });

    function oppna3d() {
      var knapp = knappar[valdIndex];
      window.SILQvisare.oppna({
        vy: knapp && knapp.getAttribute('data-3d-vy') || undefined,
        bild: huvud.getAttribute('src'),
        alt: huvud.getAttribute('alt')
      });
    }

    huvud.addEventListener('click', function () {
      if (huvud.dataset.svepte) { delete huvud.dataset.svepte; return; }
      oppna3d();
    });
    huvud.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oppna3d(); }
    });
    if (knapp3d) knapp3d.addEventListener('click', oppna3d);

    if (forstora && window.SILQlightbox) {
      forstora.addEventListener('click', function () {
        var lista = knappar.map(function (k) {
          return { src: k.getAttribute('data-galleri-bild'), alt: k.getAttribute('data-galleri-alt') || '' };
        });
        window.SILQlightbox.oppna(lista, valdIndex);
      });
    }

    /* Förladdning: första gången pekaren eller fokus närmar sig. */
    var forladdat = false;
    function forladda() {
      if (forladdat || !window.SILQ3D) return;
      forladdat = true;
      window.SILQ3D.ladda().catch(function () { /* visaren visar felet */ });
    }
    if (scen) {
      scen.addEventListener('pointerenter', forladda, { once: true });
      scen.addEventListener('touchstart', forladda, { once: true, passive: true });
      scen.addEventListener('focusin', forladda, { once: true });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-media]').forEach(koppla);
  });
})();
