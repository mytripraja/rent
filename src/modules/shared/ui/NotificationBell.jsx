import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Info, FileText, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToNotifications, markAsRead, markAllAsRead } from '../../../services/notificationService';

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToNotifications(userId, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await markAllAsRead(userId);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Failed to mark as read', error);
      }
    }
    setIsOpen(false);
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'rent_approved': return <CheckCircle className="w-5 h-5 text-stamp-green" />;
      case 'rent_rejected': return <AlertCircle className="w-5 h-5 text-stamp-red" />;
      case 'notice_posted': return <FileText className="w-5 h-5 text-brass" />;
      case 'eb_bill_created': return <AlertTriangle className="w-5 h-5 text-stamp-amber" />;
      case 'complaint_received': return <MessageSquare className="w-5 h-5 text-cover" />;
      case 'payment_reminder': return <RefreshCw className="w-5 h-5 text-brass" />;
      case 'rent_submitted': return <FileText className="w-5 h-5 text-cover" />;
      default: return <Info className="w-5 h-5 text-ink-soft" />;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const daysDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
    const hoursDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));
    const minutesDifference = Math.round((timestamp - Date.now()) / (1000 * 60));

    if (Math.abs(minutesDifference) < 60) {
      return rtf.format(minutesDifference, 'minute');
    } else if (Math.abs(hoursDifference) < 24) {
      return rtf.format(hoursDifference, 'hour');
    } else {
      return rtf.format(daysDifference, 'day');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-cover"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-ink" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-paper bg-stamp-red rounded-full border-2 border-paper">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-paper-raised border border-brass/30 rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-brass/20 bg-paper">
              <h3 className="font-display font-semibold text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 text-xs font-medium text-cover hover:text-cover/80 transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-ink-soft">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-brass/10">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-brass/10 hover:bg-brass/20' : 'hover:bg-black/5'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getIconForType(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.read ? 'font-semibold text-ink' : 'font-medium text-ink/90'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-ink-soft mt-0.5 break-words">
                          {notification.message}
                        </p>
                        <p className="text-xs text-ink-soft/70 mt-1 font-mono">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0 flex items-center">
                          <div className="w-2 h-2 rounded-full bg-cover"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
