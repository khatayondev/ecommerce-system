import { NextResponse } from 'next/server';
import { checkSMSBalance } from '@/utils/sms';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await checkSMSBalance();
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to check SMS balance' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      balance: result.balance,
      user: result.user,
      country: result.country
    });
  } catch (error) {
    console.error('API /api/sms-balance error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
