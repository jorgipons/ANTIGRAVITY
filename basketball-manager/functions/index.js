const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Cloud Function to trigger a push notification when attendance is confirmed.
 * It listens for changes in the 'attendance' field of the 'matches' collection.
 */
exports.onAttendanceUpdate = functions.firestore
    .document('matches/{matchId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        // Check if attendance field has changed
        const newAttendance = newValue.attendance || {};
        const oldAttendance = previousValue.attendance || {};

        // Find the IDs that were updated or added
        const updatedPlayerIds = Object.keys(newAttendance).filter(id => {
            const newItem = newAttendance[id];
            const oldItem = oldAttendance[id];
            // Trigger if newly added OR if ANY field within the player's attendance object changed (like a nonce)
            return !oldItem || JSON.stringify(newItem) !== JSON.stringify(oldItem);
        });

        if (updatedPlayerIds.length === 0) return null;

        const teamId = newValue.teamId;
        const opponent = newValue.opponent;
        const ownerId = newValue.ownerId;

        // Fetch user (coach) FCM tokens for PWA
        const userDoc = await admin.firestore().collection('users').doc(ownerId).get();
        const fcmTokens = userDoc.exists ? (userDoc.data().fcmTokens || []) : [];

        // Fetch user Expo Push Token for Native App
        const userTokenDoc = await admin.firestore().collection('userTokens').doc(ownerId).get();
        const expoToken = userTokenDoc.exists ? userTokenDoc.data().token : null;

        if (fcmTokens.length === 0 && !expoToken) {
            console.log('No FCM or Expo tokens found for user:', ownerId);
            return null;
        }

        // Fetch player names from the team document
        const teamDoc = await admin.firestore().collection('teams').doc(teamId).get();
        const players = teamDoc.exists ? (teamDoc.data().players || []) : [];

        // Prepare messages for Multicast (FCM v1)
        const fcmMessages = [];
        const expoMessages = [];

        for (const playerId of updatedPlayerIds) {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : 'Jugador';
            const statusLabel = newAttendance[playerId].status === 'available' ? '✅ ASISTIRÁ' : '❌ NO ASISTIRÁ';
            const title = `${opponent}`;
            const body = `${playerName} ${statusLabel}`;

            fcmTokens.forEach(token => {
                fcmMessages.push({
                    token: token,
                    notification: { title, body },
                    webpush: {
                        fcm_options: {
                            link: `https://basketmanager-ed370.web.app/#attendance-status?matchId=${context.params.matchId}`
                        },
                        notification: {
                            icon: 'https://cdn-icons-png.flaticon.com/512/889/889442.png'
                        }
                    }
                });
            });

            if (expoToken && expoToken.startsWith('ExponentPushToken[')) {
                expoMessages.push({
                    to: expoToken,
                    title: title,
                    body: body,
                    sound: 'default',
                    data: { matchId: context.params.matchId, teamId: teamId }
                });
            }
        }

        if (fcmMessages.length > 0) {
            console.log(`Sending ${fcmMessages.length} FCM messages...`);
            try {
                const response = await admin.messaging().sendEach(fcmMessages);
                console.log('FCM Multicast Response:', JSON.stringify(response));
            } catch (error) {
                console.error('FCM Multicast Error:', error);
            }
        }

        if (expoMessages.length > 0) {
            console.log(`Sending ${expoMessages.length} Expo messages...`);
            try {
                // To send Expo pushes we do an HTTP POST to exp.host
                // Node 22 has global fetch
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(expoMessages)
                });
                const data = await response.json();
                console.log('Expo Push Response:', JSON.stringify(data));
            } catch (error) {
                console.error('Expo Push Error:', error);
            }
        }

        return null;
    });
