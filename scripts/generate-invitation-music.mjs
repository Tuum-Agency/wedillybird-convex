#!/usr/bin/env node
/**
 * Génère les pistes ORIGINALES de la bibliothèque musicale des invitations
 * (`public/audio/invitation/*.m4a`) par synthèse offline — zéro dépendance,
 * zéro sample tiers : compositions maison, usage commercial libre.
 *
 * Moteur : additive/FM légère (pluck piano-harpe, pads détunés, cloches),
 * réverbération Schroeder stéréo, low-pass global, normalisation, fondus
 * d'entrée/sortie pour boucler avec une respiration.
 *
 * Usage : node scripts/generate-invitation-music.cjs [--only aurore]
 * Sortie : WAV intermédiaire dans /tmp puis AAC via ffmpeg (requis).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SR = 44100;
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'invitation');

/* ------------------------------- utils -------------------------------- */

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freqOf(note) {
  if (typeof note === 'number') return note;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`note invalide: ${note}`);
  let semi = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = semi + 12 * (Number(m[3]) + 1);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class Track {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float64Array(this.n);
    this.R = new Float64Array(this.n);
  }
  /** Ajoute un échantillon (t en secondes) avec panoramique -1..1. */
  addAt(i, v, pan) {
    if (i < 0 || i >= this.n) return;
    const p = (pan + 1) / 2; // 0..1
    this.L[i] += v * Math.cos((p * Math.PI) / 2);
    this.R[i] += v * Math.sin((p * Math.PI) / 2);
  }
}

/* ------------------------------- voix --------------------------------- */

/** Pluck piano/harpe : partiels légèrement inharmoniques, décroissance expo. */
function pluck(tr, t0, note, dur, { vel = 0.5, pan = 0, tone = 1 } = {}) {
  const f = freqOf(note);
  const partials = [
    [1, 1],
    [2, 0.42 * tone],
    [3, 0.16 * tone],
    [4.01, 0.06 * tone],
  ];
  const n0 = Math.floor(t0 * SR);
  const N = Math.floor(dur * SR);
  const tau = dur * 0.36;
  for (const [k, a] of partials) {
    const w = (2 * Math.PI * f * k * (1 + 0.0004 * k * k)) / SR;
    let phase = Math.random() * 0.3;
    const pTau = tau / (1 + 0.7 * (k - 1)); // les harmoniques meurent plus vite
    for (let i = 0; i < N; i++) {
      phase += w;
      const t = i / SR;
      const env = Math.exp(-t / pTau) * Math.min(1, t / 0.004);
      tr.addAt(n0 + i, Math.sin(phase) * a * env * vel * 0.32, pan);
    }
  }
}

/** Cloche/celesta : partiels non harmoniques brillants. */
function bell(tr, t0, note, dur, { vel = 0.3, pan = 0 } = {}) {
  const f = freqOf(note);
  const partials = [
    [1, 1],
    [2.76, 0.34],
    [5.4, 0.1],
  ];
  const n0 = Math.floor(t0 * SR);
  const N = Math.floor(dur * SR);
  for (const [k, a] of partials) {
    const w = (2 * Math.PI * f * k) / SR;
    let phase = 0;
    for (let i = 0; i < N; i++) {
      phase += w;
      const t = i / SR;
      const env = Math.exp(-t / (dur * 0.3)) * Math.min(1, t / 0.002);
      tr.addAt(n0 + i, Math.sin(phase) * a * env * vel * 0.22, pan);
    }
  }
}

/** Pad « cordes » : sinus détunés + octave basse, attaque lente. */
function pad(tr, t0, notes, dur, { vel = 0.28, pan = 0, attack = 1.6, release = 2.2 } = {}) {
  const n0 = Math.floor(t0 * SR);
  const N = Math.floor(dur * SR);
  const voices = [];
  for (const note of notes) {
    const f = freqOf(note);
    for (const det of [-0.0016, 0, 0.0016]) {
      voices.push({ w: (2 * Math.PI * f * (1 + det)) / SR, phase: Math.random() * 6.28, a: 1 });
    }
    voices.push({ w: (2 * Math.PI * (f / 2)) / SR, phase: Math.random() * 6.28, a: 0.5 });
  }
  const amp = (vel * 0.09) / Math.sqrt(voices.length);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const tLeft = dur - t;
    const env =
      Math.min(1, t / attack) *
      Math.min(1, Math.max(0, tLeft / release)) *
      (0.92 + 0.08 * Math.sin(2 * Math.PI * 0.13 * (t0 + t))); // respiration lente
    let s = 0;
    for (const vo of voices) {
      vo.phase += vo.w;
      s += Math.sin(vo.phase) * vo.a;
    }
    tr.addAt(n0 + i, s * amp * env, pan);
  }
}

