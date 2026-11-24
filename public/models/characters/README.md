# Cotonou City – realistic rigged characters (zero-cost pipeline)

Made 2026-11-24. Total cost: 0. No paid service, no trial, no card, no sign-up.

## Deliverables (`characters/`)
| File | Tris | Texture | Size | Notes |
|---|---|---|---|---|
| ibrahim.glb | 24,000 | 2048² WebP | 817 KB | Player: Ibrahim (wax-print shirt, jeans, white sneakers, glasses) |
| ibrahim_1k.glb | 24,000 | 1024² WebP | 646 KB | Same, lighter texture for phones |
| npc_zem.glb | 20,000 | 1024² WebP | 547 KB | Zemidjan driver, plain yellow shirt (no number/text) |
| npc_vendor.glb | 20,000 | 1024² WebP | 687 KB | Market vendor woman, wax pagne + headwrap |
| npc_police.glb | 20,000 | 1024² WebP | 527 KB | Generic police, navy uniform, NO real insignia/badges |
| npc_student.glb | 20,000 | 1024² WebP | 578 KB | Student, blue blouse + skirt |
| npc_business.glb | 20,000 | 1024² WebP | 522 KB | Businessman, grey suit |
| npc_elder.glb | 20,000 | 1024² WebP | 653 KB | Elder, sky-blue bazin boubou + kufi |
| lod/*_lod.glb | 5,000–6,000 | 512² WebP | 380–440 KB | Crowd LODs, same skeleton and clips |

All files: meshopt-compressed (needs `MeshoptDecoder`), WebP textures (`EXT_texture_webp`; iOS 14+ / all modern Android).

## Rig compatibility with the game
- The skeleton is the game's own `src/assets/human.glb` armature (Quaternius CC0): the same 41 joints, identical names (`Hips, Spine, Spine1, Spine2, Neck, Head, HeadTop_End, Left/RightShoulder, Arm, ForeArm, Hand, HandThumb1-4, HandIndex1-4, Left/RightUpLeg, Leg, Foot, ToeBase, Toe_End`), the same hierarchy and the same "Human Armature" / "RootNode" node chain with scale 69.18.
- Joint positions were moved (translation only) to fit each body. Bone orientations were kept, and the mesh was converted from A-pose to the skeleton's T-pose.
- Each GLB embeds all 8 original clips under the original names (`Human Armature|Idle`, `|Walk`, `|Run`, `|Jump`, `|Punch`, `|Death`, `|Working`, `|ArmatureAction.002`), so `clipBy(gltf, 'Walk')` works. Use the clips from the same file; don't mix in human.glb's clips, because the rest pose was re-exported and Hips height differs.
- The same `SCALE = 0.355` and `FEET = 0.12` give the same height as human.glb. This was checked in three.js r170 (`previews/threejs_scale_vs_original_human.png`).
- Integration notes for humanoid.js:
  1. Call `loader.setMeshoptDecoder(MeshoptDecoder)` (`three/addons/libs/meshopt_decoder.module.js`).
  2. Keep the GLB's own material/texture: skip `applyHumanShader`/`tagRegions` (those recolor the low-poly body and project the face photo) for these models.
  3. The skinned mesh is named `<Name>_Mesh` (e.g. `Ibrahim_Mesh`, `NpcZem_Mesh`).

## Pipeline / tools that worked
1. **Reference images**: built-in image generator, with Ibrahim's consented photos as identity references:
   - A-pose front view + back view (`refimg/ibrahim_apose_front.jpg`, `_back.jpg`);
   - a frontal high-res portrait for the face (`refimg/ibrahim_face_front.jpg`);
   - for the NPCs, front + back views (fictional people).
2. **Image→3D shape**: Hugging Face Space `tencent/Hunyuan3D-2`, endpoint `/shape_generation` (untextured mesh, ~200k faces), through `gradio_client`, anonymously.
3. **Texturing** (`scripts/texture_project.py`, Blender 4.2.3 LTS portable, headless):
   - rembg (isnet) masks and color-dilation (`scripts/prep_images.py`);
   - decimate to 20–24k tris and smart-UV;
   - orthographic projection of the front and back images, blended by normal;
   - for Ibrahim, the hi-res portrait is aligned with OpenCV ECC (`scripts/align_face.py`, cc=0.94) and projected onto the face;
   - Cycles bake to a 2048² albedo.
4. **Rigging** (`scripts/rig.py`, Blender):
   - automatic landmarks (sampled surface slices);
   - a fitted temp rig, with heat weights on a voxel-remeshed watertight proxy, then a weight data-transfer to the mesh;
   - pose to the game skeleton's T-pose and apply;
   - translate the game armature's joints and bind, with 4 influences per vertex.
5. **Optimization**: `@gltf-transform/cli optimize` (meshopt + WebP; `--simplify` for the LODs).
6. **Checks**: Blender Cycles previews plus headless Chrome / three.js 0.170 renders (`webtest/`).

## Tools that did not work (free tier)
- `tencent/Hunyuan3D-2` `/generation_all` (textured): the Space crashes (`texgen_worker is not defined`).
- `tencent/Hunyuan3D-2.1`: it asks for 270 s of GPU, more than the anonymous ZeroGPU maximum (that would need HF PRO, which is paid). Skipped.
- `microsoft/TRELLIS.2`: one run succeeded but was lost to a parameter error. After that the anonymous daily ZeroGPU quota was exhausted. A free HF account/token would give more quota, but that needs a sign-up, so I skipped it.
- `microsoft/TRELLIS`: the Space is in CONFIG_ERROR. `tencent/Hunyuan3D-2mini-Turbo`: API error 500.

## Licenses / attribution
- **Meshes (shape)**: these are outputs of Tencent Hunyuan3D-2 under the *Tencent Hunyuan 3D 2.0 Community License*:
  - Tencent claims no rights in the outputs.
  - The license is **limited to the "Territory" = worldwide EXCEPT the EU, UK and South Korea**. Using or displaying outputs outside that Territory is unlicensed. A public web game is reachable from the EU/UK, so consider geo-restricting or replacing these meshes if that matters.
  - Outputs must not be used to train/improve other AI models.
  - Above 1M MAU you need a separate license.
  - You are *encouraged* (not required) to mark the product "Powered by Tencent Hunyuan".
  - Suggested credit: "Personnages 3D générés avec Tencent Hunyuan3D-2 (Tencent Hunyuan 3D 2.0 Community License)".
- **Skeleton + animations**: Quaternius "Ultimate Animated Character" style human, CC0 (no attribution required). They come from the repo's human.glb.
- **Textures**: projected from AI-generated images. Ibrahim's likeness is used with his consent; the NPCs are fictional people.
- **Blender** (GPL; outputs are yours), **rembg** (MIT) + isnet model (Apache-2.0), **OpenCV** (Apache-2.0), **gltf-transform** (MIT), **meshoptimizer** (MIT), **three.js** (MIT).

## Known limitations
- The texture comes from 2 views, so the flanks, the underside of the chin and the tops of the shoulders show some stretching.
- The glasses are fused into the head mesh.
- Hands follow the game skeleton (thumb + one index chain), so the fingers bend as a single mitten.
- Long garments (vendor's pagne, elder's boubou hem) are weighted to the legs and stretch a little during walk/run.
- Re-run anything with the scripts in `scripts/` (see each header). `raw/` holds the intermediate meshes.
