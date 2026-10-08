/*
 * wero-editable choreography — TRANSCRIBED from the compiled bundle, not re-authored.
 *
 * Every duration / ease / trigger / frame number below was extracted from the minified
 * chunks by reading the actual call sites (choreography-spec.json holds each finding
 * with its verbatim source excerpt and window file). Do not "tidy" values: an odd number
 * like rotate 7.68 or a 15% scrub dead-zone is the original, on purpose.
 *
 * Libraries load as globals from js/vendor/: gsap, ScrollTrigger, lottie, Lenis.
 * Lottie data ships as files in assets/lottie/ (extracted from the bundle previously).
 *
 * KNOWN GAPS vs the original (each flagged where it applies):
 *   [G1] hero hands mobile variant (M0) was never extracted -> desktop JSON used <768px
 *   [G2] portrait page-transition lottie (D8) not extracted -> landscape JSON used
 *   [G3] footer piggybank/clock lottie (inline in bundle) not extracted -> skipped
 *   [G4] video section Swiper/Plyr players skipped (videos excluded from this project)
 *   [G5] body-scroll-lock simplified to overflow:hidden (original lib adds iOS touch
 *        handling); identical behaviour on desktop
 */
(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  /* The gsap.ticker-sleep deadlock this file's Lenis comment refers to, fixed at
   * the source instead of worked around.
   *
   * gsap parks its rAF loop (ticker.sleep) when the tab is hidden. It does not
   * reliably wake when the tab comes back, and nothing else here revives it:
   * Lenis runs its OWN rAF (autoRaf:true), so it keeps scrolling happily while
   * gsap is frozen. Every tween queued in the meantime sits at progress 0
   * forever, which is silent and looks exactly like dead JS:
   *   - hero intro never reveals, and because it is the only caller of
   *     resumeLenis(), the scroller stays paused -> "the page is broken"
   *   - FAQ overlay open/close fires, locks/unlocks the body, and never moves
   * Verified: in each case gsap.ticker.frame did not advance while rAF ran at
   * full rate, and a manual ticker.wake() completed the pending tween.
   *
   * Do NOT "fix" this by stubbing gsap.ticker.sleep — wake() calls sleep()
   * internally to cancel the outgoing rAF before requesting the next one, so a
   * no-op sleep leaves the loop dead after exactly one frame (measured:
   * ticker.frame stuck at 1). Only the public wake() is safe to call.
   *
   * A stall is not observable from an event — it was measured happening while
   * the tab was visible and rAF ran at full rate — so this polls. Two frame
   * counts 500ms apart that are equal means parked; wake() revives it and the
   * pending tween finishes normally. Cost is one integer compare per half
   * second. */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) gsap.ticker.wake(); });
  let _lastTickerFrame = -1;
  setInterval(() => {
    if (gsap.ticker.frame === _lastTickerFrame) gsap.ticker.wake();
    _lastTickerFrame = gsap.ticker.frame;
  }, 500);

  const IS_B2B = /merchant/.test(location.pathname);
  const L = 'assets/lottie/';
  const mm = (q) => window.matchMedia(q).matches;

  /* ---------------------------------------------------------------- store
   * Stand-in for the original pinia "site" store: {lenis, faqOpen, showBottomBar}
   * plus the pause/resume/lock actions and the tiny event bus ($event/$listen). */
  const store = {
    lenis: null,
    faqOpen: false,
    showBottomBar: false,
    _watchers: [],
    pauseLenis() { this.lenis && this.lenis.stop(); },
    resumeLenis() { this.lenis && this.lenis.start(); },
    setFaqOpen(v) { this.faqOpen = v; this._watchers.forEach((w) => w('faqOpen', v)); },
    setShowBottomBar(v) { this.showBottomBar = v; this._watchers.forEach((w) => w('showBottomBar', v)); },
    watch(fn) { this._watchers.push(fn); },
    openFaq() { this.setFaqOpen(true); this.pauseLenis(); lockBody(); },
    closeFaq() { this.setFaqOpen(false); this.resumeLenis(); unlockBody(); },
  };
  const bus = {
    _l: {},
    $listen(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    $event(ev, payload) { (this._l[ev] || []).forEach((fn) => fn(payload)); },
  };
  // [G5] simplified body lock
  let _bodyOverflow = '';
  const lockBody = () => { _bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; };
  const unlockBody = () => { document.body.style.overflow = _bodyOverflow; };

  const debounce = (fn, ms) => { let id; const d = (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(id); return d; };

  /* Hero lottie data, fetched THE MOMENT this script evaluates (plus <head> preload
   * hints that start the downloads during HTML parse). The compiled bundle inlines
   * this JSON in its chunk, so its intro starts with zero network wait — loading via
   * path: at init time made the whole intro (text AND hands share one timeline) sit
   * behind an XHR, which read as "the hands come in late". */
  const heroData = {
    hands: fetch('assets/lottie/hands.json').then((r) => r.json()).catch(() => null),
    lines: fetch('assets/lottie/3-lijnen-voor-eerste-titelkaart.json').then((r) => r.json()).catch(() => null),
    stars: fetch('assets/lottie/3-sterretjes-voor-eerste-titelkaart.json').then((r) => r.json()).catch(() => null),
  };
  // With animationData supplied, lottie can fire DOMLoaded synchronously inside
  // loadAnimation — before addEventListener runs. Always go through this.
  const onLottieReady = (anim, fn) => { if (anim.isLoaded) fn(); else anim.addEventListener('DOMLoaded', fn); };
  const q = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const loadLottie = (container, file, opts) => lottie.loadAnimation(
    Object.assign({ container, renderer: 'svg', loop: false, autoplay: false, path: L + file }, opts));

  /* ---------------------------------------------------------------- lenis
   * new Lenis({autoRaf:!0,duration:2,anchors:{duration:1.2},wheelMultiplier:.7,
   * touchMultiplier:.7}); scrollTo(0,{immediate}); starts PAUSED — the hero intro
   * resumes it (spec: B5ZHsiyA w26). autoRaf means Lenis drives its own rAF, which
   * also sidesteps the gsap.ticker-sleep deadlock documented in this repo. */
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const lenis = new Lenis({ autoRaf: true, duration: 2, anchors: { duration: 1.2 }, wheelMultiplier: 0.7, touchMultiplier: 0.7 });
  lenis.scrollTo(0, { immediate: true });
  store.lenis = lenis;
  store.pauseLenis();
  lenis.on('scroll', ScrollTrigger.update);

  // debounced ScrollTrigger.refresh on resize (150ms, lodash-debounce in original)
  window.addEventListener('resize', debounce(() => ScrollTrigger.refresh(), 150));

  /* ---------------------------------------------------------- reveal system
   * The bundle's global data-attribute reveals (spec: CD_rjaHw window).
   * [data-reveal]          -> adds class --revealed at top {pos|75%}, once
   * [data-title-reveal]    -> children autoAlpha:1 y:0 dur:2   stagger:.2 back.out(1.7), pos|75%
   * [data-subtitle-reveal] -> children autoAlpha:1 y:0 dur:1.2 stagger:.2 back.out(1.7), pos|90%
   * data-reveal-delay -> gsap.delayedCall before firing; data-reveal-manually -> skip. */
  function initReveals() {
    qa('[data-reveal]').forEach((el) => {
      if (el.hasAttribute('data-reveal-manually')) return;
      const pos = el.dataset.revealPosition || '75%';
      const delay = el.dataset.revealDelay;
      gsap.timeline({ scrollTrigger: { trigger: el, start: `top ${pos}`, once: true, onEnter: () => {
        if (!delay) { el.classList.add('--revealed'); return; }
        gsap.delayedCall(parseFloat(delay), () => el.classList.add('--revealed'));
      } } });
    });
    const childReveal = (attr, dur, defPos) => qa(`[${attr}]`).forEach((el) => {
      if (el.hasAttribute('data-reveal-manually')) return;
      const pos = el.dataset.revealPosition || defPos;
      const delay = el.dataset.revealDelay;
      const fire = () => gsap.to(el.children, { autoAlpha: 1, y: 0, duration: dur, stagger: 0.2, ease: 'back.out(1.7)' });
      ScrollTrigger.create({ trigger: el, start: `top ${pos}`, once: true, onEnter: () => {
        if (!delay) { fire(); return; }
        gsap.delayedCall(parseFloat(delay), fire);
      } });
    });
    childReveal('data-title-reveal', 2, '75%');
    childReveal('data-subtitle-reveal', 1.2, '90%');
  }

  /* ------------------------------------------------------- scroll progress
   * scaleX 0->1 scrubbed across the whole document (spec: B5ZHsiyA w08). */
  function initScrollProgress() {
    const bar = q('.scroll-progress');
    if (!bar) return;
    gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });
    gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: true } });
  }

  /* ----------------------------------------------------------- site header
   * Shrink to .7 + paint the logo pill after 100px; restore on the way back.
   * Note the original asymmetry: restore duration .2 vs .4 (spec: B5ZHsiyA w08). */
  function initHeader() {
    const header = q('header');
    const logo = q('.logo-container.button-primary.button-primary--white');
    if (!header || !logo) return;
    ScrollTrigger.create({
      trigger: document.documentElement, start: 'top -=100',
      onEnter: () => {
        /* No shrink on scroll: scaling the header rasterised the 187x72 logo PNG
         * at a fractional size, which is what made it look blurry. */
        gsap.to(header, { scale: 1, duration: 0.4, ease: 'power2.out' });
        /* White panel + hard black offset shadow — the same 3D-button treatment
         * the contact card and footer nav use (0 6px 0 0 #1D1C1C). */
        gsap.to(logo, { backgroundColor: '#FFFFFF', borderColor: '#1D1C1C', boxShadow: '0px 6px 0px 0px #1D1C1C', duration: 0.4, ease: 'power2.out' });
      },
      onLeaveBack: () => {
        gsap.to(header, { scale: 1, duration: 0.4, ease: 'power2.out' });
        /* Stays a white 3D button at the top of the page too — it used to fade to
         * transparent over the hero, which left the logo floating unframed. */
        gsap.to(logo, { backgroundColor: '#FFFFFF', borderColor: '#1D1C1C', boxShadow: '0px 6px 0px 0px #1D1C1C', duration: 0.2, ease: 'power2.out' });
      },
    });
  }

  /* ------------------------------------------------------------ bottom bar
   * Slides up (y:190 -> 0) once Lenis scroll >= 80, hides below 80.
   * Scroll-spy IO with rootMargin -20% 0px -60% 0px drives the active nav link.
   * Mobile menu: measured-height expand/collapse with item stagger. */
  function initBottomBar() {
    const bar = q('.bottom-bar');
    if (!bar) return;
    gsap.set(bar, { y: 190 });
    lenis.on('scroll', (e) => {
      const p = e.scroll || 0;
      if (p >= 80 && !store.showBottomBar) {
        store.setShowBottomBar(true);
        gsap.to(bar, { y: 0, duration: 0.4, ease: 'power2.out' });
      } else if (p < 80 && store.showBottomBar) {
        store.setShowBottomBar(false);
        gsap.to(bar, { y: 190, duration: 0.4, ease: 'power2.in' });
      }
    });

    // scroll spy
    const ids = ['wat-is-het', 'tijdlijn', 'veelgestelde-vragen', 'q-and-a', 'psp-partners'];
    const links = qa('.navigation__link');
    const setActive = (id) => links.forEach((a) => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('navigation__link--active', !!id && href.endsWith('#' + id));
    });
    let active = '';
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { active = en.target.id; setActive(active); }
      else if (en.target.id === active) { active = ''; setActive(''); }
    }), { root: null, rootMargin: '-20% 0px -60% 0px', threshold: 0 });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });

    // anchor clicks routed through lenis; #tijdlijn gets +50vh offset on >=1200px
    qa('a[href*="#"]', bar).forEach((a) => a.addEventListener('click', (e) => {
      const id = (a.getAttribute('href') || '').split('#')[1];
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      if (id === 'tijdlijn' && mm('(min-width: 1200px)')) {
        lenis.scrollTo(el.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.5, { duration: 1.2 });
      } else {
        lenis.scrollTo('#' + id, { duration: 1.2 });
      }
      if (navOpen) toggleNav();
    }));

    // FAQ pill. PORT GAP, not part of the transcribed spec: it is a <button> with
    // no href, so the a[href*="#"] handler above never matched it and it had no
    // listener at all. It went unnoticed while the three .faq-section__button
    // pills and the floating .faq__button were also opening the overlay; with
    // those removed this is the only trigger left, so it has to work.
    const faqBtn = q('.bottom-bar__faq-button', bar);
    if (faqBtn) faqBtn.addEventListener('click', () => store.openFaq());

    // mobile nav expand/collapse (spec: B5ZHsiyA w09)
    const label = q('.navigation__label');
    const list = q('.navigation__list');
    let navOpen = false;
    const toggleNav = () => {
      const items = qa('.navigation__item');
      if (!list) return;
      if (!navOpen) {
        navOpen = true;
        gsap.set(items, { opacity: 0, y: -10 });
        list.style.height = 'auto'; list.style.overflow = 'visible';
        const h = list.offsetHeight;
        list.style.height = '0px'; list.style.overflow = 'hidden';
        gsap.to(list, { height: h, duration: 0.3, ease: 'power2.inOut', onComplete: () => {
          list.style.height = 'auto'; list.style.overflow = 'visible';
          gsap.to(items, { opacity: 1, y: 0, duration: 0.25, stagger: 0.05, ease: 'power2.out' });
        } });
      } else {
        navOpen = false;
        gsap.to(items, { opacity: 0, y: -10, duration: 0.2, stagger: 0.05, ease: 'power2.in', onComplete: () => {
          gsap.to(list, { height: 0, duration: 0.25, ease: 'power2.inOut', onComplete: () => { list.style.overflow = 'hidden'; } });
        } });
      }
    };
    if (label) label.addEventListener('click', toggleNav);
  }

  /* ------------------------------------------------------------------ hero
   * Master intro timeline (paused, played on hands-lottie DOMLoaded), floating
   * title loop, button bob loop, hands scrub-out, sticker, CTA (spec: CRW8cIlN w00). */
  function initHero() {
    const hero = q('section.hero');
    if (!hero) return;
    const holder = q('.hero__hands-animation-holder');
    const title = q('.hero__title');
    const titleSpans = title ? qa('span', title) : [];
    const button = q('.hero__button');
    const buttonInner = q('.hero__button-inner');
    const buttonSpans = button ? qa('span', button) : [];
    const buttonBox = q('.hero__button-container');
    const sticker = q('.hero__sticker-container');
    const lines = q('.hero__lines-animation-holder');
    const stars = q('.hero__stars-animation-holder');

    // initial states (the chunk CSS carries most; these mirror the bundle's gsap.set)
    gsap.set(buttonSpans, { autoAlpha: 0 });
    if (holder) gsap.set(holder, { y: '100%' });

    let handsST = null;
    const buildHandsScrub = () => {
      if (!holder) return;
      const mobile = !mm('(min-width: 768px)');
      const end = window.innerHeight + holder.offsetHeight * (mobile ? 0.8 : 1.25);
      const stVars = {
        trigger: hero, start: 'top top', end: mobile ? 'bottom 60%' : 'bottom 25%', scrub: true,
        onLeave: () => { holder.style.display = 'none'; },
        onEnterBack: () => { holder.style.display = 'block'; },
      };
      handsST = (mobile
        ? gsap.fromTo(holder, { y: '25%' }, { y: end, autoAlpha: 0, ease: 'none', scrollTrigger: stVars })
        : gsap.fromTo(holder, { y: '25%' }, { y: end, ease: 'none', scrollTrigger: stVars })
      ).scrollTrigger;
    };
    window.addEventListener('resize', debounce(() => { if (handsST) { handsST.kill(); buildHandsScrub(); } }, 150));

    // endless title float (every keyframe recentres with xPercent/yPercent -50)
    const startTitleFloat = () => {
      if (!title) return;
      const f = gsap.timeline({ repeat: -1 });
      f.to(title, { yPercent: -50, xPercent: -50, y: -12, x: 6, duration: 2.5, ease: 'sine.inOut' });
      f.to(title, { yPercent: -50, xPercent: -50, y: -18, x: -4, duration: 2.8, ease: 'sine.inOut' });
      f.to(title, { yPercent: -50, xPercent: -50, y: -10, x: 3, duration: 2.3, ease: 'sine.inOut' });
      f.to(title, { yPercent: -50, xPercent: -50, y: 0, x: 0, duration: 2.6, ease: 'sine.inOut' });
    };
    // button bob: inner content dips 6% and back, .5s pause per cycle
    const startButtonBob = () => {
      if (!buttonInner) return;
      const v = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
      v.to(buttonInner, { yPercent: 6, duration: 0.6, ease: 'power1.inOut' });
      v.to(buttonInner, { yPercent: 0, duration: 0.6, ease: 'power1.inOut' });
    };

    // master intro timeline — exact steps and positions from the bundle
    const intro = gsap.timeline({ paused: true });
    intro.to(titleSpans, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'back.out(1.7)', stagger: 0.2 }, 0.25);
    if (holder) intro.to(holder, { y: '25%', duration: 1, ease: 'power4.out', onComplete: buildHandsScrub }, 0);
    if (button) intro.to(button, { scale: 1, duration: 0.7, ease: 'back.out(1.7)', onComplete: () => {
      store.resumeLenis();
      startTitleFloat();
      if (sticker) gsap.to(sticker, { opacity: 1, duration: 0.5 });
    } }, 0.5);
    if (button) intro.to(button, { width: 'auto', duration: 0.3, ease: 'power2.out' }, 1.2);
    intro.to(buttonSpans, { autoAlpha: 1, duration: 0.3, ease: 'power2.out', onComplete: startButtonBob }, 1.5);

    // lotties — data was prefetched at script eval; fall back to path: if a fetch died
    const killFlourish = (anim, el) => { if (anim) anim.destroy(); if (el) { el.innerHTML = ''; el.style.display = 'none'; } };
    Promise.all([heroData.hands, heroData.lines, heroData.stars]).then(([hd, ld, sd]) => {
      const make = (el, data, file, opts) => el && (data
        ? lottie.loadAnimation(Object.assign({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data }, opts))
        : loadLottie(el, file, opts));
      const linesAnim = make(lines, ld, '3-lijnen-voor-eerste-titelkaart.json', { loop: true });
      const starsAnim = make(stars, sd, '3-sterretjes-voor-eerste-titelkaart.json', { loop: true });
      // [G1] mobile hands variant not extracted; desktop JSON used at all widths
      const hands = make(holder, hd, 'hands.json', { renderer: 'canvas' });
      if (!hands) { intro.play(); return; }        // hero without hands holder still reveals
      onLottieReady(hands, () => {
        if (mm('(min-width: 768px)')) hands.play(); else hands.playSegments([0, 80], true);
        intro.play();
        if (linesAnim) { linesAnim.goToAndPlay(50, true); linesAnim.addEventListener('complete', () => killFlourish(linesAnim, lines)); }
        if (starsAnim) { starsAnim.goToAndPlay(20, true); starsAnim.addEventListener('complete', () => killFlourish(starsAnim, stars)); }
      });
    });

    // CTA scrolls to #wat-is-het
    if (button) button.addEventListener('click', () => lenis.scrollTo('#wat-is-het', { offset: 0, duration: 1.5 }));
    // sticker click scrolls to cards (#tijdlijn), +50vh on >=1200px
    if (sticker) sticker.addEventListener('click', () => {
      const t = document.getElementById('tijdlijn');
      if (!t) return;
      if (mm('(min-width: 1200px)')) lenis.scrollTo(t.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.5, { duration: 1.2 });
      else lenis.scrollTo('#tijdlijn', { duration: 1.2 });
    });
    // button container ducks 100px while the bottom bar is visible
    store.watch((key, v) => {
      if (key !== 'showBottomBar' || !buttonBox) return;
      gsap.to(buttonBox, { y: v ? 100 : 0, duration: 0.4, ease: 'power2.out' });
    });
  }

  /* ------------------------------------------------------------- airplanes */
  function initAirplanes() {
    const section = q('.airplanes__container');
    if (!section) return;
    const textBox = q('.airplanes__text-container');
    const titleEl = q('.airplanes__title');
    const inner = q('.animation-inner');
    const plane1 = q('.airplane1__image-container');
    const plane1Holder = q('.airplane1__animation-container');
    const plane2 = q('.airplane2__image-container');
    const plane2Holder = q('.airplane2__animation-container');

    if (textBox) ScrollTrigger.create({ trigger: textBox, start: 'center center', endTrigger: section, end: 'bottom bottom', pin: true, anticipatePin: 1 });

    if (titleEl) gsap.fromTo(titleEl.children, { autoAlpha: 0, y: 30 }, {
      autoAlpha: 1, y: 0, duration: 1.2, ease: 'back.out(1.7)', stagger: 0.2,
      scrollTrigger: { trigger: titleEl, start: 'top 80%', endTrigger: section, end: 'center center', scrub: true },
    });

    if (inner) {
      const innerAnim = loadLottie(inner, 'spreekwolkje-pre-comp-1.json', { renderer: 'canvas' });
      let played = false;
      ScrollTrigger.create({ trigger: inner, start: 'top 75%', onEnter: () => {
        if (!innerAnim || played) return;
        innerAnim.goToAndPlay(0, true);
        gsap.to(inner, { autoAlpha: 1, duration: 0.2, ease: 'power4.out' });
        played = true;
      } });
    }

    if (plane1 && textBox) {
      gsap.fromTo(plane1, { x: '-100%', y: '100%' }, { x: '300%', y: '-200%', ease: 'none',
        scrollTrigger: { trigger: textBox, start: 'center 51%', endTrigger: section, end: 'top -50%', scrub: true } });
      gsap.set(plane1, { autoAlpha: 1 });
    }
    if (plane1Holder) loadLottie(plane1Holder, 'roze-vliegtuig-vector.json', { renderer: 'canvas', loop: true, autoplay: true });
    if (plane2) gsap.to(plane2, { x: '-80vw', scale: 0.4, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (plane2Holder) loadLottie(plane2Holder, 'groene-vliegtuig.json', { loop: true, autoplay: true });
  }

  /* ---------------------------------------------------------------- puzzle */
  function initPuzzle() {
    const section = q('.puzzle-section');
    if (!section) return;
    const content = q('.puzzle-section__content-container');
    const icon = q('.puzzle-section__top-title-icon');
    const holder = q('.puzzle-section .image-container');
    const puzzleAnim = holder && loadLottie(holder, 'puzzle-16-9-json.json');

    if (icon && content) gsap.to(icon, {
      rotationX: 0, autoAlpha: 1, duration: 0.75, ease: 'power2.out', transformOrigin: 'center center',
      scrollTrigger: { trigger: content, start: 'top 85%' },
      onStart() { gsap.to('.image-container', { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out' }); },
      onComplete: () => { puzzleAnim && puzzleAnim.goToAndPlay(0, true); },
    });

    const wirePins = () => {
      let start = 'center center';
      if (mm('(max-width: 1023px)')) start = `center+=${window.innerWidth * 0.055}px center`;
      ScrollTrigger.create({
        trigger: section, start, end: '+=80%', pin: true, anticipatePin: 1,
        onLeave: () => requestAnimationFrame(() => {
          gsap.set(section, { autoAlpha: 0 });
          const cards = q('.cards-block'); if (cards) cards.style.opacity = '1';
        }),
        onEnterBack: () => requestAnimationFrame(() => {
          const cards = q('.cards-block'); if (cards) cards.style.opacity = '0';
        }),
      });
      gsap.to(section, { autoAlpha: 0, duration: 1.2, ease: 'power4.in',
        scrollTrigger: { trigger: section, start: 'center center', end: '+=79%', scrub: true,
          onLeave: () => {
            gsap.set(section, { autoAlpha: 0 });
            const cards = q('.cards-block'); if (cards) cards.style.opacity = '1';
          } } });
    };
    // original creates these inside the puzzle lottie's DOMLoaded
    if (puzzleAnim) puzzleAnim.addEventListener('DOMLoaded', wirePins); else wirePins();
  }

  /* -------------------------------------------------------- page transition
   * Full-screen wipe scrubbed over the puzzle->cards boundary: trigger
   * .puzzle-section center center, end +=125%, 25% dead zone (spec: CRW8cIlN w08). */
  function initPageTransition() {
    const holder = q('.page-transition__animation');
    const puzzle = q('.puzzle-section');
    if (!holder || !puzzle) return;
    // [G2] portrait variant not extracted; landscape wipe used for both orientations
    const wipe = loadLottie(holder, 'wipe-transition-2.json', { rendererSettings: { preserveAspectRatio: 'xMidYMid slice' } });
    wipe.addEventListener('DOMLoaded', () => {
      const total = wipe.totalFrames;      // 321 in the original portrait data
      ScrollTrigger.create({
        trigger: puzzle, start: 'center center', end: '+=125%', scrub: true,
        onUpdate: (self) => {
          const p = self.progress, dead = 0.25;
          if (p <= dead) wipe.goToAndStop(0, true);
          else wipe.goToAndStop(Math.round(((p - dead) / (1 - dead)) * (total - 1)), true);
        },
      });
    });
  }

  /* ----------------------------------------------------------------- cards
   * Desktop (>=1024): pin title + card1 until card2 reaches center 65%;
   * rotation scrubs 7.68->-5.68 and -6.96->6.96. Mobile: smaller scrubs, no pin.
   * EXTENSION: cards 3/4 follow the same alternating pattern; the pins run to the
   * LAST card so the whole stack passes the pinned first card (ROW has 4 features). */
  function initCards() {
    const block = q('.cards-block');
    if (!block) return;
    const title = q('.cards-block__title');
    const cards = qa('.cards-block__card', block);
    if (!cards.length) return;
    const last = cards[cards.length - 1];

    /* One animation per card, keyed off the card's own heading. The original
     * design had two cards and alternated two files; ROW has four, so the pair
     * repeated (stopwatch, speedometer, stopwatch, speedometer). Keyed by title
     * rather than index so reordering the cards can't mismatch the visuals.
     * Unknown titles fall back to the container class, leaving any other
     * section that uses these containers untouched. */
    /* Bespoke SVG per card, keyed off the card's own heading. The Lottie library
     * is fully consumed by other sections, so reusing any of it here duplicated
     * a visual already on the page — these four are drawn for these cards only,
     * in the brand palette, and animate via CSS inside the file. */
    const CARD_ART = {
      'PUBLIC IMAGE': 'card-public-image.svg',
      COMMUNICATION: 'card-communication.svg',
      'E-GOVERNANCE': 'card-e-governance.svg',
      'DISTRICT MODULE': 'card-district-module.svg',
    };
    qa('.stopwatch__animation-container, .speedometer__animation-container').forEach((el) => {
      const heading = el.closest('.cards-block__card')?.querySelector('.card-block__card-content-title');
      const art = heading && CARD_ART[heading.textContent.trim().toUpperCase()];
      if (art) {
        const img = document.createElement('img');
        img.src = `assets/images/${art}`;
        img.alt = '';
        img.className = 'cards-block__card-art';
        el.appendChild(img);
        return;
      }
      /* Unknown card: keep the original Lottie so other sections are untouched. */
      loadLottie(el, el.classList.contains('stopwatch__animation-container')
        ? 'brand-fast-stopwatch.json'
        : 'brand-fast-speedometer.json', { loop: true, autoplay: true });
    });

    if (mm('(min-width: 1024px)')) {
      // STACKING (designed extension — the original had only 2 cards, so only card 1
      // ever pinned; with 4, unpinned middle cards streamed past the pile instead of
      // joining it). Every card except the last pins where it lands — card 1 at the
      // original 'center 40%', later cards at 'center 65%', which is exactly where the
      // original pair sat overlapped in their final held state — and all of them
      // release together when the LAST card reaches 'center 65%', as the pair did.
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return;
        ScrollTrigger.create({
          trigger: card, start: i === 0 ? 'center 40%' : 'center 65%',
          endTrigger: last, end: 'center 65%', pin: true, anticipatePin: 1,
        });
      });
      if (title) ScrollTrigger.create({ trigger: title, start: 'center center', endTrigger: last, end: 'center 65%', pin: true, anticipatePin: 1 });
      cards.forEach((card, i) => {
        if (i === 0) {
          gsap.fromTo(card, { rotate: 7.68 }, { rotate: -5.68, ease: 'none',
            scrollTrigger: { trigger: card, start: 'top bottom', end: 'center 40%', scrub: true } });
        } else {
          const odd = i % 2 === 1;   // card2 pattern for even indices, card1 pattern mirrored
          gsap.fromTo(card, { rotate: odd ? -6.96 : 7.68 }, { rotate: odd ? 6.96 : -5.68, ease: 'none',
            scrollTrigger: { trigger: card, start: 'top bottom', end: 'center 65%', scrub: true } });
        }
      });
    } else {
      cards.forEach((card, i) => {
        const odd = i % 2 === 1;
        gsap.fromTo(card, { rotate: odd ? -6.96 : 7.68 }, { rotate: odd ? -0.96 : 1.68, ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }
  }

  /* ------------------------------------------------------------- faq tiles
   * Three pinned blocks. Each: pin center-center for +=50% (pinSpacing:false),
   * word-bg scaleX pop on first enter, holder zoom scrub 1.8->1, and per-page
   * lottie choreography (loop vs frame-scrub 0-60 / play 61-100 / idle 100-200). */
  function initFaqTiles() {
    const blocks = qa('.faq-section__block');
    // b2c tiles 2 and 3 SWAPPED on request (fingerpress now on tile 2, padlock on
    // tile 3). The behaviour arrays travel with the files: the 0-60 scrub / 61-100
    // playout / 100-200 idle choreography belongs to the padlock data, the
    // fingerpress loops autonomously — swapping only the files would have scrubbed
    // a looping animation and looped a scrubbed one.
    const files = IS_B2B
      ? ['padlock.json', 'brand-anytime.json', 'brand-availability-2.json']
      : ['click-hand-16-9-json.json', 'fingerpress-16-9-json.json', 'padlock.json'];
    // which blocks loop autonomously vs scrub by frame (from the bundle's per-page branches)
    const looping = IS_B2B ? [false, true, false] : [true, true, false];
    const segmentLoopAfterPlay = IS_B2B ? [false, false, true] : [false, false, false];

    blocks.forEach((block, i) => {
      const holder = q('.faq-section__animation', block);
      const wordBg = q('.word-bg', block);
      const faqBtn = q('.faq-section__button', block);
      let popped = false;

      const mobileButtonReveal = () => {
        if (!faqBtn || mm('(min-width: 1024px)')) return;
        const spans = qa('span', faqBtn);
        gsap.to(faqBtn, { scale: 1, duration: 0.7, ease: 'back.out(1.7)' });
        gsap.to(faqBtn, { width: 'auto', duration: 0.3, delay: 0.7, ease: 'power2.out' });
        gsap.to(spans, { autoAlpha: 1, duration: 0.9, delay: 1, ease: 'power2.out' });
      };

      const wirePin = (handlers) => ScrollTrigger.create(Object.assign({
        trigger: block, start: 'center center', end: '+=50%', pin: true, anticipatePin: 1, pinSpacing: false,
        onEnter: () => {
          if (popped) return;
          popped = true;
          if (wordBg) gsap.to(wordBg, { scaleX: 1, duration: 0.5, ease: 'power2.out', transformOrigin: 'left center' });
          mobileButtonReveal();
        },
      }, handlers || {}));

      const wireZoom = () => holder && gsap.fromTo(holder, { scale: 1.8 }, { scale: 1, ease: 'none',
        scrollTrigger: { trigger: block, start: 'top center', end: '+=50%', scrub: true } });

      if (!holder) { wirePin(); wireZoom(); return; }
      // tag the holder with its animation so CSS can normalize visual sizes —
      // the portrait padlock otherwise renders much larger than the 16:9 clips
      holder.dataset.anim = files[i].replace('.json', '');
      const anim = loadLottie(holder, files[i], { loop: looping[i], autoplay: looping[i] });

      anim.addEventListener('DOMLoaded', () => {
        // desktop floating FAQ button events differ per block/page; middle tile hides on back
        const evts = {};
        if (i === 1) evts.onEnterBack = () => bus.$event('faq-section:hide-button', 'done');
        if (IS_B2B && i === 2) {
          evts.onLeave = () => bus.$event('faq-section:hide-button', 'done');
          evts.onEnterBack = () => bus.$event('faq-section:show-button', 'done');
        }
        wirePin(evts);
        wireZoom();

        if (segmentLoopAfterPlay[i]) {
          // b2b block3: play once from 0, then loop [57, end] forever; rewind above block
          let started = false, onComplete = null, inst = anim;
          ScrollTrigger.create({ trigger: block, start: 'center center', onEnter: () => {
            if (!inst || started) return;
            inst.goToAndPlay(0, true); started = true;
            onComplete = () => { inst && (inst.playSegments([57, inst.totalFrames - 1], true), inst.setLoop(true)); };
            inst.addEventListener('complete', onComplete);
          } });
          ScrollTrigger.create({ trigger: block, start: 'top bottom', onLeaveBack: () => {
            if (!inst || !started) return;
            inst.destroy(); started = false; onComplete = null;
            inst = loadLottie(holder, files[i]);
          } });
        } else if (!looping[i]) {
          // frame scrub: 15% dead zone -> frames 0-60; on leave play 61-100 then idle 100-200
          let rafId = 0;
          const idleLoop = () => {
            const lo = 100, hi = 200, step = 0.5;
            let f = lo;
            const tick = () => { anim && (anim.goToAndStop(Math.floor(f), true), f += step, f > hi && (f = lo), rafId = requestAnimationFrame(tick)); };
            tick();
          };
          const playOut = () => {
            let f = 61;
            const tick = () => {
              if (!anim) return;
              anim.goToAndStop(f, true);
              f += 1;
              if (f <= 100) rafId = requestAnimationFrame(tick); else idleLoop();
            };
            tick();
          };
          ScrollTrigger.create({
            trigger: block, start: 'top bottom', end: 'center center-=20%', pinSpacing: false,
            onUpdate: (self) => {
              cancelAnimationFrame(rafId);
              const p = self.progress, dead = 0.15;
              if (p <= dead) anim.goToAndStop(0, true);
              else anim.goToAndStop(Math.round(((p - dead) / (1 - dead)) * (61 - 1)), true);
            },
            onLeave: () => { bus.$event('faq-section:show-button', 'done'); playOut(); },
          });
        }
      });
    });
  }

  /* ------------------------------------------------- floating faq button
   * Desktop-only pill toggled by faq-section events; opens the overlay. */
  function initFaqButton() {
    const box = q('.faq__button-container');
    const btn = q('.faq__button');
    if (!box || !btn) return;
    const spans = qa('span', btn);
    const show = () => {
      gsap.killTweensOf([btn, spans]);
      gsap.to(btn, { scale: 1, duration: 0.7, ease: 'back.out(1.7)' });
      gsap.to(btn, { width: 'auto', duration: 0.3, delay: 0.7, ease: 'power2.out' });
      gsap.to(spans, { autoAlpha: 1, duration: 0.9, delay: 1, ease: 'power2.out' });
    };
    const hide = () => {
      gsap.killTweensOf([btn, spans]);
      gsap.to(spans, { autoAlpha: 0, duration: 0.2, ease: 'power2.out' });
      gsap.to(btn, { width: mm('(min-width: 1024px)') ? '66px' : '50px', duration: 0.2, delay: 0.1, ease: 'power2.out' });
      gsap.to(btn, { scale: 0, duration: 0.4, delay: 0.3, ease: 'back.in(1.7)' });
    };
    bus.$listen('faq-section:show-button', () => { if (mm('(min-width: 1024px)')) show(); });
    bus.$listen('faq-section:hide-button', () => { if (mm('(min-width: 1024px)')) hide(); });
    box.addEventListener('click', () => store.openFaq());
  }

  /* ------------------------------------------------------------ faq overlay
   * Open: scale/rotate in .5 power2.out, then nested Lenis for the list.
   * Close: back out .5 power2.in to y 150%. Accordion: measured-height expand. */
  function initFaqOverlay() {
    const overlay = q('.faq-overlay');
    if (!overlay) return;
    const container = q('.faq-overlay__container');
    let overlayLenis = null;
    let lastFocus = null;

    gsap.set(overlay, { scale: 0.4, rotate: 8, autoAlpha: 1, y: '150%', x: '0%', borderColor: '#1D1C1C' });

    const focusTrap = (e) => {
      if (e.key !== 'Tab') return;
      const els = qa('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', overlay)
        .filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    store.watch((key, open) => {
      if (key !== 'faqOpen') return;
      if (open) {
        lastFocus = document.activeElement;
        document.addEventListener('keydown', focusTrap);
        gsap.to(overlay, { duration: 0.5, scale: 1, rotate: 0, y: '0%', x: '0%', borderColor: '#FFFFFF', ease: 'power2.out',
          onComplete: () => {
            if (!overlayLenis && container) overlayLenis = new Lenis({ wrapper: container, content: q('.faq-overlay__content', overlay), autoRaf: true });
            const close = q('.faq-overlay__close-button', overlay);
            close && close.focus();
          } });
      } else {
        document.removeEventListener('keydown', focusTrap);
        if (overlayLenis) { overlayLenis.destroy(); overlayLenis = null; }
        gsap.to(overlay, { duration: 0.5, scale: 0.4, rotate: 8, y: '150%', x: '0%', borderColor: '#1D1C1C', ease: 'power2.in',
          onComplete: () => { lastFocus && lastFocus.focus(); lastFocus = null; } });
      }
    });

    qa('.faq-overlay__close-button', overlay).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); store.closeFaq(); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && store.faqOpen) store.closeFaq(); });

    // "We have the answer" pills open the overlay; the footer FAQ tile now
    // NAVIGATES to faq.html instead (it is an <a> — its href does the work).
    qa('.faq-section__button').forEach((t) =>
      t.addEventListener('click', () => store.openFaq()));
  }

  /* -------------------------------------------------------- faq accordions
   * Hoisted out of the overlay so the same measured-height accordion works on
   * the standalone faq.html page, where there is no .faq-overlay wrapper. */
  function initFaqAccordions() {
    qa('.faq-overlay__faq-item').forEach((item) => {
      const btn = q('.faq-overlay__question', item);
      const answer = q('.faq-overlay__answer', item);
      if (!btn || !answer) return;
      gsap.set(answer, { height: 0, overflow: 'hidden' });
      btn.addEventListener('click', () => {
        const active = item.classList.contains('faq-overlay__faq-item--active');
        if (active) {
          item.classList.remove('faq-overlay__faq-item--active');
          btn.setAttribute('aria-expanded', 'false');
          gsap.to(answer, { height: 0, duration: 0.3, ease: 'power2.inOut' });
        } else {
          item.classList.add('faq-overlay__faq-item--active');
          btn.setAttribute('aria-expanded', 'true');
          answer.style.height = 'auto';
          const h = answer.offsetHeight;
          answer.style.height = '0px';
          gsap.to(answer, { height: h, duration: 0.3, ease: 'power2.inOut', onComplete: () => { answer.style.height = 'auto'; } });
        }
      });
    });
  }

  /* --------------------------------------------------- subscribe + download
   * ROW sections. Entrances ride the site's own reveal system (data attrs in
   * the markup + row.css states); this adds the hand-authored SVG motion in
   * the same idiom as the rest of the page. */
  function initSubscribe() {
    const badge = q('.subscribe-card__badge');
    if (!badge) return;
    gsap.set(badge, { scale: 0, rotation: -12 });
    ScrollTrigger.create({
      trigger: badge, start: 'top 85%', once: true,
      onEnter: () => gsap.to(badge, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.7)' }),
    });
  }
  function initDownload() {
    const arrow = q('.download-arrow');
    if (arrow) {
      // same bob idiom as the hero button inner
      const t = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
      t.to(arrow, { y: 10, duration: 0.6, ease: 'power1.inOut' });
      t.to(arrow, { y: 0, duration: 0.6, ease: 'power1.inOut' });
    }
    const phone = q('.download-section__phone');
    if (phone) {
      gsap.set(phone, { autoAlpha: 0, y: 40 });
      ScrollTrigger.create({
        trigger: phone, start: 'top 85%', once: true,
        onEnter: () => gsap.to(phone, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }),
      });
    }
  }

  /* --------------------------------------------------------------- partners
   * The partners section was removed from index.html on request; every hook here
   * null-guards, and the app__background fade retargets to the next section so the
   * gradient still hands off before the dark closer. */
  function initPartners() {
    const section = q('.partners-section');
    const icon = q('.partners-section__top-title-icon');
    const banks = q('.banks-animation-container');
    const bg = q('.app__background');

    if (icon) gsap.to(icon, { rotationX: 0, opacity: 1, duration: 0.75, ease: 'power2.out', transformOrigin: 'center center',
      scrollTrigger: { trigger: icon, start: 'top 85%' } });

    if (banks) {
      const anim = loadLottie(banks, 'bank-16-9-json.json');
      let played = false;
      anim.addEventListener('DOMLoaded', () => {
        ScrollTrigger.create({ trigger: banks, start: 'top center', onEnter: () => {
          if (!anim || played) return;
          anim.playSegments([0, 180], true); played = true;
        } });
      });
    }

    const fadeTrigger = section || q('.fist-bump-section');
    if (bg && fadeTrigger) gsap.to(bg, { opacity: 0, ease: 'power2.out', transformOrigin: 'center center',
      scrollTrigger: { trigger: fadeTrigger, start: 'top center', end: 'top top', scrub: true } });
  }

  /* --------------------------------------------------------------- fistbump */
  function initFistBump() {
    const section = q('.fist-bump-section');
    if (!section) return;
    const content = q('.fist-bump-section__content');
    const title = q('.fist-bump-section__title');
    const mainHolder = q('.fist-bump-section__animation');
    const burstHolder = q('.fist-bump-section__start-lines-animation');

    const main = mainHolder && loadLottie(mainHolder, 'fists.json');
    const burst = burstHolder && loadLottie(burstHolder, 'lines-en-starts-for-fists.json');
    let burstArmed = false;
    if (burst) burst.addEventListener('complete', () => { burst.stop(); burstArmed = false; });

    if (title) gsap.fromTo(title.children, { autoAlpha: 0, y: 30 }, {
      autoAlpha: 1, y: 0, duration: 1.2, ease: 'back.out(1.7)', stagger: 0.2,
      scrollTrigger: { trigger: title, start: 'top 80%', endTrigger: title, end: 'bottom center', scrub: true, refreshPriority: -1 },
    });

    if (main && content) ScrollTrigger.create({
      trigger: section, start: 'top 50%', endTrigger: content, end: 'bottom 25%', scrub: true,
      onUpdate: (self) => {
        const total = main.totalFrames;
        const frame = Math.round(self.progress * (total - 1));
        main.goToAndStop(frame, true);
        if (frame > 158 && frame < 162 && !burstArmed && burst) { burstArmed = true; burst.play(); }
      },
    });
  }

  /* ------------------------------------------------------------------ video
   * Reveal tweens transcribed; [G4] Swiper/Plyr players intentionally skipped
   * (the three Q&A clips are excluded from this project — posters render). */
  function initVideo() {
    const content = q('.video-section__content-container');
    const icon = q('.video-section__top-title-icon');
    if (!icon || !content) return;
    gsap.to(icon, { rotationX: 0, autoAlpha: 1, duration: 0.75, ease: 'power2.out', transformOrigin: 'center center',
      scrollTrigger: { trigger: content, start: 'top 85%' },
      onStart() { gsap.to('.video-section__videos', { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power2.out' }); } });
  }

  /* ----------------------------------------------------------------- footer
   * Per-tile icon flips gated on images having loaded. [G3] footer lottie skipped. */
  function initFooter() {
    const blocks = qa('.block-reveal');
    if (!blocks.length) return;
    const fire = () => blocks.forEach((d) => gsap.to(qa('.icon-reveal', d), {
      rotationX: 0, autoAlpha: 1, duration: 0.75, ease: 'power2.out', transformOrigin: 'center center',
      scrollTrigger: { trigger: d, start: 'top 70%' },
    }));
    const imgs = qa('img').filter((im) => !im.complete);
    if (!imgs.length) { fire(); return; }
    let left = imgs.length;
    const done = () => { left -= 1; if (left <= 0) fire(); };
    imgs.forEach((im) => { im.addEventListener('load', done); im.addEventListener('error', done); });
  }

  /* ------------------------------------------------------------------ boot */
  const boot = () => {
    initScrollProgress();
    initHeader();
    initBottomBar();
    initHero();
    initAirplanes();
    initPuzzle();
    initPageTransition();
    initCards();
    initFaqTiles();
    initFaqButton();
    initFaqOverlay();
    initFaqAccordions();
    initSubscribe();
    initDownload();
    initPartners();
    initFistBump();
    initVideo();
    initFooter();
    initReveals();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Reload-position guard. The browser applies scroll RESTORATION after this script's
  // early scrollTo(0,0), and Lenis then adopts the restored position as its target —
  // so a reload mid-page landed on whatever section you left, not the hero. The head
  // snippet claims scrollRestoration='manual' before first paint; this re-asserts top
  // once the restoration window has closed, then refreshes triggers at true geometry.
  window.addEventListener('load', () => {
    window.scrollTo(0, 0);
    lenis.scrollTo(0, { immediate: true });
    ScrollTrigger.refresh();
  });
})();
