import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import GuestGate from '@/components/GuestGate';

export function useGuestGate() {
  const { isGuest } = useAuth();
  const [visible, setVisible] = useState(false);

  const guard = (action: () => void) => {
    if (isGuest) {
      setVisible(true);
    } else {
      action();
    }
  };

  const GuestGateModal = () => (
    <GuestGate visible={visible} onClose={() => setVisible(false)} />
  );

  return { guard, isGuest, GuestGateModal };
}
