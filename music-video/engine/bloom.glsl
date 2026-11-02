// Low-res bloom + text-glow prepass (runs at 1/4 resolution; cheap on software GL).
precision highp float;
uniform sampler2D uComp, uText;
uniform vec2 iResolution;     // bloom target size
uniform float uBloomThr, uTextOn;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  vec3 bl = vec3(0.);
  bl += max(textureLod(uComp, uv, 2.).rgb - uBloomThr, 0.) * .45;
  bl += max(textureLod(uComp, uv, 3.).rgb - uBloomThr, 0.) * .36;
  bl += max(textureLod(uComp, uv, 4.).rgb - uBloomThr * .8, 0.) * .30;
  bl += max(textureLod(uComp, uv, 5.).rgb - uBloomThr * .7, 0.) * .26;
  bl += max(textureLod(uComp, uv, 6.).rgb - uBloomThr * .6, 0.) * .24;
  float tg = 0.;
  if (uTextOn > .5) tg = textureLod(uText, uv, 3.).a * .5 + textureLod(uText, uv, 5.).a * .9 + textureLod(uText, uv, 7.).a * 1.2;
  o = vec4(bl, tg);
}
