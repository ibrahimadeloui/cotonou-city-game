import {
  ClampToEdgeWrapping,
  Data3DTexture,
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

function makeLut(sunset) {
  const size = 16;
  const data = new Uint8Array(size * size * size * 4);
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        const i = ((b * size + g) * size + r) * 4;
        let R = r / (size - 1);
        let G = g / (size - 1);
        let B = b / (size - 1);
        const l = R * 0.2126 + G * 0.7152 + B * 0.0722;
        if (sunset) {
          R = Math.min(1, R * (0.86 + 0.4 * l) + 0.04 * l);
          G = Math.min(1, G * (0.8 + 0.12 * l));
          B = Math.min(1, B * (1.08 - 0.5 * l) + 0.08 * (1 - l));
        } else {
          R = Math.min(1, R * (0.96 + 0.16 * l));
          G = Math.min(1, G * (0.98 + 0.06 * (1 - l)));
          B = Math.min(1, B * (1.06 - 0.18 * l) + 0.05 * (1 - l));
        }
        data[i] = Math.round(R * 255);
        data[i + 1] = Math.round(G * 255);
        data[i + 2] = Math.round(B * 255);
        data[i + 3] = 255;
      }
    }
  }
  const tex = new Data3DTexture(data, size, size, size);
  tex.format = RGBAFormat;
  tex.type = UnsignedByteType;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.wrapR = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createPost(renderer, scene, camera, quality) {
  let tier = quality.tier;
  let grade = 'day';
  let composer = null;
  let lutPass = null;
  const luts = { day: makeLut(false), sunset: makeLut(true) };

  function rebuild() {
    composer?.dispose?.();
    const width = Math.max(2, window.innerWidth);
    const height = Math.max(2, window.innerHeight);
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const mobile = quality.mobile;
    if (!mobile && tier === 'haute') {
      const gtao = new GTAOPass(scene, camera, width, height);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.6;
      composer.addPass(gtao);
      composer.addPass(new SMAAPass(width * renderer.getPixelRatio(), height * renderer.getPixelRatio()));
    } else if (!mobile && tier === 'moyenne') {
      const ssao = new SSAOPass(scene, camera, width, height, 12);
      ssao.kernelRadius = 10;
      ssao.minDistance = 0.002;
      ssao.maxDistance = 0.1;
      composer.addPass(ssao);
    }
    if (!mobile) {
      const strength = tier === 'basse' ? 0.04 : tier === 'moyenne' ? 0.08 : 0.14;
      composer.addPass(new UnrealBloomPass(new Vector2(width, height), strength, 0.3, 0.9));
    }
    lutPass = new LUTPass({
      lut: grade === 'sunset' ? luts.sunset : luts.day,
      intensity: grade === 'sunset' ? 0.9 : 0.72,
    });
    composer.addPass(lutPass);
    composer.addPass(new OutputPass());
  }

  return {
    setTier(next) {
      tier = next;
      composer = null;
    },
    setGrade(next) {
      grade = next === 'sunset' ? 'sunset' : 'day';
      if (lutPass) {
        lutPass.lut = luts[grade];
        lutPass.intensity = grade === 'sunset' ? 0.82 : 0.4;
      }
    },
    setSize(width, height) {
      composer?.setSize(width, height);
    },
    render() {
      if (!composer) rebuild();
      composer.render();
    },
  };
}
