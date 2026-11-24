import { PLACES } from './config.js';
import { STORY } from './story-data.js';

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
    const stepLabel = `Étape ${Math.min(step, steps.length - 1) + 1}/${steps.length}`;
    let body = `${stepLabel} — ${current.body}`;
    if (current.kind === 'protect') body = `${stepLabel} — reste sur place, ${Math.ceil(Math.max(0, holdNeed - held))} s`;
    else if (current.vehicle && !extra.vehicleOk) body = `${stepLabel} — monte dans ${current.vehicle === 'zem' ? 'un zemidjan' : 'le SUV'}, puis suis la flèche`;
    else if (current.limit) body = `${stepLabel} — suis la flèche, ${Math.ceil(Math.max(0, timer))} s`;
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
    showResult('ok', 'Mission réussie', `${current.title}. Tu gagnes ${current.pay.toLocaleString('fr-FR')} FCFA.`);
  }

  function fail(text) {
    running = false;
    showResult('fail', 'Mission ratée', text);
  }

  return {
    save,
    length: STORY.length,
    holding() { return briefing || resultMode !== null; },
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
      pin();
      if (current.voice) hooks.say(current.voice);
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
      if (current.kind === 'reach' || current.kind === 'convoy' || current.kind === 'escape') {
        if (dist < 8 && (speed < 8 || !player.vehicle) && vehicleOk) {
          if (step < steps.length - 1) {
            step += 1;
            hooks.toast('Point de passage atteint. Continue.');
          } else succeed();
        } else if (dist < 8 && current.vehicle && !vehicleOk && nag <= 0) {
          nag = 4;
          hooks.toast(current.vehicle === 'zem' ? 'Il te faut un zemidjan.' : 'Il te faut le SUV.');
        }
      } else if (current.kind === 'protect') {
        if (held >= holdNeed) succeed();
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
        } else if (boss.down || boss.hp <= 0) {
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
