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

  /* ---------- Stegfält för antal ----------
     <div data-antal> med en minus-knapp, ett sifferfält och en plus-knapp.
     Kunden kan stega eller skriva själv. Fältet hålls alltid inom min/max,
     och en ändring sänds som vanligt change-event — så kassan och
     produktsidan behöver inte veta hur fältet fungerar.

     Allt kopplas på document, eftersom kassan ritar om sina fält hela tiden. */

  function klampaFalt(falt) {
    var min = parseInt(falt.min, 10) || 1;
    var max = parseInt(falt.max, 10) || 10;
    var n = parseInt(falt.value, 10);
    if (isNaN(n)) n = min;
    n = Math.min(max, Math.max(min, n));
    falt.value = n;

    var rot = falt.closest('[data-antal]');
    if (rot) {
      var minus = rot.querySelector('[data-steg="-1"]');
      var plus = rot.querySelector('[data-steg="1"]');
      if (minus) minus.disabled = n <= min;
      if (plus) plus.disabled = n >= max;
    }
    return n;
  }

  function stegfaltet(el) {
    var rot = el && el.closest && el.closest('[data-antal]');
    return rot ? rot.querySelector('input') : null;
  }

  document.addEventListener('click', function (e) {
    var knapp = e.target.closest && e.target.closest('[data-steg]');
    var falt = stegfaltet(knapp);
    if (!falt || knapp.disabled) return;
    falt.value = (parseInt(falt.value, 10) || 0) + parseInt(knapp.getAttribute('data-steg'), 10);
    klampaFalt(falt);
    falt.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* Bara siffror, högst två. Bokstäver och minustecken kommer aldrig in. */
  document.addEventListener('input', function (e) {
    if (!stegfaltet(e.target) || e.target !== stegfaltet(e.target)) return;
    var rent = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (rent !== e.target.value) e.target.value = rent;
  });

  /* Capture: klampningen måste hinna före kassans egen change-lyssnare,
     som sitter längre ner i trädet och annars läser ett tomt fält. */
  document.addEventListener('change', function (e) {
    if (stegfaltet(e.target) === e.target) klampaFalt(e.target);
  }, true);

  /* Enter i fältet bekräftar som ett klick utanför. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && stegfaltet(e.target) === e.target) e.target.blur();
  });

  /* ---------- Mössan som flyger till kassan ----------
     När något läggs i korgen flyger en liten SILQ-mössa från knappen till
     "Köp" i menyn och siffran studsar när den landar. På mobil, där menyn
     är ihopfälld, landar den på menyknappen i stället.

     Den som bett om mindre rörelse i sitt system får bara studsen. */

  var MOSSA =
    '<svg viewBox="0 0 64 50" aria-hidden="true" focusable="false">' +
      '<path d="M8 36C8 16 19 5 32 5s24 11 24 31z" fill="#0A0A0A" stroke="#B99A6B" stroke-width="1.4"/>' +
      '<path d="M32 7v28" stroke="#2C2C2C" stroke-width="1.1"/>' +
      '<path d="M16 16c4-5 9-7.5 14-8" fill="none" stroke="#3A3A3A" stroke-width="1.6" stroke-linecap="round"/>' +
      '<rect x="5" y="33" width="54" height="13" rx="3" fill="#141414" stroke="#B99A6B" stroke-width="1.4"/>' +
      '<text x="32" y="42.7" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" ' +
        'font-weight="900" font-size="7.6" letter-spacing="1.4" fill="#FAF8F5">SILQ</text>' +
    '</svg>';

  function korgMal() {
    var lankar = document.querySelectorAll('[data-korg-lank]');
    for (var i = 0; i < lankar.length; i++) {
      var r = lankar[i].getBoundingClientRect();
      if (r.width && r.height) return { el: lankar[i], r: r };
    }
    var meny = document.querySelector('.nav-toggle');
    if (meny) {
      var m = meny.getBoundingClientRect();
      if (m.width && m.height) return { el: meny, r: m };
    }
    return null;
  }

  function studsa(el) {
    if (!el) return;
    el.classList.remove('is-landad');
    void el.offsetWidth;            // starta om animationen vid snabba klick
    el.classList.add('is-landad');
    clearTimeout(el._landTimer);
    el._landTimer = setTimeout(function () { el.classList.remove('is-landad'); }, 700);
  }

  function flygTillKorg(fran, klar) {
    var mal = korgMal();
    var stilla = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var b = fran.getBoundingClientRect();

    if (!mal || stilla || !fran.animate || !(b.width && b.height)) {
      klar();
      studsa(mal && mal.el);
      return;
    }

    var W = 64, H = 50;
    var sx = b.left + b.width / 2 - W / 2;
    var sy = b.top + b.height / 2 - H / 2;
    var ex = mal.r.left + mal.r.width / 2 - W / 2;
    var ey = mal.r.top + mal.r.height / 2 - H / 2;

    /* Två lager: det yttre glider i sidled, det inre hoppar upp ur knappen
       och accelererar mot menyn. Tillsammans blir banan en båge. */
    var yttre = document.createElement('div');
    yttre.className = 'korg-flygare';
    var inre = document.createElement('div');
    inre.className = 'korg-flygare__inre';
    inre.innerHTML = MOSSA;
    yttre.appendChild(inre);
    document.body.appendChild(yttre);

    var TID = 850;
    var lyft = Math.min(70, Math.max(34, (sy - ey) * 0.12));

    yttre.animate([
      { transform: 'translateX(' + sx + 'px)' },
      { transform: 'translateX(' + ex + 'px)' }
    ], { duration: TID, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' });

    var bana = inre.animate([
      { transform: 'translateY(' + sy + 'px) scale(.5) rotate(0deg)', opacity: 0 },
      { transform: 'translateY(' + (sy - lyft * 0.6) + 'px) scale(1.08) rotate(-10deg)', opacity: 1, offset: 0.16 },
      { transform: 'translateY(' + (sy - lyft) + 'px) scale(1) rotate(-6deg)', opacity: 1, offset: 0.32,
        easing: 'cubic-bezier(.6,0,.9,.6)' },
      { transform: 'translateY(' + ey + 'px) scale(.34) rotate(14deg)', opacity: 0.85 }
    ], { duration: TID, easing: 'ease-out', fill: 'forwards' });

    var landad = false;
    function landa() {
      if (landad) return;
      landad = true;
      yttre.remove();
      klar();
      studsa(mal.el);
    }
    bana.onfinish = landa;
    bana.oncancel = landa;
    setTimeout(landa, TID + 400);   // om fliken göms mitt i flygningen
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
          if (falt) antal = stegfaltet(falt) === falt ? klampaFalt(falt) : (parseInt(falt.value, 10) || 1);
        }

        /* Siffran i menyn ska ticka upp när mössan landar, inte när den
           lyfter. Korgen sparas direkt — bara visningen väntar. */
        var bubblor = document.querySelectorAll('[data-korg-lank] .korg-antal');
        var fore = [];
        bubblor.forEach(function (b) { fore.push([b, b.textContent, b.hidden]); });
        lagg(id, antal);
        fore.forEach(function (f) { f[0].textContent = f[1]; f[0].hidden = f[2]; });
        flygTillKorg(knapp, ritaBubbla);

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
