import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { getOneRepMaxSeries } from '../utils/oneRepMax';
import { formatDate } from '../utils/dateTime';

const RANGES = [{ label: '1M', months: 1 }, { label: '3M', months: 3 }, { label: '6M', months: 6 }, { label: '1Y', months: 12 }, { label: 'All', months: 0 }];
const W = 600, H = 300, PAD_L = 44, PAD_R = 20, PAD_T = 20, PAD_B = 36;

export function OneRepMaxPage() {
  const { data } = useGymTracker();
  const [exerciseId, setExerciseId] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [months, setMonths] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const exercises = [...data.presetExercises, ...data.customExercises].filter(e => e.trackingType === 'weight-reps').sort((a, b) => a.name.localeCompare(b.name));
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const all = exerciseId ? getOneRepMaxSeries(data.workoutHistory, exerciseId, unit) : [];
  const points = months ? all.filter(p => p.date >= cutoffISO) : all;

  const times = points.map(p => new Date(p.date).getTime());
  const minT = Math.min(...times), maxT = Math.max(...times);
  const vals = points.map(p => p.value);
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.2 || Math.max(...vals) * 0.1;
  const lo = Math.max(0, Math.min(...vals) - pad), hi = Math.max(...vals) + pad;
  const x = (t: number) => PAD_L + (maxT === minT ? (W - PAD_L - PAD_R) / 2 : ((t - minT) / (maxT - minT)) * (W - PAD_L - PAD_R));
  const y = (v: number) => H - PAD_B - ((v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const picked = points.find(p => p.date === selected);
  const coords = points.map((p, i) => [x(times[i]), y(p.value)]);
  const line = coords.map(c => c.join(',')).join(' ');
  const area = `${PAD_L},${H - PAD_B} ${line} ${coords[coords.length - 1]?.[0]},${H - PAD_B}`;
  const yTicks = [0, 1, 2, 3].map(i => lo + ((hi - lo) * i) / 3);
  const xTicks = maxT === minT ? [minT] : [0, 1, 2, 3].map(i => minT + ((maxT - minT) * i) / 3);
  const multiYear = new Date(minT).getUTCFullYear() !== new Date(maxT).getUTCFullYear();
  const tickLabel = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: multiYear ? '2-digit' : undefined, timeZone: 'UTC' });
  const last = points[points.length - 1], first = points[0];
  const change = points.length > 1 ? last.value - first.value : null;

  return (
    <div className="one-rep-max-page">
      <h1>1 Rep Max</h1>
      <div className="orm-controls">
        <select className="input" aria-label="Exercise" value={exerciseId} onChange={e => { setExerciseId(e.target.value); setSelected(null); }}>
          <option value="">Select an exercise</option>
          {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="input input-small" aria-label="Unit" value={unit} onChange={e => { setUnit(e.target.value as 'kg' | 'lb'); setSelected(null); }}>
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </div>
      {exerciseId && all.length > 0 && (
        <div className="orm-ranges" role="group" aria-label="Date range">
          {RANGES.map(r => (
            <button key={r.label} className={`btn btn-small ${months === r.months ? 'btn-primary' : 'btn-outline'}`} aria-pressed={months === r.months} onClick={() => { setMonths(r.months); setSelected(null); }}>{r.label}</button>
          ))}
        </div>
      )}
      {!exerciseId && <p className="orm-empty">Pick an exercise to see your estimated 1RM over time.</p>}
      {exerciseId && all.length === 0 && <p className="orm-empty">No weighted sets logged for this exercise yet.</p>}
      {all.length > 0 && points.length === 0 && <p className="orm-empty">No workouts in this range.</p>}
      {points.length > 0 && (
        <div className="orm-card">
          <div className="orm-stats">
            <div><span>Latest</span><strong>{last.value.toFixed(1)} {unit}</strong></div>
            <div><span>Best</span><strong>{Math.max(...vals).toFixed(1)} {unit}</strong></div>
            {change !== null && <div><span>Change</span><strong className={change >= 0 ? 'orm-up' : 'orm-down'}>{change >= 0 ? '+' : ''}{change.toFixed(1)} {unit}</strong></div>}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Estimated 1RM over time" className="orm-chart">
            <defs>
              <linearGradient id="orm-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f8cff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4f8cff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--border)" strokeDasharray="4 4" />
                <text x={PAD_L - 8} y={y(v) + 3} textAnchor="end" fontSize="11" fill="var(--text-secondary)">{Math.round(v)}</text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text key={t} x={x(t)} y={H - PAD_B + 20} textAnchor={xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--text-secondary)">{tickLabel(t)}</text>
            ))}
            {points.length > 1 && <polygon points={area} fill="url(#orm-fill)" />}
            <polyline fill="none" stroke="#4f8cff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
            {picked && <line x1={x(new Date(picked.date).getTime())} y1={PAD_T} x2={x(new Date(picked.date).getTime())} y2={H - PAD_B} stroke="#ff8c42" strokeDasharray="3 3" />}
            {coords.map(([cx, cy], i) => {
              const active = points[i].date === selected;
              return (
                <g key={points[i].date} onClick={() => setSelected(points[i].date)} style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r="14" fill="transparent" />
                  <circle cx={cx} cy={cy} r={active ? 7 : 4.5} fill={active ? '#ff8c42' : '#4f8cff'} stroke="var(--surface)" strokeWidth="2" />
                </g>
              );
            })}
          </svg>
          <p className="orm-readout" aria-live="polite">
            {picked ? <><strong>{picked.value.toFixed(1)} {unit}</strong> on {formatDate(picked.date)}</> : 'Tap a dot to see the date and weight.'}
          </p>
        </div>
      )}
    </div>
  );
}
