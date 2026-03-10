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

        // Fetch user (coach) tokens
        const userDoc = await admin.firestore().collection('users').doc(ownerId).get();
        const tokens = userDoc.exists ? (userDoc.data().fcmTokens || []) : [];

        if (tokens.length === 0) {
            console.log('No FCM tokens found for user:', ownerId);
            return null;
        }

        // Fetch player names from the team document
        const teamDoc = await admin.firestore().collection('teams').doc(teamId).get();
        const players = teamDoc.exists ? (teamDoc.data().players || []) : [];

        // Prepare messages for Multicast (FCM v1)
        const messages = [];
        for (const playerId of updatedPlayerIds) {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : 'Jugador';
            const statusLabel = newAttendance[playerId].status === 'available' ? 'ASISTIRÁ' : 'NO ASISTIRÁ';

            tokens.forEach(token => {
                messages.push({
                    token: token,
                    notification: {
                        title: `${playerName} ${statusLabel}`,
                        body: `al partido vs ${opponent}`
                    },
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
        }

        if (messages.length === 0) return null;

        console.log(`Sending ${messages.length} individual messages via Multicast API...`);
        try {
            const response = await admin.messaging().sendEach(messages);
            console.log('FCM Multicast Response:', JSON.stringify(response));
        } catch (error) {
            console.error('FCM Multicast Error:', error);
        }

        return null;
    });