/** Basse douce (sinus + un peu de 2e harmonique). */
function bass(tr, t0, note, dur, { vel = 0.4, pan = 0 } = {}) {
  const f = freqOf(note);
  const n0 = Math.floor(t0 * SR);
  const N = Math.floor(dur * SR);
  const w1 = (2 * Math.PI * f) / SR;
  const w2 = w1 * 2;
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < N; i++) {
    p1 += w1;
    p2 += w2;
    const t = i / SR;
    const env = Math.min(1, t / 0.12) * Math.exp(-t / (dur * 0.85));
    tr.addAt(n0 + i, (Math.sin(p1) + 0.25 * Math.sin(p2)) * env * vel * 0.3, pan);
  }
}

/** Souffle filtré (vent/whoosh très doux) pour « Envol ». */
function breath(tr, t0, dur, { vel = 0.05, pan = 0 } = {}) {
  const n0 = Math.floor(t0 * SR);
  const N = Math.floor(dur * SR);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const x = t / dur; // 0..1
    const env = Math.sin(Math.PI * x) ** 2;
    const cutoff = 0.01 + 0.05 * env; // sweep du filtre
    lp += cutoff * ((Math.random() * 2 - 1) * 0.8 - lp);
    tr.addAt(n0 + i, lp * vel * env, pan + 0.3 * Math.sin(2 * Math.PI * x));
  }
}

/* ----------------------------- effets bus ------------------------------ */

/** Réverbération Schroeder (4 combs + 2 allpass) par canal. */
function reverbChannel(input, combsMs, feedback, damp) {
  const n = input.length;
  const out = new Float64Array(n);
  const combs = combsMs.map((ms) => ({
    buf: new Float64Array(Math.floor((ms / 1000) * SR)),
    idx: 0,
    store: 0,
  }));
  for (let i = 0; i < n; i++) {
    const x = input[i];
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.idx] = x + c.store * feedback;
      c.idx = (c.idx + 1) % c.buf.length;
      s += y;
    }
    out[i] = s / combs.length;
  }
  // 2 allpass en série
  for (const ms of [5.0, 1.7]) {
    const len = Math.floor((ms / 1000) * SR);
    const buf = new Float64Array(len);
    let idx = 0;
    const g = 0.7;
    for (let i = 0; i < n; i++) {
      const bufout = buf[idx];
      const inp = out[i];
      out[i] = -inp + bufout;
      buf[idx] = inp + bufout * g;
      idx = (idx + 1) % len;
    }
  }
  return out;
}

function finalize(tr, { wet = 0.32, lowpass = 0.24, fadeIn = 1.5, fadeOut = 2.8, peak = 0.84 }) {
  const revL = reverbChannel(tr.L, [29.7, 37.1, 41.1, 43.7], 0.8, 0.35);
  const revR = reverbChannel(tr.R, [30.9, 36.1, 42.3, 44.9], 0.8, 0.35);
  let lpL = 0;
  let lpR = 0;
  let max = 0;
  for (let i = 0; i < tr.n; i++) {
    let l = tr.L[i] * (1 - wet) + revL[i] * wet;
    let r = tr.R[i] * (1 - wet) + revR[i] * wet;
    // low-pass one-pole : arrondit tout l'aigu numérique
    lpL += lowpass * (l - lpL);
    lpR += lowpass * (r - lpR);
    l = lpL;
    r = lpR;
    const t = i / SR;
    const tEnd = tr.n / SR - t;
    const fade = Math.min(1, t / fadeIn) * Math.min(1, Math.max(0, tEnd / fadeOut));
    tr.L[i] = l * fade;
    tr.R[i] = r * fade;
    max = Math.max(max, Math.abs(tr.L[i]), Math.abs(tr.R[i]));
  }
  const g = max > 0 ? peak / max : 1;
  for (let i = 0; i < tr.n; i++) {
    tr.L[i] *= g;
    tr.R[i] *= g;
  }
}

function writeWav(tr, file) {
  const n = tr.n;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(tr.L[i] * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(tr.R[i] * 32767))), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

/* --------------------------- compositions ------------------------------ */

