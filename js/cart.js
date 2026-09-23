/* SILQ — varukorgen.

   Ligger i localStorage så den överlever sidbyten. Sparas som en ren lista
   av { id, antal } — aldrig pris eller namn. Priser läses alltid ur
   config.js när korgen räknas ut, så en prisändring där slår igenom direkt
   i stället för att gamla priser ligger kvar i kundens webbläsare.

   window.SILQkorg:
     las()            -> [{ produkt, antal, radsumma }]  (okända id:n rensas)
     lagg(id, antal)
     sattAntal(id, antal)     0 = ta bort
     tomma()
     summera()        -> { rader, antalVaror, varor, frakt, total }
     antalVaror()
     lyssna(fn)       anropas vid varje ändring, även från annan flik

   Ändringar sänds som 'silq:korg' på document. */

(function () {
  'use strict';

  var NYCKEL = 'silq-korg-v1';
  var C = window.SILQ;

  function lasRatt() {
    try {
      var rad = localStorage.getItem(NYCKEL);
      if (!rad) return [];
      var data = JSON.parse(rad);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      /* Privat läge, full disk eller trasig JSON. Tom korg är rätt svar —
         bättre än att kassan kraschar. */
      return [];
    }
  }

  function skrivRatt(data) {
    try {
      localStorage.setItem(NYCKEL, JSON.stringify(data));
    } catch (e) { /* går inte att spara: korgen lever kvar i minnet */ }
    document.dispatchEvent(new CustomEvent('silq:korg'));
  }

  function klamp(n, max) {
    n = parseInt(n, 10);
    if (!n || n < 0) return 0;
    return Math.min(n, max || 10);
  }

  /* Rader med produktdata påhängd. Poster vars produkt inte längre finns i
     sortimentet faller bort — och skrivs bort ur lagret så de inte ligger
     kvar och spökar. */
  function las() {
    var ratt = lasRatt();
    var rader = [];
    var stadat = false;

    ratt.forEach(function (post) {
      var p = C.hittaProdukt(post.id);
      if (!p || p.status !== 'i-lager') { stadat = true; return; }
      var antal = klamp(post.antal, p.maxAntal);
      if (!antal) { stadat = true; return; }
      rader.push({ produkt: p, antal: antal, radsumma: p.pris * antal });
    });

    if (stadat) {
      try {
        localStorage.setItem(NYCKEL, JSON.stringify(rader.map(function (r) {
          return { id: r.produkt.id, antal: r.antal };
        })));
      } catch (e) { /* ignorera */ }
    }
    return rader;
  }

  function lagg(id, antal) {
    var p = C.hittaProdukt(id);
    if (!p || p.status !== 'i-lager') return;
    antal = klamp(antal || 1, p.maxAntal) || 1;

    var ratt = lasRatt();
    var finns = false;
    ratt.forEach(function (post) {
      if (post.id === id) {
        post.antal = klamp(post.antal + antal, p.maxAntal);
        finns = true;
      }
    });
    if (!finns) ratt.push({ id: id, antal: antal });
    skrivRatt(ratt);
  }

  function sattAntal(id, antal) {
    var p = C.hittaProdukt(id);
    if (!p) return;
    antal = klamp(antal, p.maxAntal);

    var ratt = lasRatt().filter(function (post) {
      return post.id !== id;
    });
    if (antal > 0) ratt.push({ id: id, antal: antal });
    skrivRatt(ratt);
  }

  function tomma() { skrivRatt([]); }

  function summera() {
    var rader = las();
    var varor = 0, antalVaror = 0;
    rader.forEach(function (r) { varor += r.radsumma; antalVaror += r.antal; });

    var frakt = 0;
    if (antalVaror > 0) {
      var fri = C.frakt.friFran;
      frakt = (fri && varor >= fri) ? 0 : C.frakt.avgift;
    }
    return {
      rader: rader,
      antalVaror: antalVaror,
      varor: varor,
      frakt: frakt,
      total: varor + frakt
    };
  }

  function antalVaror() {
    return las().reduce(function (n, r) { return n + r.antal; }, 0);
  }

  function lyssna(fn) {
    document.addEventListener('silq:korg', fn);
    /* Korgen ändrad i en annan flik. */
    window.addEventListener('storage', function (e) {
      if (e.key === NYCKEL) fn();
    });
  }

  window.SILQkorg = {
    las: las,
    lagg: lagg,
    sattAntal: sattAntal,
    tomma: tomma,
    summera: summera,
    antalVaror: antalVaror,
    lyssna: lyssna
  };

  /* ---------- Antalsbubblan i menyn ---------- */

  function ritaBubbla() {
    var lankar = document.querySelectorAll('[data-korg-lank]');
    var n = antalVaror();
    lankar.forEach(function (a) {
      var b = a.querySelector('.korg-antal');
      if (!b) {
        b = document.createElement('span');
        b.className = 'korg-antal';
        a.appendChild(b);
      }
      b.textContent = n;
      b.hidden = n === 0;
      a.setAttribute('aria-label', n === 0
        ? 'Varukorgen är tom'
        : 'Varukorg, ' + n + (n === 1 ? ' vara' : ' varor'));
    });
  }

  /* ---------- "Lägg i varukorg"-knappar ----------
     Vilken knapp som helst med data-lagg-i-korg="<produkt-id>" fungerar,
     så nya produktsidor inte behöver egen JavaScript. */

  function kopplaKnappar() {
    document.querySelectorAll('[data-lagg-i-korg]').forEach(function (knapp) {
      knapp.addEventListener('click', function (e) {
        e.preventDefault();
        var id = knapp.getAttribute('data-lagg-i-korg');
        var faltId = knapp.getAttribute('data-antal-falt');
        var antal = 1;
        if (faltId) {
          var falt = document.getElementById(faltId);
          if (falt) antal = parseInt(falt.value, 10) || 1;
        }
        lagg(id, antal);

        var original = knapp.getAttribute('data-original') || knapp.textContent;
        knapp.setAttribute('data-original', original);
        knapp.textContent = 'Tillagd ✓';
        knapp.classList.add('is-lagd');
        clearTimeout(knapp._timer);
        knapp._timer = setTimeout(function () {
          knapp.textContent = original;
          knapp.classList.remove('is-lagd');
        }, 1800);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    ritaBubbla();
    kopplaKnappar();
  });
  lyssna(ritaBubbla);
})();
