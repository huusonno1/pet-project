import { useEffect, useState } from 'react';

import { useSavePreference } from '@/features/traits/api';
import { errorMessage } from '@/lib/api/client';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';

export function HobbySheet({ visible, subjectId, onClose }: { visible: boolean; subjectId: string; onClose: () => void }) {
  const save = useSavePreference(subjectId);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setName('');
      setError(null);
    }
  }, [visible]);
  async function submit() {
    if (!name.trim()) return setError('Nhập sở thích');
    try {
      await save.mutateAsync({ body: { subjectUserId: subjectId, category: 'HOBBY', name: name.trim(), visibility: 'SHARED' } });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Thêm sở thích" subtitle="VD: Cà phê đen ít đường, ghét hành">
      <TextField label="Sở thích" value={name} onChangeText={setName} />
      <ErrorText message={error} />
      <Button title="Lưu" onPress={submit} loading={save.isPending} />
    </Sheet>
  );
}