/** « Aurore » — piano intime + pad chaud. C majeur, 72 BPM, 76 s. */
function composeAurore() {
  const bpm = 72;
  const beat = 60 / bpm;
  const bars = 22;
  const tr = new Track(bars * 4 * beat + 6);
  const prog = [
    ['C3', ['C4', 'E4', 'G4']],
    ['A2', ['A3', 'C4', 'E4', 'G4']],
    ['F2', ['F3', 'A3', 'C4']],
    ['G2', ['G3', 'B3', 'D4']],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const [root, chord] = prog[bar % 4];
    if (bar % 2 === 0) pad(tr, t0, chord, 8 * beat + 1.2, { vel: 0.3, attack: 1.8 });
    bass(tr, t0, root, 4 * beat, { vel: 0.34, pan: -0.1 });
    // mélodie pentatonique sobre, une phrase par 2 mesures
    const phrases = [
      ['E4', 'G4', 'A4', 'G4'],
      ['C5', 'A4', 'G4', 'E4'],
      ['D4', 'E4', 'G4', 'A4'],
      ['G4', 'E4', 'D4', 'C4'],
    ];
    if (bar % 2 === 1) {
      const ph = phrases[(bar >> 1) % 4];
      ph.forEach((n, i) => {
        pluck(tr, t0 + i * beat + (i === 3 ? 0.5 * beat : 0), n, 2.6, {
          vel: 0.4 - i * 0.03,
          pan: 0.25 - i * 0.12,
        });
      });
    } else if (bar > 0) {
      pluck(tr, t0 + 2 * beat, chord[2] ?? 'G4', 2.4, { vel: 0.24, pan: 0.3 });
    }
  }
  finalize(tr, { wet: 0.34, lowpass: 0.22 });
  return tr;
}

/** « Jardin » — harpe qui ruisselle + éclats de cloche. D majeur, 66 BPM, 76 s. */
function composeJardin() {
  const bpm = 66;
  const beat = 60 / bpm;
  const bars = 20;
  const tr = new Track(bars * 4 * beat + 6);
  const prog = [
    ['D3', ['D3', 'A3', 'D4', 'F#4', 'A4']],
    ['B2', ['B2', 'F#3', 'B3', 'D4', 'F#4']],
    ['G2', ['G2', 'D3', 'G3', 'B3', 'D4']],
    ['A2', ['A2', 'E3', 'A3', 'C#4', 'E4']],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const [, arp] = prog[bar % 4];
    if (bar % 2 === 0) pad(tr, t0, [arp[2], arp[3]], 8 * beat + 1, { vel: 0.16, attack: 2.2 });
    // arpège montée-descente en doubles croches souples
    const seq = [...arp, arp[3], arp[2], arp[1]];
    seq.forEach((n, i) => {
      pluck(tr, t0 + i * beat * 0.5, n, 2.0, {
        vel: 0.3 + (i === 4 ? 0.08 : 0),
        pan: -0.4 + i * 0.11,
        tone: 0.7,
      });
    });
    if (bar % 4 === 3) bell(tr, t0 + 3 * beat, 'A5', 2.4, { vel: 0.16, pan: 0.4 });
  }
  finalize(tr, { wet: 0.38, lowpass: 0.26 });
  return tr;
}

/** « Célébration » — marimba bondissante + cloches. F majeur, 100 BPM, 70 s. */
function composeCelebration() {
  const bpm = 100;
  const beat = 60 / bpm;
  const bars = 28;
  const tr = new Track(bars * 4 * beat + 5);
  const prog = [
    ['F2', ['F3', 'A3', 'C4'], ['F4', 'A4']],
    ['D2', ['D3', 'F3', 'A3'], ['D4', 'A4']],
    ['Bb2', ['Bb2', 'D3', 'F3'], ['Bb3', 'F4']],
    ['C3', ['C3', 'E3', 'G3'], ['C4', 'G4']],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const [root, chord, tops] = prog[bar % 4];
    bass(tr, t0, root, 2 * beat, { vel: 0.3 });
    bass(tr, t0 + 2 * beat, root, 2 * beat, { vel: 0.22 });
    // motif bondissant : croches root-5th-10th
    const pattern = [chord[0], chord[2], tops[0], chord[2], tops[1], tops[0], chord[2], chord[1]];
    pattern.forEach((n, i) => {
      pluck(tr, t0 + i * beat * 0.5, n, 0.9, {
        vel: i % 2 === 0 ? 0.34 : 0.22,
        pan: i % 2 === 0 ? -0.2 : 0.25,
        tone: 1.15,
      });
    });
    if (bar % 2 === 1) bell(tr, t0 + 3.5 * beat, tops[1], 1.6, { vel: 0.14, pan: 0.45 });
    if (bar % 8 === 7) bell(tr, t0 + 2 * beat, 'F5', 2, { vel: 0.18, pan: -0.35 });
  }
  finalize(tr, { wet: 0.26, lowpass: 0.3, fadeOut: 2.2 });
  return tr;
}

