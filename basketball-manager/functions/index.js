const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.onAttendanceUpdate = functions
    .region('europe-west3')
    .firestore
    .document('matches/{matchId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        const newAttendance = newValue.attendance || {};
        const oldAttendance = previousValue.attendance || {};

        // Find players whose status actually changed to available or unavailable
        const updatedPlayerIds = Object.keys(newAttendance).filter(id => {
            const newStatus = newAttendance[id]?.status;
            const oldStatus = oldAttendance[id]?.status;
            return newStatus !== oldStatus && (newStatus === 'available' || newStatus === 'unavailable');
        });

        if (updatedPlayerIds.length === 0) return null;

        const teamId = newValue.teamId;
        const opponent = newValue.opponent;

        // Get team document to find ownerId and player names
        const teamDoc = await admin.firestore().collection('teams').doc(teamId).get();
        if (!teamDoc.exists) {
            console.log('Team not found:', teamId);
            return null;
        }
        const teamData = teamDoc.data();
        const ownerId = teamData.ownerId;
        const players = teamData.players || [];

        if (!ownerId) {
            console.log('No ownerId in team:', teamId);
            return null;
        }

        // Get Expo push token for native app
        const userTokenDoc = await admin.firestore().collection('userTokens').doc(ownerId).get();
        const expoToken = userTokenDoc.exists ? userTokenDoc.data().token : null;

        if (!expoToken || !expoToken.startsWith('ExponentPushToken[')) {
            console.log('No valid Expo token for user:', ownerId);
            return null;
        }

        // Build one message per changed player
        const expoMessages = updatedPlayerIds.map(playerId => {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : 'Jugador';
            const status = newAttendance[playerId].status;
            const emoji = status === 'available' ? '✅' : '❌';
            const action = status === 'available' ? 'asistirá' : 'no puede venir';
            return {
                to: expoToken,
                title: `vs ${opponent}`,
                body: `${emoji} ${playerName} ${action}`,
                sound: 'default',
                data: { matchId: context.params.matchId, teamId },
            };
        });

        console.log(`Sending ${expoMessages.length} Expo push(es) to ${ownerId}`);

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(expoMessages),
        });
        const data = await response.json();
        console.log('Expo Push Response:', JSON.stringify(data));

        return null;
    });

const Stripe = require('stripe');

function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// Creates a Stripe Checkout session. Called by subscribe.html with { userId, plan }.
exports.createCheckoutSession = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const stripe = new Stripe(functions.config().stripe.secret_key);
        const { userId, plan } = req.body;
        if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

        const priceId = plan === 'yearly'
            ? functions.config().stripe.price_yearly
            : functions.config().stripe.price_monthly;

        try {
            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                metadata: { userId },
                success_url: 'https://basketmanager-ed370.web.app/subscribe-success',
                cancel_url: `https://basketmanager-ed370.web.app/subscribe?uid=${userId}&plan=${plan || 'monthly'}`,
            });
            res.json({ url: session.url });
        } catch (e) {
            console.error('createCheckoutSession error:', e);
            res.status(500).json({ error: e.message });
        }
    });

// Stripe webhook — receives Stripe events and updates users/{uid}.subscription in Firestore.
// IMPORTANT: Firebase Functions provides req.rawBody automatically for HTTP functions.
exports.stripeWebhook = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        const stripe = new Stripe(functions.config().stripe.secret_key);
        const sig = req.headers['stripe-signature'];
        let event;
        try {
            event = stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                functions.config().stripe.webhook_secret
            );
        } catch (e) {
            console.error('Webhook signature failed:', e.message);
            res.status(400).send(`Webhook Error: ${e.message}`);
            return;
        }

        try {
            const db = admin.firestore();

            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                const userId = session.metadata?.userId;
                const clubId = session.metadata?.clubId;

                if (clubId) {
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    await db.collection('clubs').doc(clubId).set({
                        subscription: {
                            status: 'pro',
                            stripeCustomerId: session.customer,
                            stripeSubscriptionId: session.subscription,
                            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                            cancelAtPeriodEnd: sub.cancel_at_period_end,
                        }
                    }, { merge: true });
                } else if (userId) {
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    await db.collection('users').doc(userId).set({
                        subscription: {
                            status: 'pro',
                            stripeCustomerId: session.customer,
                            stripeSubscriptionId: session.subscription,
                            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                            cancelAtPeriodEnd: sub.cancel_at_period_end,
                        }
                    }, { merge: true });
                }
            }

            // NOTE: subscription.updated/deleted events do NOT carry checkout metadata.
            // Look up the user by stripeCustomerId stored in Firestore.
            else if (event.type === 'customer.subscription.updated') {
                const sub = event.data.object;
                const found = await findUserByCustomerId(db, sub.customer);
                if (!found) { res.json({ received: true }); return; }
                const collectionName = found.type === 'club' ? 'clubs' : 'users';
                await db.collection(collectionName).doc(found.id).set({
                    subscription: {
                        status: ['active', 'trialing'].includes(sub.status) ? 'pro' : 'free',
                        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                        cancelAtPeriodEnd: sub.cancel_at_period_end,
                    }
                }, { merge: true });
            }

            else if (event.type === 'customer.subscription.deleted') {
                const sub = event.data.object;
                const found = await findUserByCustomerId(db, sub.customer);
                if (!found) { res.json({ received: true }); return; }
                const collectionName = found.type === 'club' ? 'clubs' : 'users';
                await db.collection(collectionName).doc(found.id).set({
                    subscription: { status: 'free', stripeSubscriptionId: null, currentPeriodEnd: null }
                }, { merge: true });
            }

            else if (event.type === 'invoice.payment_failed') {
                const invoice = event.data.object;
                const found = await findUserByCustomerId(db, invoice.customer);
                if (!found) { res.json({ received: true }); return; }
                const collectionName = found.type === 'club' ? 'clubs' : 'users';
                await db.collection(collectionName).doc(found.id).set(
                    { subscription: { status: 'free' } },
                    { merge: true }
                );
            }

            res.json({ received: true });
        } catch (e) {
            console.error('stripeWebhook handler error:', e);
            res.status(500).json({ error: 'Internal error processing webhook' });
        }
    });

