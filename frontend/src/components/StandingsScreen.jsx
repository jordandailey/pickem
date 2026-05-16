import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function StandingsScreen({ week, userId }) {
  const [view, setView] = useState('overall');
  const [standings, setStandings] = useState([]);
  const [weekStandings, setWeekStandings] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);
  const [submittedIds, setSubmittedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [view, week]);

  async function loadAll() {
    setLoading(true);
    try {
      const [standingsData, playersData] = await Promise.all([
        view === 'overall' ? api.get('/standings/overall') : api.get(`/standings/quarter/${view}`),
        api.get('/standings/overall'), // always load all players for missed picks
      ]);
      setStandings(standingsData);
      setAllPlayers(playersData);

      // Load current week standings for the "this week" column
      if (week) {
        const weekData = await api.get(`/standings/week/${week.id}`);
        const byId = {};
        weekData.forEach(r => byId[r.id] = r);
        setWeekStandings(byId);

        // Load who has submitted this week
        try {
          const dashboard = await api.get(`/picks/dashboard/${week.id}`);
          if (!dashboard.locked && dashboard.picks) {
            const ids = new Set(dashboard.picks.map(p => p.user_id));
            setSubmittedIds(ids);
          } else if (dashboard.locked === false) {
            setSubmittedIds(new Set());
          }
        } catch {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function recordStr(row) {
    const parts = [parseInt(row.wins), parseInt(row.losses)];
    if (parseInt(row.pushes) > 0) parts.push(parseInt(row.pushes));
    return parts.join('-');
  }

  function lockStr(row) {
    const parts = [parseInt(row.lock_wins), parseInt(row.lock_losses)];
    if (parseInt(row.lock_pushes) > 0) parts.push(parseInt(row.lock_pushes));
    return parts.join('-');
  }

  // Players who haven't submitted this week
  const notSubmitted = allPlayers.filter(p => !submittedIds.has(p.id));
  const deadlinePassed = week && new Date() > new Date(week.submission_deadline);

  return (
    <div>
      <div className="pills">
        {['overall','1','2','3','4'].map(v => (
          <button key={v} className={`pill ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v === 'overall' ? 'Overall' : `Q${v}`}
          </button>
        ))}
      </div>

      {/* Missed picks banner */}
      {week && notSubmitted.length > 0 && (
        <div style={{
          background: deadlinePassed ? 'var(--red-bg)' : '#FDF6E3',
          border: `0.5px solid ${deadlinePassed ? 'var(--rbd)' : 'var(--gold-border)'}`,
          borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:'10px'
        }}>
          <div style={{fontSize:'12px', fontWeight:'500', color: deadlinePassed ? 'var(--red)' : 'var(--gold)', marginBottom:'4px'}}>
            {deadlinePassed ? '❌ Missed picks (Week ' + week.nfl_week + ')' : '⏳ Haven\'t submitted yet'}
          </div>
          <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
            {notSubmitted.map(p => (
              <span key={p.id} style={{
                fontSize:'11px', padding:'2px 8px', borderRadius:'10px',
                background: deadlinePassed ? 'var(--red-bg)' : '#fff',
                border: `0.5px solid ${deadlinePassed ? 'var(--rbd)' : 'var(--card-border)'}`,
                color: deadlinePassed ? 'var(--red)' : 'var(--sub)'
              }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

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
          {/* Header row */}
          <div style={{display:'flex', alignItems:'center', padding:'6px 12px', borderBottom:'0.5px solid var(--card-border)', background:'#F7F6F3'}}>
            <div style={{minWidth:'22px'}} />
            <div style={{flex:1, fontSize:'10px', color:'var(--hint)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Player</div>
            <div style={{fontSize:'10px', color:'var(--hint)', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'right', minWidth:'44px'}}>Wk</div>
            <div style={{fontSize:'10px', color:'var(--hint)', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'right', minWidth:'52px'}}>Total</div>
          </div>

          {standings.map((row, i) => {
            const weekRow = weekStandings[row.id];
            const weekPts = weekRow ? parseFloat(weekRow.total_points) : null;
            return (
              <div key={row.id} className={`standings-row ${row.id === userId ? 'me' : ''}`}>
                <div className={`rank ${i < 3 ? 'top' : ''}`}>
                  {row.id === userId ? '→' : i + 1}
                </div>
                <div className="player-info">
                  <div className="player-name" style={row.id === userId ? {color:'var(--gold)'} : {}}>
                    {row.name}{row.id === userId ? ' (You)' : ''}
                  </div>
                  <div className="player-record">
                    {recordStr(row)} · Lock {lockStr(row)}
                  </div>
                </div>
                <div style={{textAlign:'right', minWidth:'44px'}}>
                  <div style={{fontSize:'13px', fontWeight:'500', color: weekPts !== null ? 'var(--green)' : 'var(--hint)'}}>
                    {weekPts !== null ? weekPts.toFixed(1) : '–'}
                  </div>
                </div>
                <div className="player-pts" style={{minWidth:'52px'}}>
                  <div className="pts-num">{parseFloat(row.total_points).toFixed(1)}</div>
                  <div className="pts-lbl">pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="stat-grid" style={{marginTop:'4px'}}>
        <div className="stat-box"><div className="stat-label">Grand Prize</div><div className="stat-value">$2,000</div><div className="stat-sub">End of season</div></div>
        <div className="stat-box"><div className="stat-label">Quarterly Prize</div><div className="stat-value">$350</div><div className="stat-sub">Per quarter winner</div></div>
        <div className="stat-box"><div className="stat-label">2nd Place</div><div className="stat-value">$400</div><div className="stat-sub">End of season</div></div>
        <div className="stat-box"><div className="stat-label">Entry Fee</div><div className="stat-value">$200</div><div className="stat-sub">Per player</div></div>
      </div>
    </div>
  );
}
