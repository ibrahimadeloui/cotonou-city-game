import { tickFare } from './zemjob.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const world = {
  drivingZem: true,
  speed: 0,
  x: 0,
  z: 0,
  clients: [{ id: 1, x: 2, z: 0 }],
  places: [{ name: 'Dantokpa', x: 40, z: 10 }],
  pay: 1200,
};

let step = tickFare({ state: 'idle', wait: 0 }, 2, world);
assert(step.event === 'call' && step.fare.state === 'wait', 'le client doit appeler');
step = tickFare(step.fare, 0.2, { ...world, x: 2, speed: 0.4 });
assert(step.event === 'pick' && step.fare.state === 'ride', 'la prise en charge doit partir');
step = tickFare(step.fare, 0.2, { ...world, x: 40, z: 10, speed: 1 });
assert(step.event === 'drop' && step.pay === 1200, 'la course doit payer');
assert(step.fare.state === 'idle', 'la course se termine');
step = tickFare({ state: 'ride', client: { id: 1 }, dest: world.places[0], pay: 500 }, 0.1, { ...world, drivingZem: false });
assert(step.event === 'cancel', 'descendre annule la course');
console.log('zem ok');
