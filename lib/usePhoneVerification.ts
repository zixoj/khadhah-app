import { useState } from 'react';
import { supabase } from './supabase';

export type VerifyStep = 'idle' | 'sending' | 'verifying' | 'done' | 'error';

export function usePhoneVerification() {
  const [step, setStep] = useState<VerifyStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sendOtp = async (phone: string): Promise<boolean> => {
    setStep('sending');
    setErrorMsg('');
    // Normalize: must start with + and country code
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
    const normalized = phone.startsWith('+') ? phone : '+966' + phone.replace(/^0/, '');
    const { error } = await supabase.auth.verifyOtp({ phone: normalized, token, type: 'sms' });
    if (error) {
      setErrorMsg(error.message);
      setStep('error');
      return false;
    }
    // Mark phone as verified in profiles
    await supabase
      .from('profiles')
      .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
      .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
    setStep('done');
    return true;
  };

  const reset = () => { setStep('idle'); setErrorMsg(''); };

  return { step, errorMsg, sendOtp, verifyOtp, reset };
}
