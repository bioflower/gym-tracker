import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RestTimer } from '../components/RestTimer';
import { BUTTON_LABELS } from '../constants/workout';

describe('RestTimer', () => {
  it('renders a Rest label and a Start Next Set button', () => {
    render(<RestTimer previousCompletedAt={new Date().toISOString()} onStartNext={() => {}} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText(BUTTON_LABELS.START_NEXT_SET)).toBeInTheDocument();
  });

  it('calls onStartNext when the button is pressed', () => {
    const onStartNext = vi.fn();
    render(<RestTimer previousCompletedAt={new Date().toISOString()} onStartNext={onStartNext} />);
    fireEvent.click(screen.getByText(BUTTON_LABELS.START_NEXT_SET));
    expect(onStartNext).toHaveBeenCalledTimes(1);
  });
});
