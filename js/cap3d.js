/* SILQ — skullcapen i 3D.

   Mössan är ingen inläst modell utan byggs här i koden, av samma mått som
   den riktiga: en kupol med rundad hjässa och mjuka veck, en vikt mudd
   nedtill och en rullad fåll. Utsidan är matt svart trikå med mittsöm och
   SILQ-loggan på muddens framsida, till höger om sömmen — som på plagget.
   Baksidan är samma tyg utan logga. Insidan är silvrigt satinfoder.

   Filen har två delar:
     1. Modellen (ladda, byggMossa, ljussatt) — delas av produktvisaren och
        3D-mössan på startsidan. Bara koden delas, aldrig tillståndet.
     2. Produktvisaren (montera) — dra för att vrida, nyp/scrolla för att
        zooma, snabbvyer för fram, sida, bak och insida.

   three.js hämtas först när en sida faktiskt ber om 3D. Sidan som använder
   3D måste ha import map-taggen i <head> — se produkten.html.

   window.SILQ3D = { ladda, byggMossa, ljussatt, stadaUpp, montera, kvalitet } */

(function () {
  'use strict';

  var TRE = 'three';
  var MILJO = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

  /* Måtten. R = 1 är mössans radie vid mudden; allt annat följer av den. */
  var R          = 1.0;
  var MUDD_TOPP  = 0.25;   // där mudden slutar och kupolen tar vid
  var HJASSA     = 1.42;   // hjässans höjd över fållen — plagget är högre än ett halvklot
  var FYLLIGHET  = 2.15;   // superellipsens exponent: 2 = ellips, högre = fylligare kupol
  var GODS       = 0.018;  // tygets tjocklek — avståndet mellan ut- och insida
  var KUPOL_BOTTEN = MUDD_TOPP * 0.55;

  /* Loggans plats runt mössan. u = 0.5 är rakt fram (mittsömmen); på
     plagget sitter trycket en bit till höger om sömmen. */
  var LOGGA_U = 0.565;

  var laddar = null;

  function ladda() {
    if (!laddar) {
      /* Loggan ritas på en canvas med Archivo. Är typsnittet inte laddat
         än ritar canvasen med reservtypsnittet — och det syns. */
      var typsnitt = document.fonts && document.fonts.load
        ? document.fonts.load('900 100px Archivo').catch(function () {})
        : null;
      laddar = Promise.all([import(TRE), import(MILJO), typsnitt]).then(function (m) {
        return { THREE: m[0], RoomEnvironment: m[1].RoomEnvironment };
      });
      /* Ett misslyckat försök ska inte fastna i cachen — nästa klick får
         försöka igen, t.ex. när nätet kommit tillbaka. */
      laddar.catch(function () { laddar = null; });
    }
    return laddar;
  }

  /* Grov bedömning av enheten. 'lag' ger lägre upplösning, färre segment
     och mindre texturer — mössan ser nästan likadan ut, men telefonen blir
     inte varm. */
  function kvalitet() {
    var n = navigator;
    var svag = (n.hardwareConcurrency && n.hardwareConcurrency <= 4) ||
               (n.deviceMemory && n.deviceMemory <= 4) ||
               (n.connection && n.connection.saveData);
    var smal = window.matchMedia('(max-width: 860px)').matches;
    return (svag || smal) ? 'lag' : 'hog';
  }

  /* ---------- Profiler ----------
     LatheGeometry roterar en profil runt y-axeln. Punkterna går nerifrån
     och upp, så texturens v-axel följer mössan från fåll till hjässa. */

  function kupolProfil(THREE, radie, topp, botten) {
    var p = [];
    var steg = 96;
    for (var i = 0; i <= steg; i++) {
      /* Tätare punkter nära hjässan: där är krökningen störst och glesa
         punkter syns direkt som kanter mot silhuetten. */
      var t = i / steg;
      var s = Math.pow(t, 0.72);
      var r = radie * Math.pow(Math.max(0, 1 - Math.pow(s, FYLLIGHET)), 1 / FYLLIGHET);
      var y = botten + (topp - botten) * s;
      p.push(new THREE.Vector2(Math.max(r, 0.0001), y));
    }
    return p;
  }

  function muddProfil(THREE, skala) {
    /* Mudden är en vikt kant: den buktar ut en aning på mitten och dras in
       mot kupolen upptill. Utan bukten ser den ut som en rak cylinder. */
    var p = [];
    var steg = 28;
    for (var i = 0; i <= steg; i++) {
      var t = i / steg;
      var y = t * MUDD_TOPP;
      var bukt = Math.sin(t * Math.PI) * 0.022;
      var r = R * skala + bukt - t * 0.012;
      p.push(new THREE.Vector2(r, y));
    }
    return p;
  }

  /* Fodrets profil: rakt upp längs muddens insida, sedan kupolens insida.
     Radien får aldrig växa på vägen upp, annars sticker fodret ut genom
     tyget där mudden slutar. */
  function fodretProfil(THREE) {
    var p = [];
    var steg = 10;
    for (var i = 0; i <= steg; i++) {
      var t = i / steg;
      p.push(new THREE.Vector2(R - GODS - t * 0.012, t * MUDD_TOPP));
    }
    var sista = p[p.length - 1].x;
    kupolProfil(THREE, R - GODS, HJASSA - GODS, KUPOL_BOTTEN).forEach(function (q) {
      if (q.y <= MUDD_TOPP + 0.01) return;
      sista = Math.min(sista, q.x);
      p.push(new THREE.Vector2(sista, q.y));
    });
    return p;
  }

  /* ---------- Veck ----------
     Tyg ligger aldrig perfekt runt. Kupolen får mjuka, breda vågor som är
     störst strax ovanför mudden — där trikån samlas — och ebbar ut mot
     hjässan. Samma funktion används för ut- och insidan så att fodret
     följer tyget och gapet mellan dem förblir jämnt.

     Alla frekvenser är heltal i vinkeln, så vågorna går ihop runt varvet
     utan synlig skarv. */

  function veck(vinkel, t) {
    var upp = Math.min(1, Math.max(0, (t - 0.07) / 0.16));
    upp = upp * upp * (3 - 2 * upp);                 // mjuk start ovanför mudden
    var ned = Math.pow(1 - t, 1.35);                 // ebbar ut mot hjässan
    var brett = Math.sin(3 * vinkel + 1.3) * 0.55 +
                Math.sin(5 * vinkel + 0.4) * 0.30 +
                Math.sin(2 * vinkel + 2.1) * 0.35;
    var smatt = Math.sin(11 * vinkel + t * 9.0) * 0.22 +
                Math.sin(17 * vinkel - t * 6.0) * 0.10;
    return (brett * 0.010 + smatt * 0.0045) * upp * ned;
  }

  /* Satinet veckar sig mer än trikån — det är löst och glatt. De extra
     vecken går bara inåt, så fodret aldrig sticker ut genom tyget. */
  function satinVeck(vinkel, t) {
    var upp = Math.min(1, Math.max(0, (t + 0.05) / 0.2));
    var ned = Math.pow(Math.max(0, 1 - t), 1.6);
    var v = Math.sin(7 * vinkel + t * 5.0 + 0.7) * 0.5 +
            Math.sin(13 * vinkel - t * 8.0 + 2.0) * 0.3 +
            Math.sin(4 * vinkel + t * 11.0) * 0.35;
    return -Math.abs(v) * 0.022 * upp * ned;
  }

  function vecka(THREE, geo, botten, topp, extra) {
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      var vinkel = Math.atan2(x, z);
      var t = (y - botten) / (topp - botten);
      var d = veck(vinkel, t) + (extra ? extra(vinkel, t) : 0);
      var k = 1 + d / Math.max(r, 0.2);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    lagaSkarv(geo);
  }

  /* LatheGeometry har dubbla hörn där varvet sluts. computeVertexNormals
     ser dem som två olika hörn och ger dem olika normaler, vilket syns som
     en lodrät rand. Medelvärdet av de två läker randen. */
  function lagaSkarv(geo) {
    var n = geo.attributes.normal;
    var per = geo.parameters.points.length;
    var seg = geo.parameters.segments;
    for (var j = 0; j < per; j++) {
      var a = j, b = seg * per + j;
      var x = (n.getX(a) + n.getX(b)) / 2;
      var y = (n.getY(a) + n.getY(b)) / 2;
      var z = (n.getZ(a) + n.getZ(b)) / 2;
      var l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l);
      n.setXYZ(b, x / l, y / l, z / l);
    }
    n.needsUpdate = true;
  }

  /* ---------- Texturer ---------- */

  function duk(bredd, hojd) {
    var c = document.createElement('canvas');
    c.width = bredd; c.height = hojd;
    return c;
  }

  function somTextur(THREE, c, farg) {
    var t = new THREE.CanvasTexture(c);
    if (farg) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  /* Normalkarta ur en höjdfunktion. Ger tyget en fin struktur som bryter
     upp ljuset — skillnaden mellan trikå och plast. */
  function normalKarta(THREE, storlek, hojd, styrka) {
    var c = duk(storlek, storlek);
    var x = c.getContext('2d');
    var h = new Float32Array(storlek * storlek);
    for (var yy = 0; yy < storlek; yy++) {
      for (var xx = 0; xx < storlek; xx++) h[yy * storlek + xx] = hojd(xx, yy);
    }
    var bild = x.createImageData(storlek, storlek);
    var d = bild.data;
    function H(a, b) {
      a = (a + storlek) % storlek; b = (b + storlek) % storlek;
      return h[b * storlek + a];
    }
    for (var j = 0; j < storlek; j++) {
      for (var i = 0; i < storlek; i++) {
        var dx = (H(i + 1, j) - H(i - 1, j)) * styrka;
        var dy = (H(i, j + 1) - H(i, j - 1)) * styrka;
        var l = Math.hypot(dx, dy, 1);
        var o = (j * storlek + i) * 4;
        d[o]     = (-dx / l * 0.5 + 0.5) * 255;
        d[o + 1] = ( dy / l * 0.5 + 0.5) * 255;
        d[o + 2] = (  1 / l * 0.5 + 0.5) * 255;
        d[o + 3] = 255;
      }
    }
    x.putImageData(bild, 0, 0);
    var t = somTextur(THREE, c, false);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /* Enkelt värdebrus som går att kakla sömlöst. */
  function brus(storlek, celler, fro) {
    var g = [];
    var s = fro || 1;
    function slump() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < celler * celler; i++) g.push(slump());
    function v(a, b) { return g[((b % celler + celler) % celler) * celler + ((a % celler + celler) % celler)]; }
    return function (x, y) {
      var fx = x / storlek * celler, fy = y / storlek * celler;
      var ix = Math.floor(fx), iy = Math.floor(fy);
      var tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * tx;
      var b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * tx;
      return a + (b - a) * ty;
    };
  }

  /* Kupolen: matt svart med sömmar fram (u = 0.5) och bak (u = 0/1). */
  function kupolTextur(THREE, stor) {
    var c = duk(stor ? 2048 : 1024, stor ? 1024 : 512);
    var x = c.getContext('2d');
    var k = c.width / 2048;

    x.fillStyle = '#0E0E0E';
    x.fillRect(0, 0, c.width, c.height);

    /* Fläckvis variation i svärtan — tyg är aldrig helt jämnt färgat. */
    var fl = brus(c.width, 12, 7);
    var bild = x.getImageData(0, 0, c.width, c.height);
    var d = bild.data;
    for (var i = 0; i < d.length; i += 4) {
      var p = i / 4, px = p % c.width, py = (p / c.width) | 0;
      var n = (Math.random() - 0.5) * 10 + (fl(px, py * 2) - 0.5) * 8;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    x.putImageData(bild, 0, 0);

    /* Sömmarna — mjuk skugga med en ljusare tråd i. De tonar ut högst
       upp, där tygpanelerna möts i en punkt. */
    [0.5, 0, 1].forEach(function (u) {
      var mitt = c.width * u;
      var b = 14 * k;
      var g = x.createLinearGradient(mitt - b, 0, mitt + b, 0);
      g.addColorStop(0,    'rgba(0,0,0,0)');
      g.addColorStop(0.42, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.5,  'rgba(70,70,70,0.5)');
      g.addColorStop(0.58, 'rgba(0,0,0,0.55)');
      g.addColorStop(1,    'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(mitt - b, 0, b * 2, c.height * 0.93);
    });

    return somTextur(THREE, c, true);
  }

  /* Mudden: ribbad stickning, med eller utan logga. */
  function muddTextur(THREE, medLogga, stor) {
    var c = duk(stor ? 4096 : 2048, stor ? 512 : 256);
    var x = c.getContext('2d');
    var k = c.width / 4096;

    x.fillStyle = '#111111';
    x.fillRect(0, 0, c.width, c.height);

    for (var i = 0; i < c.width; i += 8 * k) {
      x.fillStyle = (Math.round(i / (8 * k)) % 2 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.30)';
      x.fillRect(i, 0, 4 * k, c.height);
    }

    /* Skugga i vecket där mudden möter kupolen (överkanten). */
    var veckSkugga = x.createLinearGradient(0, 0, 0, c.height * 0.3);
    veckSkugga.addColorStop(0, 'rgba(0,0,0,0.62)');
    veckSkugga.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = veckSkugga;
    x.fillRect(0, 0, c.width, c.height * 0.3);

    if (medLogga) {
      x.save();
      x.translate(c.width * LOGGA_U, c.height * 0.58);
      x.fillStyle = '#F4F4F4';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      /* Duken täcker hela varvet (2πR) på bredden men bara muddens höjd på
         höjden, så en pixel är mycket bredare än den är hög på mössan.
         Trycket pressas ihop i sidled med samma förhållande — annars blir
         loggan utdragen. 1.3 ger det breda, tighta trycket från plagget. */
      var tathet = (c.width / (2 * Math.PI * R)) / (c.height / MUDD_TOPP);
      x.font = '900 ' + Math.round(290 * k) + 'px Archivo, "Arial Black", Helvetica, sans-serif';
      x.scale(tathet * 1.3, 1);
      if ('letterSpacing' in x) x.letterSpacing = Math.round(6 * k) + 'px';
      x.fillText('SILQ', 0, 0);
      x.restore();
    }

    return somTextur(THREE, c, true);
  }

  /* ---------- Material ---------- */

  function tygMaterial(THREE, karta, struktur, upprepa) {
    var n = struktur.clone();
    n.needsUpdate = true;
    n.repeat.set(upprepa[0], upprepa[1]);
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: karta,
      normalMap: n,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.6,
      sheenColor: new THREE.Color(0x303030),
      sheenRoughness: 0.5,
      side: THREE.FrontSide
    });
  }

  /* Satinfodret: silvrigt och glatt. Glansen bryts av vecken i själva
     formen (satinVeck), inte av en normalkarta — en karta nyps ihop vid
     hjässan och ritar en stjärna där. Sheen ger den mjuka tygglansen som
     skiljer satin från polerad metall. */
  function satinMaterial(THREE) {
    return new THREE.MeshPhysicalMaterial({
      color: 0xD2D5DA,
      metalness: 0.5,
      roughness: 0.42,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xffffff),
      sheenRoughness: 0.3,
      clearcoat: 0.25,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.95,
      side: THREE.BackSide
    });
  }

  /* ---------- Mössan ---------- */

  function byggMossa(THREE, alt) {
    alt = alt || {};
    var stor = alt.kvalitet !== 'lag';
    var SEG = stor ? 160 : 104;
    var grupp = new THREE.Group();

    /* Trikån: fin maskstruktur. Ribbningen på mudden: lodräta ränder. */
    var trikaBrus = brus(128, 32, 3);
    var trika = normalKarta(THREE, 128, function (x, y) {
      return trikaBrus(x, y) * 0.6 + Math.sin(x / 128 * Math.PI * 32) * 0.2;
    }, 2.2);
    var ribb = normalKarta(THREE, 128, function (x) {
      return Math.pow(Math.abs(Math.sin(x / 128 * Math.PI * 8)), 0.6);
    }, 1.6);
    var satin = satinMaterial(THREE);

    var kupolGeoUt = new THREE.LatheGeometry(kupolProfil(THREE, R, HJASSA, KUPOL_BOTTEN), SEG);
    vecka(THREE, kupolGeoUt, KUPOL_BOTTEN, HJASSA);
    grupp.add(new THREE.Mesh(kupolGeoUt, tygMaterial(THREE, kupolTextur(THREE, stor), trika, [48, 20])));

    /* Fodret är ett enda stycke från fållen till hjässan, som på plagget.
       Två delar (mudd + kupol) ger en synlig kant där de möts. */
    var fodretGeo = new THREE.LatheGeometry(fodretProfil(THREE), SEG);
    vecka(THREE, fodretGeo, KUPOL_BOTTEN, HJASSA - GODS, satinVeck);
    grupp.add(new THREE.Mesh(fodretGeo, satin));

    grupp.add(new THREE.Mesh(
      new THREE.LatheGeometry(muddProfil(THREE, 1.0), SEG),
      tygMaterial(THREE, muddTextur(THREE, true, stor), ribb, [64, 1])
    ));

    /* Den rullade fållen längst ner. Sluter kanten så mössan inte ser ut
       som ett avskuret rör när man tittar in i den. */
    var fall = new THREE.Mesh(
      new THREE.TorusGeometry(R - GODS / 2, GODS * 0.62, 12, SEG),
      new THREE.MeshPhysicalMaterial({
        color: 0x151515, roughness: 0.75, metalness: 0.0,
        sheen: 0.5, sheenColor: new THREE.Color(0x3a3a3a)
      })
    );
    fall.rotation.x = Math.PI / 2;
    grupp.add(fall);

    /* LatheGeometry lägger u = 0.5 åt -z. Vänd ett halvt varv så sömmen
       och loggan möter kameran i utgångsläget, och sänk mössan så den
       snurrar kring sin egen mitt i stället för kring fållen. */
    grupp.rotation.y = Math.PI;
    grupp.position.y = -HJASSA / 2;

    var bararen = new THREE.Group();
    bararen.add(grupp);
    return bararen;
  }

  /* Miljö och lampor, tänkt för mössan mot vit eller ljus bakgrund.
     Rumsmiljön ger tyget och satinet något att spegla — utan den blir
     svart tyg en platt siluett och satinet grått. */
  function ljussatt(m, scen, ritare) {
    var THREE = m.THREE;
    var pmrem = new THREE.PMREMGenerator(ritare);
    /* Suddad miljö: lamporna i rummet speglas som mjuka ljusfält i satinet
       i stället för skarpa runda fläckar. */
    var miljo = pmrem.fromScene(new m.RoomEnvironment(), 0.18).texture;
    scen.environment = miljo;
    pmrem.dispose();

    var nyckel = new THREE.DirectionalLight(0xffffff, 2.4);
    nyckel.position.set(-2.4, 3.0, 2.6);
    scen.add(nyckel);

    var fyll = new THREE.DirectionalLight(0xe6ebf2, 0.9);
    fyll.position.set(3.0, 0.4, 1.8);
    scen.add(fyll);

    /* Kantljuset bakifrån tecknar silhuetten. */
    var kant = new THREE.DirectionalLight(0xffffff, 2.0);
    kant.position.set(0.6, 1.4, -3.2);
    scen.add(kant);

    /* Underifrån, svagt — lyser upp satinet när mössan vänds. */
    var under = new THREE.DirectionalLight(0xffffff, 0.8);
    under.position.set(0, -3, 1.5);
    scen.add(under);

    scen.add(new THREE.AmbientLight(0xffffff, 0.2));
    return miljo;
  }

  /* Frigör allt på grafikkortet: geometrier, material, texturer. */
  function stadaUpp(scen) {
    scen.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        [].concat(o.material).forEach(function (mat) {
          Object.keys(mat).forEach(function (k) {
            if (mat[k] && mat[k].isTexture) mat[k].dispose();
          });
          mat.dispose();
        });
      }
    });
    if (scen.environment) scen.environment.dispose();
  }

  function skapaRitare(THREE, lag) {
    var ritare = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: lag ? 'low-power' : 'high-performance'
    });
    ritare.setPixelRatio(Math.min(devicePixelRatio, lag ? 1.5 : 2));
    ritare.toneMapping = THREE.ACESFilmicToneMapping;
    ritare.toneMappingExposure = 1.0;
    ritare.outputColorSpace = THREE.SRGBColorSpace;
    return ritare;
  }

  /* Mjuk kontaktskugga under mössan. En radiell gradient på ett plan är
     billigare än riktiga skuggor och ser lugnare ut mot vit bakgrund. */
  function kontaktskugga(THREE) {
    var c = duk(256, 256);
    var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    var plan = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 3.0),
      new THREE.MeshBasicMaterial({ map: somTextur(THREE, c, false), transparent: true, depthWrite: false })
    );
    plan.rotation.x = -Math.PI / 2;
    plan.position.y = -HJASSA / 2 - 0.2;
    plan.renderOrder = -1;
    return plan;
  }

  /* ================================================================
     Produktvisaren
     ================================================================ */

  var VYER = {
    fram:   { a: 0,             t: 0.14 },
    sida:   { a: -Math.PI / 2,  t: 0.10 },
    bak:    { a: Math.PI,       t: 0.14 },
    insida: { a: 0.5,           t: -1.02, z: 1.12 }
  };

  var MIN_TILT = -1.95;   // negativt = öppningen vänds mot betraktaren
  var MAX_TILT = 1.25;    // positivt = hjässan vänds mot betraktaren

  function montera(vard, alt) {
    alt = alt || {};
    return ladda().then(function (m) {
      var THREE = m.THREE;
      var lag = kvalitet() === 'lag';

      var scen = new THREE.Scene();
      var kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      var ritare = skapaRitare(THREE, lag);
      var duk = ritare.domElement;
      duk.classList.add('cap3d__duk');
      duk.setAttribute('aria-hidden', 'true');
      vard.appendChild(duk);

      ljussatt(m, scen, ritare);

      var mossa = byggMossa(THREE, { kvalitet: lag ? 'lag' : 'hog' });
      scen.add(mossa);
      var skugga = kontaktskugga(THREE);
      scen.add(skugga);

      /* ---------- Tillstånd ----------
         mal* är dit fingret vill, nu* är var mössan är. Varje bildruta
         glider nu* mot mal*: det ger rörelsen vikt. Efter ett släpp
         fortsätter mal* med farten fingret hade och bromsas in. */

      var reducera = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var start = VYER[alt.vy] || VYER.fram;

      var nuA = start.a - (reducera ? 0 : 0.9), malA = start.a;
      var nuT = start.t, malT = start.t;
      var basAvst = 4.3;
      var nuZ = basAvst * (start.z || 1) * 1.06, malZ = basAvst * (start.z || 1);
      var fartA = 0, fartT = 0;
      var sjalvsnurr = !reducera && !alt.vy;

      var drar = false, sista = null, senasteTid = 0;
      var pekare = {}, nyp = null;

      function begransa() {
        malT = Math.max(MIN_TILT, Math.min(MAX_TILT, malT));
        malZ = Math.max(basAvst * 0.6, Math.min(basAvst * 1.5, malZ));
      }

      function avstandMellan() {
        var p = Object.keys(pekare).map(function (k) { return pekare[k]; });
        return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }

      duk.addEventListener('pointerdown', function (e) {
        pekare[e.pointerId] = { x: e.clientX, y: e.clientY };
        duk.setPointerCapture(e.pointerId);
        sjalvsnurr = false;
        if (alt.narDras) alt.narDras();
        if (Object.keys(pekare).length === 2) {
          drar = false;
          nyp = { avst: avstandMellan(), z: malZ };
        } else {
          drar = true;
          fartA = fartT = 0;
          sista = { x: e.clientX, y: e.clientY };
          senasteTid = performance.now();
          duk.classList.add('is-drar');
        }
        vacka();
      });

      duk.addEventListener('pointermove', function (e) {
        if (!(e.pointerId in pekare)) return;
        pekare[e.pointerId] = { x: e.clientX, y: e.clientY };

        if (nyp && Object.keys(pekare).length === 2) {
          var nu = avstandMellan();
          if (nyp.avst > 0) { malZ = nyp.z * (nyp.avst / nu); begransa(); }
          vacka();
          return;
        }
        if (!drar) return;

        /* Känsligheten följer dukens storlek: ett drag över hela bredden
           är ungefär ett varv, oavsett skärm. */
        var bredd = Math.max(320, duk.clientWidth);
        var dA = (e.clientX - sista.x) / bredd * Math.PI * 2;
        var dT = (e.clientY - sista.y) / bredd * Math.PI * 1.6;
        malA += dA;
        malT += dT;
        begransa();

        var nu2 = performance.now();
        var dt = Math.max(8, nu2 - senasteTid);
        /* Farten mäts per 16 ms (en bildruta) och jämnas ut, så ett ryckigt
           sista drag inte skickar iväg mössan. */
        fartA = fartA * 0.6 + (dA * 16 / dt) * 0.4;
        fartT = fartT * 0.6 + (dT * 16 / dt) * 0.4;
        senasteTid = nu2;
        sista = { x: e.clientX, y: e.clientY };
        vacka();
      });

      function slapp(e) {
        delete pekare[e.pointerId];
        try { duk.releasePointerCapture(e.pointerId); } catch (err) { /* redan släppt */ }
        if (Object.keys(pekare).length < 2) nyp = null;
        if (!Object.keys(pekare).length) {
          drar = false;
          duk.classList.remove('is-drar');
          /* Står fingret still en stund innan släppet ska mössan inte
             fortsätta snurra. */
          if (performance.now() - senasteTid > 90) fartA = fartT = 0;
          vacka();
        }
      }
      duk.addEventListener('pointerup', slapp);
      duk.addEventListener('pointercancel', slapp);

      duk.addEventListener('wheel', function (e) {
        e.preventDefault();
        sjalvsnurr = false;
        malZ *= Math.exp(e.deltaY * 0.0012);
        begransa();
        vacka();
      }, { passive: false });

      duk.addEventListener('dblclick', function () { visa('fram'); });

      /* Kortaste vägen runt: från 350° till 10° ska mössan vrida 20°,
         inte 340° åt andra hållet. */
      function visa(namn) {
        var v = VYER[namn];
        if (!v) return;
        sjalvsnurr = false;
        fartA = fartT = 0;
        var tva = Math.PI * 2;
        var diff = ((v.a - malA) % tva + tva * 1.5) % tva - Math.PI;
        malA += diff;
        malT = v.t;
        malZ = basAvst * (v.z || 1);
        vacka();
      }

      function storlek() {
        var b = vard.clientWidth || 1;
        var h = vard.clientHeight || 1;
        ritare.setSize(b, h, false);
        kamera.aspect = b / h;
        /* Kameraavståndet räknas ut så att mössan (ungefär 2.5 × 2.3
           enheter med marginal) ryms både på höjden och på bredden —
           en stående mobilskärm är smal, en laptop är låg. */
        var halvV = Math.tan(kamera.fov * Math.PI / 360);
        var nyBas = Math.max(1.15 / halvV, 1.3 / (halvV * b / h));
        malZ *= nyBas / basAvst;
        nuZ *= nyBas / basAvst;
        basAvst = nyBas;
        kamera.updateProjectionMatrix();
        vacka();
      }

      /* ---------- Rit-slingan ----------
         Ritar bara medan något rör sig. Står mössan still vilar
         grafikkortet — viktigt på batteridrivna enheter. */
      var igang = false, stoppad = false, paus = false;

      function vacka() {
        if (igang || stoppad || paus) return;
        igang = true;
        requestAnimationFrame(rita);
      }

      function rita() {
        if (stoppad || paus) { igang = false; return; }

        if (sjalvsnurr) malA += 0.0035;
        if (!drar) {
          malA += fartA; malT += fartT;
          fartA *= 0.93; fartT *= 0.90;
          if (Math.abs(fartA) < 1e-5) fartA = 0;
          if (Math.abs(fartT) < 1e-5) fartT = 0;
          begransa();
        }

        var f = reducera ? 1 : 0.14;
        nuA += (malA - nuA) * f;
        nuT += (malT - nuT) * f;
        nuZ += (malZ - nuZ) * f;

        mossa.rotation.set(nuT, nuA, 0, 'XYZ');
        /* Skuggan bleknar när mössan vänds upp och ner — då hänger den
           inte längre över golvet. */
        skugga.material.opacity = Math.max(0, 1 - Math.abs(nuT) * 0.9);
        kamera.position.set(0, 0.05, nuZ);
        kamera.lookAt(0, -0.02, 0);
        ritare.render(scen, kamera);

        var stilla = !sjalvsnurr && !fartA && !fartT &&
                     Math.abs(malA - nuA) < 1e-4 && Math.abs(malT - nuT) < 1e-4 &&
                     Math.abs(malZ - nuZ) < 1e-4;
        if (stilla && !drar) { igang = false; return; }
        requestAnimationFrame(rita);
      }

      storlek();
      var observator = new ResizeObserver(storlek);
      observator.observe(vard);

      return {
        duk: duk,
        visa: visa,
        pausa: function (pa) { paus = pa; if (!pa) vacka(); },
        stoppa: function () {
          stoppad = true;
          observator.disconnect();
          stadaUpp(scen);
          ritare.dispose();
          ritare.forceContextLoss();
          if (duk.parentNode) duk.parentNode.removeChild(duk);
        }
      };
    });
  }

  window.SILQ3D = {
    ladda: ladda,
    byggMossa: byggMossa,
    ljussatt: ljussatt,
    stadaUpp: stadaUpp,
    skapaRitare: skapaRitare,
    kvalitet: kvalitet,
    montera: montera,
    HJASSA: HJASSA
  };
})();
