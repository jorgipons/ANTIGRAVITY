// Emparejamiento entre la plantilla del equipo y la plantilla federada.
//
// Toda sugerencia es eso: una propuesta que el entrenador confirma. Nada se
// aplica solo, nada se borra, y el nombre que el entrenador haya puesto manda
// siempre sobre el de la federación — hay jugadores y staff que piden no
// publicar su nombre y la FBCV solo devuelve sus iniciales.

export const normalizeName = (s) => (s || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Puntúa cuánto se parece el nombre local al federado. 0 = no se parecen.
 * Los umbrales son deliberadamente conservadores: es mejor no sugerir que
 * sugerir mal, porque un emparejamiento erróneo enlaza a dos personas.
 */
export const scoreMatch = (localName, fedFullName) => {
  const a = normalizeName(localName);
  const b = normalizeName(fedFullName);
  if (!a || !b) return 0;

  if (a === b) return 100;                       // idéntico
  if (b.startsWith(`${a} `)) return 85;          // "Carlos" dentro de "Carlos Garcia Perez"

  const ta = a.split(' ');
  const tb = b.split(' ');

  if (ta[0] === tb[0]) {
    // Mismo nombre de pila. Sube si además encaja la inicial del apellido.
    if (ta[1] && tb[1] && ta[1][0] === tb[1][0]) return 80;
    return 60;
  }

  // Diminutivos: "Dani" por "Daniel", "Pau" por "Paula". Los entrenadores usan
  // el nombre corto, asi que sin esto el jugador acaba duplicado — en "sin
  // emparejar" por un lado y en "nuevos de la federacion" por otro.
  // Minimo 3 letras para no emparejar por una inicial suelta.
  if (ta.length === 1 && ta[0].length >= 3 && tb[0].startsWith(ta[0])) return 70;

  return 0;                                      // ni el nombre de pila coincide
};

export const MATCH_THRESHOLD = 60;

/**
 * Reparte las dos plantillas en los grupos que muestra el modal.
 *
 * Entra:
 *   localPlayers: [{ id, name, number, role, federationUuid? }]
 *   fedPlayers:   [{ uuid, fullName, nameHidden }]
 *
 * Sale:
 *   linked      — ya enlazados por uuid de una sincronización anterior
 *   suggestions — propuestas por nombre, para confirmar { local, fed, score }
 *   unmatched   — jugadores tuyos sin candidato; NO se tocan ni se borran
 *   hidden      — federados sin nombre publicado, para enlazar a mano
 *   newcomers   — federados con nombre que no están en tu equipo
 */
export const buildRosterPlan = (localPlayers = [], fedPlayers = []) => {
  const linked = [];
  const suggestions = [];
  const unmatched = [];

  const fedByUuid = new Map(fedPlayers.map(f => [f.uuid, f]));
  const usados = new Set();

  // 1. Enlaces ya existentes: mandan sobre cualquier parecido de nombre.
  const pendientes = [];
  for (const local of localPlayers) {
    const yaEnlazado = local.federationUuid && fedByUuid.get(local.federationUuid);
    if (yaEnlazado) {
      usados.add(yaEnlazado.uuid);
      linked.push({ local, fed: yaEnlazado });
    } else {
      pendientes.push(local);
    }
  }

  // 2. Sugerencias por nombre, de mayor a menor puntuación, sin repetir ficha.
  const candidatos = [];
  for (const local of pendientes) {
    for (const fed of fedPlayers) {
      if (usados.has(fed.uuid) || fed.nameHidden) continue;
      const score = scoreMatch(local.name, fed.fullName);
      if (score >= MATCH_THRESHOLD) candidatos.push({ local, fed, score });
    }
  }
  candidatos.sort((x, y) => y.score - x.score);

  const localesResueltos = new Set();
  for (const c of candidatos) {
    if (usados.has(c.fed.uuid) || localesResueltos.has(c.local.id)) continue;
    usados.add(c.fed.uuid);
    localesResueltos.add(c.local.id);
    suggestions.push(c);
  }

  for (const local of pendientes) {
    if (!localesResueltos.has(local.id)) unmatched.push(local);
  }

  const restantes = fedPlayers.filter(f => !usados.has(f.uuid));
  return {
    linked,
    suggestions,
    unmatched,
    hidden: restantes.filter(f => f.nameHidden),
    newcomers: restantes.filter(f => !f.nameHidden),
  };
};

/**
 * Aplica las decisiones del entrenador y devuelve la plantilla nueva.
 *
 * Reglas duras:
 *   - Nunca se elimina un jugador existente.
 *   - Nunca se sobrescribe el nombre, el dorsal ni la posición ya guardados.
 *     La federación solo aporta el nombre inicial de los que se crean.
 */
export const applyRosterPlan = (localPlayers, { links = [], additions = [] }, makeId) => {
  const porLocal = new Map(links.map(l => [l.localId, l.uuid]));

  const actualizados = localPlayers.map(p =>
    porLocal.has(p.id) ? { ...p, federationUuid: porLocal.get(p.id) } : p
  );

  const nuevos = additions.map(f => ({
    id: makeId(),
    name: f.fullName,
    number: '',
    role: null,
    federationUuid: f.uuid,
  }));

  return [...actualizados, ...nuevos];
};
