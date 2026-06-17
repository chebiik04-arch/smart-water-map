import { sendSms } from "../providers/smsProvider.js";

export async function dispatchAlert(alert, recipients = []) {
  const message = `[${alert.severity}] ${alert.message}`;
  return sendSms({ recipients, message });
}
