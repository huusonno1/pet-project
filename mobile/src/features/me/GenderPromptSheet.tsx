import { useState } from 'react';

import { useMe, useUpdateMe } from '@/features/account/api';
import { GenderPicker } from '@/features/account/GenderPicker';
import { errorMessage } from '@/lib/api/client';
import type { Gender } from '@/lib/api/types';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Sheet } from '@/ui/Sheet';
import { colors } from '@/ui/theme';

/** Tài khoản tạo trước khi có giới tính → hỏi một lần; chưa chọn thì chưa bật được chu kỳ. */
export function GenderPromptSheet() {
  const me = useMe();
  const update = useUpdateMe();
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = me.isSuccess && !me.data.gender;

  async function save() {
    if (!gender) return setError('Chọn Nam hoặc Nữ nhé');
    setError(null);
    try {
      await update.mutateAsync({ gender });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet visible={open} onClose={() => undefined} title="Bạn là…" subtitle="Để app hiển thị đúng tính năng cho bạn">
      <GenderPicker value={gender} onChange={setGender} />
      <AppText variant="caption" color={colors.textMuted}>Có thể đổi lại trong Tôi → Thông tin cá nhân.</AppText>
      <ErrorText message={error} />
      <Button title="Lưu" onPress={save} loading={update.isPending} />
    </Sheet>
  );
}
