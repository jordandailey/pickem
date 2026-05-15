import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function AdminScreen({ week, onWeekUpdated, showToast }) {
  const [panel, setPanel] = useState('home');
  const [players, setPlayers] = useState([]);
  const [seasons, setSeason] = useState(null);

  useEffect(() => { if (panel === 'players') loadPlayers(); }, [panel]);

  async function loadPlayers() {
    try { setPlayers(await api.get('/admin/players')); } catch (err) { showToast(err.message, 'error'); }
  }

  if (panel === 'week') return <WeekSetup week={week} onWeekUpdated={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'games') return <GameEntry week={week} onDone={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'scores') return <ScoreEntry week={week} onDone={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'players') return <PlayerManager players={players} onDone={loadPlayers} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'settings') return <SeasonSettings showToast={showToast} onBack={() => setPanel('home')} />;

  return (
    <div>
      <p className="sec-label">Commissioner — Week {week?.nfl_week || '–'}</p>

      {week && (
        <div className="card" style={{padding:'12px', marginBottom:'10px'}}>
          <div style={{fontSize:'13px', fontWeight:'500', marginBottom:'4px'}}>Active week</div>
          <div style={{fontSize:'12px', color:'var(--sub)'}}>
            NFL Wk {week.nfl_week} · {week.games?.length || 0} games · Deadline: {week.submission_deadline ? new Date(week.submission_deadline).toLocaleString() : 'not set'}
          </div>
          <div style={{fontSize:'12px', color: week.picks_locked ? 'var(--red)' : 'var(--green)', marginTop:'4px'}}>
            Picks: {week.picks_locked ? '🔒 Locked' : '🟢 Open'}
          </div>
        </div>
      )}

      {[
        { id: 'week', icon: '📅', title: 'Set up new week', sub: 'Create week, set deadline, assign quarter' },
        { id: 'games', icon: '🏈', title: 'Add / edit games', sub: 'Enter the slate of games for this week' },
        { id: 'scores', icon: '📊', title: 'Enter final scores', sub: 'Grade all picks automatically' },
        { id: 'players', icon: '👥', title: 'Manage players', sub: 'Add, remove, reset passwords' },
        { id: 'settings', icon: '⚙️', title: 'Season settings', sub: 'Prizes, scoring rules, picks per week' },
      ].map(b => (
        <button key={b.id} className="admin-btn" onClick={() => setPanel(b.id)}>
          <span className="admin-btn-icon">{b.icon}</span>
          <div className="admin-btn-text">
            <div className="admin-btn-title">{b.title}</div>
            <div className="admin-btn-sub">{b.sub}</div>
          </div>
          <span className="admin-btn-chevron">›</span>
        </button>
      ))}

      {week && (
        <button
          className="admin-btn"
          style={{borderColor: week.picks_locked ? 'var(--green-border)' : 'var(--red-border)'}}
          onClick={async () => {
            try {
              await api.put(`/weeks/${week.id}/lock`, { picks_locked: !week.picks_locked });
              showToast(week.picks_locked ? 'Picks unlocked' : 'Picks locked');
              onWeekUpdated();
            } catch (err) { showToast(err.message, 'error'); }
          }}
        >
          <span className="admin-btn-icon">{week.picks_locked ? '🟢' : '🔒'}</span>
          <div className="admin-btn-text">
            <div className="admin-btn-title">{week.picks_locked ? 'Unlock picks' : 'Lock picks now'}</div>
            <div className="admin-btn-sub">{week.picks_locked ? 'Re-open submissions' : 'Close submissions before deadline'}</div>
          </div>
        </button>
      )}
    </div>
  );
}

