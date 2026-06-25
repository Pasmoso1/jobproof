export type TwilioSendResult =
  | { sent: true; messageSid: string }
  | { sent: false; reason: "not_configured" | "send_failed"; error?: string };

export function isTwilioConfigured(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = process.env.TWILIO_FROM_PHONE_NUMBER?.trim();
  return Boolean(accountSid && authToken && (messagingServiceSid || fromNumber));
}

/**
 * Send a transactional SMS via Twilio Programmable Messaging. Never throws.
 */
export async function sendTwilioSms(
  toE164: string,
  body: string
): Promise<TwilioSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = process.env.TWILIO_FROM_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    console.warn("[twilio-sms] not configured");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams();
    params.set("To", toE164);
    params.set("Body", body);
    if (messagingServiceSid) {
      params.set("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      params.set("From", fromNumber);
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[twilio-sms] send failed", {
        status: response.status,
        message: errorText.slice(0, 500),
      });
      return { sent: false, reason: "send_failed", error: errorText.slice(0, 500) };
    }

    const data = (await response.json()) as { sid?: string };
    return { sent: true, messageSid: String(data.sid ?? "") };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[twilio-sms] unexpected error", { message });
    return { sent: false, reason: "send_failed", error: message };
  }
}
