import { createLineClock, lineBudget } from './line-clock.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(lineBudget('Ça va ?') < lineBudget('Ibrahim, le client est là. Prends le zem jaune.'), 'une phrase longue dure plus');
assert(lineBudget('x'.repeat(400)) === 8000, 'le délai est plafonné');

const clock = createLineClock();
clock.start('Ça va ?');
assert(clock.tick(400) === false, 'la réplique ne doit pas finir tout de suite');
assert(clock.pending(), 'la réplique est encore ouverte');
let ended = 0;
for (let i = 0; i < 40; i += 1) {
  if (clock.tick(200)) ended += 1;
}
assert(ended === 1, `la réplique s'est fermée ${ended} fois`);
assert(clock.tick(5000) === false, 'un second passage ne relance pas la file');
clock.start('encore');
clock.done();
assert(clock.tick(9000) === false, 'une réplique passée ne se termine plus');
console.log('line clock ok');