/** « Envol » — arpèges aériens + souffle. G majeur, 84 BPM, 74 s. */
function composeEnvol() {
  const bpm = 84;
  const beat = 60 / bpm;
  const bars = 26;
  const tr = new Track(bars * 4 * beat + 6);
  const prog = [
    ['G2', ['G3', 'B3', 'D4', 'G4']],
    ['F#2', ['F#3', 'A3', 'D4', 'F#4']],
    ['E2', ['E3', 'G3', 'B3', 'E4']],
    ['C3', ['C3', 'E3', 'G3', 'C4']],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const [root, arp] = prog[bar % 4];
    if (bar % 2 === 0)
      pad(tr, t0, [arp[1], arp[2], arp[3]], 8 * beat + 1.4, { vel: 0.26, attack: 2 });
    bass(tr, t0, root, 4 * beat, { vel: 0.3 });
    for (let i = 0; i < 8; i++) {
      pluck(tr, t0 + i * beat * 0.5, arp[i % 4], 1.6, {
        vel: 0.24 + 0.05 * Math.sin(i),
        pan: -0.35 + (i % 4) * 0.22,
        tone: 0.8,
      });
    }
    // ligne mélodique ascendante une mesure sur quatre
    if (bar % 4 === 2) {
      ['D4', 'G4', 'A4', 'B4'].forEach((n, i) =>
        pluck(tr, t0 + i * beat, n, 2.2, { vel: 0.34, pan: 0.15 }),
      );
    }
    if (bar % 8 === 4) breath(tr, t0, 6 * beat, { vel: 0.5 });
  }
  finalize(tr, { wet: 0.34, lowpass: 0.24 });
  return tr;
}

/** « Harmonie » — cordes amples + violoncelle + piano rare. Am/C, 60 BPM, 78 s. */
function composeHarmonie() {
  const bpm = 60;
  const beat = 60 / bpm;
  const bars = 19;
  const tr = new Track(bars * 4 * beat + 7);
  const prog = [
    ['A1', ['A3', 'C4', 'E4']],
    ['F1', ['F3', 'A3', 'C4']],
    ['C2', ['C4', 'E4', 'G4']],
    ['G1', ['G3', 'B3', 'D4']],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const [root, chord] = prog[bar % 4];
    pad(tr, t0, chord, 4 * beat + 2.4, { vel: 0.34, attack: 2.4, release: 2.6 });
    pad(tr, t0, [freqOf(root) * 2], 4 * beat + 2, { vel: 0.22, attack: 1.6, pan: -0.2 });
    bass(tr, t0, freqOf(root) * 2, 4 * beat, { vel: 0.3, pan: 0 });
    // mélodie lente, expressive, une note par 2 temps
    const melody = [
      ['A4', 'C5'],
      ['A4', 'G4'],
      ['E4', 'G4'],
      ['D4', 'B3'],
    ];
    if (bar >= 2) {
      const ph = melody[bar % 4];
      pluck(tr, t0 + beat, ph[0], 3.4, { vel: 0.3, pan: 0.2, tone: 0.6 });
      pluck(tr, t0 + 3 * beat, ph[1], 3.4, { vel: 0.24, pan: -0.15, tone: 0.6 });
    }
    if (bar % 8 === 6) bell(tr, t0 + 2 * beat, 'E5', 3, { vel: 0.1, pan: 0.4 });
  }
  finalize(tr, { wet: 0.42, lowpass: 0.19, fadeOut: 3.4 });
  return tr;
}

/* -------------------------------- main --------------------------------- */

const TRACKS = {
  aurore: composeAurore,
  jardin: composeJardin,
  celebration: composeCelebration,
  envol: composeEnvol,
  harmonie: composeHarmonie,
};

function main() {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-music-'));
  for (const [name, compose] of Object.entries(TRACKS)) {
    if (only && name !== only) continue;
    process.stdout.write(`render ${name}… `);
    const t = Date.now();
    const tr = compose();
    const wav = path.join(tmp, `${name}.wav`);
    writeWav(tr, wav);
    const out = path.join(OUT_DIR, `${name}.m4a`);
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      wav,
      '-c:a',
      'aac',
      '-b:a',
      '112k',
      '-movflags',
      '+faststart',
      out,
    ]);
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(
      `${((Date.now() - t) / 1000).toFixed(1)}s → ${path.relative(process.cwd(), out)} (${kb} Ko, ${(tr.n / SR).toFixed(0)} s)`,
    );
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

main();
