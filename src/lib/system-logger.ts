import { SystemLog } from "@/lib/models/system-log";

type LogEventType = 
  | "login_success" 
  | "login_failed" 
  | "suspicious_activity" 
  | "system_error" 
  | "rate_limit_exceeded" 
  | "logout" 
  | "admin_action";

type LogSeverity = "info" | "warning" | "critical";

interface LogPayload {
  eventType: LogEventType;
  ipAddress?: string;
  email?: string;
  userId?: string;
  details?: any;
  severity?: LogSeverity;
}

/**
 * Asynchronously writes a system event to the Audit Log.
 * Does not block the main execution thread.
 */
export function logSystemEvent(payload: LogPayload) {
  // Fire and forget, wrapping in a try-catch to ensure it never throws an unhandled rejection
  Promise.resolve().then(async () => {
    try {
      await SystemLog.create({
        eventType: payload.eventType,
        ipAddress: payload.ipAddress || "unknown",
        email: payload.email,
        userId: payload.userId,
        details: payload.details,
        severity: payload.severity || "info"
      });
    } catch (err) {
      console.error("[SystemLogger] Failed to write audit log:", err);
    }
  });
}
