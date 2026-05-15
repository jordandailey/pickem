import { api } from '../utils/api';
import { useState, useEffect } from 'react';

function Badge({ result }) {
  if (!result || result === 'pending') return <span className="badge pending">Pending</span>;
  if (result === 'win') return <span className="badge win">Win</span>;
  if (result === 'loss') return <span className="badge loss">Loss</span>;
  if (result === 'push' || result === 'void') return <span className="badge push">Push</span>;
  return null;
}

export default function MyPicksScreen({ week, myPicks }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [view, setView] = useState('current');

  const wins = myPicks.filter(p => p.result === 'win').length;
  const losses = myPicks.filter(p => p.result === 'loss').length;
  const pushes = myPicks.filter(p => p.result === 'push' || p.result === 'void').length;
  const pts = myPicks.reduce((s, p) => s + parseFloat(p.points_earned || 0), 0);
  const lockPick = myPicks.find(p => p.is_lock);
  const lockWins = myPicks.filter(p => p.is_lock && p.result === 'win').length;

  function pickLabel(p) {
    if (p.pick_type === 'spread') {
      const line = p.picked_team === p.away_team ? p.spread_away : p.spread_home;
      return `${p.picked_team} ${line > 0 ? '+' : ''}${line}`;
    }
    if (p.pick_type === 'over') return `Over ${p.total}`;
    return `Under ${p.total}`;
  }

  function pointsColor(p) {
    if (p.result === 'win') return p.is_lock ? 'var(--gold)' : 'var(--green)';
    if (p.result === 'loss') return 'var(--hint)';
    return 'var(--sub)';
  }

  function pointsLabel(p) {
    if (!p.result || p.result === 'pending') return 'TBD';
    return `+${parseFloat(p.points_earned).toFixed(1)} pts`;
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-label">This week</div>
          <div className="stat-value">{wins}-{losses}{pushes > 0 ? `-${pushes}` : ''}</div>
          <div className="stat-sub">{pts.toFixed(1)} pts</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Lock record</div>
          <div className="stat-value">{lockPick ? (lockPick.result === 'win' ? '✓' : lockPick.result === 'loss' ? '✗' : '–') : '–'}</div>
          <div className="stat-sub">{lockPick ? `${lockPick.result || 'pending'}` : 'Not set'}</div>
        </div>
      </div>

      <p className="sec-label">Week {week?.nfl_week} picks</p>

      {myPicks.length === 0 && (
        <div className="empty-state">No picks submitted this week yet.</div>
      )}

      {myPicks.map(p => (
        <div key={p.id} className={`ph-card ${p.is_lock ? 'is-lock' : ''}`}>
          <div className="ph-header">
            <span>
              {pickLabel(p)}
              {p.is_lock && <span className="lock-badge">🔒 Lead Pipe Lock</span>}
            </span>
            <Badge result={p.result} />
          </div>
          <div className="ph-body">
            <div>
              <div className="ph-pick">
                {p.pick_type === 'spread' ? p.picked_team : p.pick_type === 'over' ? `Over ${p.total}` : `Under ${p.total}`}
              </div>
              <div className="ph-sub">
                {p.game_type} · {p.pick_type === 'spread' ? 'Spread' : 'Over/Under'}
                {p.conference ? ` · ${p.conference}` : ''}
              </div>
            </div>
            <div style={{fontSize:'13px', fontWeight:'500', color: pointsColor(p)}}>
              {pointsLabel(p)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
