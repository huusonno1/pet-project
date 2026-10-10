import { Text } from 'react-native';

import { useSession } from '@/lib/auth/session';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Title } from '@/ui/Title';

export default function SignedInHome() {
  const { signOut } = useSession();
  return (
    <Screen>
      <Title>Couple App</Title>
      <Text>Bạn đã đăng nhập.</Text>
      <Button title="Đăng xuất" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
