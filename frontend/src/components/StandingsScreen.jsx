import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function StandingsScreen({ week, userId }) {
  const [view, setView] = useState('overall');
  const [standings, setStandings] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStandings();
    loadSeason();
  }, [view]);

  async function loadStandings() {
    setLoading(true);
    try {
      let data;
      if (view === 'overall') data = await api.get('/standings/overall');
      else data = await api.get(`/standings/quarter/${view}`);
      setStandings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSeason() {
    try {
      // Use public endpoint — standings page accessible to all
      const weeks = await api.get('/weeks');
      // Just get prize info from first available
    } catch {}
  }

  function recordStr(row) {
    const parts = [row.wins, row.losses];
    if (parseInt(row.pushes) > 0) parts.push(row.pushes);
    return parts.join('-');
  }

  function lockStr(row) {
    const parts = [row.lock_wins, row.lock_losses];
    if (parseInt(row.lock_pushes) > 0) parts.push(row.lock_pushes);
    return 'Lock ' + parts.join('-');
  }

  return (
    <div>
      <div className="pills">
        {['overall','1','2','3','4'].map(v => (
          <button key={v} className={`pill ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v === 'overall' ? 'Overall' : `Q${v}`}
          </button>
        ))}
      </div>

      {week && (
        <p className="sec-label">
          {view === 'overall' ? `Season · NFL Wk ${week.nfl_week}` : `Quarter ${view}`}
        </p>
      )}

      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : standings.length === 0 ? (
        <div className="empty-state">No results yet for this period.</div>
      ) : (
        <div className="card">
          {standings.map((row, i) => (
            <div key={row.id} className={`standings-row ${row.id === userId ? 'me' : ''}`}>
              <div className={`rank ${i < 3 ? 'top' : ''}`}>
                {row.id === userId ? '→' : i + 1}
              </div>
              <div className="player-info">
                <div className="player-name" style={row.id === userId ? {color:'var(--gold)'} : {}}>
                  {row.name}{row.id === userId ? ' (You)' : ''}
                </div>
                <div className="player-record">
                  {recordStr(row)} · {lockStr(row)}
                </div>
              </div>
              <div className="player-pts">
                <div className="pts-num">{parseFloat(row.total_points).toFixed(1)}</div>
                <div className="pts-lbl">pts</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stat-grid" style={{marginTop:'4px'}}>
        <div className="stat-box">
          <div className="stat-label">Grand Prize</div>
          <div className="stat-value">$2,000</div>
          <div className="stat-sub">End of season</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Quarterly Prize</div>
          <div className="stat-value">$350</div>
          <div className="stat-sub">Per quarter winner</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">2nd Place</div>
          <div className="stat-value">$400</div>
          <div className="stat-sub">End of season</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Entry Fee</div>
          <div className="stat-value">$200</div>
          <div className="stat-sub">Per player</div>
        </div>
      </div>
    </div>
  );
}
