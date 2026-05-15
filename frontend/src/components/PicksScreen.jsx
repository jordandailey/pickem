import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function isDeadlinePassed(week) {
  if (!week) return false;
  return week.picks_locked || new Date() > new Date(week.submission_deadline);
}

export default function PicksScreen({ week, myPicks, onPicksSubmitted, showToast }) {
  const [selections, setSelections] = useState({}); // key: `${gameId}_${type}` val: {side, label, picked_team}
  const [lockKey, setLockKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const locked = isDeadlinePassed(week);
  const selCount = Object.keys(selections).length;
  const maxPicks = week?.picks_per_week || 5;

  // Pre-fill from existing picks
  useEffect(() => {
    if (!myPicks?.length || !week) return;
    const existing = {};
    let existingLock = null;
    for (const p of myPicks) {
      const key = `${p.game_id}_${p.pick_type}`;
      existing[key] = {
        side: p.picked_team,
        label: p.picked_team,
        picked_team: p.picked_team,
        pick_type: p.pick_type,
        game_id: p.game_id
      };
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

  function removePick(key) {
    setSelections(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (lockKey === key) setLockKey(null);
  }

  function toggleLock(gameId) {
    const gameKeys = Object.keys(selections).filter(k => k.startsWith(gameId + '_'));
    if (!gameKeys.length) return;
    const key = gameKeys[0];
    setLockKey(prev => prev === key ? null : key);
  }

  async function handleSubmit() {
    if (selCount !== maxPicks || !lockKey) return;
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
    const spreadKeyA = `${game.id}_spread`;
    const ouKeyO = `${game.id}_over`;
    const ouKeyU = `${game.id}_under`;

    const spreadSelA = selections[spreadKeyA];
    const ouSelO = selections[ouKeyO];
    const ouSelU = selections[ouKeyU];

    const gameHasPick = spreadSelA || ouSelO || ouSelU;
    const gameHasLock = lockKey && (lockKey === spreadKeyA || lockKey === ouKeyO || lockKey === ouKeyU);

    const maxed = selCount >= maxPicks;

    function btnClass(key, side) {
      const sel = selections[key];
      if (!sel || sel.side !== side) return 'pick-btn';
      return `pick-btn ${lockKey === key ? 'is-lock' : 'selected'}`;
    }

    return (
      <div className={`card ${gameHasPick ? 'picked' : ''}`}>
        <div className="card-header">
          <span>{game.tv_network && `${game.tv_network} · `}{game.game_time ? new Date(game.game_time).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'TBD'}</span>
          <span>{game.conference}</span>
        </div>
        <div className="matchup">
          <div className="team">
            <div className="team-name">{game.away_team}</div>
            {game.away_record && <div className="team-record">{game.away_record}</div>}
          </div>
          <div className="vs-mid">at</div>
          <div className="team">
            <div className="team-name">{game.home_team}</div>
            {game.home_record && <div className="team-record">{game.home_record}</div>}
          </div>
        </div>

        <div className="pick-options">
          {game.spread_away != null && (
            <>
              <div className="pick-type-label">Spread</div>
              <div className="pick-row">
                <button
                  className={btnClass(spreadKeyA, game.away_team)}
                  onClick={() => selectPick(game, 'spread', game.away_team, game.away_team, `${game.away_team} ${game.spread_away > 0 ? '+' : ''}${game.spread_away}`)}
                  disabled={locked || (maxed && !selections[spreadKeyA])}
                >
                  <div className="btn-team">{game.away_team}</div>
                  <div className="btn-line">{game.spread_away > 0 ? '+' : ''}{game.spread_away}</div>
                </button>
                <button
                  className={btnClass(spreadKeyA, game.home_team)}
                  onClick={() => selectPick(game, 'spread', game.home_team, game.home_team, `${game.home_team} ${game.spread_home > 0 ? '+' : ''}${game.spread_home}`)}
                  disabled={locked || (maxed && !selections[spreadKeyA])}
                >
                  <div className="btn-team">{game.home_team}</div>
                  <div className="btn-line">{game.spread_home > 0 ? '+' : ''}{game.spread_home}</div>
                </button>
              </div>
            </>
          )}

          {game.total != null && (
            <>
              <div className="pick-type-label" style={{marginTop:'3px'}}>Over / Under · {game.total}</div>
              <div className="pick-row">
                <button
                  className={btnClass(ouKeyO, 'over')}
                  onClick={() => selectPick(game, 'over', 'over', 'over', `Over ${game.total} (${game.away_team}/${game.home_team})`)}
                  disabled={locked || (maxed && !selections[ouKeyO])}
                >
                  <div className="btn-team">Over</div>
                  <div className="btn-line">{game.total}</div>
                </button>
                <button
                  className={btnClass(ouKeyU, 'under')}
                  onClick={() => selectPick(game, 'under', 'under', 'under', `Under ${game.total} (${game.away_team}/${game.home_team})`)}
                  disabled={locked || (maxed && !selections[ouKeyU])}
                >
                  <div className="btn-team">Under</div>
                  <div className="btn-line">{game.total}</div>
                </button>
              </div>
            </>
          )}

          {gameHasPick && !locked && (
            <div className="lock-section">
              <span className="lock-hint">🔒 Set as Lead Pipe Lock?</span>
              <button
                className={`lock-btn ${gameHasLock ? 'active' : ''}`}
                onClick={() => toggleLock(game.id)}
              >
                {gameHasLock ? 'Lock set ✓' : 'Make Lock'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {locked && (
        <div className="lock-msg">
          <span>🔒</span>
          <span>Picks are locked for this week. Check the Dashboard to see everyone's picks.</span>
        </div>
      )}

      {!locked && selCount > 0 && (
        <div className="pick-summary">
          {Object.entries(selections).map(([key, val]) => (
            <div key={key} className={`ps-chip ${lockKey === key ? 'is-lock' : ''}`}>
              {lockKey === key && <span>🔒</span>}
              <span>{val.label}</span>
              <button onClick={() => removePick(key)}>×</button>
            </div>
          ))}
        </div>
      )}

      {selCount >= maxPicks && !locked && (
        <div className="maxed-banner">
          {maxPicks} picks selected — remove one above to swap · {lockKey ? '✓ Lock set' : '⚠️ Set your Lock!'}
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

      {!locked && (
        <div className="submit-bar">
          <button
            className="submit-btn"
            disabled={selCount !== maxPicks || !lockKey || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Submitting...' : `Submit Picks (${selCount}/${maxPicks})`}
          </button>
        </div>
      )}
    </div>
  );
}
