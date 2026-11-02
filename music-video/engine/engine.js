// Music-video engine: WebGL2 scene shaders -> transition compositor -> post FX.
// Deterministic per frame index (30 fps). Used by both the offline renderer
// (headless Chromium, render/render.js) and the live player (engine/live.html).
(function () {
  'use strict';
  const FPS = 30;
  let gl, W, H, A = null, SPEC = null, NF = 0, BASE = '..';
  let progs = {}, sceneSrc = {}, commonSrc = '', transProg = null, postProg = null;
  let specTex, textTex, textCanvas, textCtx, textDirty = false, bloomProg = null, bloomRT = null;
  let comp = null, post = [], postIdx = 0;
  const targets = new Map();
  let TL = null;           // active timeline object { shots, fx(t,f,au,shot), text(ctx,t,f,au,W,H) }
  let lastFX = {};
  const DBG = {};

  const VS = '#version 300 es\nlayout(location=0) in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';

  async function fetchText(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('fetch ' + u + ' -> ' + r.status); return r.text(); }
  async function fetchBuf(u) { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('fetch ' + u + ' -> ' + r.status); return r.arrayBuffer(); }

  function compileShader(type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('[shader compile error in ' + name + ']\n' + log);
    }
    return s;
  }
  function makeProgram(fs, name) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, VS, name + ':vs'));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('[link error in ' + name + '] ' + gl.getProgramInfoLog(p));
    const uni = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      uni[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type };
    }
    return { p, uni, name };
  }
  function setU(pr, name, v) {
    const u = pr.uni[name]; if (!u) return;
    switch (u.type) {
      case gl.FLOAT: gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      case gl.INT: case gl.SAMPLER_2D: case gl.BOOL: gl.uniform1i(u.loc, v | 0); break;
      default: break;
    }
  }

  function makeTarget(w, h, { float = true, mip = false } = {}) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const levels = mip ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
    gl.texStorage2D(gl.TEXTURE_2D, levels, float ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete ' + st);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h };
  }
  function freeTarget(t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }

  function sceneProgram(name) {
    if (progs[name]) return progs[name];
    const src = sceneSrc[name];
    if (src == null) throw new Error('scene not loaded: ' + name);
    const fs = '#version 300 es\n' + commonSrc + '\n#line 1\n' + src +
      '\nvoid main(){ vec4 c = vec4(0.); mainImage(c, gl_FragCoord.xy);\n' +
      '  if (any(isnan(c)) || any(isinf(c))) c = vec4(0.);\n' +
      '  mv_FragColor = vec4(clamp(c.rgb, 0., 64.), 1.); }\n';
    progs[name] = makeProgram(fs, 'scenes/' + name + '.glsl');
    return progs[name];
  }

  async function loadScene(name, force) {
    if (sceneSrc[name] != null && !force) return;
    sceneSrc[name] = await fetchText(BASE + '/scenes/' + name + '.glsl');
    delete progs[name];
    sceneProgram(name);
  }

  // ---------------------------------------------------------------- audio
  function audioAt(f) {
    f = Math.max(0, Math.min(NF - 1, f | 0));
    const T = A.tracks, g = (k) => (T[k] ? T[k][f] : 0);
    return {
      f, aKick: g('kick'), aSnare: g('snare'), aHat: g('hat'), aBeat: g('beat'),
      aSub: g('sub'), aBass: g('bass'), aLowMid: g('lowmid'), aMid: g('mid'), aHigh: g('high'), aAir: g('air'),
      aRms: g('rms'), aEnergy: g('energy'), aEnergySlow: g('energy_slow'), aCentroid: g('centroid'), aOnset: g('onset'),
      aBeatPhase: g('beat_phase'), aBarPhase: g('bar_phase'), aBeatCount: g('beat_index'),
      aBarCount: Math.floor(g('beat_index') / 4), aKickAcc: g('kick_acc'), aEnergyAcc: g('energy_acc'), aBassAcc: g('bass_acc'),
    };
  }
  const AUDIO_KEYS = ['aKick', 'aSnare', 'aHat', 'aBeat', 'aSub', 'aBass', 'aLowMid', 'aMid', 'aHigh', 'aAir', 'aRms', 'aEnergy', 'aEnergySlow',
    'aCentroid', 'aOnset', 'aBeatPhase', 'aBarPhase', 'aBeatCount', 'aBarCount', 'aKickAcc', 'aEnergyAcc', 'aBassAcc'];

  // ---------------------------------------------------------------- draw helpers
  function drawQuad() { gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

  const DEFAULT_PAL = [[0.035, 0.012, 0.11], [0.22, 0.26, 1.0], [0.10, 0.42, 0.45], [1.0, 0.12, 0.55]];

  function getShotTarget(shot, f) {
    let t = targets.get(shot.id);
    if (!t) {
      t = { rt: [makeTarget(W, H), makeTarget(W, H)], idx: 0, last: -999 };
      targets.set(shot.id, t);
    }
    if (f <= t.last || f - t.last > 15) {   // non-contiguous -> reset feedback
      for (const r of t.rt) { gl.bindFramebuffer(gl.FRAMEBUFFER, r.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    return t;
  }

  function renderShot(shot, f, t, au) {
    const tg = getShotTarget(shot, f);
    const read = tg.rt[tg.idx], write = tg.rt[1 - tg.idx];
    const pr = sceneProgram(shot.scene);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
    gl.viewport(0, 0, W, H);
    gl.useProgram(pr.p);
    bindTex(0, read.tex); setU(pr, 'iPrev', 0);
    bindTex(1, specTex); setU(pr, 'iSpectrum', 1);
    bindTex(2, textTex); setU(pr, 'iText', 2);
    const rs = shot.renderStart;
    setU(pr, 'iResolution', [W, H]);
    setU(pr, 'iTime', t);
    setU(pr, 'iLocal', t - rs);
    setU(pr, 'iShotLen', shot.end - rs);
    setU(pr, 'iProgress', (t - rs) / Math.max(1e-3, shot.end - rs));
    setU(pr, 'iFrame', f);
    setU(pr, 'iSeed', shot.seed || 0);
    setU(pr, 'iParams', shot.params || [0, 0, 0, 0]);
    setU(pr, 'iIntensity', shot.intensity != null ? shot.intensity : 0.5);
    const P = shot.pal || DEFAULT_PAL;
    setU(pr, 'cA', P[0]); setU(pr, 'cB', P[1]); setU(pr, 'cC', P[2]); setU(pr, 'cD', P[3]);
    for (const k of AUDIO_KEYS) setU(pr, k, au[k]);
    drawQuad();
    tg.idx = 1 - tg.idx; tg.last = f;
    return write.tex;
  }

  const POST_DEFAULTS = {
    uExposure: 1.0, uBloom: 0.9, uBloomThr: 0.55, uChroma: 0.002, uGlitch: 0, uGrain: 0.06, uVignette: 0.35, uScan: 0,
    uFlash: 0, uInvert: 0, uAfter: 0, uZoom: 0, uLetterbox: 0, uContrast: 1.05, uSat: 1.0, uWarp: 0, uPixelate: 0,
    uMirror: 0, uRoll: 0, uShake: [0, 0], uTint: [1, 1, 1], uLift: [0, 0, 0],
    uTextColor: [1, 1, 1], uTextGlow: 0.6, uTextMode: 0, uTextGlitch: 0, uTextAlpha: 1,
  };

  function updateSpectrum(f) {
    f = Math.max(0, Math.min(NF - 1, f));
    gl.bindTexture(gl.TEXTURE_2D, specTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.RED, gl.UNSIGNED_BYTE, SPEC.subarray(f * 64, f * 64 + 64));
  }

  function updateText(t, f, au, shot) {
    textCtx.setTransform(1, 0, 0, 1, 0, 0);
    textCtx.clearRect(0, 0, W, H);
    let drew = false;
    if (TL && TL.text) drew = !!TL.text(textCtx, t, f, au, W, H, shot);
    if (drew || textDirty) {
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    textDirty = drew;
    return drew;
  }

  function activeShots(t) {
    const out = [];
    for (const s of TL.shots) if (t >= s.renderStart && t < s.end) out.push(s);
    out.sort((a, b) => a.start - b.start);
    return out.slice(-2);
  }

  // ---------------------------------------------------------------- main frame
  function renderFrame(f) {
    const t = f / FPS;
    const au = audioAt(f);
    updateSpectrum(f);
    const act = activeShots(t);
    if (!act.length) act.push({ id: '__black', scene: '__black', start: 0, end: 1e9, renderStart: 0 });
    const cur = act[act.length - 1];
    const hasText = updateText(t, f, au, cur);

    // free targets of finished shots
    for (const [id, tg] of targets) if (!act.find((s) => s.id === id) && tg.last < f - 2) { tg.rt.forEach(freeTarget); targets.delete(id); }

    if (DBG.noScene) return post[postIdx];
    const texs = act.map((s) => (s.scene === '__black' ? null : renderShot(s, f, t, au)));
    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, comp.fb);
    gl.viewport(0, 0, W, H);
    gl.useProgram(transProg.p);
    let mix = 0, type = -1, seed = 0;
    if (act.length === 2) {
      const B = act[1];
      const d = (B.transIn && B.transIn.dur) || 1e-3;
      mix = (t - B.renderStart) / d; type = (B.transIn && B.transIn.type) || 0; seed = B.seed || 0;
    }
    bindTex(0, texs[0] || blackTex); setU(transProg, 'uA', 0);
    bindTex(1, (texs[1] || texs[0]) || blackTex); setU(transProg, 'uB', 1);
    setU(transProg, 'iResolution', [W, H]); setU(transProg, 'uMix', mix); setU(transProg, 'uType', type);
    setU(transProg, 'uSeed', seed); setU(transProg, 'iTime', t);
    drawQuad();
    if (!DBG.noMip) { gl.bindTexture(gl.TEXTURE_2D, comp.tex); gl.generateMipmap(gl.TEXTURE_2D); }

    if (DBG.noPost) return post[postIdx];
    const fx = Object.assign({}, POST_DEFAULTS, TL && TL.fx ? TL.fx(t, f, au, cur, act) : {});
    if (!hasText) fx.uTextAlpha = 0;
    lastFX = fx;
    // bloom + text glow prepass at 1/4 res
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomRT.fb);
    gl.viewport(0, 0, bloomRT.w, bloomRT.h);
    gl.useProgram(bloomProg.p);
    bindTex(0, comp.tex); setU(bloomProg, 'uComp', 0);
    bindTex(1, textTex); setU(bloomProg, 'uText', 1);
    setU(bloomProg, 'iResolution', [bloomRT.w, bloomRT.h]); setU(bloomProg, 'uBloomThr', fx.uBloomThr); setU(bloomProg, 'uTextOn', hasText ? 1 : 0);
    drawQuad();
    // post
    const prev = post[postIdx], out = post[1 - postIdx];
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, W, H);
    gl.useProgram(postProg.p);
    bindTex(0, comp.tex); setU(postProg, 'uComp', 0);
    bindTex(1, prev.tex); setU(postProg, 'uPrev', 1);
    bindTex(2, textTex); setU(postProg, 'uText', 2);
    bindTex(3, bloomRT.tex); setU(postProg, 'uBloomTex', 3);
    setU(postProg, 'iResolution', [W, H]); setU(postProg, 'iTime', t); setU(postProg, 'iFrame', f);
    for (const k in fx) setU(postProg, k, fx[k]);
    drawQuad();
    postIdx = 1 - postIdx;
    return out;
  }

  let blackTex = null;
  function blitToCanvas() {
    const src = post[postIdx];
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.COLOR_BUFFER_BIT, gl.LINEAR);
  }

  let pixBuf = null;
  function readFrameB64() {
    const src = post[postIdx];
    gl.bindFramebuffer(gl.FRAMEBUFFER, src.fb);
    if (!pixBuf) pixBuf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixBuf);
    if (pixBuf.toBase64) return pixBuf.toBase64();
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < pixBuf.length; i += CH) s += String.fromCharCode.apply(null, pixBuf.subarray(i, i + CH));
    return btoa(s);
  }

  // ---------------------------------------------------------------- public API
  async function init(opts) {
    W = opts.W || 1280; H = opts.H || 720; BASE = opts.base || '..';
    const canvas = opts.canvas || document.getElementById('c');
    canvas.width = opts.canvasW || W; canvas.height = opts.canvasH || H;
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    gl.getExtension('OES_texture_float_linear');
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const [common, postSrc, transSrc, analysis, spec, bloomSrc] = await Promise.all([
      fetchText(BASE + '/engine/common.glsl'), fetchText(BASE + '/engine/post.glsl'), fetchText(BASE + '/engine/transition.glsl'),
      opts.analysis ? Promise.resolve(opts.analysis) : fetchText(BASE + '/analysis/analysis.json').then(JSON.parse),
      fetchBuf(BASE + '/analysis/analysis_spectrum.u8'), fetchText(BASE + '/engine/bloom.glsl'),
    ]);
    commonSrc = common; A = analysis; NF = A.nframes; SPEC = new Uint8Array(spec);
    transProg = makeProgram('#version 300 es\n' + transSrc, 'engine/transition.glsl');
    postProg = makeProgram('#version 300 es\n' + postSrc, 'engine/post.glsl');
    bloomProg = makeProgram('#version 300 es\n' + bloomSrc, 'engine/bloom.glsl');

    specTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, specTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, 64, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    textCanvas = document.createElement('canvas'); textCanvas.width = W; textCanvas.height = H;
    textCtx = textCanvas.getContext('2d');
    textTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(W, H))) + 1, gl.RGBA8, W, H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textCtx.clearRect(0, 0, W, H); textDirty = true;

    comp = makeTarget(W, H, { float: true, mip: true });
    post = [makeTarget(W, H, { float: false }), makeTarget(W, H, { float: false })];
    bloomRT = makeTarget(Math.ceil(W / 4), Math.ceil(H / 4), { float: true });
    blackTex = makeTarget(4, 4).tex;

    if (document.fonts) {
      await Promise.all(['900 64px "Inter Display"', '800 64px "Inter Display"', '400 64px "JetBrains Mono"', '700 64px "JetBrains Mono"', '400 64px "MV Blackletter"']
        .map((f) => document.fonts.load(f).catch(() => null)));
    }
    return { W, H, NF, fps: FPS, tempo: A.tempo, duration: A.duration, renderer: gl.getParameter(gl.RENDERER) };
  }

  // Use the full timeline (window.MV_TIMELINE built from timeline.js)
  async function useTimeline(builder) {
    TL = builder(A, window.MVText || {});
    TL.shots.forEach((s, i) => {
      s.id = s.id || 'shot' + i;
      s.renderStart = s.start - ((s.transIn && s.transIn.dur) || 0);
    });
    const names = [...new Set(TL.shots.map((s) => s.scene))];
    for (const n of names) await loadScene(n);
    return { shots: TL.shots.length, scenes: names };
  }

  // Preview a single scene as one shot (for scene development)
  async function useSingleScene(o) {
    await loadScene(o.scene, true);
    const shot = {
      id: 'preview_' + o.scene + '_' + Math.random(), scene: o.scene, start: o.start, end: o.end, seed: o.seed || 0.37,
      params: o.params || [0, 0, 0, 0], intensity: o.intensity != null ? o.intensity : 0.8,
      pal: typeof o.pal === 'string' ? (window.MV_PALETTES || {})[o.pal] : (o.pal || null),
    };
    shot.renderStart = shot.start;
    const preset = o.fxPreset || 'neutral';
    TL = {
      shots: [shot],
      fx: (t, f, au) => {
        if (preset === 'raw') return { uBloom: 0, uGrain: 0, uVignette: 0, uChroma: 0, uContrast: 1 };
        if (preset === 'drop') return { uZoom: au.aKick * 0.035, uChroma: 0.002 + au.aSnare * 0.006 };
        return {};
      },
      text: o.text || null,
    };
    for (const [id, tg] of targets) { tg.rt.forEach(freeTarget); targets.delete(id); }
    return shot;
  }

  window.MV = {
    DBG, FPS, init, useTimeline, useSingleScene, loadScene, renderFrame, readFrameB64, blitToCanvas, audioAt,
    get analysis() { return A; }, get timeline() { return TL; }, get lastFX() { return lastFX; },
    renderAndRead(f) { renderFrame(f); return readFrameB64(); },
    // render frames [f0,f1) and POST raw RGBA (bottom-up) to url?i=<frame>; returns when all uploads finished
    async renderRangePost(f0, f1, url, maxInFlight) {
      maxInFlight = maxInFlight || 3;
      const inflight = [];
      const buf = new Uint8Array(W * H * 4);
      for (let f = f0; f < f1; f++) {
        renderFrame(f);
        gl.bindFramebuffer(gl.FRAMEBUFFER, post[postIdx].fb);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const p = fetch(url + '?i=' + f, { method: 'POST', body: new Blob([buf]) })
          .then((r) => { if (!r.ok) throw new Error('upload failed ' + f + ' ' + r.status); });
        inflight.push(p);
        if (inflight.length >= maxInFlight) await inflight.shift();
      }
      await Promise.all(inflight);
      return f1 - f0;
    },
    timeRender(f) { const t0 = performance.now(); renderFrame(f); const px = new Uint8Array(4); gl.bindFramebuffer(gl.FRAMEBUFFER, post[postIdx].fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; },
  };
})();
