import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RestTimer } from '../components/RestTimer';

describe('RestTimer', () => {
  it('renders a Rest label and a Start Next Set button', () => {
    render(<RestTimer previousCompletedAt={new Date().toISOString()} onStartNext={() => {}} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('Start Next Set')).toBeInTheDocument();
  });

  it('calls onStartNext when the button is pressed', () => {
    const onStartNext = vi.fn();
    render(<RestTimer previousCompletedAt={new Date().toISOString()} onStartNext={onStartNext} />);
    fireEvent.click(screen.getByText('Start Next Set'));
    expect(onStartNext).toHaveBeenCalledTimes(1);
  });
});
