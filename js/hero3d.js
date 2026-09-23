/* SILQ — 3D-mössan på startsidan.

   Ett eget system, skilt från produktvisaren: egen ritare, egen scen,
   eget tillstånd. Bara modellkoden i cap3d.js delas.

   Mössan svävar bakom innehållet i hero-sektionen och styrs av scrollen:
   ju längre ner besökaren scrollar, desto mer vrids, lutas och sjunker
   den — tills satinfodret vänds mot betraktaren och mössan glider in
   bakom nästa sektion. Den snurrar aldrig av sig själv.

   Mössan placeras där fotot (.hero__fig) sitter, så layouten är densamma
   med och utan 3D. Fotot är reserven: det syns tills 3D är klart och
   ligger kvar om 3D inte går — utan WebGL, med sparat data eller när
   besökaren bett om mindre rörelse. */

(function () {
  'use strict';

  var hero = document.querySelector('[data-hero3d]');
  if (!hero) return;
  var plats = hero.querySelector('.hero__fig');
  var lager = hero.querySelector('.hero__3d');
  if (!plats || !lager) return;

  function kanKora() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    var n = navigator;
    if (n.connection && n.connection.saveData) return false;
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  function starta() {
    if (!window.SILQ3D || !kanKora()) return;
    window.SILQ3D.ladda().then(bygg).catch(function (fel) {
      if (window.console) console.warn('[SILQ] 3D på startsidan kunde inte laddas:', fel);
    });
  }

  function bygg(m) {
    var THREE = m.THREE;
    var S = window.SILQ3D;
    var lag = S.kvalitet() === 'lag';

    var scen = new THREE.Scene();
    var kamera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    kamera.position.set(0, 0, 7);

    var ritare = S.skapaRitare(THREE, lag);
    /* Bakgrundslagret behöver inte full upplösning på telefoner. */
    if (lag) ritare.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    var duk = ritare.domElement;
    duk.setAttribute('aria-hidden', 'true');
    lager.appendChild(duk);

    S.ljussatt(m, scen, ritare);
    var mossa = S.byggMossa(THREE, { kvalitet: lag ? 'lag' : 'hog' });
    scen.add(mossa);

    /* ---------- Placering ----------
       Mittpunkten och storleken på .hero__fig räknas om till en punkt och
       en skala i 3D-rummet, så mössan hamnar precis där fotot satt. */
    var bas = { x: 0, y: 0, skala: 1 };
    var lagerH = 1, stracka = 1;

    function mat() {
      var b = lager.clientWidth || 1;
      lagerH = lager.clientHeight || 1;
      ritare.setSize(b, lagerH, false);
      kamera.aspect = b / lagerH;
      kamera.updateProjectionMatrix();

      var l = lager.getBoundingClientRect();
      var f = plats.getBoundingClientRect();
      var cx = (f.left + f.width / 2 - l.left) / b * 2 - 1;
      var cy = -((f.top + f.height / 2 - l.top) / lagerH * 2 - 1);

      /* Synlig höjd i världsenheter på kamerans avstånd. */
      var synligH = 2 * Math.tan(kamera.fov * Math.PI / 360) * kamera.position.z;
      var synligB = synligH * kamera.aspect;
      bas.x = cx * synligB / 2;
      bas.y = cy * synligH / 2;
      /* Mössan är ungefär 2 enheter bred; låt den fylla ~78 % av platsen. */
      var platsB = f.width / b * synligB;
      var platsH = f.height / lagerH * synligH;
      bas.skala = Math.min(platsB / 2.0, platsH / 1.55) * 0.78;
      bas.synligH = synligH;

      /* Scrollsträckan: från toppen tills platsens underkant lämnat skärmen.
         På mobil sitter mössan överst, så den sträckan är kort — mössan
         hinner ändå vända sig hela vägen innan den försvinner. */
      stracka = Math.max(200, f.bottom - l.top);
      /* Parallax: hur stor del av scrollen mössan följer med nedåt. Halva
         på stora skärmar — den ligger kvar i bild längre och glider till
         slut in bakom nästa sektion. Mindre på mobil, där texten ligger
         precis under och ska förbli läsbar. */
      bas.smal = kamera.aspect < 1;
      var andel = bas.smal ? 0.22 : 0.5;
      bas.sjunk = andel * stracka / lagerH;
      rita();
    }

    /* ---------- Scrollen ----------
       p = 0 när sidan ligger överst, 1 när hero-sektionen scrollats ur
       bild. mal följer scrollen direkt; nu glider efter, så rörelsen känns
       mjuk även med ett ryckigt scrollhjul. */
    var mal = 0, nu = -0.35;   // börjar en bit "före" och glider på plats vid start
    var synlig = true, igang = false;

    function lasScroll() {
      var r = hero.getBoundingClientRect();
      mal = Math.max(0, Math.min(1.25, -r.top / stracka));
    }

    function ease(t) { return t * t * (3 - 2 * t); }

    function stall(p) {
      var q = Math.max(0, p);
      /* Rotation runt tre axlar, var och en med sin egen kurva så att
         rörelsen aldrig ser ut som en enkel snurr. */
      mossa.rotation.set(
        0.18 - ease(Math.min(1, q)) * 1.55 + Math.min(0, p) * 0.4,   // lutar fram: fodret syns
        -0.55 + p * 2.6,                                              // vrider runt
        Math.sin(p * Math.PI) * 0.22,                                 // lätt krängning
        'XYZ'
      );
      var s = bas.skala * (1 - q * 0.08);
      mossa.scale.setScalar(s);
      /* Sjunker långsammare än sidan scrollar — den ligger "längre bort"
         än texten — och drar sig lite mot mitten. */
      mossa.position.set(
        bas.x * (1 - q * 0.18),
        bas.y - q * bas.synligH * bas.sjunk + Math.sin(Math.max(0, Math.min(1, -p / 0.35)) * Math.PI) * 0.04,
        -q * 0.6
      );
      /* På mobil ligger rubriken direkt under mössan. Tona ut mössan den
         sista biten, innan den hamnar bakom texten. */
      if (bas.smal) {
        var u = Math.min(1, Math.max(0, (q - 0.5) / 0.3));
        duk.style.opacity = String(1 - u * u * (3 - 2 * u));
      } else if (duk.style.opacity) {
        duk.style.opacity = '';
      }
    }

    function rita() {
      stall(nu);
      ritare.render(scen, kamera);
    }

    function slinga() {
      if (!synlig) { igang = false; return; }
      nu += (mal - nu) * 0.085;
      rita();
      if (Math.abs(mal - nu) < 0.0005) { nu = mal; rita(); igang = false; return; }
      requestAnimationFrame(slinga);
    }

    function vacka() {
      if (igang || !synlig) return;
      igang = true;
      requestAnimationFrame(slinga);
    }

    window.addEventListener('scroll', function () { lasScroll(); vacka(); }, { passive: true });

    /* Ritar inte alls när sektionen är ur bild. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (poster) {
        synlig = poster[0].isIntersecting;
        if (synlig) { lasScroll(); vacka(); }
      }).observe(lager);
    }

    var observator = new ResizeObserver(function () { mat(); lasScroll(); vacka(); });
    observator.observe(hero);

    /* Fliken i bakgrunden: släpp grafikkortet helt om sidan tas ur minnet. */
    window.addEventListener('pagehide', function (e) {
      if (e.persisted) return;
      observator.disconnect();
      S.stadaUpp(scen);
      ritare.dispose();
    });

    mat();
    lasScroll();
    /* Visa 3D först när första bilden är ritad — ingen tom ruta. */
    requestAnimationFrame(function () {
      hero.classList.add('is-3d');
      vacka();
    });
  }

  /* Vänta tills sidan är klar och webbläsaren har tid över. Texten och
     knapparna i hero ska aldrig vänta på ett 3D-bibliotek. */
  function nar() {
    if ('requestIdleCallback' in window) requestIdleCallback(starta, { timeout: 1500 });
    else setTimeout(starta, 300);
  }
  if (document.readyState === 'complete') nar();
  else window.addEventListener('load', nar);
})();
