void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - .5 * iResolution) / iResolution.y;
  float r = length(uv);
  float ring = smoothstep(.02, 0., abs(r - .2 - aKick * .2));
  vec3 col = cB * ring * 4. + cA + spec(fragCoord.x / iResolution.x) * step(fragCoord.y / iResolution.y, .2) * cD * 2.;
  vec3 prev = texture(iPrev, fragCoord / iResolution).rgb;
  fragColor = vec4(max(col, prev * .9), 1.);
}
