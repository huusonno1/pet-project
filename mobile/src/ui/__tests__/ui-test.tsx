import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/ui/Button';
import { DateField } from '@/ui/DateField';
import { TextField } from '@/ui/TextField';

describe('ui', () => {
  test('Button calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Lưu" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('loading Button does not call onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Lưu" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('TextField shows label and error', async () => {
    await render(<TextField label="Email" value="" onChangeText={() => {}} error="Email không hợp lệ" />);
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Email không hợp lệ')).toBeOnTheScreen();
  });

  test('DateField opens picker and returns ISO date', async () => {
    const onChange = jest.fn();
    await render(<DateField label="Ngày" value="2026-03-08" onChange={onChange} />);
    expect(screen.getByText('08/03/2026')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ngày' }));
    await fireEvent(screen.getByTestId('datetimepicker'), 'valueChange', {}, new Date(2026, 9, 20));

    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });
});
