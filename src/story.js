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

export function createStory(missions) {
  const save = loadSave();
  let index = save?.story ?? 0;
  let briefing = false;
  let running = false;
  let held = 0;
  let timer = 0;
  let busted = false;
  let boss = null;
  let wantedArmed = false;
  let nag = 0;
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
    const place = spot(current.place);
    const body = current.kind === 'protect'
      ? `${current.body} ${Math.ceil(Math.max(0, current.hold - held))} s`
      : current.limit
        ? `${current.body} ${Math.ceil(Math.max(0, timer))} s`
        : current.body;
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

  function complete() {
    const current = mission();
    running = false;
    boss = null;
    wantedArmed = false;
    missions.unlock();
    index += 1;
    hooks.reward(current.pay);
    hooks.persist();
    hooks.toast(`Mission réussie. ${current.pay.toLocaleString('fr-FR')} FCFA.`);
    if (index < STORY.length) openBrief();
    else hooks.toast('Les huit missions sont faites. Les courses libres reprennent.');
  }

  return {
    save,
    length: STORY.length,
    holding() { return briefing; },
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
      if (!running || !current || briefing) return;
      const place = spot(current.place);
      const dist = Math.hypot(player.pos.x - place.x, player.pos.z - place.z);
      const speed = player.vehicle ? Math.abs(player.vehicle.speed) : player.speed;
      nag = Math.max(0, nag - dt);
      if (current.kind === 'protect' && dist < 16) held += dt;
      if (current.limit) {
        timer = Math.max(0, timer - dt);
        if (timer <= 0) {
          timer = current.limit;
          hooks.toast('Trop tard. Le chrono repart.');
          if (current.kind === 'escape') hooks.setWanted(3);
        }
      }
      if (current.kind === 'convoy' && missions.state.active?.dirty) {
        missions.state.active.dirty = false;
        hooks.toast('Choc sur le convoi. Reprends la route du port, doucement.');
      }
      pin();
      if (current.kind === 'reach' || current.kind === 'convoy') {
        const vehicleOk = !current.vehicle || player.vehicle?.type === current.vehicle;
        if (dist < 8 && speed < 8 && vehicleOk) complete();
        else if (dist < 8 && current.vehicle && !vehicleOk && nag <= 0) {
          nag = 4;
          hooks.toast(current.vehicle === 'zem' ? 'Il te faut un zemidjan.' : 'Il te faut le SUV.');
        }
      } else if (current.kind === 'protect') {
        if (held >= current.hold) complete();
      } else if (current.kind === 'escape') {
        if (dist < 8) complete();
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
          complete();
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
