/** Une arrestation = un prélèvement, puis un délai sans nouvelle amende. */

export const ARREST_GRACE = 12;
export const ARREST_SCREEN = 2.7;
export const HOSPITAL_FEE = 500;
export const HOSPITAL_LOCK = 4;

export function freshArrest() {
  return { active: false, grace: 0, timer: 0, fine: 0, pendingWanted: 0 };
}

export function computeFine(money) {
  const safe = Math.max(0, Math.floor(money) || 0);
  if (safe <= 0) return 0;
  const share = Math.round((safe * 0.28) / 50) * 50;
  return Math.min(safe, Math.max(400, share));
}

function francs(n) {
  return `${new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(n)))}\u00a0FCFA`;
}

export function arrestText(fine, before) {
  const had = Math.max(0, Math.floor(before) || 0);
  if (had <= 0 || fine <= 0) return 'ARRÊTÉ — Tu n\'avais pas de francs. La police te relâche.';
  if (fine >= had) return `ARRÊTÉ — Tu n'avais que ${francs(had)}, la police a tout pris.`;
  return `ARRÊTÉ — Amende : ${francs(fine)}`;
}

/** Plusieurs agents, plusieurs images : un seul démarrage tant que l'arrestation ou le délai dure. */
export function tryArrest(state, money) {
  if (state.active || state.grace > 0) {
    return { state, money: Math.max(0, money), fine: 0, started: false, text: '' };
  }
  const before = Math.max(0, money);
  const fine = computeFine(before);
  return {
    started: true,
    fine,
    money: before - fine,
    text: arrestText(fine, before),
    state: {
      active: true,
      grace: 0,
      timer: 0,
      fine,
      pendingWanted: state.pendingWanted || 0,
    },
  };
}

export function tickArrest(state, dt) {
  if (state.active) {
    const timer = state.timer + dt;
    if (timer >= ARREST_SCREEN) {
      return {
        active: false,
        grace: ARREST_GRACE,
        timer: 0,
        fine: state.fine,
        pendingWanted: state.pendingWanted || 0,
      };
    }
    return { ...state, timer };
  }
  return { ...state, grace: Math.max(0, (state.grace || 0) - dt) };
}

/** Hôpital et achats : jamais en dessous de zéro, et pas deux fois pendant le verrou. */
export function payOnce(lock, money, cost) {
  const safe = Math.max(0, money);
  if (lock > 0) return { lock, money: safe, paid: 0 };
  const paid = Math.min(Math.max(0, cost), safe);
  return { lock: HOSPITAL_LOCK, money: safe - paid, paid };
}