// Looks up a Firestore user or club document by the stripeCustomerId stored in subscription.
async function findUserByCustomerId(db, customerId) {
    // Check users first
    const userSnap = await db.collection('users')
        .where('subscription.stripeCustomerId', '==', customerId)
        .limit(1).get();
    if (!userSnap.empty) return { type: 'user', id: userSnap.docs[0].id };

    // Check clubs
    const clubSnap = await db.collection('clubs')
        .where('subscription.stripeCustomerId', '==', customerId)
        .limit(1).get();
    if (!clubSnap.empty) return { type: 'club', id: clubSnap.docs[0].id };

    return null;
}

// Creates a Stripe Customer Portal session. Called by manage.html with { userId }.
exports.createPortalSession = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const stripe = new Stripe(functions.config().stripe.secret_key);
        const { userId } = req.body;
        if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

        try {
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(userId).get();
            const customerId = userDoc.data()?.subscription?.stripeCustomerId;
            if (!customerId) { res.status(400).json({ error: 'No Stripe customer found' }); return; }

            const session = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: `https://basketmanager-ed370.web.app/manage?uid=${userId}`,
            });
            res.json({ url: session.url });
        } catch (e) {
            console.error('createPortalSession error:', e);
            res.status(500).json({ error: e.message });
        }
    });

// ── Clubs v2 ─────────────────────────────────────────────────────────────────

const TIER_LIMITS = { small: 10, medium: 20, large: 30 };

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `PARTITS-${suffix}`;
}

// Creates a new club. Admin must not already be in a club.
exports.createClub = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const { userId, name, tier, plan } = req.body;
        if (!userId || !name || !tier || !TIER_LIMITS[tier]) {
            res.status(400).json({ error: 'userId, name, and valid tier required' }); return;
        }

        const db = admin.firestore();

        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.data()?.clubId) {
                res.status(400).json({ error: 'Ya perteneces a un club' }); return;
            }

            let inviteCode;
            let attempts = 0;
            do {
                inviteCode = generateInviteCode();
                const existing = await db.collection('clubs').where('inviteCode', '==', inviteCode).limit(1).get();
                if (existing.empty) break;
                attempts++;
            } while (attempts < 10);

            const clubRef = db.collection('clubs').doc();
            await db.runTransaction(async (t) => {
                t.set(clubRef, {
                    name: name.trim(),
                    adminUid: userId,
                    members: [],
                    inviteCode,
                    tier,
                    subscription: { status: 'free' },
                    createdAt: new Date().toISOString(),
                });
                t.set(db.collection('users').doc(userId), { clubId: clubRef.id }, { merge: true });
            });

            res.json({ clubId: clubRef.id, inviteCode });
        } catch (e) {
            console.error('createClub error:', e);
            res.status(500).json({ error: e.message });
        }
    });

