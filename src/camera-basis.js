/**
 * Repère caméra au sol, Y vers le haut, repère main droite (Three.js).
 *
 * forward = regard de la caméra projeté sur XZ, donc la direction qui
 * s'éloigne de la caméra. yaw 0 → +Z, yaw π/2 (spawn) → +X.
 * right = cross(forward, up) = (−cos yaw, sin yaw). C'est la droite de
 * l'écran. cross(up, forward) est la gauche : ne pas l'utiliser.
 *
 * input.right > 0 = stick poussé à droite, ou D / flèche droite.
 * joyX a le même signe que le déplacement du bouton (clientX). Ne pas
 * l'inverser en plus du vecteur right.
 */
export function cameraPlanarBasis(yaw) {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  return {
    forwardX,
    forwardZ,
    rightX: -forwardZ,
    rightZ: forwardX,
  };
}
