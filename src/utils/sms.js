export async function sendSMS(to, message) {
  const rawKey = process.env.ARKESEL_API_KEY;
  const apiKey = (rawKey && rawKey !== 'aVJZdWNFS3d6SmVVZkR6Z1loYXo') 
    ? rawKey 
    : 'Ulp6VGVsYndEd1lUdHBuY0lPaXY';
  const rawSender = process.env.ARKESEL_SENDER_ID;
  const senderId = (rawSender && rawSender.toLowerCase() !== 'honeypalace' && rawSender.length <= 11)
    ? rawSender.replace(/\s+/g, '')
    : 'PalaceHoney';
  
  if (!apiKey) {
    console.warn(`[SMS SIMULATION] To: ${to} | Msg: ${message} (Define ARKESEL_API_KEY to send real SMS)`);
    return { success: true, simulated: true };
  }

  // Clean phone number (strip whitespace, symbols, and leading +)
  let cleanedPhone = (to || '').replace(/[^\d+]/g, '');
  if (cleanedPhone.startsWith('+')) {
    cleanedPhone = cleanedPhone.substring(1);
  }
  // Convert 10-digit Ghana number starting with 0 (e.g. 024XXXXXXX) to 23324XXXXXXX
  if (cleanedPhone.length === 10 && cleanedPhone.startsWith('0')) {
    cleanedPhone = '233' + cleanedPhone.substring(1);
  }
  // Convert 9-digit Ghana number without leading 0 (e.g. 553986269) to 233553986269
  if (cleanedPhone.length === 9) {
    cleanedPhone = '233' + cleanedPhone;
  }

  if (!cleanedPhone) {
    return { success: false, error: 'Invalid recipient phone number.' };
  }

  // 1. Primary: Arkesel v2 REST API
  let data2 = null;
  try {
    const response2 = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        sender: senderId,
        recipients: [cleanedPhone],
        message: message
      })
    });
    data2 = await response2.json();

    const isSuccessV2 = data2.status === 'success' || 
                        data2.code === '1000' || 
                        data2.code === 1000 || 
                        data2.code === 'ok' || 
                        (data2.message && data2.message.toLowerCase().includes('success'));

    if (isSuccessV2) {
      console.log(`[SMS SUCCESS] Sent to ${cleanedPhone} via Arkesel v2 API`);
      return { success: true, data: data2 };
    }
  } catch (v2Err) {
    console.warn('[SMS GATEWAY] Arkesel v2 failed or timed out, trying v1 fallback...', v2Err.message);
  }

  // 2. Fallback: Arkesel v1 Gateway API
  try {
    const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(cleanedPhone)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(message)}`;
    
    const response1 = await fetch(v1Url, { 
      method: 'GET',
      signal: AbortSignal.timeout(15000)
    });
    const data1 = await response1.json();
    
    const isSuccessV1 = data1.status === 'success' || 
                        data1.code === '1000' || 
                        data1.code === 1000 || 
                        data1.code === 'ok' || 
                        (data1.message && data1.message.toLowerCase().includes('success'));

    if (isSuccessV1) {
      console.log(`[SMS SUCCESS] Sent to ${cleanedPhone} via Arkesel v1 API`);
      return { success: true, data: data1 };
    }

    console.error('Arkesel SMS gateway responded with error status:', data2, data1);
    return { success: false, error: (data2 && data2.message) || data1.message || 'Gateway failed to queue message' };
  } catch (err) {
    console.error('Exception error dispatching Arkesel SMS:', err);
    return { success: false, error: err.message };
  }
}

export async function checkSMSBalance() {
  const rawKey = process.env.ARKESEL_API_KEY;
  const apiKey = (rawKey && rawKey !== 'aVJZdWNFS3d6SmVVZkR6Z1loYXo') 
    ? rawKey 
    : 'Ulp6VGVsYndEd1lUdHBuY0lPaXY';

  try {
    const res = await fetch(`https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    const data = await res.json();
    return {
      success: true,
      balance: typeof data.balance === 'number' ? data.balance : Number(data.balance || 0),
      user: data.user || 'The Honey Palace',
      country: data.country || 'Ghana'
    };
  } catch (err) {
    console.error('Failed to fetch Arkesel SMS balance:', err);
    return { success: false, error: err.message, balance: null };
  }
}

