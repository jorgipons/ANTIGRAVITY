import { Linking } from 'react-native';

const BASE_URL = 'https://basketmanager-ed370.web.app';

export function openSubscribePage(userId, plan = 'monthly') {
  Linking.openURL(`${BASE_URL}/subscribe?uid=${encodeURIComponent(userId)}&plan=${plan}`);
}

export function openManagePage(userId) {
  Linking.openURL(`${BASE_URL}/manage?uid=${encodeURIComponent(userId)}`);
}

export function openClubSubscribePage(userId, clubId, tier = 'small', plan = 'monthly') {
  const url = `${BASE_URL}/club-subscribe?uid=${encodeURIComponent(userId)}&clubId=${encodeURIComponent(clubId)}&tier=${tier}&plan=${plan}`;
  Linking.openURL(url);
}
