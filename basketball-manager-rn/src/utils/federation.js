import { Alert } from 'react-native';

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Base64 decoding helper
const atob = (input = '') => {
  let str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 == 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  for (let bc = 0, bs = 0, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
};

// UTF-8 decoding helper
const decodeBase64UTF8 = (str) => {
  try {
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    let out = "", i = 0, len = bytes.length;
    while(i < len) {
      let c = bytes[i++];
      switch(c >> 4) { 
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
          out += String.fromCharCode(c);
          break;
        case 12: case 13:
          let char2 = bytes[i++];
          out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
          break;
        case 14:
          let char2a = bytes[i++];
          let char3 = bytes[i++];
          out += String.fromCharCode(((c & 0x0F) << 12) | ((char2a & 0x3F) << 6) | ((char3 & 0x3F) << 0));
          break;
      }
    }
    return out;
  } catch (e) {
    console.error("Base64 decode error:", e);
    return null;
  }
};

export const importFederationMatches = async (federationId, mode = 'smart') => {
  try {
    const url = `https://esb.optimalwayconsulting.com/fbcv/1/btz38ZsZlAdaODiH2fGsnJC9mZgSNPeR/FCBQWeb/getTeamCard/${federationId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al conectar con la federación.');

    const base64Data = await response.text();
    const decodedStr = decodeBase64UTF8(base64Data);
    if (!decodedStr) throw new Error('Error decodificando la respuesta.');

    const jsonData = JSON.parse(decodedStr);
    if (jsonData.result !== 'OK') throw new Error(jsonData.message || 'Error federación.');

    const teamData = jsonData.messageData.team;
    const groups = teamData.groups || [];

    const matchesToImport = [];

    for (const group of groups) {
      const idGroup = group.idGroup;
      if (!idGroup) continue;

      try {
        const resultsBaseUrl = `https://esb.optimalwayconsulting.com/fbcv/1/btz38ZsZlAdaODiH2fGsnJC9mZgSNPeR/FCBQWeb/resultats/${idGroup}`;
        const resultsResponse = await fetch(resultsBaseUrl);
        if (!resultsResponse.ok) continue;

        const resultsBase64 = await resultsResponse.text();
        const resultsData = JSON.parse(decodeBase64UTF8(resultsBase64));

        if (resultsData.result !== 'OK') continue;

        const totalRounds = parseInt(resultsData.messageData.totalRounds || 0);
        const lastRound = parseInt(resultsData.messageData.lastRound || 0);

        let roundsToFetch = [];
        if (mode === 'total') {
            for (let i = 1; i <= totalRounds; i++) roundsToFetch.push(i);
        } else if (mode === 'next') {
            if (lastRound < totalRounds) roundsToFetch.push(lastRound + 1);
            else roundsToFetch.push(lastRound);
        } else { // smart
            roundsToFetch.push(lastRound);
            if (lastRound < totalRounds) roundsToFetch.push(lastRound + 1);
        }

        for (const roundNum of roundsToFetch) {
          try {
            const roundUrl = `${resultsBaseUrl}/${roundNum}`;
            const roundResponse = await fetch(roundUrl);
            if (!roundResponse.ok) continue;

            const roundBase64 = await roundResponse.text();
            const roundData = JSON.parse(decodeBase64UTF8(roundBase64));
            if (roundData.result !== 'OK') continue;

            const rounds = roundData.messageData.rounds || {};
            const roundInfo = rounds[roundNum] || {};
            const matches = roundInfo.matches || {};

            for (const matchId in matches) {
              const match = matches[matchId];
              const localId = match.idLocalTeam;
              const visitorId = match.idVisitorTeam;

              if (String(localId) !== String(federationId) && String(visitorId) !== String(federationId)) continue;

              const isHome = String(localId) === String(federationId);
              const opponent = isHome ? (match.nameVisitorTeam || match.visitorTeam?.name || 'Rival') : (match.nameLocalTeam || match.localTeam?.name || 'Rival');

              let matchDate = '';
              let matchTime = '';
              if (match.matchDay) {
                  const parts = match.matchDay.split(' ');
                  if (parts[0].includes('/')) {
                      const [d, m, y] = parts[0].split('/');
                      matchDate = `${y}-${m}-${d}`;
                  } else {
                      matchDate = parts[0];
                  }
                  if (parts[1]) matchTime = parts[1].substring(0, 5);
              }

              const matchDateTime = new Date(match.matchDay?.replace(' ', 'T') || `${matchDate}T${matchTime || '00:00'}:00`);
              const isPast = matchDateTime < new Date();

              let score = null;
              let result = null;

              if (match.localScore != null && match.visitorScore != null && match.localScore !== '' && match.visitorScore !== '') {
                  const lScore = parseInt(match.localScore);
                  const vScore = parseInt(match.visitorScore);
                  score = { local: lScore, visitor: vScore };
                  const ourScore = isHome ? lScore : vScore;
                  const theirScore = isHome ? vScore : lScore;
                  if (ourScore > theirScore) result = 'won';
                  else if (ourScore < theirScore) result = 'lost';
                  else result = 'draw';
              }

              let callTime = '00:00';
              if (matchTime && isHome) {
                  const [h, m] = matchTime.split(':').map(Number);
                  let callH = h - 1;
                  if (callH < 0) callH += 24;
                  callTime = `${String(callH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              }

              matchesToImport.push({
                  opponent,
                  date: matchDate,
                  time: matchTime,
                  callTime,
                  location: match.nameField || match.fieldName || '',
                  matchDay: match.numMatchDay || roundNum || '',
                  isHome,
                  state: (isPast && score) ? 'finished' : 'pending',
                  score,
                  result,
                  federationMatchId: String(match.idMatch || matchId),
                  observations: match.observations || ''
              });
            }
          } catch(e) {}
        }
      } catch (e) {}
    }

    return { success: true, matches: matchesToImport };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const syncWithFederation = async (federationId) => {
  try {
    const url = `https://esb.optimalwayconsulting.com/fbcv/1/btz38ZsZlAdaODiH2fGsnJC9mZgSNPeR/FCBQWeb/getTeamCard/${federationId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Error al conectar con la federación');
    }

    const base64Data = await response.text();
    const jsonData = JSON.parse(decodeBase64UTF8(base64Data));

    if (jsonData.result !== 'OK') {
      throw new Error(jsonData.message || 'Error en la respuesta de la federación');
    }

    const teamData = jsonData.messageData.team;
    const groups = teamData.groups || [];

    // Buscar la clasificación del equipo en sus grupos
    let myStanding = null;
    for (const group of groups) {
      const standings = group.standing || [];
      const found = standings.find(s => String(s.idTeam) === String(federationId));
      if (found) {
        myStanding = found;
        break;
      }
    }

    return {
      success: true,
      data: {
        clubName: teamData.entityName || null,
        teamName: teamData.name || null,
        category: teamData.categoriesRegisteredName || teamData.categoryName || null,
        logo: teamData.entityLogo || null,
        field: {
          name: teamData.fieldName || null,
          address: teamData.fieldAddress || null,
          town: teamData.fieldTown || null
        },
        standing: myStanding ? {
          position: parseInt(myStanding.position) || 0,
          points: parseInt(myStanding.standingScore) || 0,
          wins: parseInt(myStanding.matchWin) || 0,
          losses: parseInt(myStanding.matchLost) || 0,
          played: parseInt(myStanding.matchPlayed) || 0,
          scoreFavour: parseInt(myStanding.matchScoreFavour) || 0,
          scoreAgainst: parseInt(myStanding.matchScoreAgainst) || 0
        } : null,
        lastSync: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ Error syncing with federation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
