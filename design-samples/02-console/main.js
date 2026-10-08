/* =========================================================
   ROW · Concept 02 · Console
   GSAP 3.15 (ScrollTrigger, SplitText, ScrambleText, DrawSVG, CustomEase) + Lenis.
   The page is complete without this file; every feature below is optional and guarded.
   ========================================================= */
(() => {
  'use strict';

  const doc = document.documentElement;
  const late = !doc.classList.contains('js'); // the <head> failsafe already revealed the page
  window.__rowReady = true;
  window.lenis = null;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const mq = (q) => window.matchMedia(q);
  const reduceMQ = mq('(prefers-reduced-motion: reduce)');
  const fineMQ = mq('(pointer: fine)');
  const hoverMQ = mq('(hover: hover) and (pointer: fine)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const safe = (name, fn) => {
    try { return fn(); } catch (err) { console.warn('[ROW] ' + name + ' skipped:', err); return null; }
  };

  const gsap = window.gsap;
  if (!gsap) { doc.classList.remove('js'); return; } // CSS fallbacks (hover menus, native details) take over
  doc.classList.add('js');

  const ST = window.ScrollTrigger;
  const Split = window.SplitText;
  const hasScramble = !!window.ScrambleTextPlugin;
  const hasDraw = !!window.DrawSVGPlugin;
  gsap.registerPlugin(...[ST, Split, window.ScrambleTextPlugin, window.DrawSVGPlugin, window.CustomEase].filter(Boolean));
  const EOUT = window.CustomEase ? window.CustomEase.create('rowOut', '.22,1,.36,1') : 'expo.out';
  const EIO = window.CustomEase ? window.CustomEase.create('rowInOut', '.65,0,.35,1') : 'power3.inOut';
  const CLEAR = 'transform,translate,rotate,scale,opacity,visibility';
  if (ST) ST.config({ ignoreMobileResize: true });

  const mm = gsap.matchMedia();
  // An exception must never escape a GSAP context callback: it would leave the context
  // stack dirty and break every scene registered after it.
  const mmAdd = (query, fn) => mm.add(query, (ctx) => {
    try { return fn(ctx); } catch (err) { console.warn('[ROW] scene skipped:', err); return undefined; }
  });
  const fontsReady = Promise.race([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 450)),
  ]);

  const scrambleTo = (el, text, chars = 'lowerCase', duration = 0.6) => {
    if (!el) return;
    if (!hasScramble || reduceMQ.matches) { el.textContent = text; return; }
    gsap.to(el, { duration, overwrite: true, scrambleText: { text, chars, speed: 0.8, revealDelay: 0.08 } });
  };

  // Layout-only box (ignores transforms), used to fly the orbit into the console slot.
  const box = (el) => {
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { cx: x + el.offsetWidth / 2, cy: y + el.offsetHeight / 2, w: el.offsetWidth };
  };

  /* ---------- Loops: run only while in view and while the tab is visible ---------- */
  const loops = new Set();
  function addLoop(el, start, stop, want = () => true) {
    const L = { inView: false, running: false };
    L.sync = () => {
      const on = L.inView && !document.hidden && want();
      if (on === L.running) return;
      L.running = on;
      safe(on ? 'loop start' : 'loop stop', on ? start : stop);
    };
    const io = new IntersectionObserver(([e]) => { L.inView = e.isIntersecting; L.sync(); }, { rootMargin: '60px 0px' });
    io.observe(el);
    L.kill = () => {
      io.disconnect();
      loops.delete(L);
      if (L.running) { L.running = false; stop(); }
    };
    loops.add(L);
    return L;
  }
  document.addEventListener('visibilitychange', () => loops.forEach((L) => L.sync()));

  /* =========================================================
     Smooth scroll (fine pointers, motion allowed)
     ========================================================= */
  let lenis = null;
  safe('lenis', () => {
    if (!window.Lenis || reduceMQ.matches || !fineMQ.matches) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.lenis = lenis;
    if (ST) lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  });

  /* =========================================================
     Header: shrink + blur after 80px
     ========================================================= */
  safe('header', () => {
    const header = $('#site-header');
    if (!header) return;
    let stuck = null;
    const update = () => {
      const s = window.scrollY > 80;
      if (s !== stuck) { stuck = s; header.classList.toggle('is-stuck', s); }
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  });

  /* =========================================================
     Desktop nav: a pill slides under the hovered or focused link
     ========================================================= */
  safe('nav', () => {
    const root = $('.nav');
    const pill = root && $('.nav__pill', root);
    if (!pill) return;
    const movePill = (a) => {
      root.style.setProperty('--pill-x', a.parentElement.offsetLeft + a.offsetLeft + 'px');
      root.style.setProperty('--pill-w', a.offsetWidth + 'px');
      root.classList.add('has-pill');
    };
    $$('.nav__link', root).forEach((a) => {
      a.addEventListener('pointerenter', () => movePill(a));
      a.addEventListener('focus', () => movePill(a));
    });
    root.addEventListener('pointerleave', () => { if (!root.contains(document.activeElement)) root.classList.remove('has-pill'); });
    root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget) && !root.matches(':hover')) root.classList.remove('has-pill'); });
  });

  /* =========================================================
     Mobile menu: full-screen dialog, focus trap, Esc, scroll lock
     ========================================================= */
  const menu = safe('menu', () => {
    const btn = $('.burger');
    const panel = $('#mobile-menu');
    if (!btn || !panel) return null;
    let isOpen = false;
    const focusables = () => [btn, ...$$('a[href], button:not([disabled])', panel)];
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!f.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    function open() {
      if (isOpen) return;
      isOpen = true;
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
      doc.classList.add('menu-open');
      if (lenis) lenis.stop();
      document.addEventListener('keydown', onKey);
      gsap.killTweensOf(panel);
      // opacity, not autoAlpha: focus has to land on the first link while the fade runs
      if (reduceMQ.matches) gsap.set(panel, { autoAlpha: 1 });
      else {
        gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.32, ease: EOUT });
        gsap.fromTo($$('.mobile-menu__group, .mobile-menu__ctas', panel), { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: EOUT, delay: 0.04, clearProps: CLEAR });
      }
      const first = $('a', panel);
      if (first) first.focus({ preventScroll: true });
    }
    function close(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
      document.removeEventListener('keydown', onKey);
      doc.classList.remove('menu-open');
      if (lenis) lenis.start();
      gsap.killTweensOf(panel);
      gsap.to(panel, {
        autoAlpha: 0, duration: reduceMQ.matches ? 0 : 0.2,
        onComplete: () => { panel.hidden = true; gsap.set(panel, { clearProps: 'opacity,visibility' }); },
      });
      if (restoreFocus) btn.focus();
    }
    btn.addEventListener('click', () => (isOpen ? close(true) : open()));
    mq('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) close(false); });
    return { close, isOpen: () => isOpen };
  });

  /* =========================================================
     FAQ: native details, animated height, hash on open
     ========================================================= */
  const faq = safe('faq', () => {
    const items = $$('.qa');
    if (!items.length) return null;
    const answer = (d) => $('.qa__a', d);
    function openQa(d, instant) {
      const a = answer(d);
      gsap.killTweensOf(a);
      d.classList.add('is-open');
      d.open = true;
      if (instant || reduceMQ.matches || !a) { if (a) gsap.set(a, { clearProps: 'height,opacity,visibility' }); return; }
      gsap.fromTo(a, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.38, ease: EOUT, clearProps: 'height,opacity,visibility' });
    }
    function closeQa(d) {
      const a = answer(d);
      gsap.killTweensOf(a);
      d.classList.remove('is-open');
      if (reduceMQ.matches || !a) { d.open = false; return; }
      gsap.to(a, {
        height: 0, autoAlpha: 0, duration: 0.28, ease: EIO,
        onComplete: () => { d.open = false; gsap.set(a, { clearProps: 'height,opacity,visibility' }); },
      });
    }
    items.forEach((d) => {
      if (d.open) d.classList.add('is-open');
      const s = $('summary', d);
      if (!s) return;
      s.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.classList.contains('is-open')) {
          closeQa(d);
          if (location.hash === '#' + d.id) history.replaceState(null, '', location.pathname + location.search);
        } else {
          openQa(d);
          if (d.id) history.replaceState(null, '', '#' + d.id);
        }
        if (ST) setTimeout(() => ST.refresh(), 420);
      });
    });
    const fromHash = () => {
      const d = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (d && d.classList.contains('qa')) openQa(d, true);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return { open: openQa };
  });

  /* =========================================================
     In-page anchors (through Lenis when active)
     ========================================================= */
  function scrollToTarget(target, immediate) {
    if (lenis) lenis.scrollTo(target, immediate ? { immediate: true } : {});
    else target.scrollIntoView({ behavior: immediate || reduceMQ.matches ? 'auto' : 'smooth', block: 'start' });
    const focusEl = target.tagName === 'DETAILS' ? $('summary', target) : target;
    if (!focusEl) return;
    if (!/^(A|BUTTON|SUMMARY|INPUT|SELECT|TEXTAREA)$/.test(focusEl.tagName) && !focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
    focusEl.focus({ preventScroll: true });
  }
  safe('anchors', () => {
    document.addEventListener('click', (e) => {
      const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      if (menu && menu.isOpen()) menu.close(false);
      if (faq && target.classList.contains('qa')) faq.open(target, true);
      if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
      requestAnimationFrame(() => scrollToTarget(target));
    });
  });

  /* =========================================================
     Hero intro: words rise, copy follows, orbit powers up
     ========================================================= */
  safe('intro', () => {
    const items = $$('[data-intro]');
    if (!items.length) return;
    if (late || reduceMQ.matches) { gsap.to(items, { autoAlpha: 1, duration: late ? 0 : 0.16 }); return; }
    const title = $('.hero__title');
    const rest = items.filter((el) => el !== title);
    const run = () => {
      const tl = gsap.timeline({ defaults: { ease: EOUT } });
      if (title && Split) {
        const split = Split.create(title, { type: 'words', aria: 'auto' });
        gsap.set(title, { autoAlpha: 1 });
        tl.from(split.words, { autoAlpha: 0, y: 26, duration: 0.8, stagger: 0.035, onComplete: () => split.revert() }, 0.06);
      } else if (title) tl.to(title, { autoAlpha: 1, duration: 0.5 }, 0.06);
      tl.fromTo(rest, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.09, clearProps: 'transform' }, 0.36);
      const svg = $('.orbit__svg');
      if (svg) tl.from(svg, { autoAlpha: 0, scale: 0.9, duration: 1.4, clearProps: CLEAR }, 0.1);
      const nodes = $$('.o-node');
      if (nodes.length) tl.from(nodes, { autoAlpha: 0, duration: 0.6, stagger: { each: 0.018, from: 'random' }, clearProps: 'opacity,visibility' }, 0.35);
      return true;
    };
    // if anything in the intro fails, the hero copy is shown at once rather than left hidden
    fontsReady.then(() => { if (!safe('intro run', run)) gsap.set(items, { autoAlpha: 1 }); });
  });

  /* =========================================================
     HERO — the Sync Orbit (SVG, driven by the GSAP ticker)
     ========================================================= */
  function createOrbit(svg) {
    const C = 300, R = [112, 176, 240], SPEED = [7, -4.5, 3], DEPTH = [0.4, 0.7, 1];
    const D2R = Math.PI / 180;
    const RI = { x: 512.5, y: 108.6 }, CORE = { x: 300, y: 300 };
    const rot = [0, 0, 0];
    const layers = [0, 1, 2].map((i) => svg.querySelector('.o-ring[data-layer="' + i + '"]'));
    const off = [0, 1, 2].map(() => ({ x: 0, y: 0 }));
    const offT = { x: 0, y: 0 };
    const nodes = $$('.o-node', svg).map((el) => ({ el, ring: +el.dataset.ring, a: +el.dataset.a, x: 0, y: 0 }));
    const rps = $$('.o-rp', svg).map((el, i) => ({ el, ring: +el.dataset.ring, a: +el.dataset.a, v: (i % 2 ? -1 : 1) * (14 + i * 4) }));
    const packets = $$('.o-packet', svg).map((el) => ({ el, dot: $('.o-packet__dot', el), trail: $('.o-packet__trail', el), pts: null, p: 0, on: false }));
    const spokes = $$('.o-spoke--evt', svg).map((el) => ({ el, node: null }));
    const ripples = $$('.o-ripple', svg).map((el) => ({ el, at: null }));
    const label = $('[data-event-text]');
    const badge = $('[data-event-badge]');
    if (!nodes.length || packets.length < 2 || spokes.length < 2 || !ripples.length) return null;

    // Snapshot of the static end-frame, restored whenever motion is switched off.
    const snap = [];
    const keep = (el, ...attrs) => attrs.forEach((a) => snap.push([el, a, el.getAttribute(a)]));
    nodes.forEach((n) => keep(n.el, 'transform'));
    rps.forEach((p) => keep(p.el, 'cx', 'cy'));
    packets.forEach((k) => { keep(k.el, 'class'); keep(k.dot, 'cx', 'cy'); keep(k.trail, 'x1', 'y1', 'x2', 'y2'); });
    spokes.forEach((s) => keep(s.el, 'x2', 'y2'));
    ripples.forEach((r) => keep(r.el, 'class', 'cx', 'cy', 'r'));
    layers.forEach((l) => l && keep(l, 'transform'));
    const label0 = label ? label.textContent : '';
    const badge0 = badge ? badge.dataset.state : null;

    const f1 = (v) => v.toFixed(1);
    const nodePos = (n) => ({ x: n.x + off[n.ring].x, y: n.y + off[n.ring].y });
    const along = (pts, p) => {
      const i = Math.min(Math.floor(p), pts.length - 2), t = p - i;
      const a = pts[i](), b = pts[i + 1]();
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };

    function frame(dt) {
      for (let i = 0; i < 3; i++) {
        rot[i] += SPEED[i] * dt;
        const o = off[i];
        o.x += (offT.x * DEPTH[i] - o.x) * 0.08;
        o.y += (offT.y * DEPTH[i] - o.y) * 0.08;
        if (layers[i]) layers[i].setAttribute('transform', 'translate(' + o.x.toFixed(2) + ' ' + o.y.toFixed(2) + ')');
      }
      for (const n of nodes) {
        const ang = (n.a + rot[n.ring]) * D2R;
        n.x = C + R[n.ring] * Math.cos(ang);
        n.y = C + R[n.ring] * Math.sin(ang);
        n.el.setAttribute('transform', 'translate(' + f1(n.x) + ' ' + f1(n.y) + ')');
      }
      for (const p of rps) {
        p.a += p.v * dt;
        const ang = (p.a + rot[p.ring]) * D2R;
        p.el.setAttribute('cx', f1(C + R[p.ring] * Math.cos(ang)));
        p.el.setAttribute('cy', f1(C + R[p.ring] * Math.sin(ang)));
      }
      for (const s of spokes) {
        if (!s.node) continue;
        const q = nodePos(s.node);
        s.el.setAttribute('x2', f1(q.x));
        s.el.setAttribute('y2', f1(q.y));
      }
      for (const k of packets) {
        if (!k.on || !k.pts) continue;
        const h = along(k.pts, k.p), t = along(k.pts, Math.max(0, k.p - 0.16));
        k.dot.setAttribute('cx', f1(h.x)); k.dot.setAttribute('cy', f1(h.y));
        k.trail.setAttribute('x1', f1(t.x)); k.trail.setAttribute('y1', f1(t.y));
        k.trail.setAttribute('x2', f1(h.x)); k.trail.setAttribute('y2', f1(h.y));
      }
      for (const r of ripples) {
        if (!r.at) continue;
        const q = r.at();
        r.el.setAttribute('cx', f1(q.x));
        r.el.setAttribute('cy', f1(q.y));
      }
    }

    // Each event is a sync story: a record travels to ROW, then on to RI (or back).
    // Labels are the doc's own words: "members, officers and club details".
    const EVENTS = [
      { dir: 'out', ring: 2, text: 'Members' },
      { dir: 'in', ring: 0, text: 'Officers' },
      { dir: 'out', ring: 1, text: 'Club details' },
      { dir: 'in', ring: 2, text: 'Members' },
      { dir: 'out', ring: 0, text: 'Officers' },
    ];
    const pools = [0, 1, 2].map((r) => nodes.filter((n) => n.ring === r && !n.el.classList.contains('o-node--dot')));
    const coreGet = () => CORE, riGet = () => RI;
    let rIdx = 0;
    const ripple = (getPos, kind) => {
      const r = ripples[rIdx++ % ripples.length];
      r.at = getPos;
      r.el.setAttribute('class', 'o-ripple is-' + kind);
      gsap.fromTo(r.el, { attr: { r: 6 }, opacity: 0.9 }, { attr: { r: 32 }, opacity: 0, duration: 0.9, ease: 'power2.out', overwrite: true });
    };
    const setBadge = (state) => { if (badge) badge.dataset.state = state; };

    function eventTl(ev, slot) {
      const pk = packets[slot], sp = spokes[slot];
      let node = pools[ev.ring][0];
      const nodeGet = () => nodePos(node);
      const tl = gsap.timeline();
      tl.call(() => {
        const pool = pools[ev.ring];
        node = pool[Math.floor(Math.random() * pool.length)];
        sp.node = node;
        pk.pts = ev.dir === 'out' ? [nodeGet, coreGet, riGet] : [riGet, coreGet, nodeGet];
        pk.p = 0;
        pk.on = true;
        pk.el.classList.toggle('is-in', ev.dir === 'in');
        if (ev.dir === 'out') { ripple(nodeGet, 'out'); setBadge('queued'); }
        else { ripple(riGet, 'in'); setBadge('received'); }
        scrambleTo(label, ev.text, 'lowerCase', 0.55);
      }, null, 0)
        .fromTo(sp.el, { opacity: 0 }, { opacity: 1, duration: 0.25, immediateRender: false }, 0)
        .fromTo(pk.el, { opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: false }, 0)
        .fromTo(pk, { p: 0 }, { p: 1, duration: 0.55, ease: 'power2.inOut', immediateRender: false }, 0.1)
        .call(() => ripple(coreGet, ev.dir === 'out' ? 'out' : 'in'), null, 0.65)
        .fromTo(pk, { p: 1 }, { p: 2, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, 0.68)
        .call(() => {
          if (ev.dir === 'out') { ripple(riGet, 'ok'); setBadge('accepted'); }
          else { ripple(nodeGet, 'ok'); setBadge('synced'); }
        }, null, 1.28)
        .to([pk.el, sp.el], { opacity: 0, duration: 0.3 }, 1.45)
        .call(() => { pk.on = false; sp.node = null; }, null, 1.76);
      return tl;
    }

    let master = null;
    let running = false;
    const tick = (time, dtMs) => frame(Math.min(dtMs, 64) / 1000);
    const api = {
      start() {
        if (running) return;
        running = true;
        if (!master) {
          gsap.set(packets.map((k) => k.el), { opacity: 0 });
          master = gsap.timeline({ repeat: -1, paused: true });
          EVENTS.forEach((ev, i) => master.add(eventTl(ev, i % 2), i * 1.9));
          master.set({}, {}, EVENTS.length * 1.9);
        }
        gsap.ticker.add(tick);
        master.play();
      },
      stop() {
        if (!running) return;
        running = false;
        gsap.ticker.remove(tick);
        if (master) master.pause();
      },
      pointer(nx, ny) { offT.x = nx * 12; offT.y = ny * 12; },
      reset() {
        api.stop();
        if (master) { master.kill(); master = null; }
        rot.fill(0);
        off.forEach((o) => { o.x = 0; o.y = 0; });
        offT.x = 0; offT.y = 0;
        packets.forEach((k) => { k.on = false; });
        spokes.forEach((s) => { s.node = null; });
        ripples.forEach((r) => { r.at = null; gsap.killTweensOf(r.el); });
        snap.forEach(([el, a, v]) => (v == null ? el.removeAttribute(a) : el.setAttribute(a, v)));
        gsap.set([...packets.map((k) => k.el), ...spokes.map((s) => s.el), ...ripples.map((r) => r.el)], { clearProps: 'opacity' });
        if (label) { gsap.killTweensOf(label); label.textContent = label0; }
        if (badge0) setBadge(badge0);
      },
    };
    return api;
  }

  safe('hero', () => {
    const hero = $('.hero');
    const svg = $('.orbit__svg', hero || document);
    const orbitApi = svg ? createOrbit(svg) : null;
    if (!hero || !orbitApi) return;
    const orbit = $('.orbit', hero);
    const tilt = $('.orbit__tilt', hero);
    const consoleEl = $('.console', hero);
    const slot = $('[data-orbit-slot]', hero);
    const copy = $('.hero__copy', hero);
    let sceneP = 0;

    // 1) the living orbit + pointer parallax
    mmAdd({ motion: '(prefers-reduced-motion: no-preference)', fine: '(hover: hover) and (pointer: fine)' }, (ctx) => {
      const { motion, fine } = ctx.conditions;
      if (!motion) { orbitApi.reset(); return undefined; }
      const loop = addLoop(hero, () => orbitApi.start(), () => orbitApi.stop());
      let onMove = null;
      if (fine && tilt) {
        gsap.set(tilt, { transformPerspective: 1100 });
        const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.9, ease: 'power3' });
        const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.9, ease: 'power3' });
        onMove = (e) => {
          const k = 1 - clamp(sceneP * 3, 0, 1); // the tilt hands over to the scroll scene
          const nx = (e.clientX / window.innerWidth - 0.5) * 2;
          const ny = (e.clientY / window.innerHeight - 0.5) * 2;
          ry(nx * 8 * k);
          rx(-ny * 6 * k);
          orbitApi.pointer(nx * k, ny * k);
        };
        window.addEventListener('pointermove', onMove, { passive: true });
      }
      return () => {
        loop.kill();
        if (onMove) window.removeEventListener('pointermove', onMove);
        orbitApi.reset();
      };
    });

    // 2) the scroll scene: orbit settles into the console sidebar, cards assemble
    if (!ST || !orbit || !consoleEl || !slot) return;
    mmAdd({
      desk: '(min-width: 1024px) and (min-height: 640px)',
      mob: '(max-width: 1023.98px)',
      motion: '(prefers-reduced-motion: no-preference)',
    }, (ctx) => {
      const { desk, mob, motion } = ctx.conditions;
      if (!motion || !(desk || mob)) return undefined;
      hero.classList.add('is-scene');
      const pinEl = desk ? $('.hero__pin', hero) : $('.hero__stage', hero);
      if (!pinEl) return () => hero.classList.remove('is-scene');
      let F = null;
      const flight = () => {
        if (!F) {
          const a = box(orbit), b = box(slot);
          F = { x: b.cx - a.cx, y: b.cy - a.cy, s: a.w ? b.w / a.w : 0.3 };
        }
        return F;
      };
      const assemble = $$('[data-assemble]', consoleEl);
      const labels = $$('.o-ring__tag, .o-ri__label, .orbit__event', hero);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pinEl,
          // desktop: pin once the whole hero (CTAs included) has been seen
          start: desk ? 'bottom bottom' : 'top 60px',
          end: desk ? '+=110%' : '+=75%',
          pin: true,
          scrub: desk ? 0.8 : 0.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: () => { F = null; },
          onUpdate: (self) => { sceneP = self.progress; },
        },
      });
      if (desk && copy) tl.to(copy, { y: -64, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0);
      tl.fromTo(consoleEl,
        { y: () => pinEl.offsetHeight * (desk ? 0.5 : 0.32), autoAlpha: 0, scale: 0.94 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: EOUT }, desk ? 0.08 : 0)
        .to(orbit, { x: () => flight().x, y: () => flight().y, scale: () => flight().s, duration: 0.52, ease: EIO }, desk ? 0.1 : 0.04)
        .to(labels, { autoAlpha: 0, duration: 0.16 }, desk ? 0.1 : 0.04)
        .from(assemble, { autoAlpha: 0, y: 18, duration: 0.2, stagger: 0.04, ease: 'back.out(1.6)' }, desk ? 0.42 : 0.34)
        .to({}, { duration: 0.12 });
      return () => { hero.classList.remove('is-scene'); sceneP = 0; };
    });
  });

  /* =========================================================
     Proof: odometer counters (once, 1.2s)
     ========================================================= */
  safe('odometers', () => {
    if (!ST) return;
    mmAdd('(prefers-reduced-motion: no-preference)', () => {
      const built = $$('[data-odo]').map((el) => {
        const html = el.innerHTML;
        const text = el.textContent.trim();
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = text;
        const vis = document.createElement('span');
        vis.className = 'odo';
        vis.setAttribute('aria-hidden', 'true');
        let first = true;
        for (const ch of text) {
          if (/\d/.test(ch)) {
            const d = document.createElement('span');
            d.className = 'odo__d';
            const strip = document.createElement('span');
            strip.className = 'odo__strip';
            for (let k = 0; k < 20; k++) {
              const s = document.createElement('span');
              s.textContent = String(k % 10);
              strip.appendChild(s);
            }
            strip.dataset.to = String((first ? 0 : 10) + Number(ch)); // trailing digits roll a full turn
            first = false;
            d.appendChild(strip);
            vis.appendChild(d);
          } else {
            const c = document.createElement('span');
            c.className = 'odo__c';
            c.textContent = ch;
            vis.appendChild(c);
          }
        }
        el.textContent = '';
        el.append(sr, vis);
        const strips = $$('.odo__strip', vis);
        const item = el.closest('.proof__item');
        ST.create({
          trigger: el,
          start: 'top 92%',
          once: true,
          onEnter: () => gsap.to(strips, {
            yPercent: (i, t) => -5 * Number(t.dataset.to),
            duration: 1.2, ease: 'power4.out', stagger: 0.03,
            onComplete: () => { if (item) item.classList.add('is-lit'); },
          }),
        });
        return { el, html };
      });
      return () => built.forEach(({ el, html }) => { el.innerHTML = html; });
    });
  });

  /* =========================================================
     What is ROW: records cross both ways (queued → retried → accepted)
     ========================================================= */
  safe('sync', () => {
    const root = $('.sync');
    if (!root) return;
    const q = (k) => $('[data-sync="' + k + '"]', root);
    const el = {
      riNew: q('ri-new'), rowNew: q('row-new'), riNext: q('ri-next'), rowNext: q('row-next'),
      riRohan: q('ri-rohan'), rowRohan: q('row-rohan'), newBadge: q('row-new-badge'),
      rohanBadge: q('row-rohan-badge'), chip: q('chip'), chipText: q('chip-text'),
    };
    if (Object.values(el).some((v) => !v)) return;
    const orig = { newBadge: el.newBadge.dataset.state, rohanBadge: el.rohanBadge.dataset.state, chip: el.chipText.textContent };
    const setBadge = (b, state) => { b.dataset.state = state; };
    const clearHl = () => $$('.is-hl', root).forEach((n) => n.classList.remove('is-hl', 'is-hl--in'));

    mmAdd({ wide: '(min-width: 768px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
      const { wide, motion } = ctx.conditions;
      if (!motion) return undefined;
      const axis = wide ? 'x' : 'y';
      const D = wide ? 60 : 30; // RI sits left (or above): outbound travels toward negative
      let tl = null;
      const build = () => ctx.add(() => {
        tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true, defaults: { ease: EOUT } });
        tl.call(() => {
          clearHl();
          setBadge(el.newBadge, 'queued');
          setBadge(el.rohanBadge, 'ok');
          el.chipText.textContent = 'Members';
        }, null, 0)
          .set([el.riNew, el.rowNew, el.riNext, el.rowNext, el.chip], { autoAlpha: 0 }, 0)
          .set(el.chip, { [axis]: D }, 0)
          // a new member is added in ROW and queued for RI
          .to(el.rowNew, { autoAlpha: 1, duration: 0.4 }, 0.3)
          .call(() => el.rowNew.classList.add('is-hl'), null, 0.3)
          // first attempt does not get through…
          .to(el.chip, { autoAlpha: 1, duration: 0.15 }, 0.9)
          .to(el.chip, { [axis]: 6, duration: 0.5, ease: 'power2.in' }, 0.9)
          .to(el.chip, { [axis]: 16, autoAlpha: 0, duration: 0.25, ease: 'power2.out' }, 1.4)
          .call(() => setBadge(el.newBadge, 'retried'), null, 1.45)
          // …so it is retried automatically, and accepted
          .set(el.chip, { [axis]: D }, 2.1)
          .to(el.chip, { autoAlpha: 1, duration: 0.15 }, 2.1)
          .to(el.chip, { [axis]: -D, duration: 0.8, ease: EIO }, 2.1)
          .to(el.chip, { autoAlpha: 0, duration: 0.2 }, 2.8)
          .to(el.riNew, { autoAlpha: 1, duration: 0.4 }, 2.8)
          .call(() => { el.riNew.classList.add('is-hl'); setBadge(el.newBadge, 'accepted'); }, null, 2.85)
          // next year's officer arrives from RI
          .call(() => { el.riRohan.classList.add('is-hl', 'is-hl--in'); el.chipText.textContent = 'Officers'; }, null, 3.8)
          .to(el.riNext, { autoAlpha: 1, duration: 0.3 }, 3.8)
          .set(el.chip, { [axis]: -D }, 4.2)
          .to(el.chip, { autoAlpha: 1, duration: 0.15 }, 4.2)
          .to(el.chip, { [axis]: D, duration: 0.8, ease: EIO }, 4.2)
          .to(el.chip, { autoAlpha: 0, duration: 0.2 }, 4.9)
          .to(el.rowNext, { autoAlpha: 1, duration: 0.3 }, 4.9)
          .call(() => { el.rowRohan.classList.add('is-hl', 'is-hl--in'); setBadge(el.rohanBadge, 'received'); }, null, 4.95)
          .call(clearHl, null, 6.4)
          .set({}, {}, 6.8);
      });
      const loop = addLoop(root, () => { if (!tl) build(); tl.play(); }, () => { if (tl) tl.pause(); });
      return () => {
        loop.kill();
        clearHl();
        setBadge(el.newBadge, orig.newBadge);
        setBadge(el.rohanBadge, orig.rohanBadge);
        el.chipText.textContent = orig.chip;
      };
    });
  });

  /* =========================================================
     Plan next year: Jan → Jul Gantt + Year Dial, scrubbed
     ========================================================= */
  safe('plan', () => {
    const planner = $('[data-planner]');
    const inner = $('.plan__inner');
    if (!planner || !inner || !ST) return;
    const tasks = $$('.task', planner);
    const lane = $('.gantt__lane', planner);
    const segs = $$('.dial__seg', planner);
    const dial = $('.dial', planner);
    const ticks = $('.dial__ticks', planner);
    const cur = $('.dial__cur', planner);
    const next = $('.dial__next', planner);
    const nextRing = $('.dial__next-ring', planner);
    const segsG = $('.dial__segs', planner);
    const curBar = $('.gantt__bar--current', planner);
    const monthEl = $('[data-dial-month]', planner);
    const swapA = $$('.swap__a', planner);
    const swapB = $$('.swap__b', planner);
    if (!lane || !tasks.length) return;
    const S = tasks.map((t) => parseFloat(t.style.getPropertyValue('--s')) || 0);
    const E = tasks.map((t) => parseFloat(t.style.getPropertyValue('--e')) || 1);
    const month0 = monthEl ? monthEl.textContent : '';
    // the dial names only the doc's two dates: January until the changeover, then 1 July
    const monthAt = (t) => (t >= 1 ? '1 July' : 'January');

    mmAdd({ desk: '(min-width: 1024px) and (min-height: 640px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
      const { desk, motion } = ctx.conditions;
      if (!motion) return undefined;
      let lastM = null;
      const show = (m) => { if (monthEl && m !== lastM) { lastM = m; monthEl.textContent = m; } };
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: desk
          ? {
            trigger: inner,
            start: () => (inner.offsetHeight > window.innerHeight - 120 ? 'top 76px' : 'center center+=30'),
            end: '+=110%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
          }
          : { trigger: planner, start: 'top 72%', end: 'top 14%', scrub: 0.6 },
        onUpdate: () => show(monthAt(tl.time())),
      });

      gsap.set(lane, { x: 0, xPercent: 0 });
      tl.fromTo(lane, { xPercent: 0 }, { xPercent: 100, duration: 1 }, 0);
      tasks.forEach((task, i) => {
        const fill = $('.gantt__fill', task);
        const tick = $('.task__tick', task);
        const tint = $('.task__tint', task);
        const boxEl = $('.task__box', task);
        if (fill) tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: Math.max(0.01, E[i] - S[i]) }, S[i]);
        if (tick) tl.fromTo(tick, hasDraw ? { drawSVG: '0%' } : { opacity: 0 }, hasDraw ? { drawSVG: '100%', duration: 0.035 } : { opacity: 1, duration: 0.02 }, E[i]);
        if (boxEl) tl.fromTo(boxEl, { stroke: 'rgba(255,255,255,0.22)' }, { stroke: 'rgba(61,220,151,0.55)', duration: 0.02 }, E[i]);
        if (tint) tl.fromTo(tint, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, E[i] + 0.01);
        if (segs[i]) tl.fromTo(segs[i], hasDraw ? { drawSVG: '0%' } : { opacity: 0 }, hasDraw ? { drawSVG: '100%', duration: 0.05 } : { opacity: 1, duration: 0.03 }, E[i]);
      });

      // 1 July: the dial clicks and the rings swap — next year becomes the current year
      tl.addLabel('jul', 1);
      if (dial) tl.to(dial, { scale: 1.07, duration: 0.025, ease: 'power2.out' }, 'jul').to(dial, { scale: 1, duration: 0.06, ease: 'back.out(3)' }, 'jul+=0.025');
      if (ticks) tl.to(ticks, { rotation: 60, svgOrigin: '70 70', duration: 0.06, ease: 'back.out(2)' }, 'jul');
      if (segsG) tl.to(segsG, { autoAlpha: 0, duration: 0.02 }, 'jul+=0.02');
      if (nextRing) tl.fromTo(nextRing, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 'jul+=0.02').to(nextRing, { stroke: '#4F7DFF', duration: 0.09 }, 'jul+=0.04');
      if (next) tl.to(next, { scale: 54 / 40, svgOrigin: '70 70', duration: 0.09, ease: EOUT }, 'jul+=0.04');
      if (cur) tl.to(cur, { scale: 40 / 54, svgOrigin: '70 70', autoAlpha: 0.4, duration: 0.09, ease: EOUT }, 'jul+=0.04');
      if (curBar) tl.to(curBar, { autoAlpha: 0.45, duration: 0.05 }, 'jul+=0.04');
      if (swapA.length) tl.to(swapA, { autoAlpha: 0, yPercent: -50, duration: 0.04 }, 'jul+=0.05');
      if (swapB.length) tl.fromTo(swapB, { autoAlpha: 0, yPercent: 50 }, { autoAlpha: 1, yPercent: 0, duration: 0.04 }, 'jul+=0.06');
      tl.to({}, { duration: 0.18 });
      show(monthAt(tl.time()));
      return () => show(month0);
    });
  });

  /* =========================================================
     Bento: spotlight border + live micro-demos
     ========================================================= */
  const demoTl = (vars) => gsap.timeline(Object.assign({ paused: true, repeat: -1, repeatDelay: 0.6, defaults: { ease: EOUT } }, vars));
  const DEMOS = {
    dir(tile) {
      const toggle = $('.toggle', tile), knob = $('.toggle__knob', tile);
      const shown = $('.dd-shown', tile), hidden = $('.dd-hidden', tile), row = $('.dd-row--focus', tile);
      if (!toggle || !knob || !shown || !hidden || !row) return null;
      return demoTl()
        .set(toggle, { '--on': 0 }, 0).set(knob, { x: 0 }, 0)
        .set(shown, { autoAlpha: 0, y: 0 }, 0).set(hidden, { autoAlpha: 1, y: 0 }, 0)
        // Priya shares her phone with the club…
        .to(toggle, { '--on': 1, duration: 0.25 }, 0.5)
        .to(knob, { x: 16, duration: 0.32 }, 0.5)
        .to(hidden, { autoAlpha: 0, y: -6, duration: 0.2 }, 0.6)
        .fromTo(shown, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.32 }, 0.7)
        // …then hides it again; the directory respects it at once
        .to(toggle, { '--on': 0, duration: 0.25 }, 2.3)
        .to(knob, { x: 0, duration: 0.32 }, 2.3)
        .to(shown, { autoAlpha: 0, y: -6, duration: 0.2 }, 2.4)
        .fromTo(hidden, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.32 }, 2.5)
        .fromTo(row, { '--hl': 1 }, { '--hl': 0, duration: 0.9 }, 2.5)
        .set({}, {}, 3.8);
    },
    sync(tile) {
      const lane = $('.ds-lane', tile), pulse = $('.ds-pulse', tile);
      const ri = $('.ds-node--ri', tile), rowN = $('.ds-node--row', tile);
      const checks = $$('.ds-check', tile);
      if (!lane || !pulse || !ri || !rowN || checks.length < 3) return null;
      const pop = { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' };
      const glow = (n) => [n, { '--glow': 1 }, { '--glow': 0, duration: 0.6 }];
      return demoTl({ repeatDelay: 0.8 })
        .set(checks, { autoAlpha: 0, scale: 0.4 }, 0)
        .set(lane, { xPercent: 0 }, 0)
        .to(pulse, { autoAlpha: 1, duration: 0.1 }, 0.1)
        .to(lane, { xPercent: 100, duration: 0.7, ease: EIO }, 0.1)
        .fromTo(...glow(rowN), 0.8)
        .to(checks[0], pop, 0.8)
        .to(lane, { xPercent: 0, duration: 0.7, ease: EIO }, 1.0)
        .fromTo(...glow(ri), 1.7)
        .to(checks[1], pop, 1.7)
        .to(lane, { xPercent: 100, duration: 0.7, ease: EIO }, 1.9)
        .fromTo(...glow(rowN), 2.6)
        .to(checks[2], pop, 2.6)
        .to(pulse, { autoAlpha: 0, duration: 0.15 }, 2.6)
        .set({}, {}, 3.6);
    },
    qr(tile) {
      const lane = $('.dq-lane', tile), ok = $('.dq-ok', tile);
      const fill = $('.dq-bar__fill', tile), code = $('.dq-code', tile);
      if (!lane || !ok || !fill || !code) return null;
      return demoTl({ repeatDelay: 0.9 })
        .set(ok, { autoAlpha: 0, scale: 0.92 }, 0).set(code, { autoAlpha: 1 }, 0)
        .set(fill, { scaleX: 31 / 44 }, 0).set(lane, { yPercent: 0 }, 0)
        .to(lane, { yPercent: 92, duration: 1, ease: 'sine.inOut' }, 0.2)
        .to(lane, { yPercent: 0, duration: 0.8, ease: 'sine.inOut' }, 1.2)
        .to(code, { autoAlpha: 0.25, duration: 0.2 }, 2.0)
        .to(ok, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 2.05)
        .to(fill, { scaleX: 32 / 44, duration: 0.4 }, 2.2)
        .set({}, {}, 3.4);
    },
    dues(tile) {
      const lines = $$('.di-lines li', tile), sum = $('.di-sum .skel', tile), exp = $('.di-export', tile);
      if (!lines.length || !sum || !exp) return null;
      // the total bar grows as each line lands (a shape, not an amount)
      const tl = demoTl({ repeatDelay: 1 })
        .set(lines, { autoAlpha: 0, x: -8 }, 0).set(exp, { autoAlpha: 0, scale: 0.9 }, 0)
        .set(sum, { scaleX: 0, transformOrigin: '0% 50%' }, 0);
      lines.forEach((li, i) => {
        const at = 0.3 + i * 0.45;
        tl.to(li, { autoAlpha: 1, x: 0, duration: 0.35 }, at)
          .to(sum, { scaleX: (i + 1) / lines.length, duration: 0.4, ease: 'power2.out' }, at + 0.08);
      });
      return tl.to(exp, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 2.3).set({}, {}, 3.6);
    },
    chat(tile) {
      const bubble = $('.dc-bubble', tile), t2 = $('.dc-t2', tile), ticksEl = $('.dc-ticks', tile);
      const stats = $$('.dc-stats .skel', tile);
      if (!bubble || !t2 || !ticksEl) return null;
      const tl = demoTl({ repeatDelay: 0.9 })
        .set(bubble, { autoAlpha: 0, y: 14, scale: 0.96, transformOrigin: '100% 100%' }, 0)
        .set(t2, { autoAlpha: 0 }, 0)
        .call(() => ticksEl.classList.remove('is-read'), null, 0)
        .to(bubble, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.3) // sent
        .to(t2, { autoAlpha: 1, duration: 0.15 }, 1.0) // delivered
        .call(() => ticksEl.classList.add('is-read'), null, 1.6); // read
      // open and click tracking fills in (bars, not counts)
      if (stats.length) tl.set(stats, { scaleX: 0, transformOrigin: '0% 50%' }, 0).to(stats, { scaleX: 1, duration: 1.2, ease: 'power2.out', stagger: 0.1 }, 1.0);
      tl.set({}, {}, 3.4);
      tl.data = { reset: () => ticksEl.classList.add('is-read') };
      return tl;
    },
    proj(tile) {
      const btn = $('.dp-btn', tile), a = $('.dp-btn__a', tile), b = $('.dp-btn__b', tile);
      const c = $('.dp-btn__c', tile), card = $('.dp-card', tile);
      if (!btn || !a || !b || !c || !card) return null;
      const tl = demoTl({ repeatDelay: 1 })
        .set(a, { autoAlpha: 1 }, 0).set([b, c], { autoAlpha: 0 }, 0)
        .call(() => btn.classList.remove('is-done'), null, 0)
        .to(btn, { scale: 0.96, duration: 0.12, ease: 'power2.out' }, 0.7)
        .to(btn, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, 0.82)
        .to(a, { autoAlpha: 0, duration: 0.15 }, 0.8)
        .to(b, { autoAlpha: 1, duration: 0.15 }, 0.9)
        .to(b, { autoAlpha: 0, duration: 0.15 }, 1.9)
        .call(() => btn.classList.add('is-done'), null, 1.95)
        .to(c, { autoAlpha: 1, duration: 0.2 }, 2.0)
        .fromTo(card, { '--glow': 1 }, { '--glow': 0, duration: 1.1 }, 2.0)
        .set({}, {}, 3.4);
      tl.data = { reset: () => btn.classList.add('is-done') };
      return tl;
    },
    grant(tile) {
      const steps = $$('.dg-step', tile), stamp = $('.dg-stamp', tile);
      if (!steps.length || !stamp) return null;
      const tl = demoTl({ repeatDelay: 1 })
        .set(stamp, { autoAlpha: 0, scale: 1.8, rotation: -24 }, 0)
        .call(() => steps.forEach((s) => s.classList.remove('is-done')), null, 0);
      steps.forEach((s, i) => tl.call(() => s.classList.add('is-done'), null, 0.4 + i * 0.55));
      tl.to(stamp, { autoAlpha: 1, scale: 1, rotation: -9, duration: 0.45, ease: 'back.out(2.2)' }, 1.95).set({}, {}, 3.6);
      tl.data = { reset: () => steps.forEach((s) => s.classList.add('is-done')) };
      return tl;
    },
    web(tile) {
      const name = $('.dw-lang__name', tile), bars = $$('.sk', tile);
      if (!name || !bars.length) return null;
      const base = bars.map((b) => parseFloat(b.style.getPropertyValue('--w')) || 1);
      // the doc's language names, each with re-flowed line lengths (layout only; no invented copy)
      const L = [
        ['French', base], ['English', [0.7, 0.48, 0.88, 0.84, 0.58]], ['Spanish', [0.92, 0.64, 0.97, 0.76, 0.7]],
        ['German', [0.96, 0.72, 0.99, 0.9, 0.76]], ['Japanese', [0.58, 0.36, 0.7, 0.6, 0.46]], ['Italian', [0.82, 0.6, 0.93, 0.8, 0.66]],
        ['Korean', [0.62, 0.4, 0.76, 0.64, 0.5]], ['Portuguese', [0.9, 0.55, 0.95, 0.83, 0.69]],
      ];
      const tl = demoTl({ repeatDelay: 0 });
      L.forEach((_, i) => {
        const [nn, w] = L[(i + 1) % L.length];
        const at = i * 1.5 + 0.6;
        tl.call(() => scrambleTo(name, nn, 'upperAndLowerCase', 0.6), null, at);
        bars.forEach((b, k) => tl.to(b, { scaleX: (w[k] || base[k]) / base[k], duration: 0.5 }, at + 0.05 + k * 0.03));
      });
      tl.set({}, {}, L.length * 1.5);
      tl.data = { reset: () => { gsap.killTweensOf(name); name.textContent = L[0][0]; } };
      return tl;
    },
  };

  safe('bento', () => {
    const grid = $('.bento');
    const tiles = $$('.tile[data-demo]');
    if (!grid || !tiles.length) return;

    // cursor-following spotlight border (fine pointers)
    if (hoverMQ.matches) {
      grid.addEventListener('pointermove', (e) => {
        const rects = tiles.map((t) => t.getBoundingClientRect());
        tiles.forEach((t, i) => {
          t.style.setProperty('--mx', Math.round(e.clientX - rects[i].left) + 'px');
          t.style.setProperty('--my', Math.round(e.clientY - rects[i].top) + 'px');
        });
      }, { passive: true });
    }

    // demos play on hover / keyboard focus (and in view on touch); they finish their beat when left
    mmAdd('(prefers-reduced-motion: no-preference)', (ctx) => {
      const offs = tiles.map((tile) => {
        const build = DEMOS[tile.dataset.demo];
        if (!build) return null;
        const touch = !hoverMQ.matches;
        let tl = null, hover = false, focus = false, finish = null;
        const start = () => {
          if (finish) { finish.kill(); finish = null; }
          if (!tl) {
            ctx.add(() => { tl = safe('demo ' + tile.dataset.demo, () => build(tile)); });
            if (!tl) return;
            tl.restart();
          } else tl.play();
        };
        const stop = () => {
          if (!tl) return;
          tl.pause();
          finish = gsap.to(tl, { progress: 1, duration: 0.5, ease: 'power1.out' });
        };
        const loop = addLoop(tile, start, stop, () => touch || hover || focus);
        const set = (k, v) => () => { if (k === 'h') hover = v; else focus = v; loop.sync(); };
        const handlers = [['pointerenter', set('h', true)], ['pointerleave', set('h', false)], ['focusin', set('f', true)], ['focusout', set('f', false)]];
        handlers.forEach(([ev, fn]) => tile.addEventListener(ev, fn));
        return () => {
          loop.kill();
          if (finish) finish.kill();
          handlers.forEach(([ev, fn]) => tile.removeEventListener(ev, fn));
          if (tl && tl.data && tl.data.reset) tl.data.reset();
        };
      });
      return () => offs.forEach((f) => f && f());
    });
  });

  /* =========================================================
     Languages: the display scrambles between the doc's language names
     ========================================================= */
  safe('languages', () => {
    const root = $('.locale');
    if (!root) return;
    const word = $('[data-lang-word]', root);
    const opts = $$('.locale__opt', root);
    if (!word || !opts.length) return;
    const L = opts.map((b) => b.textContent.trim());
    let i = 0, holdUntil = 0;
    function show(n, animate) {
      i = (n + L.length) % L.length;
      const name = L[i];
      opts.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      if (animate && hasScramble && !reduceMQ.matches) {
        gsap.to(word, { duration: 0.9, overwrite: true, scrambleText: { text: name, chars: 'upperAndLowerCase', speed: 0.6, revealDelay: 0.15 } });
      } else {
        gsap.killTweensOf(word);
        word.textContent = name;
      }
    }
    opts.forEach((b, k) => b.addEventListener('click', () => { holdUntil = performance.now() + 6000; show(k, true); }));
    mmAdd('(prefers-reduced-motion: no-preference)', () => {
      let timer = 0;
      const step = () => { if (performance.now() >= holdUntil) show(i + 1, true); };
      const loop = addLoop(root, () => { timer = setInterval(step, 2400); }, () => { clearInterval(timer); timer = 0; });
      return () => loop.kill();
    });
  });

  /* =========================================================
     Districts: one subscription fans out, clubs switch on
     ========================================================= */
  safe('graph', () => {
    const root = $('.graph');
    if (!root || !ST) return;
    const links = $$('.g-link', root);
    const hub = $('.g-hub', root);
    mmAdd('(prefers-reduced-motion: no-preference)', () => {
      const mid = (links.length - 1) / 2;
      const order = links.map((_, k) => k).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid)); // fan opens from the centre
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root, start: 'top 80%', end: 'center 55%', scrub: 0.6 }, // complete by the time it is centred
      });
      if (hub) tl.fromTo(hub, { scale: 0.82, autoAlpha: 0.5, transformOrigin: '50% 50%' }, { scale: 1, autoAlpha: 1, duration: 0.12, ease: EOUT }, 0);
      order.forEach((idx, k) => {
        const l = links[idx];
        const on = $('.g-edge--on', l), node = $('.g-node__on', l);
        const t = 0.1 + k * 0.05;
        if (on) tl.fromTo(on, hasDraw ? { drawSVG: '0%' } : { opacity: 0 }, hasDraw ? { drawSVG: '100%', duration: 0.16 } : { opacity: 0.85, duration: 0.1 }, t);
        if (node) tl.fromTo(node, { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.06, ease: 'back.out(3)' }, t + 0.15);
      });
      return undefined;
    });
  });

  /* =========================================================
     Migration: 10-working-day import log → signed report
     ========================================================= */
  safe('importer', () => {
    const root = $('.importer');
    if (!root || !ST) return;
    const fills = $$('.seg__fill', root), logs = $$('.log', root);
    const report = $('.report', root), sig = $('.report__sig path', root), stamp = $('.stamp', root);
    const live = $('.importer__live', root), checks = $$('.report__checks li', root);
    mmAdd('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root, start: 'top 80%', end: 'bottom 85%', scrub: 0.6 },
      });
      fills.forEach((f, d) => tl.fromTo(f, { scaleX: 0 }, { scaleX: 1, duration: 0.1 }, d * 0.1));
      logs.forEach((li) => {
        const dd = Number(li.dataset.day) || 1;
        const t0 = Math.max(0, (dd - 1) * 0.1), t1 = dd * 0.1;
        const spin = $('.log__spin', li), ok = $('.log__ok', li);
        tl.fromTo(li, { autoAlpha: 0.35 }, { autoAlpha: 1, duration: 0.02 }, t0);
        if (spin) tl.fromTo(spin, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, t0).to(spin, { autoAlpha: 0, duration: 0.01 }, t1 - 0.015);
        if (ok) tl.fromTo(ok, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.03, ease: 'back.out(3)' }, t1 - 0.01);
      });
      if (report) tl.fromTo(report, { autoAlpha: 0.25, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.74);
      if (checks.length) tl.fromTo(checks, { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.03, stagger: 0.02 }, 0.8);
      if (sig) tl.fromTo(sig, hasDraw ? { drawSVG: '0%' } : { opacity: 0 }, hasDraw ? { drawSVG: '100%', duration: 0.1 } : { opacity: 1, duration: 0.05 }, 0.88);
      if (stamp) tl.fromTo(stamp, { autoAlpha: 0, scale: 1.6, rotation: -18 }, { autoAlpha: 1, scale: 1, rotation: -6, duration: 0.04, ease: 'back.out(2)' }, 0.98);
      if (live) tl.fromTo(live, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.99);
      tl.set({}, {}, 1.04);
      return undefined;
    });
  });

  /* =========================================================
     Magnetic primary CTA (hero + closing band, fine pointers)
     ========================================================= */
  safe('magnets', () => {
    mmAdd('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const offs = $$('.magnet').map((m) => {
        const xTo = gsap.quickTo(m, 'x', { duration: 0.5, ease: 'power3' });
        const yTo = gsap.quickTo(m, 'y', { duration: 0.5, ease: 'power3' });
        const move = (e) => {
          const r = m.getBoundingClientRect();
          const cx = r.left + r.width / 2 - (gsap.getProperty(m, 'x') || 0);
          const cy = r.top + r.height / 2 - (gsap.getProperty(m, 'y') || 0);
          xTo(clamp((e.clientX - cx) * 0.22, -6, 6));
          yTo(clamp((e.clientY - cy) * 0.3, -6, 6));
        };
        const leave = () => gsap.to(m, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: true });
        m.addEventListener('pointermove', move);
        m.addEventListener('pointerleave', leave);
        return () => { m.removeEventListener('pointermove', move); m.removeEventListener('pointerleave', leave); };
      });
      return () => offs.forEach((f) => f());
    });
  });

  /* =========================================================
     Section reveals, tile cascade, heading words
     ========================================================= */
  safe('reveals', () => {
    if (!ST) return;
    mmAdd('(prefers-reduced-motion: no-preference)', (ctx) => {
      $$('[data-reveal]').forEach((el) => {
        gsap.from(el, { autoAlpha: 0, y: 24, duration: 0.7, ease: EOUT, clearProps: CLEAR, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });

      const tiles = $$('.tile');
      if (tiles.length) {
        gsap.set(tiles, { autoAlpha: 0, y: 28 });
        ST.batch(tiles, {
          start: 'top 92%', once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06, ease: EOUT, clearProps: CLEAR }),
        });
      }

      fontsReady.then(() => safe('heading split', () => ctx.add(() => {
        if (Split) {
          $$('[data-split]').forEach((h) => {
            const s = Split.create(h, { type: 'words', aria: 'auto' });
            gsap.from(s.words, {
              autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.03, ease: EOUT,
              scrollTrigger: { trigger: h, start: 'top 88%', once: true },
              onComplete: () => s.revert(),
            });
          });
        }
        ST.refresh();
      })));
      return undefined;
    });
  });

  /* =========================================================
     CSS loops (live dot, caret, spinners, CTA border) pause offscreen
     ========================================================= */
  safe('css-loops', () => {
    $$('.hero, .bento, .importer, .cta__card').forEach((el) => {
      el.classList.add('is-paused');
      addLoop(el, () => el.classList.remove('is-paused'), () => el.classList.add('is-paused'));
    });
  });

  /* =========================================================
     Final layout pass + honour a deep link after pins are measured
     ========================================================= */
  fontsReady.then(() => safe('final refresh', () => {
    if (ST) ST.refresh();
    const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    const target = id ? document.getElementById(id) : null;
    if (target) requestAnimationFrame(() => safe('deep link', () => scrollToTarget(target, true)));
  }));
})();
