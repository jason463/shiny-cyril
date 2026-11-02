// Typography helpers for the text layer (Canvas2D, white glyphs; post colours them).
(function () {
  const ease = {
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    clamp01: (x) => Math.max(0, Math.min(1, x)),
  };
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  const FONTS = { display: '"Inter Display", "Inter", sans-serif', mono: '"JetBrains Mono", monospace', black: '"MV Blackletter", serif' };

  // fit text to a max width at a given weight; returns font size
  function fitSize(ctx, text, family, weight, maxW, maxSize) {
    ctx.font = `${weight} 100px ${family}`;
    const w = ctx.measureText(text).width || 1;
    return Math.min(maxSize, (100 * maxW) / w);
  }
  function setFont(ctx, size, family, weight, spacing) {
    ctx.font = `${weight} ${size}px ${family}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (spacing || 0) + 'px';
  }
  // scramble characters that haven't "resolved" yet (decode effect)
  function scramble(text, p, seed) {
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$/\\<>*+=?!';
    let s = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') { s += ' '; continue; }
      const th = (i + 1) / (text.length + 1);
      s += p >= th ? ch : glyphs[Math.floor(hash(seed + i * 7.3 + Math.floor(p * 40)) * glyphs.length)];
    }
    return s;
  }
  window.MVText = { ease, hash, FONTS, fitSize, setFont, scramble };
})();
