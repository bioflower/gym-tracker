import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RestTimer } from '../components/RestTimer';

describe('RestTimer', () => {
  it('renders a Rest label', () => {
    render(<RestTimer previousCompletedAt={new Date().toISOString()} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('renders a running clock', () => {
    render(<RestTimer previousCompletedAt={new Date().toISOString()} />);
    // LiveTimer renders a mm:ss clock — just confirm something clock-shaped is present
    expect(screen.getByText(/^\d+:\d{2}$/)).toBeInTheDocument();
  });
});
