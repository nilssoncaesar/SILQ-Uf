/* Frilägger en mörk produkt mot vit bakgrund.

   node frilagg.js in.jpg ut.jpg [tröskel] [crop x,y,w,h]

   tröskel   0–255. Pixlar mörkare än så räknas som produkt. Börja på 145;
             sänk om bakgrunden äter sig in, höj om delar av produkten försvinner.
   crop      beskär först, i originalbildens pixlar.

   Miljövariabler:
   POLY       JSON-lista med polygoner (originalbildens koordinater) runt ljusa
              delar av produkten — t.ex. satinfoder — som annars tolkas som
              bakgrund. Inuti dem räknas bara varma, ljusa pixlar (bordet) som
              bakgrund.
   EJ_BOTTEN  sätt till 1 om produkten går ut genom bildens underkant.

   Kräver: npm i sharp */
const sharp = require('sharp');

const [,, IN, OUT, T = '95', CROP] = process.argv;
const TROSKEL = +T;

(async () => {
  let img = sharp(IN).rotate();
  if (CROP) {
    const [left, top, width, height] = CROP.split(',').map(Number);
    img = img.extract({ left, top, width, height });
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;

  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    lum[i] = 0.299 * data[i*3] + 0.587 * data[i*3+1] + 0.114 * data[i*3+2];
  }

  let m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = lum[i] < TROSKEL ? 1 : 0;

  const morf = (src, r, erode) => {
    // separabel min/max-filter
    const tmp = new Uint8Array(N), out = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = erode ? 1 : 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(W - 1, Math.max(0, x + k));
        const s = src[y*W + xx];
        if (erode) { if (!s) { v = 0; break; } } else if (s) { v = 1; break; }
      }
      tmp[y*W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = erode ? 1 : 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(H - 1, Math.max(0, y + k));
        const s = tmp[yy*W + x];
        if (erode) { if (!s) { v = 0; break; } } else if (s) { v = 1; break; }
      }
      out[y*W + x] = v;
    }
    return out;
  };

  // Öppning: tar bort tunna sprickor i träet
  m = morf(morf(m, 3, true), 3, false);

  // Största sammanhängande mörka område = mössan
  const lab = new Int32Array(N).fill(-1);
  let bast = -1, bastStorlek = 0, nr = 0;
  const ko = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!m[s] || lab[s] !== -1) continue;
    let h = 0, t = 0; ko[t++] = s; lab[s] = nr; let storlek = 0;
    while (h < t) {
      const p = ko[h++]; storlek++;
      const x = p % W, y = (p / W) | 0;
      const g = [x > 0 ? p-1 : -1, x < W-1 ? p+1 : -1, y > 0 ? p-W : -1, y < H-1 ? p+W : -1];
      for (const q of g) if (q >= 0 && m[q] && lab[q] === -1) { lab[q] = nr; ko[t++] = q; }
    }
    if (storlek > bastStorlek) { bastStorlek = storlek; bast = nr; }
    nr++;
  }
  let mossa = new Uint8Array(N);
  for (let i = 0; i < N; i++) mossa[i] = lab[i] === bast ? 1 : 0;

  // Stängning: jämnar kanten
  mossa = morf(morf(mossa, 4, false), 4, true);

  // Utsidan = det som nås från bildkanten utan att korsa mössan.
  // Allt annat (loggan, satinet inne i mössan) hör till produkten.
  const ute = new Uint8Array(N);
  let h = 0, t = 0;
  // Satinområden, handritade i originalbildens koordinater
  const OX = CROP ? +CROP.split(',')[0] : 0, OY = CROP ? +CROP.split(',')[1] : 0;
  const POLY = JSON.parse(process.env.POLY || '[]').map(pl => pl.map(([x,y]) => [x-OX, y-OY]));
  const inne = (x, y, pl) => { let c = false; for (let i = 0, j = pl.length-1; i < pl.length; j = i++) { const [xi,yi]=pl[i],[xj,yj]=pl[j]; if (((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) c = !c; } return c; };
  const poly = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (POLY.some(pl => inne(x, y, pl))) poly[y*W+x] = 1;
  const varm = (p) => (data[p*3] - data[p*3+2]) >= 7 && lum[p] > 180;
  const push = (p) => { if (!mossa[p] && !ute[p] && (!poly[p] || varm(p))) { ute[p] = 1; ko[t++] = p; } };
  for (let x = 0; x < W; x++) { push(x); if (!process.env.EJ_BOTTEN) push((H-1)*W + x); }
  for (let y = 0; y < H; y++) { push(y*W); push(y*W + W-1); }
  while (h < t) {
    const p = ko[h++]; const x = p % W, y = (p / W) | 0;
    if (x > 0) push(p-1); if (x < W-1) push(p+1); if (y > 0) push(p-W); if (y < H-1) push(p+W);
  }

  // Mjuk kant: krymp 1 px, sudda 1.6 px
  let prod = new Uint8Array(N);
  const krymp = morf(Uint8Array.from(ute, v => v ? 0 : 1), 1, true);
  for (let i = 0; i < N; i++) prod[i] = krymp[i] ? 255 : 0;
  const alfa = await sharp(Buffer.from(prod), { raw: { width: W, height: H, channels: 1 } })
    .blur(1.6).extractChannel(0).raw().toBuffer();

  const ut = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    const a = alfa[i] / 255;
    for (let c = 0; c < 3; c++) ut[i*3+c] = Math.round(data[i*3+c] * a + 255 * (1 - a));
  }
  await sharp(ut, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 86, mozjpeg: true }).toFile(OUT);
  console.log(OUT, W + 'x' + H);
})();
