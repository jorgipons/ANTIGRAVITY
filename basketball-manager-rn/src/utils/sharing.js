export const generateInfoPartido = (match, team, lang = 'val') => {
  if (!match || !team) return '';
  
  const date = new Date(match.date);
  const dayName = lang === 'val' 
    ? ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'][date.getDay()]
    : ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][date.getDay()];

  const rival = match.opponent;
  const teamName = team.name;
  const horaIni = match.time;
  const horaConvo = match.callTime || '---';
  const location = match.location || (match.isHome ? (lang === 'val' ? 'Local' : 'Local') : (lang === 'val' ? 'Visitant' : 'Visitante'));

  if (lang === 'val') {
    return `Hola, aquesta és la informació del pròxim partit:\n\n` +
      `⚠ IMPORTANT! ⚠\nAvisar perfavor si algú no pot vindre per planificar quant abans millor.\n\n` +
      `👕  ${teamName} vs ${rival}\n📍  ${location}\n🗓  ${dayName}\n🤝  ${horaConvo}h (Convocatòria)\n🏀  ${horaIni}h (Inici partit)`;
  } else {
    return `Hola, esta es la información del próximo partido:\n\n` +
      `⚠ ¡IMPORTANTE! ⚠\nAvisad por favor si alguien no puede venir para planificar cuanto antes mejor.\n\n` +
      `👕  ${teamName} vs ${rival}\n📍  ${location}\n🗓  ${dayName}\n🤝  ${horaConvo}h (Convocatoria)\n🏀  ${horaIni}h (Inicio partido)`;
  }
};

export const generateInfoConvo = (match, team, players, lang = 'val') => {
  if (!match || !team) return '';
  
  let baseInfo = generateInfoPartido(match, team, lang);
  baseInfo = baseInfo.replace('informació del pròxim partit', 'convocatòria per al pròxim partit');
  baseInfo = baseInfo.replace('información del próximo partido', 'convocatoria para el próximo partido');

  const attendance = match.attendance || {};
  const confirmed = players.filter(p => attendance[p.id]?.status === 'available');
  
  if (confirmed.length === 0) return baseInfo;

  const playersText = confirmed.map(p => `- ${p.name}`).join('\n');
  if (lang === 'val') {
    return `${baseInfo}\n\n👥  Convocats:\n${playersText}`;
  } else {
    return `${baseInfo}\n\n👥  Convocados:\n${playersText}`;
  }
};

export const getAttendanceLink = (teamId, matchId, isPublic = true) => {
  const isPublicParam = isPublic ? '?public=true' : '';
  return `https://app.pasarelamanager.com/match/${teamId}/${matchId}${isPublicParam}`;
};
