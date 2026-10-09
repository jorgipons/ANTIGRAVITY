// Catálogo de reglamentos. Debe mantenerse idéntico al RULESETS de
// basketball-manager/index.html: las dos apps leen el mismo team.rulesetId.
export const RULESETS = {
  fbcv_8p: {
    id: 'fbcv_8p',
    name: 'Pasarela 8 periodos',
    sub: '8 periodos · Reglamento estándar',
    totalPeriods: 8,
    checkPeriod: 6, // Las reglas FBCV obligan a revisar en el 6º
    minPlay: 2,
    minRest: 2,
    maxPlay: 4,
    freeSubstitutions: false,
  },
  fbcv_6p: {
    id: 'fbcv_6p',
    name: 'Pasarela 6 periodos',
    sub: '6 periodos · Categorías menores',
    totalPeriods: 6,
    checkPeriod: 5,
    minPlay: 2,
    minRest: 2,
    maxPlay: 3,
    freeSubstitutions: false,
  },
  libre_4p: {
    id: 'libre_4p',
    name: 'Libre 4 periodos',
    sub: '4 periodos · Cambios libres',
    totalPeriods: 4,
    freeSubstitutions: true,
  },
};

// Campo antiguo del móvil. Se lee como respaldo, nunca se vuelve a escribir.
export const LEGACY_MODE_MAP = {
  pasarela: 'fbcv_8p',
  pasarela6: 'fbcv_6p',
  libre: 'libre_4p',
};

export const FALLBACK_RULESET_ID = 'fbcv_8p';

// Mayor número de periodos del catálogo. Se usa para normalizar historiales
// antiguos sin depender del reglamento del equipo: si un equipo pasa a Libre 4P,
// sus periodos 5-8 ya guardados deben seguir normalizándose igual.
export const MAX_PERIODS = Math.max(...Object.values(RULESETS).map(r => r.totalPeriods));

// El reglamento del partido manda sobre el del equipo: cambiar el reglamento a
// mitad de temporada no debe revalidar partidos ya jugados con el anterior.
export const resolveRulesetId = (team, match) =>
  match?.rulesetId
  || team?.rulesetId
  || LEGACY_MODE_MAP[team?.mode]
  || FALLBACK_RULESET_ID;

// Un id desconocido cae al de por defecto en vez de reventar, para que añadir un
// reglamento en una app no rompa la otra mientras no esté actualizada.
export const resolveRuleset = (team, match) =>
  RULESETS[resolveRulesetId(team, match)] || RULESETS[FALLBACK_RULESET_ID];

export const DEFAULT_RULESET = RULESETS[FALLBACK_RULESET_ID];

// Utils translated from the PWA index.html for validating the match matrix
export const getPlayerPeriods = (playerId, periodsState, totalPeriods) => {
  let played = 0;
  for (let i = 1; i <= totalPeriods; i++) {
    const pData = periodsState[i];
    if (Array.isArray(pData)) {
      if (pData.some(e => e === playerId || (e && e.id === playerId))) played++;
    } else if (pData && pData[playerId]) {
      // Soporte para partidos antiguos que guardaban en formato { playerId: 'role' }
      played++;
    }
  }
  return played;
};

export const validatePlayerSelection = (playerId, currentPeriod, periodsState, ruleset = DEFAULT_RULESET) => {
  // Libre: sin restricciones Pasarela.
  if (ruleset.freeSubstitutions) return { isValid: true };
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

  // Libre: no hay nada que incumplir, solo "ha jugado" o "no ha jugado".
  if (ruleset.freeSubstitutions) return played === 0 ? 'empty' : 'valid';


  const playedInFirst6 = getPlayerPeriods(playerId, periodsState, ruleset.checkPeriod);
  
  if (playedInFirst6 < ruleset.minPlay) return 'error'; // Rojo (no cumplió el mínimo en los primeros 6)
  if (playedInFirst6 > ruleset.maxPlay) return 'error'; // Rojo (jugó de más en los primeros 6)
  
  // Reglas de descanso (minRest = 2 periodos enteros)
  const restedInFirst6 = ruleset.checkPeriod - playedInFirst6;
  if (restedInFirst6 < ruleset.minRest) return 'error'; 
  
  if (played === 0) return 'empty'; // No ha jugado nada (aún)
  return 'valid'; // Todo correcto
};
