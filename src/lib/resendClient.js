import { Resend } from 'resend';

export const VERIFIED_RESEND_KEY = process.env.RESEND_API_KEY || '';

/**
 * Robust email dispatcher with automatic fallback to verified API key
 */
export async function sendEmailWithFallback(payload) {
  const envKey = (process.env.RESEND_API_KEY || '').trim();
  // If envKey is provided, valid format, and not a placeholder, try it, otherwise use verified key
  const primaryKey = (envKey && envKey.startsWith('re_') && !envKey.includes('dummy') && !envKey.includes('SENSITIVE'))
    ? envKey
    : VERIFIED_RESEND_KEY;

  const safePayload = {
    ...payload,
    from: payload.from || 'The Honey Palace <purchases@thehoneypalaceafrica.com>',
    replyTo: payload.replyTo || 'purchases@thehoneypalaceafrica.com',
  };

  // 1. Primary attempt
  try {
    const resend = new Resend(primaryKey);
    const res = await resend.emails.send(safePayload);
    if (!res.error) {
      return { success: true, data: res.data };
    }
    console.warn('[ResendClient] Initial attempt failed with error:', res.error?.message);
  } catch (err) {
    console.warn('[ResendClient] Initial attempt threw error:', err?.message);
  }

  // 2. If primaryKey was not the verified master key, fallback to verified master key
  if (primaryKey !== VERIFIED_RESEND_KEY) {
    try {
      console.log('[ResendClient] Retrying with verified master key...');
      const fallbackResend = new Resend(VERIFIED_RESEND_KEY);
      const res = await fallbackResend.emails.send(safePayload);
      if (!res.error) {
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error.message || 'Email delivery failed' };
    } catch (err) {
      return { success: false, error: err.message || 'Email delivery failed' };
    }
  }

  return { success: false, error: 'Email delivery failed' };
}
