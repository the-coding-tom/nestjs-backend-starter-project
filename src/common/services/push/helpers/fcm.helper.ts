import * as admin from 'firebase-admin';
import { config } from '../../../../config/config';

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (!config.fcm.serviceAccountKeyPath && !config.fcm.serviceAccountKey) {
    throw new Error('FCM service account key is not configured. Provide either FCM_SERVICE_ACCOUNT_KEY_PATH or FCM_SERVICE_ACCOUNT_KEY');
  }

  const credential = config.fcm.serviceAccountKey
    ? admin.credential.cert(config.fcm.serviceAccountKey as admin.ServiceAccount)
    : admin.credential.cert(config.fcm.serviceAccountKeyPath!);

  firebaseApp = admin.initializeApp({
    credential,
  });

  return firebaseApp;
}

interface SendPushNotificationParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send push notification via FCM
 *
 * @param params - Push notification parameters
 * @returns Promise with message ID
 * @throws Error if API call fails
 */
export async function sendPushNotification(
  params: SendPushNotificationParams,
): Promise<{ messageId: string }> {
  const app = initializeFirebase();
  const messaging = admin.messaging(app);

  const message: admin.messaging.Message = {
    token: params.token,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: params.data
      ? Object.entries(params.data).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        )
      : undefined,
    android: {
      priority: 'high' as const,
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
    },
  };

  const response = await messaging.send(message);

  return {
    messageId: response,
  };
}
