/**
 * The half of the look that happens after the scene is drawn.
 *
 * RenderPass → Bloom → TiltShift(H) → TiltShift(V) → Output. `OutputPass` has to be last:
 * it does the tone mapping and the sRGB conversion, and anything after it would be working
 * in the wrong space.
 *
 * The tilt-shift is a true screen-space one — blur ramps with distance from a horizontal
 * band — rather than depth-of-field. That is closer to what a shifted lens actually does,
 * it is much cheaper, and it is what gives the ward its "model of a street" read. If blur
 * driven by real scene depth is ever wanted, these two passes swap for a `BokehPass`.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LOOK } from './look.js';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    direction: { value: new THREE.Vector2(1, 0) },
    resolution: { value: new THREE.Vector2(1, 1) },
    focusCenter: { value: LOOK.tiltFocusCenter },
    focusWidth: { value: LOOK.tiltFocusWidth },
    falloff: { value: LOOK.tiltFalloff },
    maxBlur: { value: LOOK.tiltMaxBlur },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 direction;
    uniform vec2 resolution;
    uniform float focusCenter;
    uniform float focusWidth;
    uniform float falloff;
    uniform float maxBlur;
    varying vec2 vUv;

    void main() {
      float d = abs(vUv.y - focusCenter);
      float blur = smoothstep(focusWidth, focusWidth + falloff, d) * maxBlur;

      if (blur < 0.01) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 texel = direction / resolution * blur;
      vec4 sum = vec4(0.0);
      sum += texture2D(tDiffuse, vUv - texel * 4.0) * 0.0162162162;
      sum += texture2D(tDiffuse, vUv - texel * 3.0) * 0.0540540541;
      sum += texture2D(tDiffuse, vUv - texel * 2.0) * 0.1216216216;
      sum += texture2D(tDiffuse, vUv - texel * 1.0) * 0.1945945946;
      sum += texture2D(tDiffuse, vUv)               * 0.2270270270;
      sum += texture2D(tDiffuse, vUv + texel * 1.0) * 0.1945945946;
      sum += texture2D(tDiffuse, vUv + texel * 2.0) * 0.1216216216;
      sum += texture2D(tDiffuse, vUv + texel * 3.0) * 0.0540540541;
      sum += texture2D(tDiffuse, vUv + texel * 4.0) * 0.0162162162;
      gl_FragColor = sum;
    }
  `,
};

export interface PostChain {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  /** Pushes the current LOOK values into both blur passes. */
  syncTilt(width: number, height: number): void;
  setSize(width: number, height: number): void;
  dispose(): void;
}

export function buildPostChain(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): PostChain {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    LOOK.bloomStrength,
    LOOK.bloomRadius,
    LOOK.bloomThreshold,
  );
  composer.addPass(bloom);

  const tiltH = new ShaderPass(TiltShiftShader);
  tiltH.uniforms.direction.value.set(1, 0);
  composer.addPass(tiltH);

  // The vertical pass gets its own uniform block. Sharing one would make the two
  // directions fight over a single `direction` vector and blur on the diagonal.
  const tiltV = new ShaderPass({
    ...TiltShiftShader,
    uniforms: THREE.UniformsUtils.clone(TiltShiftShader.uniforms),
  });
  tiltV.uniforms.direction.value.set(0, 1);
  composer.addPass(tiltV);

  composer.addPass(new OutputPass());

  const syncTilt = (w: number, h: number): void => {
    for (const pass of [tiltH, tiltV]) {
      pass.enabled = LOOK.tiltEnabled;
      pass.uniforms.focusCenter.value = LOOK.tiltFocusCenter;
      pass.uniforms.focusWidth.value = LOOK.tiltFocusWidth;
      pass.uniforms.falloff.value = LOOK.tiltFalloff;
      pass.uniforms.maxBlur.value = LOOK.tiltMaxBlur;
      pass.uniforms.resolution.value.set(w, h);
    }
  };
  syncTilt(width, height);

  return {
    composer,
    bloom,
    syncTilt,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.resolution.set(w, h);
      syncTilt(w, h);
    },
    dispose() {
      composer.dispose();
      tiltH.dispose?.();
      tiltV.dispose?.();
      bloom.dispose?.();
    },
  };
}
