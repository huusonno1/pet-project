import { useCouple } from '@/features/couple/api';
import PairScreen from '@/features/couple/PairScreen';
import HomeScreen from '@/features/home/HomeScreen';

export default function HomeTab() {
  const couple = useCouple();
  return couple.data ? <HomeScreen /> : <PairScreen />;
}
