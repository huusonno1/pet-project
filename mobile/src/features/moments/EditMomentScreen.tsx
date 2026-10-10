import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { colors } from '@/ui/theme';

import { useMoment } from './api';
import { MomentFormScreen } from './MomentFormScreen';

export default function EditMomentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const me = useMe();
  const couple = useCouple();
  if (!moment.data || !me.data || !couple.data) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  }
  return <MomentFormScreen initial={moment.data} meId={me.data.id} partnerId={couple.data.partner.id} />;
}
