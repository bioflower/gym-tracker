import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

function renderApp() {
  return render(<App />);
}

describe('Gym Tracker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('displays Workout A by default', () => {
    renderApp();
    expect(screen.getByText('Workout A')).toBeInTheDocument();
  });

  it('advances to Workout B after finishing Workout A', async () => {
    renderApp();
    fireEvent.click(screen.getByText('Start Workout'));
    const exerciseHeaders = document.querySelectorAll('.exercise-card-header');
    exerciseHeaders.forEach(header => {
      fireEvent.click(header);
    });
    const startButtons = screen.getAllByText('Start Exercise');
    for (const btn of startButtons) {
      fireEvent.click(btn);
      fireEvent.click(screen.getByText('Complete Exercise'));
    }
    fireEvent.click(screen.getByText('Finish Workout'));
    expect(screen.getByText('Workout B')).toBeInTheDocument();
  });
});
