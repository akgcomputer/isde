import { getPushSubscriptions } from './db';

const publicVapidKey = 'BKOH_T9sAo-B0LbqG-gIoZ9-p8mLnYfAl5_DbS8aFlBOTEc1dyisvXhlbVTjqtYGuq31Q115eVkDzabsmFUHFBw';
const privateVapidKey = 'VnuAEWj_ELB5TJdJgQpOaWwHLVdgTLykBzzICNmlr8g';

export async function sendPushNotification(title: string, body: string, url: string, dbBinding?: any) {
  let webpush;
  try {
    webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      'mailto:iletisim@laflaf.net',
      publicVapidKey,
      privateVapidKey
    );
  } catch (err) {
    console.error('Web Push is not available in this environment:', err);
    return 0;
  }

  const subscriptions = await getPushSubscriptions(dbBinding);
  
  if (subscriptions.length === 0) return 0;
  
  const payload = JSON.stringify({
    title,
    body,
    url,
    icon: '/favicon.svg'
  });

  let successCount = 0;
  
  const pushPromises = subscriptions.map(async (sub) => {
    try {
      // In DB, keys might be stored as a JSON string
      const parsedKeys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys;
      
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: parsedKeys
      };
      
      await webpush.sendNotification(pushSubscription, payload);
      successCount++;
    } catch (error) {
      console.error('Bildirim gönderme hatası:', error);
      // In a real app, if error.statusCode === 410 (Gone), delete the subscription
    }
  });

  await Promise.allSettled(pushPromises);
  
  return successCount;
}
