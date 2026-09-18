export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  const permission = await Notification.requestPermission()
  return permission // 'granted' | 'denied' | 'default'
}

export function showBrowserNotification(title, body, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, { 
      body, 
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options 
    })
  }
}

export function isNotificationSupported() {
  return 'Notification' in window
}

export function isNotificationGranted() {
  return 'Notification' in window && Notification.permission === 'granted'
}
