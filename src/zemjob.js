import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  TorusGeometry,
} from 'three';
import { PLACES } from './config.js';

export function tickFare(fare, dt, world) {
  const next = {
    state: fare.state || 'idle',
    wait: fare.wait || 0,
    client: fare.client,
    dest: fare.dest,
    pay: fare.pay || 0,
  };
  if (!world.drivingZem) {
    if (next.state !== 'idle') {
      return { fare: { state: 'idle', wait: 0, client: null, dest: null, pay: 0 }, event: 'cancel', client: next.client };
    }
    return { fare: next, event: null };
  }
  if (next.state === 'idle') {
    next.wait += dt;
    if (next.wait > 1.6 && world.clients?.length && world.places?.length) {
      next.state = 'wait';
      next.client = world.clients[0];
      next.dest = world.places[0];
      next.pay = world.pay || 900;
      next.wait = 0;
      return { fare: next, event: 'call' };
    }
  }
  if (next.state === 'wait' && next.client) {
    const d = Math.hypot(world.x - next.client.x, world.z - next.client.z);
    if (d < 3.6 && Math.abs(world.speed) < 3.6) {
      next.state = 'ride';
      return { fare: next, event: 'pick' };
    }
  }
  if (next.state === 'ride' && next.dest) {
    const d = Math.hypot(world.x - next.dest.x, world.z - next.dest.z);
    if (d < 8 && Math.abs(world.speed) < 4.2) {
      const pay = next.pay;
      return {
        fare: { state: 'idle', wait: 0, client: null, dest: null, pay: 0 },
        event: 'drop',
        pay,
        client: next.client,
      };
    }
  }
  return { fare: next, event: null };
}

export function createZemJob(scene) {
  const ring = new Mesh(
    new RingGeometry(0.7, 1.05, 20),
    new MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  const pin = new Mesh(
    new TorusGeometry(0.35, 0.08, 6, 12),
    new MeshBasicMaterial({ color: 0xffd23a }),
  );
  pin.position.y = 2.3;
  ring.add(pin);
  ring.visible = false;
  scene.add(ring);

  let fare = { state: 'idle', wait: 0, client: null, dest: null, pay: 0 };
  let rider = null;

  function candidates(peds, player) {
    const list = [];
    for (const ped of peds) {
      if (ped.down || ped.riding || ped.temper === 'fight') continue;
      if (ped.behavior === 'vendor' || ped.behavior === 'sit') continue;
      const d = Math.hypot(ped.pos.x - player.pos.x, ped.pos.z - player.pos.z);
      if (d > 8 && d < 26) list.push(ped);
    }
    list.sort((a, b) => Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) - Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z));
    return list;
  }

  function destination(from) {
    let best = PLACES[0];
    let bestD = 0;
    for (const place of PLACES) {
      const d = Math.hypot(place.x - from.x, place.z - from.z);
      if (d > bestD) {
        best = place;
        bestD = d;
      }
    }
    return bestD > 30 ? best : PLACES.find((place) => Math.hypot(place.x - from.x, place.z - from.z) > 40) || best;
  }

  function release(ped) {
    if (!ped) return;
    ped.riding = false;
    ped.behavior = 'walk';
    ped.speed = 1.1;
    if (ped.mesh.parent !== scene) scene.add(ped.mesh);
    ped.mesh.scale.setScalar(ped.homeScale || 1);
    ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
  }

  return {
    fare: () => fare,
    update(dt, player, peds) {
      const driving = player.vehicle?.type === 'zem';
      const list = candidates(peds, player);
      const client = fare.client;
      const world = {
        drivingZem: Boolean(driving),
        speed: player.vehicle ? player.vehicle.speed : 0,
        x: player.pos.x,
        z: player.pos.z,
        clients: fare.state === 'idle' && list[0]
          ? [{ id: list[0], x: list[0].pos.x, z: list[0].pos.z }]
          : client ? [{ id: client.id, x: client.x, z: client.z }] : [],
        places: fare.dest ? [fare.dest] : list[0] ? [destination(list[0].pos)] : [],
        pay: fare.pay || (list[0] ? Math.round((800 + Math.hypot(destination(list[0].pos).x - list[0].pos.x, destination(list[0].pos).z - list[0].pos.z) * 8) / 50) * 50 : 900),
      };
      if (fare.state === 'idle' && list[0] && !world.places.length) world.places = [destination(list[0].pos)];
      const step = tickFare(fare, dt, world);
      if (step.event === 'call' && list[0]) {
        rider = list[0];
        rider.behavior = 'wait';
        rider.speed = 0;
        rider.homeScale = rider.mesh.scale.x || 1;
        fare = {
          ...step.fare,
          client: { id: rider, x: rider.pos.x, z: rider.pos.z },
          dest: world.places[0],
          pay: world.pay,
        };
      } else if (step.event === 'pick' && rider && player.vehicle) {
        fare = step.fare;
        rider.riding = true;
        rider.behavior = 'wait';
        player.vehicle.mesh.add(rider.mesh);
        rider.mesh.position.set(0, 0.55, -0.48);
        rider.mesh.rotation.set(0, 0, 0);
        rider.mesh.scale.setScalar(0.8);
      } else if (step.event === 'drop') {
        if (rider && fare.dest) {
          rider.pos.x = fare.dest.x + 1.4;
          rider.pos.z = fare.dest.z;
          release(rider);
        }
        rider = null;
        fare = step.fare;
      } else if (step.event === 'cancel') {
        release(rider);
        rider = null;
        fare = step.fare;
      } else {
        fare = step.fare;
      }
      const point = fare.state === 'wait' && fare.client
        ? fare.client
        : fare.state === 'ride' && fare.dest
          ? fare.dest
          : null;
      ring.visible = Boolean(point);
      if (point) {
        ring.position.x = point.x;
        ring.position.z = point.z;
        pin.rotation.y += dt * 2;
      }
      return { ...step, fare, place: fare.dest?.name || '' };
    },
  };
}
