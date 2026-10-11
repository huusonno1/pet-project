import { useCouple } from '@/features/couple/api';
import SoloHomeScreen from '@/features/couple/SoloHomeScreen';
import HomeScreen from '@/features/home/HomeScreen';

export default function HomeTab() {
  const couple = useCouple();
  return couple.data ? <HomeScreen /> : <SoloHomeScreen />;
}
