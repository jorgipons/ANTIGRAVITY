export const DEFAULT_RULESET = {
  totalPeriods: 8,
  checkPeriod: 6, // Las reglas FBCV obligan a revisar en el 6º
  minPlay: 2,
  minRest: 2,
  maxPlay: 3
};

// Utils translated from the PWA index.html for validating the match matrix
export const getPlayerPeriods = (playerId, periodsState, totalPeriods) => {
  let played = 0;
  for (let i = 1; i <= totalPeriods; i++) {
    const pData = periodsState[i];
    if (Array.isArray(pData)) {
      if (pData.includes(playerId)) played++;
    } else if (pData && pData[playerId]) {
      // Soporte para partidos antiguos que guardaban en formato { playerId: 'role' }
      played++;
    }
  }
  return played;
};

export const validatePlayerSelection = (playerId, currentPeriod, periodsState, ruleset = DEFAULT_RULESET) => {
  if (currentPeriod > ruleset.checkPeriod) return { isValid: true };

  const played = getPlayerPeriods(playerId, periodsState, currentPeriod - 1);

  // Regla: Máximo de periodos jugados en los primeros 6
  if (played >= ruleset.maxPlay) {
    return {
      isValid: false,
      reason: `Ya ha jugado el máximo permitido (${ruleset.maxPlay}) en los primeros ${ruleset.checkPeriod} periodos.`
    };
  }

  // Si estamos en el periodo 6, verificar si está OBLIGADO a jugar
  if (currentPeriod === ruleset.checkPeriod) {
    if (played < ruleset.minPlay - 1) {
      return {
        isValid: false,
        reason: `Debería haber jugado al menos ${ruleset.minPlay - 1} periodos antes de este para cumplir el mínimo.` // En teoría ya no debería llegar aquí si validó bien antes, pero por seguridad
      };
    }
  }

  // Previsión: ¿Si no juega este periodo, podrá cumplir el mínimo?
  const remainingCheckPeriods = ruleset.checkPeriod - currentPeriod; // Si estamos en el p4, quedan 2 (p5, p6)
  if (played + remainingCheckPeriods < ruleset.minPlay) {
     return {
         isValid: false,
         reason: `Si descansa, no podrá cumplir el mínimo de ${ruleset.minPlay} periodos jugados.`
     }
  }

  return { isValid: true };
};

export const getPlayerStatusClasses = (playerId, periodsState, ruleset = DEFAULT_RULESET) => {
  const played = getPlayerPeriods(playerId, periodsState, ruleset.totalPeriods);
  const playedInFirst6 = getPlayerPeriods(playerId, periodsState, ruleset.checkPeriod);
  
  if (playedInFirst6 < ruleset.minPlay) return 'error'; // Rojo (no cumplió el mínimo en los primeros 6)
  if (playedInFirst6 > ruleset.maxPlay) return 'error'; // Rojo (jugó de más en los primeros 6)
  
  // Reglas de descanso (minRest = 2 periodos enteros)
  const restedInFirst6 = ruleset.checkPeriod - playedInFirst6;
  if (restedInFirst6 < ruleset.minRest) return 'error'; 
  
  if (played === 0) return 'empty'; // No ha jugado nada (aún)
  return 'valid'; // Todo correcto
};
