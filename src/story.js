import { PLACES } from './config.js';
import { sceneFor, STORY } from './story-data.js';

const SAVE_KEY = 'cotonou-city-save';

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || typeof data.story !== 'number') return null;
    return {
      story: Math.max(0, Math.min(STORY.length, data.story)),
      money: typeof data.money === 'number' ? data.money : null,
      jobs: typeof data.jobs === 'number' ? data.jobs : 0,
    };
  } catch {
    return null;
  }
}

function writeSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function spot(id) {
  return PLACES.find((place) => place.id === id);
}

function stepsOf(current) {
  return current.steps || [current.place];
}

export function createStory(missions) {
  const save = loadSave();
  let index = save?.story ?? 0;
  let briefing = false;
  let running = false;
  let held = 0;
  let timer = 0;
  let busted = false;
  let boss = null;
  let step = 0;
  let resultMode = null;
  let pendingPay = 0;
  let wantedArmed = false;
  let nag = 0;
  let scene = null;
  let introDone = false;
  let outroDone = false;
  let zoneIdle = 0;
  let objectiveText = '';
  let zoneHint = '';
  function showResult(mode, title, text) {
    resultMode = mode;
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-text').textContent = text;
    document.getElementById('result-ok').hidden = mode !== 'ok';
    document.getElementById('result-retry').hidden = mode !== 'fail';
    document.getElementById('result').classList.remove('hidden');
  }

  const hooks = {
    toast() {},
    say() {},
    sayLine() {},
    reward() {},
    setWanted() {},
    persist() {},
  };

  function mission() {
    return STORY[index] || null;
  }

  function pin(extra = {}) {
    const current = mission();
    const steps = stepsOf(current);
    const place = spot(steps[Math.min(step, steps.length - 1)]);
    const holdNeed = (typeof window !== 'undefined' && window.__cotonouFast) ? 0.35 : (current.hold || 0);
    const checklist = steps.map((id, i) => ({
      label: spot(id).name,
      done: i < step,
      current: i === step,
    }));
    const stepLabel = `Étape ${Math.min(step, steps.length - 1) + 1}/${steps.length}`;
    let body = `${stepLabel} — ${current.body}`;
    if (current.kind === 'protect') body = `${stepLabel} — reste sur place, ${Math.ceil(Math.max(0, holdNeed - held))} s`;
    else if (current.vehicle && !extra.vehicleOk) body = `${stepLabel} — monte dans ${current.vehicle === 'zem' ? 'un zemidjan' : 'le SUV'}, puis suis la flèche`;
    else if (current.limit) body = `${stepLabel} — suis la flèche, ${Math.ceil(Math.max(0, timer))} s`;
    if (objectiveText) body = `${objectiveText} · + ${current.pay.toLocaleString('fr-FR')} FCFA`;
    missions.lock({
      story: true,
      storyTitle: current.title,
      storyBody: body,
      kind: 'story',
      phase: 'pickup',
      a: place,
      b: place,
      pay: current.pay,
      timer,
      dirty: false,
      checklist,
      objective: current.objective || current.body,
      ...extra,
    });
  }

  function openBrief() {
    const current = mission();
    if (!current) return;
    briefing = true;
    running = false;
    document.getElementById('brief-kicker').textContent = `Mission ${index + 1} sur ${STORY.length}`;
    document.getElementById('brief-title').textContent = current.title;
    document.getElementById('brief-text').textContent = current.brief;
    document.getElementById('brief').classList.remove('hidden');
  }

  function succeed() {
    const current = mission();
    running = false;
    boss = null;
    wantedArmed = false;
    pendingPay = current.pay;
    showResult('ok', 'MISSION RÉUSSIE', `${current.title}\n+ ${current.pay.toLocaleString('fr-FR')} FCFA`);
  }

  function fail(text) {
    running = false;
    showResult('fail', 'Mission ratée', text);
  }

  function fastPlay() {
    return typeof window !== 'undefined' && window.__cotonouFast;
  }

  function hideScene() {
    scene = null;
    document.getElementById('letterbox')?.classList.remove('on');
    document.body.dataset.scene = '0';
  }

  function openScene(lines, place, kind) {
    if (!lines?.length) return;
    scene = { lines, i: 0, wait: 0, place, kind };
    document.getElementById('letterbox')?.classList.add('on');
    document.body.dataset.scene = '1';
    hooks.sayLine({ ...lines[0], hold: true });
  }

  function closeScene(kind) {
    hideScene();
    const current = mission();
    if (!current) return;
    if (kind === 'intro') {
      introDone = true;
      const steps = stepsOf(current);
      if ((current.kind === 'reach' || current.kind === 'convoy') && step < steps.length - 1) step += 1;
      const staged = sceneFor(current.id);
      objectiveText = staged?.objective || `Objectif : ${current.objective || current.body}`;
      zoneHint = '';
      hooks.toast(`${objectiveText} · + ${current.pay.toLocaleString('fr-FR')} FCFA`);
      pin();
      if (staged?.mid) hooks.sayLine(staged.mid);
    }
    if (kind === 'outro') {
      outroDone = true;
      succeed();
    }
  }

  return {
    save,
    length: STORY.length,
    holding() { return briefing || resultMode !== null; },
    sceneOn() { return Boolean(scene); },
    zoneHint() { return zoneHint; },
    objective() { return objectiveText; },
    skipScene() {
      if (!scene) return;
      const kind = scene.kind;
      hooks.sayLine && null;
      closeScene(kind);
    },
    tryTalk(player) {
      const current = mission();
      if (!running || !current || scene || introDone || fastPlay()) return false;
      const staged = sceneFor(current.id);
      if (!staged || staged.introAt === 'start') return false;
      const steps = stepsOf(current);
      const place = spot(steps[Math.min(step, steps.length - 1)]);
      const dist = Math.hypot(player.pos.x - place.x, player.pos.z - place.z);
      if (dist > 18) return false;
      openScene(staged.intro, place, 'intro');
      return true;
    },
    tickScene(dt, player, peds) {
      if (!scene) return null;
      scene.wait += dt;
      const line = scene.lines[scene.i];
      const origin = scene.place || player.pos;
      for (const ped of peds || []) {
        if (ped.riding || ped.down) continue;
        const d = Math.hypot(ped.pos.x - origin.x, ped.pos.z - origin.z);
        if (d < 9) ped.yaw = Math.atan2(player.pos.x - ped.pos.x, player.pos.z - ped.pos.z);
      }
      if (scene.wait > (line?.dur || 2.6)) {
        scene.i += 1;
        scene.wait = 0;
        if (scene.i >= scene.lines.length) {
          const kind = scene.kind;
          closeScene(kind);
          return null;
        }
        hooks.sayLine({ ...scene.lines[scene.i], hold: true });
      }
      const cam = scene?.lines?.[scene.i]?.cam || { dx: 3.2, dy: 1.7, dz: 2 };
      const focus = scene?.place || player.pos;
      return {
        x: focus.x + cam.dx,
        y: cam.dy,
        z: focus.z + cam.dz,
        lx: player.pos.x,
        ly: 1.35,
        lz: player.pos.z,
      };
    },
    current() { return mission(); },
    knockBoss() {
      if (!boss) return false;
      boss.hp = 0;
      boss.down = true;
      return true;
    },
    accept() {
      if (resultMode !== 'ok') return;
      const pay = pendingPay;
      pendingPay = 0;
      resultMode = null;
      document.getElementById('result').classList.add('hidden');
      missions.unlock();
      index += 1;
      step = 0;
      hooks.reward(pay);
      hooks.persist();
      if (index < STORY.length) openBrief();
      else hooks.toast('Les huit missions sont faites. Les courses libres reprennent.');
    },
    retry() {
      resultMode = null;
      document.getElementById('result').classList.add('hidden');
      this.begin();
    },
    done() { return index >= STORY.length; },
    hint() { return this.hintText || ''; },
    setHooks(next) { Object.assign(hooks, next); },
    openBrief,
    begin() {
      const current = mission();
      if (!current) return null;
      briefing = false;
      document.getElementById('brief').classList.add('hidden');
      running = true;
      held = 0;
      step = 0;
      timer = current.limit || 0;
      busted = false;
      boss = null;
      wantedArmed = false;
      scene = null;
      introDone = false;
      outroDone = false;
      zoneIdle = 0;
      objectiveText = '';
      zoneHint = '';
      document.getElementById('letterbox')?.classList.remove('on');
      document.body.dataset.scene = '0';
      pin();
      const staged = sceneFor(current.id);
      const fast = typeof window !== 'undefined' && window.__cotonouFast;
      if (!fast && staged?.introAt === 'start') {
        openScene(staged.intro, null, 'intro');
      } else if (current.voice) hooks.say(current.voice);
      if (current.kind === 'escape') {
        wantedArmed = true;
        hooks.setWanted(3);
      }
      return current;
    },
    noteBust() {
      if (running && mission()?.kind === 'escape') busted = true;
    },
    afterBust() {
      if (!busted) return false;
      busted = false;
      if (mission()?.kind !== 'escape') return false;
      timer = mission().limit;
      wantedArmed = true;
      hooks.setWanted(2);
      hooks.toast('Raté. La fuite reprend : file vers Ganhi.');
      pin();
      return true;
    },
    update(dt, player, peds) {
      const current = mission();
      if (!running || !current || briefing || resultMode) return;
      const steps = stepsOf(current);
      const place = spot(steps[Math.min(step, steps.length - 1)]);
      const dist = Math.hypot(player.pos.x - place.x, player.pos.z - place.z);
      const speed = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
      const vehicleOk = !current.vehicle || player.vehicle?.type === current.vehicle;
      nag = Math.max(0, nag - dt);
      const holdNeed = (typeof window !== 'undefined' && window.__cotonouFast) ? 0.35 : (current.hold || 0);
      if (current.kind === 'protect' && dist < 16) held += dt;
      if (current.limit) {
        timer = Math.max(0, timer - dt);
        if (timer <= 0) {
          fail('Le temps est écoulé. Tu peux réessayer.');
          return;
        }
      }
      if (current.kind === 'convoy' && missions.state.active?.dirty) {
        missions.state.active.dirty = false;
        fail('Le convoi a pris un choc. Reprends depuis le début.');
        return;
      }
      pin({ vehicleOk });
      const staged = sceneFor(current.id);
      if (!fastPlay() && staged && staged.introAt !== 'start' && !introDone && dist < 11) {
        openScene(staged.intro, place, 'intro');
        zoneHint = '';
        document.body.dataset.zone = '0';
        return;
      }
      if (!introDone && dist < 18 && staged && staged.introAt !== 'start') {
        zoneIdle = speed < 0.6 ? zoneIdle + dt : 0;
        zoneHint = zoneIdle > 10 ? 'Tu es au bon endroit. Appuie sur PARLER.' : 'Appuie sur PARLER';
        document.body.dataset.zone = '1';
      } else {
        zoneIdle = 0;
        if (!scene) zoneHint = '';
        document.body.dataset.zone = '0';
      }
      if (current.kind === 'fight' && dist < 14 && !player.vehicle) {
        this.hintText = 'Frappe pour le mettre à terre';
      } else if (dist < 10 && current.vehicle && !vehicleOk) {
        this.hintText = current.vehicle === 'zem' ? 'Monte sur le zemidjan' : 'Monte dans le SUV';
      } else if (!introDone && dist < 18 && staged) {
        this.hintText = 'Appuie sur PARLER';
      } else if (dist < 8) {
        this.hintText = objectiveText || 'Tu es sur l\'objectif';
      } else {
        this.hintText = objectiveText || '';
      }
      const playOutro = () => {
        if (!fastPlay() && staged?.outro && !outroDone) {
          openScene(staged.outro, place, 'outro');
          return true;
        }
        return false;
      };
      if (current.kind === 'reach' || current.kind === 'convoy' || current.kind === 'escape') {
        if (dist < 8 && (speed < 8 || !player.vehicle) && vehicleOk) {
          if (step < steps.length - 1) {
            step += 1;
            if (staged?.mid && !fastPlay()) hooks.sayLine(staged.mid);
            hooks.toast('Point de passage atteint. Continue.');
          } else if (!playOutro()) succeed();
        } else if (dist < 8 && current.vehicle && !vehicleOk && nag <= 0) {
          nag = 4;
          hooks.toast(current.vehicle === 'zem' ? 'Il te faut un zemidjan.' : 'Il te faut le SUV.');
        }
      } else if (current.kind === 'protect') {
        if (held >= holdNeed && !playOutro()) succeed();
      } else if (current.kind === 'fight') {
        if (!boss) {
          let best = null;
          let bestD = Infinity;
          for (const ped of peds) {
            const d = Math.hypot(ped.pos.x - place.x, ped.pos.z - place.z);
            if (d < bestD) {
              best = ped;
              bestD = d;
            }
          }
          if (best) {
            boss = best;
            boss.boss = true;
            boss.temper = 'fight';
            boss.hpMax = current.bossHp;
            boss.hp = current.bossHp;
            boss.down = false;
            boss.name = current.bossName;
          }
        } else if ((boss.down || boss.hp <= 0) && !playOutro()) {
          succeed();
        }
      }
    },
    foe() {
      if (!boss || boss.down) return null;
      return { name: boss.name || 'Adversaire', hp: boss.hp, max: boss.hpMax };
    },
    persist(money, jobs) {
      writeSave({ story: index, money, jobs });
    },
  };
}
