// importScripts('./ngsw-worker.js');

// self.addEventListener('push', (event) => {
//   if (!event.data) return;
//   try {
//     const data = event.data.json();
//     if (data.type !== 'PAYMENT_APPROVAL') return;

//     event.waitUntil(
//       self.registration.showNotification('Payment Request 💳', {
//         body: `RM ${Number(data.amount).toFixed(2)} from ${data.sellerName}. Open app to approve.`,
//         icon: '/favicon.svg',
//         badge: '/favicon.svg',
//         data: { url: '/balance' },
//         actions: [{ action: 'open', title: 'Open App' }],
//         requireInteraction: true,
//         vibrate: [200, 100, 200],
//         tag: 'payment-approval',
//         renotify: true,
//       }),
//     );
//   } catch {}
// });

// self.addEventListener('notificationclick', (event) => {
//   event.notification.close();
//   event.waitUntil(
//     clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
//       for (const client of clientList) {
//         if ('focus' in client) return client.focus();
//       }
//       if (clients.openWindow) return clients.openWindow('/balance');
//     }),
//   );
// });

// importScripts('./ngsw-worker.js');

// self.addEventListener('push', (event) => {
//   if (!event.data) return;
//   try {
//     const data = event.data.json();

//     let options = {
//       icon: '/favicon.svg',
//       badge: '/favicon.svg',
//       vibrate: [200, 100, 200],
//       data: { url: '/', type: data.type },
//       requireInteraction: false,
//     };

//     if (data.type === 'PAYMENT_APPROVAL') {
//       options = {
//         ...options,
//         body: data.message,
//         tag: 'payment-approval',
//         renotify: true,
//         requireInteraction: true,
//         actions: [{ action: 'open', title: '👀 View' }],
//       };
//       event.waitUntil(self.registration.showNotification('💳 ' + data.title, options));
//     } else if (data.type === 'PAYMENT_RECEIVED') {
//       options.data.url = '/sellerhistory';
//       options.tag = 'payment-received';
//       event.waitUntil(self.registration.showNotification('💰 ' + data.title, options));
//     } else if (data.type === 'PAYMENT_DEDUCTED') {
//       options.data.url = '/balance';
//       options.tag = 'payment-deducted';
//       event.waitUntil(self.registration.showNotification('🧾 ' + data.title, options));
//     } else if (data.type === 'ANNOUNCEMENT') {
//       options.data.url = '/balance';
//       options.tag = 'announcement';
//       event.waitUntil(self.registration.showNotification('📢 ' + data.title, options));
//     }
//   } catch {}
// });

// self.addEventListener('notificationclick', (event) => {
//   event.notification.close();
//   const url = event.notification.data?.url || '/';
//   event.waitUntil(
//     clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
//       for (const client of clientList) {
//         if ('focus' in client) return client.focus();
//       }
//       if (clients.openWindow) return clients.openWindow(url);
//     }),
//   );
// });
importScripts('./ngsw-worker.js');

self.addEventListener('push', (event) => {
  console.log('[SW] Push event fired!', event); // ← add this

  if (!event.data) {
    console.log('[SW] No data in push event'); // ← add this
    return;
  }
  if (!event.data) return;
  try {
    const data = event.data.json();
    console.log('[SW] Push data parsed:', data);

    // Common options
    const baseOptions = {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      requireInteraction: false,
    };

    if (data.type === 'PAYMENT_APPROVAL') {
      event.waitUntil(
        self.registration.showNotification('Payment Request 💳', {
          ...baseOptions,
          body: `RM ${Number(data.amount).toFixed(2)} from ${data.sellerName}. Open app to approve.`,
          data: { url: '/balance' },
          actions: [{ action: 'open', title: '👀 Open App' }],
          requireInteraction: true,
          tag: 'payment-approval',
          renotify: true,
        }),
      );
    } else if (data.type === 'PAYMENT_RECEIVED') {
      event.waitUntil(
        self.registration.showNotification('💰 ' + (data.title || 'Payment Received'), {
          ...baseOptions,
          body: data.message || 'You received a payment.',
          data: { url: '/scantopay' },
          tag: 'payment-received',
        }),
      );
    } else if (data.type === 'PAYMENT_DEDUCTED') {
      event.waitUntil(
        self.registration.showNotification('🧾 ' + (data.title || 'Payment Sent'), {
          ...baseOptions,
          body: data.message || 'Payment deducted from your balance.',
          data: { url: '/sellerhistory' },
          tag: 'payment-deducted',
        }),
      );
    } else if (data.type === 'ANNOUNCEMENT') {
      event.waitUntil(
        self.registration.showNotification('📢 ' + (data.title || 'Announcement'), {
          ...baseOptions,
          body: data.message || '',
          data: { url: '/balance' },
          tag: 'announcement-' + Date.now(), // unique tag so multiple don't replace each other
        }),
      );
    }
  } catch (e) {
    console.log('[SW] Parse error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/balance';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
