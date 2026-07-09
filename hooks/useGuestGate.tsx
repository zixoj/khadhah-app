import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import GuestGate from '@/components/GuestGate';

export function useGuestGate() {
  const { isGuest } = useAuth();
  const [visible, setVisible] = useState(false);

  const guard = useCallback((action: () => void) => {
    if (isGuest) {
      setVisible(true);
    } else {
      action();
    }
  }, [isGuest]);

  const GuestGateModal = useCallback(() => (
    <GuestGate visible={visible} onClose={() => setVisible(false)} />
  ), [visible]);

  return { guard, isGuest, GuestGateModal };
}
