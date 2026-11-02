// TEMP test timeline (replaced later)
window.MV_TIMELINE = function (A, T) {
  return { shots: [{ scene: '_test', start: 0, end: 300, seed: 0.5, params: [0, 0, 0, 0], intensity: 0.8 }],
    fx: (t, f, au) => ({ uZoom: au.aKick * 0.03 }), text: null };
};
