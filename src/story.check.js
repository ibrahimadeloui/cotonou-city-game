import assert from 'node:assert/strict';
import { sceneFor, STORY } from './story-data.js';
import fs from 'node:fs';

assert.ok(STORY.length >= 8, 'au moins 8 missions');
const ids = new Set();
for (const mission of STORY) {
  assert.ok(mission.title && mission.brief && mission.body && mission.place && mission.pay > 0);
  assert.ok(!ids.has(mission.id));
  ids.add(mission.id);
  assert.ok(['reach', 'fight', 'convoy', 'protect', 'escape'].includes(mission.kind));
}
assert.ok(ids.has('zem') && ids.has('port') && ids.has('patron') && ids.has('fuite'));
for (const id of ['zem', 'pagne', 'course', 'fuite', 'vendeur']) {
  const scene = sceneFor(id);
  assert.ok(scene?.intro?.length >= 2, `${id} scène d'intro`);
  assert.ok(scene.outro?.length >= 1, `${id} scène de fin`);
  assert.ok(/Objectif/.test(scene.objective), `${id} objectif`);
  for (const line of [...scene.intro, ...scene.outro]) {
    assert.ok(line.speaker && line.text, `${id} réplique`);
  }
}

const voices = ['cava', 'doucement', 'yovo', 'ahnon', 'mikudo', 'zem', 'port', 'police', 'patron', 'hopital'];
for (const id of voices) {
  const file = `src/assets/voices/${id}.wav`;
  assert.ok(fs.existsSync(file), file);
  assert.ok(fs.statSync(file).size > 500, file);
}
console.log('story ok', STORY.length, 'missions');
