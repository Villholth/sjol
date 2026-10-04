(() => {
'use strict';

const html = document.documentElement;
html.classList.remove('uten-js');
html.classList.add('med-js');
const mqBevegelse = matchMedia('(prefers-reduced-motion: no-preference)');
const mqSidestilt = matchMedia('(min-width: 1024px), (min-width: 640px) and (max-height: 500px)');
let bevegelse = mqBevegelse.matches;
html.classList.toggle('bevegelse', bevegelse);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const NBSP = ' ';
const nbFmt = new Intl.NumberFormat('nb-NO');
const tall = n => nbFmt.format(n).replace(/[   ]/g, NBSP);
const klem = (a, v, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const NS = 'http://www.w3.org/2000/svg';
const sett = (el, egenskap, verdi) => { if (el) el.style.setProperty(egenskap, verdi); };
const fjern = (el, ...egenskaper) => { if (el) for (const e of egenskaper) el.style.removeProperty(e); };
const del = (t, fra, varighet) => klem(0, (t - fra) / varighet, 1);

function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const x = u => ((ax * u + bx) * u + cx) * u, y = u => ((ay * u + by) * u + cy) * u, dx = u => (3 * ax * u + 2 * bx) * u + cx;
  return t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) { const f = x(u) - t, d = dx(u); if (Math.abs(f) < 1e-5 || Math.abs(d) < 1e-6) break; u -= f / d; }
    if (u < 0 || u > 1) { let a = 0, b = 1; u = t; for (let i = 0; i < 20; i++) { if (x(u) < t) a = u; else b = u; u = (a + b) / 2; } }
    return y(u);
  };
}
const easeUt = bezier(.2, .7, .2, 1), easeInnUt = bezier(.6, 0, .3, 1), easeFjaer = bezier(.3, 1.35, .5, 1);

const klokke = (() => {
  const aktive = new Set(); let sist = 0, id = 0;
  const steg = naa => {
    const dt = sist ? Math.min(naa - sist, 50) : 16; sist = naa;
    for (const a of Array.from(aktive)) { a.t += dt; if (a.f(a.t) === false) aktive.delete(a); }
    if (aktive.size) id = requestAnimationFrame(steg); else { id = 0; sist = 0; }
  };
  document.addEventListener('visibilitychange', () => { sist = 0; });
  return {
    kjor(f) { const a = { t: 0, f }; aktive.add(a); f(0); if (!id) id = requestAnimationFrame(steg); return () => aktive.delete(a); },
    stoppAlle() { aktive.clear(); },
  };
})();

function skala(svg, r) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (!r) r = svg.getBoundingClientRect();
  if (!vb || !vb.width || !r.width || !r.height) return;
  const slice = (svg.getAttribute('preserveAspectRatio') || '').indexOf('slice') >= 0;
  const s = slice ? Math.max(r.width / vb.width, r.height / vb.height) : Math.min(r.width / vb.width, r.height / vb.height);
  svg.style.setProperty('--k', String(1 / s));
}
const kartene = $$('svg.kart');
const flater = new WeakMap();
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(poster => { for (const p of poster) { flater.set(p.target, p.contentRect); if (!p.target.classList.contains('kamera')) skala(p.target, p.contentRect); } });
  kartene.forEach(s => ro.observe(s));
} else {
  requestAnimationFrame(() => kartene.forEach(s => skala(s)));
  addEventListener('resize', () => kartene.forEach(s => skala(s)));
}

const data = id => { const el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } };
let scene = null, talldata = null;
const hentScene = () => scene || (scene = data('data-scene'));
const hentTall = () => talldata || (talldata = data('data-tall'));

const tilbakestillere = [];
const nullstill = f => tilbakestillere.push(f);
function engang(el, terskel, { start, spill }) {
  if (!el || !bevegelse || !('IntersectionObserver' in window)) return;
  let klar = null;
  const io = new IntersectionObserver(poster => {
    for (const p of poster) {
      if (klar === null) {
        klar = !p.isIntersecting;
        if (!klar || !bevegelse) { io.disconnect(); return; }
        start();
      }
      if (p.isIntersecting && p.intersectionRatio >= terskel * 0.98) { io.disconnect(); if (bevegelse) spill(); return; }
    }
  }, { threshold: [0, terskel] });
  io.observe(el);
}

(() => {
  const fig = $('.i-dag-figur'); if (!fig) return;
  const rett = $('.rett-strek', fig), punktA = $('.rett-punkt-a', fig), punktB = $('.rett-punkt-b', fig);
  const kant = $('.egen .kant', fig), kjerne = $('.egen .kjerne', fig), start = $$('.startprikk-ring, .startprikk', fig);
  const maal = $('.maal-linje', fig), ender = $$('.maal-ende', fig);
  const etLenka = $('.et-iDag-lenka', fig), etStart = $('.et-iDag-startOgSlutt', fig), etAvvik = $('.et-iDag-avvik', fig);
  const alle = [rett, punktA, punktB, kant, kjerne, maal, etLenka, etStart, etAvvik, ...start, ...ender];
  const slutt = () => alle.forEach(el => fjern(el, 'stroke-dashoffset', 'opacity'));
  nullstill(slutt);
  engang(fig, 0.4, {
    start() {
      [rett, kant, kjerne, maal].forEach(el => sett(el, 'stroke-dashoffset', '1.001'));
      [punktA, punktB, etLenka, etStart, etAvvik, ...start, ...ender].forEach(el => sett(el, 'opacity', '0'));
    },
    spill() {
      klokke.kjor(t => {
        if (!bevegelse) { slutt(); return false; }
        sett(rett, 'stroke-dashoffset', String(1 - easeUt(del(t, 0, 300))));
        sett(punktA, 'opacity', String(del(t, 0, 80)));
        sett(punktB, 'opacity', String(del(t, 280, 80)));
        sett(etStart, 'opacity', String(easeUt(del(t, 300, 200))));
        const l = String(1 - easeInnUt(del(t, 200, 900)));
        sett(kant, 'stroke-dashoffset', l); sett(kjerne, 'stroke-dashoffset', l);
        start.forEach(el => sett(el, 'opacity', String(del(t, 200, 120))));
        sett(etLenka, 'opacity', String(easeUt(del(t, 1000, 200))));
        sett(maal, 'stroke-dashoffset', String(1 - easeUt(del(t, 1100, 200))));
        ender.forEach(el => sett(el, 'opacity', String(del(t, 1100, 200))));
        sett(etAvvik, 'opacity', String(easeUt(del(t, 1100, 200))));
        if (t >= 1300) { slutt(); return false; }
      });
    },
  });
})();

