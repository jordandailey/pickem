import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function isDeadlinePassed(week) {
  if (!week) return false;
  return week.picks_locked || new Date() > new Date(week.submission_deadline);
}

export default function PicksScreen({ week, myPicks, onPicksSubmitted, showToast }) {
  const [selections, setSelections] = useState({});
  const [lockKey, setLockKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const locked = isDeadlinePassed(week);
  const selCount = Object.keys(selections).length;
  const maxPicks = week?.picks_per_week || 5;
  const readyToSubmit = selCount === maxPicks && lockKey;
  const hasExistingPicks = myPicks?.length > 0;

  useEffect(() => {
    if (!myPicks?.length || !week) return;
    const existing = {};
    let existingLock = null;
    for (const p of myPicks) {
      const key = `${p.game_id}_${p.pick_type}`;
      existing[key] = { side: p.picked_team, label: p.picked_team, picked_team: p.picked_team, pick_type: p.pick_type, game_id: p.game_id };
      if (p.is_lock) existingLock = key;
    }
    setSelections(existing);
    setLockKey(existingLock);
  }, [myPicks, week]);

  function selectPick(game, type, side, picked_team, label) {
    const key = `${game.id}_${type}`;
    setSelections(prev => {
      const next = { ...prev };
      if (next[key]?.side === side) {
        delete next[key];
        if (lockKey === key) setLockKey(null);
      } else {
        if (!next[key] && Object.keys(next).length >= maxPicks) return prev;
        next[key] = { side, picked_team, label, pick_type: type, game_id: game.id };
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!readyToSubmit) return;
    setSubmitting(true);
    try {
      const picksPayload = Object.entries(selections).map(([key, val]) => ({
        game_id: val.game_id,
        pick_type: val.pick_type,
        picked_team: val.picked_team,
        is_lock: key === lockKey
      }));
      await api.post('/picks/submit', { week_id: week.id, picks: picksPayload });
      onPicksSubmitted();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!week) return <div className="empty-state">No active week set up yet.<br />Check back soon.</div>;

  const cfbGames = week.games?.filter(g => g.game_type === 'CFB') || [];
  const nflGames = week.games?.filter(g => g.game_type === 'NFL') || [];

  function GameCard({ game }) {
    const spreadKey = `${game.id}_spread`;
    const overKey = `${game.id}_over`;
    const underKey = `${game.id}_under`;

    const spreadSel = selections[spreadKey];
    const overSel = selections[overKey];
    const underSel = selections[underKey];

    const gamePickKeys = [spreadKey, overKey, underKey].filter(k => selections[k]);
    const gameHasPick = gamePickKeys.length > 0;
    const gameHasLock = gamePickKeys.some(k => k === lockKey);
    const maxed = selCount >= maxPicks;

    function btnClass(key, side) {
      const sel = selections[key];
      if (!sel || sel.side !== side) return 'pick-btn';
      return `pick-btn ${lockKey === key ? 'is-lock' : 'selected'}`;
    }

    // When game has both spread + O/U picked, show lock selector between them
    const bothPicked = spreadSel && (overSel || underSel);

    return (
      <div className={`card ${gameHasPick ? 'picked' : ''}`} style={{marginBottom:'7px'}}>
        <div className="card-header" style={{padding:'5px 10px'}}>
          <span>{game.tv_network ? `${game.tv_network} · ` : ''}{game.game_time ? new Date(game.game_time).toLocaleString('en-US', { weekday:'short', month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit' }) : 'TBD'}</span>
          <span>{game.conference}</span>
        </div>

        {/* Compact matchup */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px 4px', gap:'6px'}}>
          <div style={{flex:1, textAlign:'center'}}>
            <div style={{fontSize:'12px', fontWeight:'500', color:'var(--black)', lineHeight:1.2}}>{game.away_team}</div>
          </div>
          <div style={{fontSize:'10px', color:'var(--hint)', flexShrink:0}}>@</div>
          <div style={{flex:1, textAlign:'center'}}>
            <div style={{fontSize:'12px', fontWeight:'500', color:'var(--black)', lineHeight:1.2}}>{game.home_team}</div>
          </div>
        </div>

        <div style={{padding:'0 8px 8px', display:'flex', flexDirection:'column', gap:'4px'}}>
          {/* Spread row */}
          {game.spread_away != null && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
              <button
                className={btnClass(spreadKey, game.away_team)}
                style={{padding:'7px 6px'}}
                onClick={() => selectPick(game, 'spread', game.away_team, game.away_team, `${game.away_team} ${game.spread_away > 0 ? '+' : ''}${game.spread_away}`)}
                disabled={locked || (maxed && !selections[spreadKey])}
              >
                <div className="btn-team" style={{fontSize:'12px'}}>{game.away_team}</div>
                <div className="btn-line" style={{fontSize:'11px'}}>{game.spread_away > 0 ? '+' : ''}{game.spread_away}</div>
              </button>
              <button
                className={btnClass(spreadKey, game.home_team)}
                style={{padding:'7px 6px'}}
                onClick={() => selectPick(game, 'spread', game.home_team, game.home_team, `${game.home_team} ${game.spread_home > 0 ? '+' : ''}${game.spread_home}`)}
                disabled={locked || (maxed && !selections[spreadKey])}
              >
                <div className="btn-team" style={{fontSize:'12px'}}>{game.home_team}</div>
                <div className="btn-line" style={{fontSize:'11px'}}>{game.spread_home > 0 ? '+' : ''}{game.spread_home}</div>
              </button>
            </div>
          )}

          {/* O/U row */}
          {game.total != null && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
              <button
                className={btnClass(overKey, 'over')}
                style={{padding:'7px 6px'}}
                onClick={() => selectPick(game, 'over', 'over', 'over', `Over ${game.total} (${game.away_team}/${game.home_team})`)}
                disabled={locked || (maxed && !selections[overKey])}
              >
                <div className="btn-team" style={{fontSize:'12px'}}>Over</div>
                <div className="btn-line" style={{fontSize:'11px'}}>{game.total}</div>
              </button>
              <button
                className={btnClass(underKey, 'under')}
                style={{padding:'7px 6px'}}
                onClick={() => selectPick(game, 'under', 'under', 'under', `Under ${game.total} (${game.away_team}/${game.home_team})`)}
                disabled={locked || (maxed && !selections[underKey])}
              >
                <div className="btn-team" style={{fontSize:'12px'}}>Under</div>
                <div className="btn-line" style={{fontSize:'11px'}}>{game.total}</div>
              </button>
            </div>
          )}

          {/* Lock section */}
          {gameHasPick && !locked && (
            <div style={{
              marginTop:'2px', borderTop:'0.5px solid var(--card-border)',
              paddingTop:'6px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'
            }}>
              <span style={{fontSize:'11px', color:'var(--sub)', flex: bothPicked ? 'none' : 1}}>
                🔒 Lead Pipe Lock?
              </span>

              {/* If both spread and O/U picked — show which pick to lock */}
              {bothPicked ? (
                <div style={{display:'flex', gap:'5px', flexWrap:'wrap', flex:1}}>
                  {/* Spread lock option */}
                  <button
                    onClick={() => setLockKey(prev => prev === spreadKey ? null : spreadKey)}
                    style={{
                      fontSize:'11px', padding:'4px 10px', borderRadius:'20px', cursor:'pointer',
                      fontFamily:'var(--font)', fontWeight:'500', flex:1, textAlign:'center',
                      background: lockKey === spreadKey ? 'var(--black)' : 'transparent',
                      color: lockKey === spreadKey ? 'var(--gold-border)' : 'var(--black)',
                      border: lockKey === spreadKey ? '1.5px solid var(--black)' : '1.5px solid var(--card-border)',
                    }}
                  >
                    {spreadSel.side === game.away_team
                      ? `${game.away_team} ${game.spread_away > 0 ? '+' : ''}${game.spread_away}`
                      : `${game.home_team} ${game.spread_home > 0 ? '+' : ''}${game.spread_home}`
                    }
                  </button>
                  {/* O/U lock option */}
                  {(() => {
                    const ouKey = overSel ? overKey : underKey;
                    const ouLabel = overSel ? `Over ${game.total}` : `Under ${game.total}`;
                    return (
                      <button
                        onClick={() => setLockKey(prev => prev === ouKey ? null : ouKey)}
                        style={{
                          fontSize:'11px', padding:'4px 10px', borderRadius:'20px', cursor:'pointer',
                          fontFamily:'var(--font)', fontWeight:'500', flex:1, textAlign:'center',
                          background: lockKey === ouKey ? 'var(--black)' : 'transparent',
                          color: lockKey === ouKey ? 'var(--gold-border)' : 'var(--black)',
                          border: lockKey === ouKey ? '1.5px solid var(--black)' : '1.5px solid var(--card-border)',
                        }}
                      >
                        {ouLabel}
                      </button>
                    );
                  })()}
                </div>
              ) : (
                /* Single pick — simple toggle */
                <button
                  onClick={() => setLockKey(prev => prev === gamePickKeys[0] ? null : gamePickKeys[0])}
                  style={{
                    fontSize:'11px', padding:'5px 14px', borderRadius:'20px', cursor:'pointer',
                    fontFamily:'var(--font)', fontWeight:'500',
                    background: gameHasLock ? 'var(--black)' : 'transparent',
                    color: gameHasLock ? 'var(--gold-border)' : 'var(--black)',
                    border: gameHasLock ? '1.5px solid var(--black)' : '1.5px solid var(--black)',
                  }}
                >
                  {gameHasLock ? 'Lock set ✓' : 'Make Lock'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom: readyToSubmit ? '80px' : '16px'}}>
      {locked && (
        <div className="lock-msg">
          <span>🔒</span>
          <span>Picks are locked for this week. Check the Dashboard to see everyone's picks.</span>
        </div>
      )}

      {hasExistingPicks && !locked && (
        <div style={{
          background:'#FDF6E3', border:'0.5px solid #D4AF37', borderRadius:'var(--radius-sm)',
          padding:'9px 12px', marginBottom:'8px', fontSize:'12px', color:'#8a6a00',
          display:'flex', alignItems:'center', gap:'8px'
        }}>
          <span>✏️</span>
          <span>You've already submitted this week. Any changes will replace your picks when you resubmit.</span>
        </div>
      )}

      {selCount >= maxPicks && !locked && !lockKey && (
        <div className="maxed-banner">
          5 picks selected — now tap <strong>Make Lock</strong> on your most confident pick ⬇️
        </div>
      )}

      {cfbGames.length > 0 && (
        <>
          <p className="sec-label">College Football — Power 4 + Independents</p>
          {cfbGames.map(g => <GameCard key={g.id} game={g} />)}
        </>
      )}

      {nflGames.length > 0 && (
        <>
          <p className="sec-label">NFL</p>
          {nflGames.map(g => <GameCard key={g.id} game={g} />)}
        </>
      )}

      {/* Floating submit button — slides up when 5 picks selected */}
      {!locked && (
        <div style={{
          position:'fixed', bottom: readyToSubmit ? '70px' : '-100px',
          left:'50%', transform:'translateX(-50%)',
          transition:'bottom 0.3s ease',
          zIndex:150, width:'calc(100% - 32px)', maxWidth:'358px',
        }}>
          <button
            className="submit-btn"
            disabled={!readyToSubmit || submitting}
            onClick={handleSubmit}
            style={{
              boxShadow:'0 4px 20px rgba(0,0,0,0.25)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
            }}
          >
            {submitting ? (hasExistingPicks ? 'Updating...' : 'Submitting...') : (hasExistingPicks ? `✏️ Update Picks — Lock: ${lockKey ? selections[lockKey]?.label : '?'}` : `🏈 Submit ${selCount}/${maxPicks} Picks — Lock: ${lockKey ? selections[lockKey]?.label : '?'}`)}
          </button>
        </div>
      )}
    </div>
  );
}
