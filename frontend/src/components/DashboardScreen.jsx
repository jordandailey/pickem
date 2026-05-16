import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function groupByGame(picks) {
  const games = {};
  for (const p of picks) {
    if (!games[p.game_id]) {
      games[p.game_id] = {
        game_id: p.game_id, away_team: p.away_team, home_team: p.home_team,
        spread_away: p.spread_away, spread_home: p.spread_home, total: p.total,
        game_type: p.game_type, conference: p.conference, game_time: p.game_time,
        game_status: p.game_status, sides: {}
      };
    }
    const label = p.pick_type === 'spread'
      ? p.picked_team
      : p.pick_type === 'over' ? `Over ${p.total}` : `Under ${p.total}`;
    if (!games[p.game_id].sides[label]) games[p.game_id].sides[label] = [];
    games[p.game_id].sides[label].push(p);
  }
  return Object.values(games);
}

export default function DashboardScreen({ week }) {
  const [allWeeks, setAllWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState(week?.id || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/weeks').then(weeks => {
      const sorted = weeks.sort((a, b) => b.nfl_week - a.nfl_week);
      setAllWeeks(sorted);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedWeekId) loadDashboard(selectedWeekId);
  }, [selectedWeekId]);

  useEffect(() => {
    if (week?.id && !selectedWeekId) setSelectedWeekId(week.id);
  }, [week]);

  async function loadDashboard(weekId) {
    setLoading(true);
    try {
      const res = await api.get(`/picks/dashboard/${weekId}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const selectedWeek = allWeeks.find(w => w.id === selectedWeekId) || week;

  if (!selectedWeekId) return <div className="empty-state">No active week.</div>;

  function GameBlock({ game }) {
    const sides = Object.entries(game.sides);
    return (
      <div className="dashboard-game">
        <div className="dg-header">
          <div className="dg-title">{game.away_team} vs {game.home_team}</div>
          <div className="dg-sub">
            {game.game_type} · {game.conference}
            {game.game_status === 'final' && ' · Final'}
          </div>
        </div>
        {sides.map(([label, pickers]) => {
          const allWin = pickers.every(p => p.result === 'win');
          const allLoss = pickers.every(p => p.result === 'loss');
          const sideColor = allWin ? 'g' : allLoss ? 'r' : '';
          return (
            <div key={label} className="dg-side">
              <div className={`dg-side-label ${sideColor}`}>{label}</div>
              <div className="chips">
                {pickers.map(p => {
                  const color = p.result === 'win' ? 'g' : p.result === 'loss' ? 'r' : '';
                  return (
                    <div key={p.id} className={`chip ${color} ${p.is_lock ? 'lk' : ''}`}>
                      {p.player_name}{p.is_lock ? ' 🔒' : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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

      <p className="sec-label">Week {selectedWeek?.nfl_week} · All picks</p>

      {loading && <div className="empty-state">Loading...</div>}

      {!loading && data?.locked && (
        <div className="lock-msg">
          <span>🔒</span>
          <span>Picks are hidden until the Friday 10 PM ET deadline passes.</span>
        </div>
      )}

      {!loading && !data?.locked && (() => {
        const grouped = groupByGame(data?.picks || []);
        const cfb = grouped.filter(g => g.game_type === 'CFB');
        const nfl = grouped.filter(g => g.game_type === 'NFL');
        if (!grouped.length) return <div className="empty-state">No picks submitted yet this week.</div>;
        return (
          <>
            {cfb.length > 0 && (
              <>
                <p className="sec-label">College Football</p>
                {cfb.map(g => <GameBlock key={g.game_id} game={g} />)}
              </>
            )}
            {nfl.length > 0 && (
              <>
                <p className="sec-label">NFL</p>
                {nfl.map(g => <GameBlock key={g.game_id} game={g} />)}
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
