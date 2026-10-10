import { ActivityIndicator } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { colors } from '@/ui/theme';

import { MomentFormScreen } from './MomentFormScreen';

export default function NewMomentScreen() {
  const me = useMe();
  const couple = useCouple();
  if (!me.data || !couple.data) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  return <MomentFormScreen meId={me.data.id} partnerId={couple.data.partner.id} />;
}
