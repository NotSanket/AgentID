import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

export type NotificationType = "success" | "error" | "warning" | "info";
interface Notification { id: number; type: NotificationType; title: string; message?: string }
interface NotificationContextValue { notify: (notification: Omit<Notification, "id">) => void }

const NotificationContext = createContext<NotificationContextValue | null>(null);
const icons = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert, info: Info };

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismiss = useCallback((id: number) => {
    setNotifications((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((notification: Omit<Notification, "id">) => {
    const id = Date.now() + Math.random();
    setNotifications((items) => [...items, { ...notification, id }]);
    window.setTimeout(() => dismiss(id), 4_500);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <aside className="toast-stack" aria-live="polite" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {notifications.map((notification) => {
            const Icon = icons[notification.type];
            return (
              <motion.div
                className={`toast toast-${notification.type}`}
                key={notification.id}
                initial={{ opacity: 0, x: 18, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 12, scale: 0.98 }}
              >
                <Icon size={18} aria-hidden="true" />
                <div><strong>{notification.title}</strong>{notification.message && <p>{notification.message}</p>}</div>
                <button type="button" onClick={() => dismiss(notification.id)} aria-label="Dismiss notification"><X size={15} /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </aside>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider.");
  return context;
}