// Joins a club using an invite code. Validates capacity and club Pro status.
exports.joinClub = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const { userId, inviteCode } = req.body;
        if (!userId || !inviteCode) {
            res.status(400).json({ error: 'userId and inviteCode required' }); return;
        }

        const db = admin.firestore();

        try {
            const clubSnap = await db.collection('clubs').where('inviteCode', '==', inviteCode.trim().toUpperCase()).limit(1).get();
            if (clubSnap.empty) {
                res.status(404).json({ error: 'Código inválido' }); return;
            }
            const clubDoc = clubSnap.docs[0];
            const clubData = clubDoc.data();

            if (clubData.subscription?.status !== 'pro') {
                res.status(403).json({ error: 'El club no tiene suscripción activa' }); return;
            }
            if (userId === clubData.adminUid) {
                res.status(400).json({ error: 'Ya eres el administrador de este club' }); return;
            }
            if ((clubData.members || []).some(m => m.uid === userId)) {
                res.status(400).json({ error: 'Ya eres miembro de este club' }); return;
            }
            if ((clubData.members || []).length >= TIER_LIMITS[clubData.tier]) {
                res.status(403).json({ error: 'El club está lleno' }); return;
            }

            let displayName = '', email = '';
            try {
                const authUser = await admin.auth().getUser(userId);
                displayName = authUser.displayName || '';
                email = authUser.email || '';
            } catch (_) {}

            await db.runTransaction(async (t) => {
                const freshUser = await t.get(db.collection('users').doc(userId));
                if (freshUser.data()?.clubId) throw new Error('Ya perteneces a otro club');

                const freshClub = await t.get(db.collection('clubs').doc(clubDoc.id));
                const members = freshClub.data()?.members || [];
                if (members.length >= TIER_LIMITS[freshClub.data().tier]) throw new Error('El club está lleno');

                t.update(db.collection('clubs').doc(clubDoc.id), {
                    members: admin.firestore.FieldValue.arrayUnion({ uid: userId, displayName, email }),
                });
                t.set(db.collection('users').doc(userId), { clubId: clubDoc.id }, { merge: true });
            });

            res.json({ clubId: clubDoc.id, clubName: clubData.name });
        } catch (e) {
            console.error('joinClub error:', e);
            const status = ['Ya perteneces a otro club', 'El club está lleno'].includes(e.message) ? 400 : 500;
            res.status(status).json({ error: e.message });
        }
    });

// A member voluntarily leaves their club.
exports.leaveClub = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const { userId, clubId } = req.body;
        if (!userId || !clubId) {
            res.status(400).json({ error: 'userId and clubId required' }); return;
        }

        const db = admin.firestore();

        try {
            await db.runTransaction(async (t) => {
                const clubRef = db.collection('clubs').doc(clubId);
                const userRef = db.collection('users').doc(userId);
                const clubDoc = await t.get(clubRef);

                if (!clubDoc.exists) throw new Error('Club no encontrado');
                if (clubDoc.data().adminUid === userId) throw new Error('El administrador no puede salir del club');

                const member = (clubDoc.data().members || []).find(m => m.uid === userId);
                if (!member) throw new Error('No eres miembro de este club');

                t.update(clubRef, { members: admin.firestore.FieldValue.arrayRemove(member) });
                t.set(userRef, { clubId: null }, { merge: true });
            });

            res.json({ success: true });
        } catch (e) {
            console.error('leaveClub error:', e);
            res.status(400).json({ error: e.message });
        }
    });

// Admin removes a member from the club.
exports.removeMember = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const { adminId, clubId, memberId } = req.body;
        if (!adminId || !clubId || !memberId) {
            res.status(400).json({ error: 'adminId, clubId, and memberId required' }); return;
        }

        const db = admin.firestore();

        try {
            await db.runTransaction(async (t) => {
                const clubRef = db.collection('clubs').doc(clubId);
                const memberUserRef = db.collection('users').doc(memberId);
                const clubDoc = await t.get(clubRef);

                if (!clubDoc.exists) throw new Error('Club no encontrado');
                if (clubDoc.data().adminUid !== adminId) throw new Error('Solo el administrador puede expulsar miembros');

                const member = (clubDoc.data().members || []).find(m => m.uid === memberId);
                if (!member) throw new Error('El usuario no es miembro de este club');

                t.update(clubRef, { members: admin.firestore.FieldValue.arrayRemove(member) });
                t.set(memberUserRef, { clubId: null }, { merge: true });
            });

            res.json({ success: true });
        } catch (e) {
            console.error('removeMember error:', e);
            res.status(400).json({ error: e.message });
        }
    });

// Creates a Stripe Checkout session for a club tier. Called by club-subscribe.html.
exports.createClubCheckoutSession = functions
    .region('europe-west3')
    .https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        const stripe = new Stripe(functions.config().stripe.secret_key);
        const { userId, clubId, tier, plan } = req.body;

        if (!userId || !clubId || !tier || !TIER_LIMITS[tier]) {
            res.status(400).json({ error: 'userId, clubId, and valid tier required' }); return;
        }

        const db = admin.firestore();

        try {
            const clubDoc = await db.collection('clubs').doc(clubId).get();
            if (!clubDoc.exists || clubDoc.data().adminUid !== userId) {
                res.status(403).json({ error: 'Solo el administrador puede gestionar la suscripción' }); return;
            }

            const configKey = `club_price_${tier}_${plan === 'yearly' ? 'yearly' : 'monthly'}`;
            const priceId = functions.config().stripe[configKey];
            if (!priceId) { res.status(500).json({ error: `Price config missing: ${configKey}` }); return; }

            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                metadata: { clubId },
                success_url: 'https://basketmanager-ed370.web.app/club-subscribe-success',
                cancel_url: `https://basketmanager-ed370.web.app/club-subscribe?uid=${userId}&clubId=${clubId}&tier=${tier}&plan=${plan || 'monthly'}`,
            });
            res.json({ url: session.url });
        } catch (e) {
            console.error('createClubCheckoutSession error:', e);
            res.status(500).json({ error: e.message });
        }
    });
