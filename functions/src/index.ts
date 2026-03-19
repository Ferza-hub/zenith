import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

admin.initializeApp();

// Access secrets - ensure you run `firebase functions:config:set lemonsqueezy.secret="YOUR_SECRET"`
const config: any = (functions as any).config();
const LS_WEBHOOK_SECRET = config?.lemonsqueezy?.secret;

export const lsWebhook = functions.https.onRequest(async (req, res) => {
  // 1. Verify Signature
  const rawBody = req.rawBody;
  const signature = req.get('X-Signature');

  if (!signature || !LS_WEBHOOK_SECRET) {
    console.warn('Missing signature or secret');
    res.status(400).send('Invalid signature or missing secret');
    return;
  }

  const hmac = crypto.createHmac('sha256', LS_WEBHOOK_SECRET);
  const digest = hmac.update(rawBody).digest('hex');

  // Lemon Squeezy provides the signature in hex
  if (signature !== digest) {
    console.error('Signature mismatch');
    res.status(400).send('Signature mismatch');
    return;
  }

  // 2. Parse Event
  const event = req.body;
  const eventName = event.meta?.event_name;

  if (eventName === 'order_created') {
    const attributes = event.data.attributes;
    const email = attributes.user_email;

    // 3. Update Firestore
    try {
      await admin.firestore().collection('users').doc(email).set({
        isUnlocked: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        orderId: event.data.id,
      }, { merge: true });

      console.log(`User ${email} unlocked successfully.`);
      res.status(200).send('Success');
    } catch (error) {
      console.error('Error updating firestore:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(200).send('Event skipped');
  }
});