const setting = (() => {
  const omr = $('.sett-omraade'); if (!omr) return null;
  const svg = $('.sett-kart', omr), kartFlate = $('.scene-kart', omr);
  const lenkeKant = $('.sett-lenke .kant', svg), lenkeKjerne = $('.sett-lenke .kjerne', svg);
  const spor = $('.spor:not(.spor-hale)', svg), hale = $('.spor-hale', svg), sloyfe = $('.sloyfe-fjernet', svg);
  const baat = $('.baat', svg), baatRot = $('.baat-rot', svg);
  const etLag = $('.se-etiketter', svg), kort = $('.garnkort-kart', omr);
  const noter = $$('.note', omr);
  const felt = {}; $$('[data-felt]', $('.stripe', omr)).forEach(el => { felt[el.dataset.felt] = el; });
  const original = { lenke: lenkeKant.getAttribute('d'), spor: spor.getAttribute('d'), vb: svg.getAttribute('viewBox'), baat: baat.getAttribute('transform'), felt: {} };
  for (const k in felt) original.felt[k] = felt[k].textContent;
  const vb0 = svg.viewBox.baseVal; const VB = { x: vb0.x, y: vb0.y, w: vb0.width, h: vb0.height };

  let D = null;
  function forbered() {
    if (D) return D;
    const sc = hentScene(); if (!sc) return null;
    const [sx, sy] = sc.s;
    const les = str => { const ut = []; for (const par of str.split(' ')) { const [a, b] = par.split(','); ut.push(sx + (+a) / 10, sy + (+b) / 10); } return Float64Array.from(ut); };
    const glatt = a => {
      const n = a.length / 2, ut = new Float64Array(a.length);
      for (let i = 0; i < n; i++) {
        if (i === 0 || i === n - 1) { ut[2 * i] = a[2 * i]; ut[2 * i + 1] = a[2 * i + 1]; continue; }
        let x = 0, y = 0, k = 0;
        for (let q = Math.max(0, i - 3); q <= Math.min(n - 1, i + 3); q++) { x += a[2 * q]; y += a[2 * q + 1]; k++; }
        ut[2 * i] = x / k; ut[2 * i + 1] = y / k;
      }
      return ut;
    };
    const fikser = les(sc.fikser), forL = glatt(les(sc.for)), etter = glatt(les(sc.etter)), sloyfeP = les(sc.sloyfe);
    const tekst = arr => { const n = arr.length / 2, ut = new Array(n); for (let i = 0; i < n; i++) ut[i] = `${Math.round(arr[2 * i] * 10) / 10} ${Math.round(arr[2 * i + 1] * 10) / 10}`; return ut; };
    D = { fikser, forL, etter, sloyfeP, n: sc.n, meter: sc.meter, lukk: sc.lukk, h: sc.hendelser, etiketter: sc.etiketter || {},
      antall: fikser.length / 2, fiksTekst: tekst(fikser), forTekst: tekst(forL), etterTekst: tekst(etter) };
    const N = D.antall, kurs = new Float64Array(N);
    const inni = (a, b) => i => i >= a && i <= b;
    const stille = inni(D.h.stille[0], D.h.stille[1] + 4), rygg = inni(D.h.rygging[0] - 2, D.h.rygging[1] + 6);
    let forrige = 62;
    for (let i = 0; i < N; i++) {
      if (stille(i) || rygg(i)) { kurs[i] = forrige; continue; }
      const a = Math.max(0, i - 7), b = Math.min(N - 1, i + 7);
      const dx = fikser[2 * b] - fikser[2 * a], dy = fikser[2 * b + 1] - fikser[2 * a + 1];
      if (Math.hypot(dx, dy) > 4) { let k = Math.atan2(dx, -dy) * 180 / Math.PI; while (k - forrige > 180) k -= 360; while (k - forrige < -180) k += 360; forrige = k; }
      kurs[i] = forrige;
    }
    D.kurs = kurs;
    const vokser = fra => { const m0 = D.meter[fra]; for (let j = fra + 1; j < N; j++) if (D.meter[j] > m0 + 0.05) return j; return N; };
    D.hold = [[D.h.stille[0], vokser(D.h.stille[1])], [D.h.rygging[0], vokser(D.h.rygging[1])]];
    return D;
  }

  const FASER = [[0, 0.10, 0, 0], [0.10, 0.28, 0, 200], [0.28, 0.44, 200, 330], [0.44, 0.76, 330, 700], [0.76, 0.92, 700, 834], [0.92, 1.0001, 834, 834]];
  const fiksVed = p => { for (const [a, b, f0, f1] of FASER) if (p < b) return lerp(f0, f1, klem(0, (p - a) / (b - a), 1)); return 834; };
  const fase = p => p < 0.10 ? 0 : p < 0.28 ? 1 : p < 0.44 ? 2 : p < 0.76 ? 3 : p < 0.92 ? 4 : 5;

  let etikettEl = null, etikettModus = '';
  function lagEtiketter() {
    const modus = mqSidestilt.matches ? 'bred' : 'smal';
    if (etikettEl && etikettModus === modus) return;
    etikettModus = modus; etLag.textContent = ''; etikettEl = {};
    for (const id of ['stille', 'rygging', 'sloyfe']) {
      const e = D.etiketter[id]; if (!e || !e[modus]) continue;
      const v = e[modus];
      const ax = VB.x + v.x / 100 * VB.w, ay = VB.y + v.y / 100 * VB.h;
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'se-etikett borte'); g.setAttribute('transform', `translate(${ax} ${ay})`);
      const kp = document.createElementNS(NS, 'g'); kp.setAttribute('class', 'kp'); g.appendChild(kp);
      const tekst = document.createElementNS(NS, 'text'); tekst.textContent = e.tekst;
      const bak = document.createElementNS(NS, 'rect'); bak.setAttribute('class', 'se-bak'); bak.setAttribute('rx', '3');
      const leder = document.createElementNS(NS, 'line'); leder.setAttribute('class', 'se-leder');
      kp.appendChild(leder); kp.appendChild(bak); kp.appendChild(tekst);
      etLag.appendChild(g);
      let tw = 0; try { tw = tekst.getComputedTextLength(); } catch (err) { tw = 0; }
      if (!tw) tw = e.tekst.length * 9;
      const w = tw + 12, h = 24, L = v.leder;
      let bx = v.juster === 'venstre' ? 0 : v.juster === 'hoyre' ? -w : -w / 2, by = 0;
      const linje = (x1, y1, x2, y2) => { leder.setAttribute('x1', x1); leder.setAttribute('y1', y1); leder.setAttribute('x2', x2); leder.setAttribute('y2', y2); };
      if (v.side === 'sor') { by = L; linje(0, 6, 0, L); }
      else if (v.side === 'nord') { by = -L - h; linje(0, -6, 0, -L); }
      else if (v.side === 'ost') { bx = L; by = -h / 2; linje(6, 0, L, 0); }
      else if (v.side === 'vest') { bx = -L - w; by = -h / 2; linje(-6, 0, -L, 0); }
      bak.setAttribute('x', bx); bak.setAttribute('y', by); bak.setAttribute('width', w); bak.setAttribute('height', h);
      tekst.setAttribute('x', bx + 6); tekst.setAttribute('y', by + 17);
      g.boks = [ax, ay, bx, by, w, h];
      etikettEl[id] = g;
    }
  }

  let kamera = null;
  const fullVisning = () => {
    const r = kartFlate.getBoundingClientRect(); const a = r.height / Math.max(1, r.width);
    let w = VB.w, h = VB.w * a; if (h < VB.h) { h = VB.h; w = VB.h / a; }
    return { cx: VB.x + VB.w / 2, cy: VB.y + VB.h / 2, w, h, a, bredde: r.width };
  };
  function kameraSteg(p, bx, by, umiddelbart) {
    const f = fiksVed(p), h = D.h, a0 = h.stille[0] - 18, a1 = h.stille[0] - 2, b0 = D.hold[1][1] + 6, b1 = D.hold[1][1] + 26;
    const naer = f < a0 ? 0 : f < a1 ? easeInnUt((f - a0) / (a1 - a0)) : f < b0 ? 1 : f < b1 ? 1 - easeInnUt((f - b0) / (b1 - b0)) : 0;
    if (mqSidestilt.matches) {
      if (naer <= 0) { if (kamera) { svg.setAttribute('viewBox', original.vb); svg.classList.remove('kamera'); kamera = null; skala(svg, flater.get(svg)); if (etikettEl) for (const g of Object.values(etikettEl)) g.classList.remove('utenfor'); } return false; }
      const w = lerp(VB.w, 600, naer), hh = w * VB.h / VB.w;
      kamera = { cx: lerp(VB.x + VB.w / 2, bx, naer), cy: lerp(VB.y + VB.h / 2, by, naer), w, h: hh };
      const vbS = `${(kamera.cx - w / 2).toFixed(1)} ${(kamera.cy - hh / 2).toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}`;
      if (svg.getAttribute('viewBox') !== vbS) { svg.setAttribute('viewBox', vbS); svg.classList.add('kamera'); skala(svg, flater.get(svg)); }
      return false;
    }
    const full = fullVisning();
    const B = lerp(560, 240, naer), bh = B * full.a;
    const inn = p < 0.10 ? 0 : p < 0.14 ? easeInnUt((p - 0.10) / 0.04) : p < 0.84 ? 1 : p < 0.94 ? 1 - easeInnUt((p - 0.84) / 0.10) : 0;
    const mal = { cx: lerp(full.cx, bx, inn), cy: lerp(full.cy, by, inn), w: lerp(full.w, B, inn), h: lerp(full.h, bh, inn) };
    if (!kamera || umiddelbart) kamera = { ...mal };
    else { kamera.cx = lerp(kamera.cx, mal.cx, 0.18); kamera.cy = lerp(kamera.cy, mal.cy, 0.18); kamera.w = mal.w; kamera.h = mal.h; }
    const vb = `${(kamera.cx - kamera.w / 2).toFixed(1)} ${(kamera.cy - kamera.h / 2).toFixed(1)} ${kamera.w.toFixed(1)} ${kamera.h.toFixed(1)}`;
    if (svg.getAttribute('viewBox') !== vb) { svg.setAttribute('viewBox', vb); svg.classList.add('kamera'); if (full.bredde) svg.style.setProperty('--k', String(kamera.w / full.bredde)); }
    if (etikettEl && full.bredde) {
      const k = kamera.w / full.bredde, x0 = kamera.cx - kamera.w / 2 + 4 * k, y0 = kamera.cy - kamera.h / 2 + 4 * k, kw = kamera.w - 8 * k, kh = kamera.h - 8 * k;
      for (const g of Object.values(etikettEl)) {
        const [ax, ay, bx, by, w, hh] = g.boks, l = ax + bx * k, t = ay + by * k, rr = l + w * k, b = t + hh * k;
        const inne = Math.max(0, Math.min(rr, x0 + kw) - Math.max(l, x0)) * Math.max(0, Math.min(b, y0 + kh) - Math.max(t, y0)) / ((rr - l) * (b - t));
        g.classList.toggle('utenfor', inne < 0.98);
      }
    }
    return Math.abs(kamera.cx - mal.cx) > 0.3 || Math.abs(kamera.cy - mal.cy) > 0.3;
  }

  let aktiv = false, rafId = 0, sistIdx = -1, sistFase = -1, sistLenkeN = -1, sistLenkeKilde = null, sloyfeVist = null, sammentrekk = null, sistP = -1, sistHold = -1;
  let tauEnde = null, sporTopp = null;
  function lagHoldMerker() {
    if (tauEnde) return;
    sporTopp = document.createElementNS(NS, 'path'); sporTopp.setAttribute('class', 'sloyfe-fjernet'); sporTopp.setAttribute('d', 'M0 0');
    tauEnde = document.createElementNS(NS, 'g'); tauEnde.setAttribute('class', 'tau-ende borte');
    const kp = document.createElementNS(NS, 'g'); kp.setAttribute('class', 'kp'); tauEnde.appendChild(kp);
    for (const kl of ['handtak-ring', 'handtak-ring-hvit']) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', kl); c.setAttribute('r', '9'); kp.appendChild(c); }
    svg.insertBefore(sporTopp, baat); svg.insertBefore(tauEnde, baat);
  }
  let markering = null;
  function markerTall() {
    if (markering) markering();
    markering = klokke.kjor(t => {
      const o = String(1 - 0.5 * Math.sin(Math.PI * del(t, 0, 600)));
      sett(felt.lenke, 'opacity', o); sett(felt.favner, 'opacity', o);
      if (t >= 600 || !bevegelse) { fjern(felt.lenke, 'opacity'); fjern(felt.favner, 'opacity'); markering = null; return false; }
    });
  }
  const verdier = {};
  const settFelt = (k, v) => { if (verdier[k] !== v) { verdier[k] = v; felt[k].textContent = v; } };
  const klokkeslett = i => { const s = 5 * 3600 + 52 * 60 + i; return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`; };
  const rund = v => Math.round(v * 10) / 10;

  function lenkeD(kilde, tekst, n, trekk) {
    if (n <= 0) return '';
    if (!trekk) return 'M' + tekst.slice(0, n).join('L');
    const { k, kx, ky, t } = trekk; const deler = [];
    for (let j = 0; j < n; j++) deler.push(j > k ? `${rund(lerp(kilde[2 * j], kx, t))} ${rund(lerp(kilde[2 * j + 1], ky, t))}` : tekst[j]);
    return 'M' + deler.join('L') + `L${rund(kx)} ${rund(ky)}`;
  }

  function tegn(p) {
    const d = D; const f = Math.min(fiksVed(p), d.antall - 1), i = Math.floor(f), u = f - i, j = Math.min(i + 1, d.antall - 1);
    const fs = fase(p);
    const bx = lerp(d.fikser[2 * i], d.fikser[2 * j], u), by = lerp(d.fikser[2 * i + 1], d.fikser[2 * j + 1], u);
    baat.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
    baatRot.setAttribute('transform', `rotate(${lerp(d.kurs[i], d.kurs[j], u).toFixed(1)})`);
    if (i !== sistIdx || fs !== sistFase) {
      const n = fs === 0 ? 0 : d.n[i];
      const forLukk = i < d.lukk, kilde = forLukk ? 'for' : 'etter';
      if (sistIdx >= 0 && sistIdx < d.lukk && !forLukk && bevegelse) startSammentrekk();
      if (forLukk && sammentrekk) { sammentrekk.stopp(); sammentrekk = null; }
      if (!sammentrekk && (n !== sistLenkeN || kilde !== sistLenkeKilde)) {
        const dd = forLukk ? lenkeD(d.forL, d.forTekst, n) : lenkeD(d.etter, d.etterTekst, n);
        lenkeKant.setAttribute('d', dd); lenkeKjerne.setAttribute('d', dd);
        sistLenkeN = n; sistLenkeKilde = kilde;
      }
      spor.setAttribute('d', fs === 0 ? 'M0 0' : 'M' + d.fiksTekst.slice(0, i + 1).join('L'));
      if (sloyfeVist !== !forLukk) { sloyfe.classList.toggle('borte', forLukk); sloyfeVist = !forLukk; }
      if (etikettEl) {
        if (etikettEl.stille) etikettEl.stille.classList.toggle('borte', !(fs > 0 && i >= d.h.stilleEtikett));
        if (etikettEl.rygging) etikettEl.rygging.classList.toggle('borte', !(fs > 0 && i >= d.h.ryggingEtikett));
        if (etikettEl.sloyfe) etikettEl.sloyfe.classList.toggle('borte', forLukk);
      }
      const m = fs === 0 ? 0 : d.meter[i];
      settFelt('klokka', fs === 0 ? '05:51' : klokkeslett(i));
      settFelt('lenke', `${tall(Math.round(m))}${NBSP}m`);
      settFelt('favner', `${tall(Math.round(m / 1.8288))}${NBSP}fv`);
      const inni = ([a, b]) => i >= a && i <= b;
      settFelt('status', fs === 0 ? 'klar' : fs === 5 ? 'ferdig' : inni(d.h.stille) ? 'stille' : inni(d.h.rygging) ? 'rygger' : 'setter');
      const hv = fs === 0 || fs === 5 ? -1 : d.hold.findIndex(([a, b]) => i >= a && i < b);
      if (hv !== sistHold) { tauEnde.classList.toggle('borte', hv < 0); if (hv >= 0 && sistHold < 0 && sistIdx >= 0) markerTall(); sistHold = hv; }
      if (hv >= 0 && n > 0) {
        const arr = forLukk ? d.forL : d.etter;
        tauEnde.setAttribute('transform', `translate(${rund(arr[2 * (n - 1)])} ${rund(arr[2 * (n - 1) + 1])})`);
      }
      sporTopp.setAttribute('d', hv === 1 ? 'M' + d.fiksTekst.slice(d.hold[1][0], i + 1).join('L') : 'M0 0');
      sistIdx = i;
    }
    hale.setAttribute('d', fs === 0 ? 'M0 0' : `M${d.fiksTekst[i]}L${bx.toFixed(1)} ${by.toFixed(1)}`);
    if (fs !== sistFase) {
      kort.classList.toggle('borte', fs !== 0);
      svg.classList.toggle('ikke-startet', fs === 0);
      svg.classList.toggle('ferdig', fs === 5);
      const aktivNote = fs === 5 ? 4 : fs;
      noter.forEach((el, k) => el.classList.toggle('aktiv', k === aktivNote));
      sistFase = fs;
    }
    return { bx, by };
  }

  function startSammentrekk() {
    const d = D, sl = d.sloyfeP, n = sl.length / 2;
    if (n < 2) return;
    const kx = sl[2 * (n - 1)], ky = sl[2 * (n - 1) + 1];
    let k = 0, best = Infinity;
    for (let j = 0; j < d.forL.length / 2; j++) { const dd = Math.hypot(d.forL[2 * j] - sl[0], d.forL[2 * j + 1] - sl[1]); if (dd < best) { best = dd; k = j; } }
    const nFor = d.n[d.lukk - 1];
    if (sammentrekk) sammentrekk.stopp();
    const stopp = klokke.kjor(t => {
      const e = easeUt(del(t, 0, 300));
      if (e >= 1 || !bevegelse) { sammentrekk = null; sistLenkeN = -1; sistIdx = -1; if (aktiv) planlegg(); return false; }
      const dd = lenkeD(d.forL, d.forTekst, nFor, { k, kx, ky, t: e });
      lenkeKant.setAttribute('d', dd); lenkeKjerne.setAttribute('d', dd);
    });
    sammentrekk = { stopp };
  }

  const fremdrift = () => { const r = omr.getBoundingClientRect(); return klem(0, -r.top / Math.max(1, r.height - innerHeight), 1); };
  function bilde() {
    rafId = 0;
    if (!aktiv || !bevegelse) return;
    const p = fremdrift();
    const { bx, by } = tegn(p);
    const beveger = kameraSteg(p, bx, by, sistP < 0);
    sistP = p;
    if (beveger) planlegg();
  }
  const planlegg = () => { if (!rafId) rafId = requestAnimationFrame(bilde); };
  const vedRull = () => { if (aktiv) planlegg(); };

  function start() {
    if (aktiv || !forbered()) return;
    lagEtiketter(); lagHoldMerker();
    sistIdx = -1; sistFase = -1; sistLenkeN = -1; sistLenkeKilde = null; sloyfeVist = null; sistP = -1; sistHold = -1;
    for (const k in verdier) delete verdier[k];
    addEventListener('scroll', vedRull, { passive: true });
    addEventListener('resize', vedRull, { passive: true });
    svg.classList.add('uten-overgang'); kort.classList.add('uten-overgang');
    aktiv = true; bilde();
    requestAnimationFrame(() => requestAnimationFrame(() => { svg.classList.remove('uten-overgang'); kort.classList.remove('uten-overgang'); }));
  }
  function stopp() { aktiv = false; removeEventListener('scroll', vedRull); removeEventListener('resize', vedRull); }

  function tilSlutt() {
    stopp();
    if (sammentrekk) { sammentrekk.stopp(); sammentrekk = null; }
    lenkeKant.setAttribute('d', original.lenke); lenkeKjerne.setAttribute('d', original.lenke);
    spor.setAttribute('d', original.spor); hale.setAttribute('d', 'M0 0');
    baat.setAttribute('transform', original.baat);
    svg.setAttribute('viewBox', original.vb); svg.classList.remove('kamera', 'ferdig', 'ikke-startet'); kamera = null;
    sloyfe.classList.remove('borte'); kort.classList.remove('borte');
    if (tauEnde) { tauEnde.classList.add('borte'); sporTopp.setAttribute('d', 'M0 0'); }
    if (markering) markering(); markering = null; fjern(felt.lenke, 'opacity'); fjern(felt.favner, 'opacity');
    for (const k in felt) felt[k].textContent = original.felt[k];
    noter.forEach(el => el.classList.remove('aktiv'));
    etLag.textContent = ''; etikettEl = null; etikettModus = '';
    skala(svg);
  }
  nullstill(tilSlutt);

  let synlig = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(poster => { for (const p of poster) { synlig = p.isIntersecting; if (synlig && bevegelse) start(); else stopp(); } }, { rootMargin: '200px 0px' }).observe(omr);
  }
  else if (bevegelse) { synlig = true; start(); }
  if (mqSidestilt.addEventListener) mqSidestilt.addEventListener('change', () => {
    if (!bevegelse || !D || !aktiv) return;
    lagEtiketter(); sistIdx = -1; sistFase = -1; kamera = null;
    svg.setAttribute('viewBox', original.vb); svg.classList.remove('kamera'); skala(svg); planlegg();
  });
  return { slaaPaa() { if (synlig) start(); } };
})();

(() => {
  const seksjon = $('#bekreft'); if (!seksjon) return;
  const fig = $('.bekreft-figur', seksjon), boks = $('.kartboks', fig), svg = $('svg', boks);
  const prikker = $('.prikker', svg), lenke = $$('.versjon-rettet .egen', svg), sloyfe = $('.versjon-rettet .sloyfe-fjernet', svg);
  const handtak = $$('.versjon-rettet .handtak-inn', svg), puls = $('.versjon-rettet .handtak-puls', svg);
  const T = hentTall() || {};
  const L = { rettet: T.lengde || 1240, ugjort: T.ugjortLengde || 1846 };
  const MIN = T.teinerMin || 2, MAKS = T.teinerMaks || 400;
  let n = T.teiner || 57, ugjort = false;
  const ut = $('.teller-tall', seksjon), knapper = $$('.teller-knapp', seksjon);
  const kontroll = $('[data-verdi="kontroll"]', seksjon), lengde = $('[data-verdi="lengde"]', seksjon);
  const sloyfeTekst = $('[data-verdi="sloyfe"]', seksjon), merknad = $('[data-verdi="merknad"]', seksjon), angre = $('.angre', seksjon);
  const mellom = Ln => { const m = Ln / Math.max(1, n - 1); return { m: Math.round(m), fv: Math.round(m / 1.8288) }; };
  const lengdeTekst = Ln => `${tall(Ln)}${NBSP}m · ${tall(Math.round(Ln / 1.8288))}${NBSP}fv`;
  function oppdater() {
    const k = mellom(ugjort ? L.ugjort : L.rettet);
    ut.textContent = String(n);
    kontroll.textContent = `ca. ${tall(k.m)}${NBSP}m · ${tall(k.fv)}${NBSP}fv mellom teinene`;
    lengde.textContent = lengdeTekst(ugjort ? L.ugjort : L.rettet);
    sloyfeTekst.textContent = ugjort ? 'ikke rettet' : '1 rettet';
    angre.textContent = ugjort ? 'rett igjen' : 'angre';
    angre.setAttribute('aria-pressed', String(ugjort));
    if (n !== (T.teiner || 57)) sett(merknad, 'display', 'none'); else fjern(merknad, 'display');
    knapper[0].disabled = n <= MIN; knapper[1].disabled = n >= MAKS;
  }
  knapper.forEach(b => b.addEventListener('click', () => { n = klem(MIN, n + Number(b.dataset.steg), MAKS); oppdater(); }));
  angre.addEventListener('click', () => { ugjort = !ugjort; seksjon.classList.toggle('ugjort', ugjort); oppdater(); });
  oppdater();

  let lerret = null, tegnPrikker = null, malLerret = null;
  const slutt = () => { [prikker, sloyfe, puls, ...lenke, ...handtak].forEach(el => fjern(el, 'opacity', 'transform')); if (lerret) { lerret.remove(); lerret = null; } };
  nullstill(slutt);
  engang(fig, 0.5, {
    start() {
      const sc = hentScene(); if (!sc) return;
      const [sx, sy] = sc.s;
      const pkt = str => str.split(' ').map(par => { const [a, b] = par.split(','); return [sx + (+a) / 10, sy + (+b) / 10]; });
      const fikser = pkt(sc.fikser), dp = pkt(sc.dp);
      const proj = q => { let best = null, bd = Infinity; for (let i = 1; i < dp.length; i++) { const a = dp[i - 1], b = dp[i]; const vx = b[0] - a[0], vy = b[1] - a[1]; const t = klem(0, ((q[0] - a[0]) * vx + (q[1] - a[1]) * vy) / (vx * vx + vy * vy), 1); const p = [a[0] + t * vx, a[1] + t * vy]; const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < bd) { bd = dd; best = p; } } return best; };
      const mal = fikser.map(proj);
      const avst = mal.map(m => Math.min(...dp.map(p => Math.hypot(m[0] - p[0], m[1] - p[1]))));
      const maks = Math.max(...avst) || 1;
      const forsinkelse = avst.map(a => 300 * a / maks);
      const vb = svg.viewBox.baseVal;
      lerret = document.createElement('canvas'); lerret.className = 'kart'; lerret.setAttribute('aria-hidden', 'true');
      boks.appendChild(lerret);
      const ctx = lerret.getContext('2d');
      let W = 0, H = 0, dpr = 1;
      malLerret = () => { const r = boks.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; lerret.width = Math.round(W * dpr); lerret.height = Math.round(H * dpr); };
      const tilPx = (x, y) => { const s = Math.min(W / vb.width, H / vb.height), ox = (W - vb.width * s) / 2, oy = (H - vb.height * s) / 2; return [ox + (x - vb.x) * s, oy + (y - vb.y) * s]; };
      tegnPrikker = t => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#F4F7FA';
        for (let i = 0; i < fikser.length; i++) {
          const e = easeInnUt(del(t, forsinkelse[i], 900)), a = (1 - e) * 0.85;
          if (a <= 0.01) continue;
          const [x, y] = tilPx(lerp(fikser[i][0], mal[i][0], e), lerp(fikser[i][1], mal[i][1], e));
          ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      malLerret(); tegnPrikker(0);
      [prikker, sloyfe, ...lenke].forEach(el => sett(el, 'opacity', '0'));
      handtak.forEach(el => sett(el, 'transform', 'scale(0)'));
    },
    spill() {
      if (!tegnPrikker) return;
      malLerret();
      klokke.kjor(t => {
        if (!bevegelse) { slutt(); return false; }
        if (t < 1320) tegnPrikker(t); else if (lerret) { lerret.remove(); lerret = null; }
        lenke.forEach(el => sett(el, 'opacity', String(easeUt(del(t, 350, 650)))));
        sett(sloyfe, 'opacity', String(easeUt(del(t, 900, 300))));
        handtak.forEach((el, k) => sett(el, 'transform', `scale(${easeFjaer(del(t, 900 + 80 * k, 240)).toFixed(3)})`));
        sett(prikker, 'opacity', String(easeUt(del(t, 1100, 500))));
        if (puls) {
          const tp = t < 2000 ? del(t, 1300, 700) : del(t, 2000, 700);
          sett(puls, 'opacity', t >= 1300 && t < 2700 ? String(0.9 * (1 - easeUt(tp))) : '0');
          sett(puls, 'transform', `scale(${(1 + 0.8 * easeUt(tp)).toFixed(3)})`);
        }
        if (t >= 2700) { slutt(); return false; }
      });
    },
  });
})();

(() => {
  const seksjon = $('#meld'); if (!seksjon) return;
  const logg = $('.statuslogg', seksjon), rader = $$('.status-rad', seksjon), andre = $('.hos-andre', seksjon);
  const strek = $('.andres-strek', andre), prikk = $$('.andres-lenke .r-ring, .andres-lenke .r-prikk', andre), ingenting = $('.ingenting-enna', andre);
  const knapp = $('.spill-igjen', seksjon), blaa = $('.kapsel-blaa', seksjon);
  let stopp = null;
  const slutt = () => {
    if (stopp) { stopp(); stopp = null; }
    rader.forEach(r => { r.classList.remove('skjult-rad'); fjern(r, '--v', '--o'); }); fjern(blaa, 'transform');
    fjern(strek, 'stroke-dashoffset'); prikk.forEach(el => fjern(el, 'opacity')); ingenting.classList.add('borte');
  };
  nullstill(() => { slutt(); ingenting.classList.remove('borte'); });
  const startTilstand = () => { rader.forEach(r => r.classList.add('skjult-rad')); sett(strek, 'stroke-dashoffset', '1.001'); prikk.forEach(el => sett(el, 'opacity', '0')); ingenting.classList.remove('borte'); };
  function spill() {
    if (stopp) stopp();
    startTilstand();
    let steg = 0;
    stopp = klokke.kjor(t => {
      if (!bevegelse) { slutt(); return false; }
      sett(blaa, 'transform', t < 240 ? `scale(${(1 - 0.03 * Math.sin(Math.PI * easeUt(del(t, 0, 240)))).toFixed(4)})` : 'none');
      if (steg === 0 && t >= 120) { rader[0].classList.remove('skjult-rad'); steg = 1; }
      if (steg === 1 && t >= 1400) { rader[1].classList.remove('skjult-rad'); steg = 2; }
      if (steg === 2 && t >= 2800) { rader[2].classList.remove('skjult-rad'); ingenting.classList.add('borte'); steg = 3; }
      sett(rader[0], '--v', del(t, 240, 1160).toFixed(3)); sett(rader[0], '--o', t < 1400 ? '1' : '0');
      sett(rader[1], '--v', del(t, 1640, 1160).toFixed(3)); sett(rader[1], '--o', t >= 1640 && t < 2800 ? '1' : '0');
      if (t >= 2800) { sett(strek, 'stroke-dashoffset', String(1 - easeUt(del(t, 2800, 600)))); prikk.forEach(el => sett(el, 'opacity', String(del(t, 2800, 120)))); }
      if (t >= 3400) { stopp = null; fjern(strek, 'stroke-dashoffset'); prikk.forEach(el => fjern(el, 'opacity')); return false; }
    });
  }
  knapp.addEventListener('click', () => { if (bevegelse) spill(); });
  if (!bevegelse) return;
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(p => { io.disconnect(); if (p[0].isIntersecting) ingenting.classList.add('borte'); }); io.observe(logg); }
  engang(logg, 0.5, { start: startTilstand, spill });
})();

(() => {
  const seksjon = $('#mens-den-star'); if (!seksjon) return;
  const T = hentTall(); if (!T || !T.mens) return;
  const M = T.mens;
  const glider = $('#dager', seksjon), utVerdi = $('.dagvelger-verdi', seksjon);
  const felt = {}; $$('[data-felt]', seksjon).forEach(el => { felt[el.dataset.felt] = el; });
  const frister = { rokting: $('[data-frist="rokting"]', seksjon), meldefrist: $('[data-frist="meldefrist"]', seksjon) };
  const fyll = { rokting: $('[data-frist="rokting"] .skala-fyll', seksjon), meldefrist: $('[data-frist="meldefrist"] .skala-fyll', seksjon) };
  const varsel = { rokting: $('.varsel-rokting', seksjon), meldefrist: $('.varsel-meldefrist', seksjon) };
  const figur = $('.mens-figur', seksjon);
  const redskap = $$('.redskap[data-timer]', figur);
  const roktetKnapp = $('.roktet', seksjon), svar = $('.roktet-svar', seksjon);
  const DAG = 1440, SATT = 0, NAA0 = M.naaMin;
  let roktetDag = null;
  function statid(min) {
    const minutter = Math.floor(Math.max(0, min)), timer = Math.floor(minutter / 60), dager = Math.floor(timer / 24);
    if (dager >= 30) return `${Math.floor(dager / 30)}${NBSP}mnd ${dager % 30}${NBSP}d`;
    if (dager >= 1) return `${dager}${NBSP}d ${timer % 24}${NBSP}t`;
    if (timer >= 1) return `${timer}${NBSP}t ${minutter % 60}${NBSP}min`;
    return `${minutter}${NBSP}min`;
  }
  const frist = (f, naa) => f > naa ? statid(f - naa) : 'utløpt';
  function vis(d) {
    if (roktetDag !== null && d < roktetDag) { roktetDag = null; svar.textContent = ''; }
    const naa = NAA0 + d * DAG;
    const grunn = roktetDag === null ? SATT : NAA0 + roktetDag * DAG;
    const roktefrist = grunn + 7 * DAG, meldefrist = grunn + 14 * DAG;
    felt.iSjoen.textContent = statid(naa - SATT);
    felt.tilRokting.textContent = frist(roktefrist, naa);
    felt.tilMeldefrist.textContent = frist(meldefrist, naa);
    const rIgjen = roktefrist - naa, mIgjen = meldefrist - naa;
    frister.rokting.classList.toggle('haster', rIgjen < DAG);
    frister.meldefrist.classList.toggle('haster', mIgjen < 2 * DAG);
    sett(fyll.rokting, 'transform', `scaleX(${klem(0, rIgjen / (7 * DAG), 1).toFixed(4)})`);
    sett(fyll.meldefrist, 'transform', `scaleX(${klem(0, mIgjen / (14 * DAG), 1).toFixed(4)})`);
    varsel.rokting.classList.toggle('vis', roktetDag === null && d >= M.varsler[0].fraDag);
    varsel.meldefrist.classList.toggle('vis', roktetDag === null && d >= M.varsler[1].fraDag);
    for (const el of redskap) el.classList.toggle('gammel', Number(el.dataset.timer) + d * 24 > M.svakEtterTimer);
    if (felt.gammelt) felt.gammelt.textContent = `garn · ikke meldt tatt opp på ${M.gammeltGarnDager + d}${NBSP}d`;
    figur.classList.toggle('ikke-synlig', naa >= meldefrist);
    utVerdi.textContent = `${d}${NBSP}d`;
    glider.setAttribute('aria-valuetext', d === 1 ? '1 dag' : `${d} dager`);
  }
  let hint = null;
  glider.disabled = false;
  const avbrytHint = () => { if (hint) { hint(); hint = null; } };
  glider.addEventListener('input', () => { avbrytHint(); vis(Number(glider.value)); });
  ['pointerdown', 'keydown', 'touchstart'].forEach(h => glider.addEventListener(h, avbrytHint, { passive: true }));
  roktetKnapp.addEventListener('click', () => {
    avbrytHint();
    roktetDag = Number(glider.value);
    vis(roktetDag);
    svar.textContent = 'Røktet og godkjent. Begge klokkene starter på nytt.';
  });
  vis(0);
  nullstill(avbrytHint);
  engang(figur, 0.6, {
    start() {},
    spill() {
      if (Number(glider.value) !== 0) return;
      let forrige = 0;
      hint = klokke.kjor(t => {
        if (!bevegelse) { hint = null; return false; }
        const d = Math.round(6 * easeInnUt(del(t, 0, 1600)));
        if (d !== forrige) { forrige = d; glider.value = String(d); vis(d); }
        if (t >= 1600) { hint = null; return false; }
      });
    },
  });
})();

(() => {
  for (const rad of $$('.melding')) {
    const tegn = $$('.strek-kant, .strek-kjerne', rad), start = $('.strek-start', rad), etikett = $('.strek-etikett', rad), gruppe = $('.strek-tegn', rad), spokelse = $('.strek-spokelse', rad);
    const dager = $('[data-felt="roktet"]', rad);
    const slutt = () => { [...tegn, start, etikett, gruppe, spokelse].forEach(el => fjern(el, 'stroke-dashoffset', 'opacity', 'transform', 'display', 'stroke-dasharray')); if (dager) dager.textContent = `0${NBSP}d`; };
    nullstill(slutt);
    let forbered = () => {}, spill = () => true;
    if (rad.classList.contains('m-satt')) {
      forbered = () => { tegn.forEach(el => sett(el, 'stroke-dashoffset', '1.001')); sett(start, 'opacity', '0'); sett(etikett, 'opacity', '0'); };
      spill = t => { tegn.forEach(el => sett(el, 'stroke-dashoffset', String(1 - easeUt(del(t, 0, 600))))); sett(start, 'opacity', String(del(t, 0, 100))); sett(etikett, 'opacity', String(del(t, 500, 200))); return t >= 700; };
    } else if (rad.classList.contains('m-roktet')) {
      forbered = () => { dager.textContent = `6${NBSP}d`; };
      spill = t => { sett(start, 'transform', `scale(${(1 + 0.4 * Math.sin(Math.PI * easeInnUt(del(t, 0, 400)))).toFixed(3)})`); if (t >= 400) dager.textContent = `0${NBSP}d`; return t >= 400; };
    } else if (rad.classList.contains('m-opp')) {
      forbered = () => { sett(gruppe, 'opacity', '1'); sett(spokelse, 'display', 'none'); sett(etikett, 'opacity', '0'); };
      spill = t => {
        const u = easeInnUt(del(t, 0, 700));
        tegn.forEach(el => sett(el, 'stroke-dashoffset', String(u)));
        sett(start, 'opacity', String(1 - del(t, 600, 150)));
        sett(etikett, 'opacity', String(del(t, 500, 200)));
        if (t >= 700) { fjern(spokelse, 'display'); sett(spokelse, 'opacity', String(del(t, 700, 300))); }
        return t >= 1000;
      };
    } else if (rad.classList.contains('m-tapt')) {
      forbered = () => { tegn.forEach(el => sett(el, 'stroke-dasharray', '1 2')); sett(etikett, 'opacity', '0'); };
      spill = t => { tegn.forEach(el => fjern(el, 'stroke-dasharray')); sett(etikett, 'opacity', String(easeUt(del(t, 0, 200)))); return t >= 200; };
    }
    engang(rad, 0.6, { start: forbered, spill: () => klokke.kjor(t => { if (!bevegelse || spill(t)) { slutt(); return false; } }) });
  }
})();

(() => {
  const rader = $$('.ikke-rad');
  if (!('IntersectionObserver' in window)) { rader.forEach(r => r.classList.add('vist')); return; }
  for (const rad of rader) { const io = new IntersectionObserver(p => { if (p[0].intersectionRatio >= 0.49) { io.disconnect(); rad.classList.add('vist'); } }, { threshold: [0.5] }); io.observe(rad); }
  nullstill(() => rader.forEach(r => r.classList.add('vist')));
})();

(() => {
  const tallEl = $('[data-felt="andre"]'), linje = $('.maaling-levende'), tillegg = $('.maaling-tillegg');
  if (!tallEl || !('performance' in window) || !performance.getEntriesByType) return;
  const egen = location.origin;
  const opphav = e => { try { return new URL(e.name).origin; } catch (err) { return ''; } };
  const maal = () => {
    const alle = performance.getEntriesByType('resource').filter(e => /^https?:/.test(e.name));
    const andre = alle.filter(e => opphav(e) !== egen).length;
    const egne = [performance.getEntriesByType('navigation')[0], ...alle.filter(e => opphav(e) === egen)];
    const storrelse = e => (e && (e.encodedBodySize || e.transferSize)) || 0;
    const byte = egne.some(e => !storrelse(e)) ? 0 : egne.reduce((s, e) => s + storrelse(e), 0);
    tallEl.textContent = String(andre);
    linje.textContent = byte > 0 ? `denne siden · ${tall(Math.round(byte / 1000))}${NBSP}kB · målt i nettleseren din nå` : 'denne siden · målt i nettleseren din nå';
    tillegg.textContent = andre > 0 ? '– trolig fra et tillegg i nettleseren din. Siden selv henter ingenting fra andre.' : '';
  };
  addEventListener('load', maal);
  if ('PerformanceObserver' in window) { try { new PerformanceObserver(maal).observe({ type: 'resource', buffered: true }); } catch (err) {} }
  if (document.readyState === 'complete') maal();
})();

if (mqBevegelse.addEventListener) mqBevegelse.addEventListener('change', e => {
  bevegelse = e.matches;
  html.classList.toggle('bevegelse', bevegelse);
  if (!bevegelse) { klokke.stoppAlle(); tilbakestillere.forEach(f => { try { f(); } catch (err) {} }); }
  else if (setting) setting.slaaPaa();
  kartene.forEach(s => skala(s));
});
})();
