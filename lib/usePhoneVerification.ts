import { useState } from 'react';
import { supabase } from './supabase';

export type VerifyStep = 'idle' | 'sending' | 'verifying' | 'done' | 'error';

// Switch to false when real SMS (Twilio) is configured
const IS_DEV_MODE = true;

export function usePhoneVerification() {
  const [step, setStep] = useState<VerifyStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sendOtp = async (phone: string): Promise<boolean> => {
    setStep('sending');
    setErrorMsg('');

    if (IS_DEV_MODE) {
      // DEV: skip SMS, immediately mark verified
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMsg('المستخدم غير مسجل');
        setStep('error');
        return false;
      }
      await supabase
        .from('profiles')
        .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
        .eq('id', user.id);
      setStep('done');
      return true;
    }

    // PRODUCTION: send real SMS via Supabase OTP (Twilio)
    const normalized = phone.startsWith('+') ? phone : '+966' + phone.replace(/^0/, '');
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) {
      setErrorMsg(error.message);
      setStep('error');
      return false;
    }
    setStep('verifying');
    return true;
  };

  const verifyOtp = async (phone: string, token: string): Promise<boolean> => {
    setErrorMsg('');

    if (IS_DEV_MODE) {
      // DEV: verification already done in sendOtp, no-op here
      setStep('done');
      return true;
    }

    // PRODUCTION: verify SMS token
    const normalized = phone.startsWith('+') ? phone : '+966' + phone.replace(/^0/, '');
    const { error } = await supabase.auth.verifyOtp({ phone: normalized, token, type: 'sms' });
    if (error) {
      setErrorMsg(error.message);
      setStep('error');
      return false;
    }
    await supabase
      .from('profiles')
      .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
      .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
    setStep('done');
    return true;
  };

  const reset = () => { setStep('idle'); setErrorMsg(''); };

  return { step, errorMsg, sendOtp, verifyOtp, reset, isDevMode: IS_DEV_MODE };
}
