/* Atom Research — particle graphics and scroll animations. No dependencies. */
(() => {
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const ACCENT = [142, 162, 255];
  const BLUE = [77, 107, 255];
  const ENERGY = [62, 224, 180];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // Seeded RNG so graphics are stable per loop.
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // Runs draw(ctx, w, h, t, pointer) on a canvas only while it is on screen.
  function animate(canvas, draw, { onResize } = {}) {
    const ctx = canvas.getContext("2d");
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false };
    let w = 0, h = 0, visible = true, raf = 0;
    const start = performance.now();

    const frame = (now) => {
      raf = 0;
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h, REDUCE ? 6 : (now - start) / 1000, pointer);
      if (visible && !REDUCE) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * DPR));
      canvas.height = Math.max(1, Math.round(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      onResize && onResize(w, h);
      kick();
    };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
    const host = canvas.parentElement;
    host.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      pointer.inside = true;
    });
    host.addEventListener("pointerleave", () => { pointer.tx = 0; pointer.ty = 0; pointer.inside = false; });
    resize();
  }

  /* ---------- starfield (fixed page background) ---------- */
  function starfield(canvas) {
    let stars = [];
    let shooting = null;
    const rand = rng(7);
    animate(canvas, (ctx, w, h, t) => {
      for (const s of stars) {
        const y = (s.y * h + t * s.v) % h;
        const a = s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.p));
        ctx.fillStyle = s.blue ? rgba(ACCENT, a) : `rgba(232,235,247,${a})`;
        ctx.fillRect(s.x * w, y, s.r, s.r);
      }
      // an occasional shooting star
      if (!shooting && Math.random() < 0.004) {
        shooting = { x: Math.random() * w * 0.8, y: Math.random() * h * 0.4, life: 0 };
      }
      if (shooting) {
        shooting.life += 0.016;
        const p = shooting.life / 0.9;
        const x = shooting.x + p * 260, y = shooting.y + p * 110;
        const g = ctx.createLinearGradient(x - 90, y - 38, x, y);
        g.addColorStop(0, "rgba(142,162,255,0)");
        g.addColorStop(1, `rgba(220,228,255,${0.8 * (1 - p)})`);
        ctx.strokeStyle = g; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 90, y - 38); ctx.lineTo(x, y); ctx.stroke();
        if (p >= 1) shooting = null;
      }
    }, {
      onResize: (w, h) => {
        const n = Math.round(Math.min(420, (w * h) / 5200));
        stars = Array.from({ length: n }, () => ({
          x: rand(), y: rand(), r: rand() < 0.08 ? 2 : 1,
          a: 0.25 + rand() * 0.6, tw: 0.4 + rand() * 1.8, p: rand() * 6.28,
          v: 1 + rand() * 4, blue: rand() < 0.25,
        }));
      },
    });
  }

  /* ---------- particle atom (home hero) ---------- */
  function atom(canvas) {
    const rand = rng(42);
    const nucleus = [];
    while (nucleus.length < 170) {
      const x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1;
      if (x * x + y * y + z * z <= 1) nucleus.push([x * 0.17, y * 0.17, z * 0.17, rand() * 6.28]);
    }
    const RINGS = 3, DOTS = 150, TILT = 1.22;
    const rings = [];
    for (let k = 0; k < RINGS; k++) {
      const rz = (k * Math.PI) / 3;
      const pts = [];
      for (let i = 0; i < DOTS; i++) pts.push(ringPoint(k, (i / DOTS) * Math.PI * 2));
      rings.push({ rz, pts, speed: 0.9 + k * 0.17, phase: k * 2.1 });
    }
    function ringPoint(k, th) {
      // circle in XY plane, tilted around X, then turned around Z by k*60deg
      let x = Math.cos(th), y = Math.sin(th), z = 0;
      const cy = Math.cos(TILT), sy = Math.sin(TILT);
      [y, z] = [y * cy - z * sy, y * sy + z * cy];
      const rz = (k * Math.PI) / 3, c = Math.cos(rz), s = Math.sin(rz);
      return [x * c - y * s, x * s + y * c, z];
    }
    // dust: particles scattered in a loose shell
    const dust = Array.from({ length: 260 }, () => {
      const u = rand() * 2 - 1, th = rand() * 6.28, r = 1.25 + rand() * 0.9;
      const q = Math.sqrt(1 - u * u);
      return [Math.cos(th) * q * r, u * r * 0.7, Math.sin(th) * q * r, rand()];
    });

    animate(canvas, (ctx, w, h, t, ptr) => {
      const R = Math.min(w * 0.36, h * 0.42);
      const cx = w * 0.5, cy = h * 0.42;
      const ay = t * 0.22 + ptr.x * 0.6;
      const ax = 0.28 + ptr.y * 0.35;
      const cay = Math.cos(ay), say = Math.sin(ay), cax = Math.cos(ax), sax = Math.sin(ax);
      const proj = (x, y, z) => {
        let X = x * cay + z * say, Z = -x * say + z * cay;
        let Y = y * cax - Z * sax; Z = y * sax + Z * cax;
        const f = 3.2 / (3.2 + Z);
        return [cx + X * R * f, cy + Y * R * f, Z, f];
      };

      for (const d of dust) {
        const [x, y, z, a] = proj(d[0], d[1] + Math.sin(t * 0.3 + d[3] * 6) * 0.03, d[2]);
        const al = (0.12 + 0.25 * a) * (1 - (z + 2) / 5);
        ctx.fillStyle = rgba(ACCENT, Math.max(0.04, al));
        ctx.fillRect(x, y, 1.2, 1.2);
      }

      // orbit dots
      for (const r of rings) {
        for (let i = 0; i < r.pts.length; i++) {
          const p = r.pts[i];
          const [x, y, z, f] = proj(p[0], p[1], p[2]);
          const depth = (1 - z) / 2;
          const s = 1.1 + f * 1.1;
          ctx.fillStyle = rgba(ACCENT, 0.18 + depth * 0.5);
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }

      // nucleus
      for (const n of nucleus) {
        const j = 0.012 * Math.sin(t * 2.4 + n[3]);
        const [x, y, z, f] = proj(n[0] + j, n[1] - j, n[2] + j);
        const depth = (1 - z * 4) / 2;
        const s = 1.6 + f * 1.6;
        ctx.fillStyle = `rgba(232,235,247,${0.35 + 0.55 * Math.min(1, depth)})`;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      // nucleus glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45);
      g.addColorStop(0, "rgba(77,107,255,0.28)");
      g.addColorStop(1, "rgba(77,107,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 0.45, 0, 6.28); ctx.fill();

      // electrons with trails
      rings.forEach((r, k) => {
        for (let tr = 14; tr >= 0; tr--) {
          const th = (t - tr * 0.018) * r.speed + r.phase;
          const p = ringPoint(k, th);
          const [x, y, , f] = proj(p[0], p[1], p[2]);
          const a = 1 - tr / 15;
          const s = (tr === 0 ? 4 : 2.4) * f;
          ctx.fillStyle = tr === 0 ? "#ffffff" : rgba(ACCENT, a * 0.7);
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
          if (tr === 0) {
            const eg = ctx.createRadialGradient(x, y, 0, x, y, 22 * f);
            eg.addColorStop(0, "rgba(142,162,255,0.55)");
            eg.addColorStop(1, "rgba(142,162,255,0)");
            ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x, y, 22 * f, 0, 6.28); ctx.fill();
          }
        }
      });
    });
  }

  /* ---------- search tree (Discovery OS) ---------- */
  // Agents branch out from a question; dead ends dim, the best path lights up.
  function searchTree(canvas) {
    const PERIOD = 11;
    let tree = null, cycle = -1, W = 0, H = 0;

    function build(seed) {
      const rand = rng(seed * 7919 + 3);
      const nodes = [{ x: 0, y: 0.5, d: 0, parent: -1, dead: false, birth: 0.2 }];
      const maxD = 6;
      let frontier = [0];
      for (let d = 1; d <= maxD; d++) {
        const next = [];
        for (const pi of frontier) {
          const p = nodes[pi];
          if (p.dead) continue;
          const kids = d === 1 ? 3 : 1 + Math.floor(rand() * (d < 4 ? 3 : 2));
          for (let k = 0; k < kids; k++) {
            const spread = 0.42 / Math.pow(d, 0.9);
            const y = Math.min(0.94, Math.max(0.06, p.y + (k - (kids - 1) / 2) * spread + (rand() - 0.5) * 0.06));
            nodes.push({ x: d / maxD, y, d, parent: pi, dead: d > 1 && rand() < 0.32, birth: 0.2 + d * 1.05 + rand() * 0.5 });
            next.push(nodes.length - 1);
          }
        }
        frontier = next;
      }
      // best path: the deepest live leaf with the most central y
      let best = -1, score = -1;
      nodes.forEach((n, i) => { if (!n.dead && n.d === maxD) { const s = 1 - Math.abs(n.y - 0.5) + rand() * 0.3; if (s > score) { score = s; best = i; } } });
      if (best < 0) best = nodes.length - 1;
      const onPath = new Set();
      for (let i = best; i >= 0; i = nodes[i].parent) onPath.add(i);
      return { nodes, onPath };
    }

    animate(canvas, (ctx, w, h, t) => {
      const c = Math.floor(t / PERIOD);
      if (c !== cycle || W !== w || H !== h) { cycle = c; W = w; H = h; tree = build(c + 1); }
      const lt = t - c * PERIOD;
      const fadeOut = lt > PERIOD - 1 ? Math.max(0, PERIOD - lt) : 1;
      const lit = lt > 7.6;
      const padX = Math.max(28, w * 0.07), padY = h * 0.12;
      const X = (n) => padX + n.x * (w - padX * 2);
      const Y = (n) => padY + n.y * (h - padY * 2);
      const { nodes, onPath } = tree;

      // edges as dotted lines
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i], p = nodes[n.parent];
        const prog = Math.min(1, Math.max(0, (lt - (n.birth - 0.9)) / 0.9));
        if (prog <= 0) continue;
        const x0 = X(p), y0 = Y(p), x1 = X(n), y1 = Y(n);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.floor((len * prog) / 6);
        const best = lit && onPath.has(i);
        const col = best ? ACCENT : n.dead && lt > n.birth + 0.6 ? [74, 81, 117] : [120, 132, 190];
        const a = (best ? 0.95 : 0.55) * fadeOut;
        for (let s = 0; s <= steps; s++) {
          const u = (s * 6) / len;
          // slight curve
          const ex = x0 + (x1 - x0) * u;
          const ey = y0 + (y1 - y0) * (u * u * (3 - 2 * u));
          ctx.fillStyle = rgba(col, a);
          ctx.fillRect(ex - 0.8, ey - 0.8, 1.6, 1.6);
        }
      }
      // nodes
      nodes.forEach((n, i) => {
        if (lt < n.birth) return;
        const x = X(n), y = Y(n);
        const age = lt - n.birth;
        const best = lit && onPath.has(i);
        const pop = Math.min(1, age / 0.25);
        let s = (i === 0 ? 9 : 5) * pop;
        let col = i === 0 ? [255, 255, 255] : best ? [255, 255, 255] : n.dead && age > 0.6 ? [74, 81, 117] : ACCENT;
        if (best) s += 2;
        ctx.fillStyle = rgba(col, fadeOut);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        if (n.dead && age > 0.6) {
          ctx.strokeStyle = rgba([74, 81, 117], fadeOut);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
        }
        if ((best || i === 0) && fadeOut > 0) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 24);
          g.addColorStop(0, rgba(BLUE, 0.5 * fadeOut));
          g.addColorStop(1, rgba(BLUE, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 24, 0, 6.28); ctx.fill();
        }
      });
      // a pulse travelling along the best path once it is lit
      if (lit) {
        const path = [...onPath].sort((a, b) => nodes[a].d - nodes[b].d);
        const u = ((lt - 7.6) / 1.6) % 1;
        const seg = Math.min(path.length - 2, Math.floor(u * (path.length - 1)));
        const f = u * (path.length - 1) - seg;
        const a = nodes[path[seg]], b = nodes[path[seg + 1]];
        if (a && b) {
          const px = X(a) + (X(b) - X(a)) * f, py = Y(a) + (Y(b) - Y(a)) * f;
          ctx.fillStyle = rgba([255, 255, 255], fadeOut);
          ctx.fillRect(px - 3, py - 3, 6, 6);
        }
      }
    });
  }

  /* ---------- power trace (MilliJoule) ---------- */
  // A dot-matrix power trace that scrolls left; its envelope shrinks over each loop,
  // the way J/token falls as the engine improves. Illustrative only.
  function powerTrace(canvas) {
    const PERIOD = 12;
    const rand = rng(11);
    const noise = Array.from({ length: 512 }, () => rand());
    const n1 = (x) => { const i = Math.floor(x) & 511, f = x - Math.floor(x); const a = noise[i], b = noise[(i + 1) & 511]; return a + (b - a) * (f * f * (3 - 2 * f)); };

    animate(canvas, (ctx, w, h, t, ptr) => {
      const STEP = w < 520 ? 7 : 9;
      const cols = Math.ceil(w / STEP) + 1, rows = Math.floor(h / STEP);
      const mid = h * 0.55;
      const lt = t % PERIOD;
      const env = 1 - 0.55 * Math.min(1, lt / (PERIOD * 0.8));
      const shift = t * 6;

      for (let c = 0; c < cols; c++) {
        const x = c * STEP;
        const gx = c + shift;
        // batches of tokens show up as bursts
        let v = 0.35 * n1(gx * 0.08) + 0.45 * Math.pow(n1(gx * 0.025 + 40), 2) + 0.2 * n1(gx * 0.4 + 90);
        v *= env;
        const fadeEdge = Math.min(1, c / 10, (cols - c) / 10);
        const amp = Math.min(h * 0.46, v * h * 0.8);
        for (let r = 0; r < rows; r++) {
          const y = r * STEP + STEP / 2;
          const dist = Math.abs(y - mid);
          if (dist > amp) {
            // background grid dot
            ctx.fillStyle = "rgba(74,81,117,0.22)";
            ctx.fillRect(x, y, 1, 1);
            continue;
          }
          const q = 1 - dist / Math.max(1, amp);
          const hot = Math.min(1, v * 1.4);
          const col = [
            ENERGY[0] + (ACCENT[0] - ENERGY[0]) * (1 - hot),
            ENERGY[1] + (ACCENT[1] - ENERGY[1]) * (1 - hot),
            ENERGY[2] + (ACCENT[2] - ENERGY[2]) * (1 - hot),
          ];
          const s = 1.4 + q * 2.6;
          ctx.fillStyle = rgba(col, (0.25 + 0.75 * q) * fadeEdge);
          ctx.fillRect(x - s / 2 + 0.5, y - s / 2, s, s);
        }
      }
      // scan line that follows the pointer (or drifts)
      const sx = ptr.inside ? (ptr.x + 1) / 2 * w : w * (0.5 + 0.35 * Math.sin(t * 0.4));
      ctx.fillStyle = "rgba(62,224,180,0.35)";
      ctx.fillRect(Math.round(sx), 0, 1, h);
      // baseline
      ctx.fillStyle = "rgba(62,224,180,0.25)";
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, Math.round(mid), 2, 1);
    });
  }

  /* ---------- text scramble for mono labels ---------- */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#*+/<>";
  function scramble(el) {
    const final = el.dataset.text || el.textContent;
    el.dataset.text = final;
    if (REDUCE) return;
    let frame = 0;
    const total = 22;
    // animation frames pause in background tabs; always land on the real text
    setTimeout(() => { frame = total; el.textContent = final; }, 1200);
    const tick = () => {
      if (frame >= total) { el.textContent = final; return; }
      frame++;
      const done = Math.floor((frame / total) * final.length);
      el.textContent = final.split("").map((ch, i) => (i < done || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (frame < total) requestAnimationFrame(tick); else el.textContent = final;
    };
    tick();
  }

  /* ---------- wire up ---------- */
  document.querySelectorAll("canvas[data-viz]").forEach((c) => {
    ({ stars: starfield, atom, tree: searchTree, power: powerTrace })[c.dataset.viz]?.(c);
  });

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-scramble]").forEach(scramble);
      if (e.target.matches("[data-scramble]")) scramble(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal, [data-scramble]").forEach((el) => io.observe(el));

  // loop diagram: highlight the node the comet is passing
  const loop = document.querySelector(".loop-diagram");
  if (loop && !REDUCE) {
    const nodes = [...loop.querySelectorAll(".node")];
    const start = performance.now();
    const tick = (now) => {
      const u = (((now - start) / 1000) / 9) % 1; // 9s per lap, matches the SVG animation
      const idx = Math.floor(u * nodes.length + 0.5) % nodes.length;
      nodes.forEach((n, i) => n.classList.toggle("on", i === idx));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
