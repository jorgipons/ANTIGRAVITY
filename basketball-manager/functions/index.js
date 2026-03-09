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

        // Find the newly added/updated attendance entry
        const newPlayerIds = Object.keys(newAttendance).filter(id => !oldAttendance[id] || oldAttendance[id].status !== newAttendance[id].status);

        if (newPlayerIds.length === 0) return null;

        const teamId = newValue.teamId;
        const opponent = newValue.opponent;
        const ownerId = newValue.ownerId;

        // Fetch user (coach) tokens
        const userDoc = await admin.firestore().collection('users').doc(ownerId).get();
        const tokens = userDoc.exists ? (userDoc.data().fcmTokens || []) : [];

        if (tokens.length === 0) {
            console.log('No FCM tokens found for user:', ownerId);
            return null;
        }

        // Fetch player name for the notification
        const teamDoc = await admin.firestore().collection('teams').doc(teamId).get();
        const players = teamDoc.exists ? (teamDoc.data().players || []) : [];

        for (const playerId of newPlayerIds) {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : 'Un jugador';
            const status = newAttendance[playerId].status === 'available' ? 'ASISTIRÁ' : 'NO ASISTIRÁ';

            const payload = {
                notification: {
                    title: 'Confirmación de Asistencia',
                    body: `${playerName} ${status} al partido contra ${opponent}`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/889/889442.png',
                    clickAction: `https://basketmanager-ed370.web.app/#attendance-status?matchId=${context.params.matchId}`
                }
            };

            console.log(`Sending notification for player ${playerName} to user ${ownerId}`);
            try {
                const response = await admin.messaging().sendToDevice(tokens, payload);
                console.log('Notification sent successfully:', response);
            } catch (error) {
                console.error('Error sending notification:', error);
            }
        }

        return null;
    });