function WeekSetup({ week, onWeekUpdated, showToast, onBack }) {
  const [form, setForm] = useState({ nfl_week: '', cfb_week: '', label: '', submission_deadline: '', quarter_id: '' });
  const [quarters, setQuarters] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/weeks').then(weeks => {
      // Extract quarters from weeks data if available
    }).catch(() => {});
    // Load quarters
    api.get('/weeks').then(() => {}).catch(() => {});
  }, []);

  async function save() {
    if (!form.nfl_week || !form.cfb_week || !form.submission_deadline) {
      return showToast('NFL week, CFB week and deadline are required', 'error');
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quarter_id: form.quarter_id || null,
        submission_deadline: new Date(form.submission_deadline).toISOString(),
      };
      await api.post('/weeks', payload);
      showToast('Week created!');
      onWeekUpdated();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>Set up new week</p>
      </div>
      <div className="card" style={{padding:'16px'}}>
        {[
          { key: 'nfl_week', label: 'NFL Week #', type: 'number', placeholder: '1' },
          { key: 'cfb_week', label: 'CFB Week #', type: 'number', placeholder: '2' },
          { key: 'label', label: 'Label (optional)', type: 'text', placeholder: 'e.g. Thanksgiving Week' },
          { key: 'submission_deadline', label: 'Picks Deadline', type: 'datetime-local' },
        ].map(f => (
          <div key={f.key} className="form-group">
            <label className="form-label">{f.label}</label>
            <input className="form-input" type={f.type} placeholder={f.placeholder}
              value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Quarter</label>
          <select className="form-select" value={form.quarter_id} onChange={e => setForm(p => ({ ...p, quarter_id: e.target.value }))}>
            <option value="">Select quarter</option>
            <option value="b0000000-0000-0000-0000-000000000001">Q1 (Sept 6 – Sept 27)</option>
            <option value="b0000000-0000-0000-0000-000000000002">Q2 (Oct 4 – Oct 25)</option>
            <option value="b0000000-0000-0000-0000-000000000003">Q3 (Nov 1 – Nov 29)</option>
            <option value="b0000000-0000-0000-0000-000000000004">Q4 (Dec 6 – Dec 27)</option>
          </select>
        </div>
        <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
          {saving ? 'Creating...' : 'Create Week & Set as Active'}
        </button>
      </div>
    </div>
  );
}

function GameEntry({ week, onDone, showToast, onBack }) {
  const [games, setGames] = useState(week?.games || []);
  const [form, setForm] = useState({ game_type: 'NFL', conference: '', away_team: '', home_team: '', away_record: '', home_record: '', game_time: '', tv_network: '', spread_away: '', spread_home: '', total: '' });
  const [saving, setSaving] = useState(false);

  async function addGame() {
    if (!form.away_team || !form.home_team) return showToast('Enter both team names', 'error');
    setSaving(true);
    try {
      const game = await api.post(`/weeks/${week.id}/games`, form);
      setGames(g => [...g, game]);
      setForm(f => ({ ...f, away_team: '', home_team: '', away_record: '', home_record: '', game_time: '', tv_network: '', spread_away: '', spread_home: '', total: '' }));
      showToast('Game added');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function removeGame(id) {
    try {
      await api.delete(`/weeks/${week.id}/games/${id}`);
      setGames(g => g.filter(x => x.id !== id));
      showToast('Game removed');
    } catch (err) { showToast(err.message, 'error'); }
  }

  if (!week) return <div className="empty-state">No active week. Create one first.</div>;

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>Games · NFL Wk {week.nfl_week}</p>
      </div>

      {games.map(g => (
        <div key={g.id} className="card" style={{padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:'13px', fontWeight:'500'}}>{g.away_team} @ {g.home_team}</div>
            <div style={{fontSize:'11px', color:'var(--hint)'}}>
              {g.game_type} · {g.conference} · Spread: {g.spread_away}/{g.spread_home} · O/U: {g.total}
            </div>
          </div>
          <button className="btn btn-danger" style={{padding:'5px 10px', fontSize:'12px'}} onClick={() => removeGame(g.id)}>Remove</button>
        </div>
      ))}

      <div className="card" style={{padding:'16px', marginTop:'8px'}}>
        <p className="sec-label">Add game</p>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={form.game_type} onChange={e => setForm(p => ({...p, game_type: e.target.value}))}>
            <option value="NFL">NFL</option>
            <option value="CFB">College Football</option>
          </select>
        </div>
        {form.game_type === 'CFB' && (
          <div className="form-group">
            <label className="form-label">Conference</label>
            <select className="form-select" value={form.conference} onChange={e => setForm(p => ({...p, conference: e.target.value}))}>
              <option value="">Select</option>
              <option>Big Ten</option><option>SEC</option><option>Big 12</option>
              <option>ACC</option><option>Independent</option>
            </select>
          </div>
        )}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
          <div className="form-group">
            <label className="form-label">Away team</label>
            <input className="form-input" value={form.away_team} onChange={e => setForm(p => ({...p, away_team: e.target.value}))} placeholder="e.g. Chiefs" />
          </div>
          <div className="form-group">
            <label className="form-label">Home team</label>
            <input className="form-input" value={form.home_team} onChange={e => setForm(p => ({...p, home_team: e.target.value}))} placeholder="e.g. Raiders" />
          </div>
          <div className="form-group">
            <label className="form-label">Away record</label>
            <input className="form-input" value={form.away_record} onChange={e => setForm(p => ({...p, away_record: e.target.value}))} placeholder="6-1" />
          </div>
          <div className="form-group">
            <label className="form-label">Home record</label>
            <input className="form-input" value={form.home_record} onChange={e => setForm(p => ({...p, home_record: e.target.value}))} placeholder="2-5" />
          </div>
          <div className="form-group">
            <label className="form-label">Away spread</label>
            <input className="form-input" type="number" step="0.5" value={form.spread_away} onChange={e => setForm(p => ({...p, spread_away: e.target.value}))} placeholder="-6.5" />
          </div>
          <div className="form-group">
            <label className="form-label">Home spread</label>
            <input className="form-input" type="number" step="0.5" value={form.spread_home} onChange={e => setForm(p => ({...p, spread_home: e.target.value}))} placeholder="+6.5" />
          </div>
          <div className="form-group">
            <label className="form-label">Total (O/U)</label>
            <input className="form-input" type="number" step="0.5" value={form.total} onChange={e => setForm(p => ({...p, total: e.target.value}))} placeholder="44.5" />
          </div>
          <div className="form-group">
            <label className="form-label">TV Network</label>
            <input className="form-input" value={form.tv_network} onChange={e => setForm(p => ({...p, tv_network: e.target.value}))} placeholder="FOX" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Game time</label>
          <input className="form-input" type="datetime-local" value={form.game_time} onChange={e => setForm(p => ({...p, game_time: e.target.value}))} />
        </div>
        <button className="btn btn-primary btn-full" onClick={addGame} disabled={saving}>
          {saving ? 'Adding...' : 'Add Game'}
        </button>
      </div>
    </div>
  );
}

function ScoreEntry({ week, onDone, showToast, onBack }) {
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(null);

  if (!week?.games?.length) return (
    <div>
      <button className="btn btn-secondary" onClick={onBack} style={{marginBottom:'16px'}}>← Back</button>
      <div className="empty-state">No games this week yet.</div>
    </div>
  );

  async function submitScore(game) {
    const s = scores[game.id];
    if (s?.away_score === undefined || s?.home_score === undefined) return showToast('Enter both scores', 'error');
    setSaving(game.id);
    try {
      const res = await api.put(`/weeks/${week.id}/games/${game.id}/score`, {
        away_score: parseInt(s.away_score),
        home_score: parseInt(s.home_score),
        status: 'final'
      });
      showToast(`Graded ${res.graded} picks ✓`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(null); }
  }

  async function voidGame(game) {
    setSaving(game.id);
    try {
      await api.put(`/weeks/${week.id}/games/${game.id}/score`, { away_score: 0, home_score: 0, status: 'cancelled' });
      showToast('Game voided — all picks awarded 0.5 pts');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(null); }
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>Enter final scores</p>
      </div>
      {week.games.map(g => (
        <div key={g.id} className="card" style={{padding:'14px 12px', marginBottom:'8px'}}>
          <div style={{fontSize:'13px', fontWeight:'500', marginBottom:'10px'}}>
            {g.away_team} @ {g.home_team}
            <span style={{fontSize:'11px', color:'var(--hint)', fontWeight:'400', marginLeft:'8px'}}>{g.game_type}</span>
          </div>
          {g.status === 'final' ? (
            <div style={{fontSize:'13px', color:'var(--green)'}}>
              ✓ Final: {g.away_score} – {g.home_score}
            </div>
          ) : g.status === 'cancelled' ? (
            <div style={{fontSize:'13px', color:'var(--red)'}}>Voided</div>
          ) : (
            <>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px'}}>
                <div>
                  <div style={{fontSize:'11px', color:'var(--hint)', marginBottom:'4px'}}>{g.away_team}</div>
                  <input className="form-input" type="number" min="0" placeholder="0"
                    value={scores[g.id]?.away_score ?? ''}
                    onChange={e => setScores(s => ({...s, [g.id]: {...s[g.id], away_score: e.target.value}}))} />
                </div>
                <div>
                  <div style={{fontSize:'11px', color:'var(--hint)', marginBottom:'4px'}}>{g.home_team}</div>
                  <input className="form-input" type="number" min="0" placeholder="0"
                    value={scores[g.id]?.home_score ?? ''}
                    onChange={e => setScores(s => ({...s, [g.id]: {...s[g.id], home_score: e.target.value}}))} />
                </div>
              </div>
              <div style={{display:'flex', gap:'8px'}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={() => submitScore(g)} disabled={saving === g.id}>
                  {saving === g.id ? 'Grading...' : 'Submit & Grade'}
                </button>
                <button className="btn btn-secondary" onClick={() => voidGame(g)} disabled={saving === g.id}>
                  Void
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function PlayerManager({ players, onDone, showToast, onBack }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState(null);
  const [newPw, setNewPw] = useState('');

  async function addPlayer() {
    setSaving(true);
    try {
      await api.post('/admin/players', form);
      showToast(`${form.name} added`);
      setForm({ name: '', username: '', password: '' });
      setAdding(false);
      onDone();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function resetPassword(id) {
    if (!newPw) return showToast('Enter new password', 'error');
    try {
      await api.put(`/admin/players/${id}/reset-password`, { password: newPw });
      showToast('Password reset');
      setResetId(null);
      setNewPw('');
    } catch (err) { showToast(err.message, 'error'); }
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={() => setAdding(a => !a)}>+ Add player</button>
      </div>

      {adding && (
        <div className="card" style={{padding:'16px', marginBottom:'10px'}}>
          <p className="sec-label">New player</p>
          {[
            { key: 'name', label: 'Display name', placeholder: 'John D.' },
            { key: 'username', label: 'Username', placeholder: 'johnd' },
            { key: 'password', label: 'Initial password', placeholder: 'johnd' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label className="form-label">{f.label}</label>
              <input className="form-input" value={form[f.key]} placeholder={f.placeholder}
                onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} />
            </div>
          ))}
          <button className="btn btn-primary btn-full" onClick={addPlayer} disabled={saving}>
            {saving ? 'Adding...' : 'Add Player'}
          </button>
        </div>
      )}

      {players.map(p => (
        <div key={p.id} className="card" style={{padding:'10px 12px', marginBottom:'6px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <div style={{fontSize:'14px', fontWeight:'500'}}>{p.name} {p.is_admin && '⚙️'}</div>
              <div style={{fontSize:'12px', color:'var(--hint)'}}>@{p.username}</div>
            </div>
            {!p.is_admin && (
              <button className="btn btn-secondary" style={{fontSize:'12px', padding:'5px 10px'}}
                onClick={() => setResetId(resetId === p.id ? null : p.id)}>
                Reset PW
              </button>
            )}
          </div>
          {resetId === p.id && (
            <div style={{marginTop:'8px', display:'flex', gap:'8px'}}>
              <input className="form-input" placeholder="New password" value={newPw}
                onChange={e => setNewPw(e.target.value)} style={{flex:1}} />
              <button className="btn btn-primary" onClick={() => resetPassword(p.id)}>Set</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SeasonSettings({ showToast, onBack }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/season').then(setSettings).catch(err => showToast(err.message, 'error'));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/season', settings);
      showToast('Settings saved');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  if (!settings) return <div className="empty-state">Loading...</div>;

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>Season settings</p>
      </div>
      <div className="card" style={{padding:'16px'}}>
        {[
          { key: 'entry_fee', label: 'Entry fee ($)', type: 'number' },
          { key: 'grand_prize', label: 'Grand prize ($)', type: 'number' },
          { key: 'second_prize', label: '2nd place prize ($)', type: 'number' },
          { key: 'quarterly_prize', label: 'Quarterly prize ($)', type: 'number' },
          { key: 'picks_per_week', label: 'Picks per week', type: 'number' },
          { key: 'point_win', label: 'Points for a win', type: 'number' },
          { key: 'point_lock_win', label: 'Points for a Lock win', type: 'number' },
          { key: 'point_push', label: 'Points for a push', type: 'number' },
        ].map(f => (
          <div key={f.key} className="form-group">
            <label className="form-label">{f.label}</label>
            <input className="form-input" type={f.type} step="0.5"
              value={settings[f.key] ?? ''} onChange={e => setSettings(s => ({...s, [f.key]: e.target.value}))} />
          </div>
        ))}
        <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
