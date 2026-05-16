import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function Badge({ result }) {
  if (!result || result === 'pending') return <span className="badge pending">Pending</span>;
  if (result === 'win') return <span className="badge win">Win</span>;
  if (result === 'loss') return <span className="badge loss">Loss</span>;
  if (result === 'push' || result === 'void') return <span className="badge push">Push</span>;
  return null;
}

export default function MyPicksScreen({ week, myPicks }) {
  const [allWeeks, setAllWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState(week?.id || null);
  const [historyPicks, setHistoryPicks] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load all weeks for navigation
    api.get('/weeks').then(weeks => {
      setAllWeeks(weeks.sort((a, b) => b.nfl_week - a.nfl_week));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedWeekId && selectedWeekId !== week?.id) {
      loadHistoryPicks(selectedWeekId);
    } else {
      setHistoryPicks(null);
    }
  }, [selectedWeekId]);

  async function loadHistoryPicks(weekId) {
    setLoading(true);
    try {
      const picks = await api.get(`/picks/my/${weekId}`);
      setHistoryPicks(picks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const displayPicks = selectedWeekId === week?.id ? myPicks : (historyPicks || []);
  const selectedWeek = allWeeks.find(w => w.id === selectedWeekId) || week;

  const wins = displayPicks.filter(p => p.result === 'win').length;
  const losses = displayPicks.filter(p => p.result === 'loss').length;
  const pushes = displayPicks.filter(p => p.result === 'push' || p.result === 'void').length;
  const pts = displayPicks.reduce((s, p) => s + parseFloat(p.points_earned || 0), 0);
  const lockPick = displayPicks.find(p => p.is_lock);

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
    return `+${parseFloat(p.points_earned || 0).toFixed(1)} pts`;
  }

  return (
    <div>
      {/* Week selector */}
      {allWeeks.length > 1 && (
        <div className="pills" style={{marginBottom:'10px'}}>
          {allWeeks.map(w => (
            <button
              key={w.id}
              className={`pill ${selectedWeekId === w.id ? 'active' : ''}`}
              onClick={() => setSelectedWeekId(w.id)}
            >
              Wk {w.nfl_week}
            </button>
          ))}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-label">Week {selectedWeek?.nfl_week}</div>
          <div className="stat-value">{wins}-{losses}{pushes > 0 ? `-${pushes}` : ''}</div>
          <div className="stat-sub">{pts.toFixed(1)} pts</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Lock</div>
          <div className="stat-value">
            {lockPick ? (lockPick.result === 'win' ? '✓' : lockPick.result === 'loss' ? '✗' : lockPick.result === 'pending' ? '–' : '½') : '–'}
          </div>
          <div className="stat-sub">{lockPick ? (lockPick.result || 'pending') : 'Not set'}</div>
        </div>
      </div>

      <p className="sec-label">Week {selectedWeek?.nfl_week} picks</p>

      {loading && <div className="empty-state">Loading...</div>}

      {!loading && displayPicks.length === 0 && (
        <div className="empty-state">No picks submitted for this week.</div>
      )}

      {!loading && displayPicks.map(p => (
        <div key={p.id} className={`ph-card ${p.is_lock ? 'is-lock' : ''}`}>
          <div className="ph-header">
            <span>
              {pickLabel(p)}
              {p.is_lock && <span className="lock-badge">🔒 Lock</span>}
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
