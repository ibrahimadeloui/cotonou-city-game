import { ARREST_GRACE, ARREST_SCREEN, freshArrest, payOnce, tickArrest, tryArrest } from './arrest.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function framesOf(seconds) {
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  return { dt, steps };
}

let state = freshArrest();
let money = 5000;
let deductions = 0;
const { dt, steps } = framesOf(8);
for (let frame = 0; frame < steps; frame += 1) {
  for (let officer = 0; officer < 3; officer += 1) {
    const result = tryArrest(state, money);
    if (result.started) {
      deductions += 1;
      money = result.money;
    }
    state = result.state;
  }
  state = tickArrest(state, dt);
}
const once = 5000 - money;
assert(deductions === 1, `l'amende part ${deductions} fois`);
assert(once > 0 && once <= 5000, `montant inattendu ${once}`);
assert(money === 5000 - once, 'le solde ne correspond pas à une seule amende');
assert(state.active === false, 'l\'écran d\'arrestation ne se ferme pas');
assert(state.grace > 0, 'pas de délai après l\'arrestation');

let duringGrace = 0;
const remain = state.grace;
assert(remain > 5, `délai trop court (${remain})`);
const safeSteps = Math.floor((remain - 0.25) / dt);
for (let frame = 0; frame < safeSteps; frame += 1) {
  for (let officer = 0; officer < 3; officer += 1) {
    const result = tryArrest(state, money);
    if (result.started) duringGrace += 1;
    state = result.state;
  }
  state = tickArrest(state, dt);
}
assert(duringGrace === 0, `nouvelle arrestation pendant le délai (${duringGrace})`);
assert(state.grace > 0, 'le délai est déjà fini');
assert(money === 5000 - once, 'l\'argent bouge pendant le délai');

let broke = freshArrest();
let empty = 0;
let released = false;
let brokeStarts = 0;
const hold = framesOf(ARREST_SCREEN + 0.2);
for (let frame = 0; frame < hold.steps; frame += 1) {
  const result = tryArrest(broke, empty);
  if (result.started) {
    brokeStarts += 1;
    empty = result.money;
    assert(result.fine === 0, 'une amende sans argent');
    assert(/relâche/.test(result.text), result.text);
  }
  broke = result.state;
  const next = tickArrest(broke, hold.dt);
  if (broke.active && !next.active) released = true;
  broke = next;
}
assert(brokeStarts === 1, 'sans argent, l\'arrestation ne s\'ouvre pas');
assert(empty === 0, 'le solde passe sous zéro');
assert(released, 'sans argent, le contrôle ne revient pas');
assert(broke.grace > ARREST_GRACE - 0.3, 'le délai ne démarre pas');

const hospital = payOnce(0, 100, 500);
assert(hospital.paid === 100 && hospital.money === 0, 'l\'hôpital prend plus que le solde');
const again = payOnce(hospital.lock, hospital.money, 500);
assert(again.paid === 0 && again.money === 0, 'l\'hôpital prélève deux fois');

console.log('arrest ok', once, 'FCFA une fois');
