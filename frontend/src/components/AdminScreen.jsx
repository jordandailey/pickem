import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function AdminScreen({ week, onWeekUpdated, showToast }) {
  const [panel, setPanel] = useState('home');
  const [players, setPlayers] = useState([]);

  useEffect(() => { if (panel === 'players') loadPlayers(); }, [panel]);

  async function loadPlayers() {
    try { setPlayers(await api.get('/admin/players')); } catch (err) { showToast(err.message, 'error'); }
  }

  if (panel === 'week') return <WeekSetup existingWeek={null} onWeekUpdated={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'editweek') return <WeekSetup existingWeek={week} onWeekUpdated={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'games') return <GameEntry week={week} onDone={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'scores') return <ScoreEntry week={week} onDone={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'players') return <PlayerManager players={players} onDone={loadPlayers} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'settings') return <SeasonSettings showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'odds') return <OddsImport week={week} onDone={() => { onWeekUpdated(); setPanel('home'); }} showToast={showToast} onBack={() => setPanel('home')} />;
  if (panel === 'override') return <PickOverride week={week} showToast={showToast} onBack={() => setPanel('home')} />;

  return (
    <div>
      <p className="sec-label">Commissioner — Week {week?.nfl_week || '–'}</p>

      {week && (
        <div className="card" style={{padding:'12px', marginBottom:'10px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:'13px', fontWeight:'500', marginBottom:'4px'}}>Active week</div>
              <div style={{fontSize:'12px', color:'var(--sub)'}}>
                NFL Wk {week.nfl_week} · CFB Wk {week.cfb_week} · {week.games?.length || 0} games
              </div>
              <div style={{fontSize:'12px', color:'var(--sub)', marginTop:'2px'}}>
                Deadline: {week.submission_deadline ? new Date(week.submission_deadline).toLocaleString() : 'not set'}
              </div>
              <div style={{fontSize:'12px', color: week.picks_locked ? 'var(--red)' : 'var(--green)', marginTop:'4px'}}>
                Picks: {week.picks_locked ? '🔒 Locked' : '🟢 Open'}
              </div>
            </div>
            <button className="btn btn-secondary" style={{fontSize:'12px', padding:'5px 12px', flexShrink:0}} onClick={() => setPanel('editweek')}>
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Odds API Import */}
      <button className="admin-btn" style={{borderColor:'var(--gold-border)', background:'#FDF6E3'}} onClick={() => setPanel('odds')}>
        <span className="admin-btn-icon">🔄</span>
        <div className="admin-btn-text">
          <div className="admin-btn-title" style={{color:'var(--gold)'}}>Import lines from DraftKings</div>
          <div className="admin-btn-sub">Auto-pull this week's spreads + O/U via Odds API</div>
        </div>
        <span className="admin-btn-chevron">›</span>
      </button>

      {[
        { id: 'week', icon: '📅', title: 'Set up new week', sub: 'Create week, set deadline, assign quarter' },
        { id: 'games', icon: '🏈', title: 'Add / edit games', sub: 'Enter the slate of games for this week' },
        { id: 'scores', icon: '📊', title: 'Enter final scores', sub: 'Grade all picks automatically' },
        { id: 'override', icon: '✏️', title: 'Override pick results', sub: 'Manually correct any graded pick' },
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

function toLocalDatetime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WeekSetup({ existingWeek, onWeekUpdated, showToast, onBack }) {
  const isEdit = !!existingWeek;
  const [form, setForm] = useState({
    nfl_week: existingWeek?.nfl_week || '',
    cfb_week: existingWeek?.cfb_week || '',
    label: existingWeek?.label || '',
    submission_deadline: toLocalDatetime(existingWeek?.submission_deadline),
    quarter_id: existingWeek?.quarter_id || '',
  });
  const [saving, setSaving] = useState(false);

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
      if (isEdit) {
        await api.put(`/weeks/${existingWeek.id}`, payload);
        showToast('Week updated!');
      } else {
        await api.post('/weeks', payload);
        showToast('Week created!');
      }
      onWeekUpdated();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>{isEdit ? 'Edit active week' : 'Set up new week'}</p>
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
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Week & Set as Active'}
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
      const payload = {
        ...form,
        game_time: form.game_time ? new Date(form.game_time).toISOString() : null,
      };
      const game = await api.post(`/weeks/${week.id}/games`, payload);
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
        <div key={g.id} className="card" style={{padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px'}}>
          <div>
            <div style={{fontSize:'13px', fontWeight:'500'}}>{g.away_team} @ {g.home_team}</div>
            <div style={{fontSize:'11px', color:'var(--hint)'}}>
              {g.game_type} · {g.conference} · {g.spread_away > 0 ? '+' : ''}{g.spread_away}/{g.spread_home > 0 ? '+' : ''}{g.spread_home} · O/U {g.total}
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
            <input className="form-input" value={form.away_team} onChange={e => setForm(p => ({...p, away_team: e.target.value}))} placeholder="Chiefs" />
          </div>
          <div className="form-group">
            <label className="form-label">Home team</label>
            <input className="form-input" value={form.home_team} onChange={e => setForm(p => ({...p, home_team: e.target.value}))} placeholder="Raiders" />
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
    if (!s || s.away_score === '' || s.away_score === undefined || s.home_score === '' || s.home_score === undefined) {
      return showToast('Enter both scores', 'error');
    }
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
            <div style={{fontSize:'13px', color:'var(--green)'}}>✓ Final: {g.away_score} – {g.home_score}</div>
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
                <button className="btn btn-secondary" onClick={() => voidGame(g)} disabled={saving === g.id}>Void</button>
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
                onClick={() => setResetId(resetId === p.id ? null : p.id)}>Reset PW</button>
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
          { key: 'entry_fee', label: 'Entry fee ($)' },
          { key: 'grand_prize', label: 'Grand prize ($)' },
          { key: 'second_prize', label: '2nd place prize ($)' },
          { key: 'quarterly_prize', label: 'Quarterly prize ($)' },
          { key: 'picks_per_week', label: 'Picks per week' },
          { key: 'point_win', label: 'Points for a win' },
          { key: 'point_lock_win', label: 'Points for a Lock win' },
          { key: 'point_push', label: 'Points for a push' },
        ].map(f => (
          <div key={f.key} className="form-group">
            <label className="form-label">{f.label}</label>
            <input className="form-input" type="number" step="0.5"
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

function OddsImport({ week, onDone, showToast, onBack }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  async function checkStatus() {
    setCheckingStatus(true);
    try {
      const data = await api.get('/odds/status');
      setStatus(data);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setCheckingStatus(false); }
  }

  async function importOdds() {
    if (!week) return showToast('Create an active week first', 'error');
    setImporting(true);
    setResult(null);
    try {
      const data = await api.post('/odds/import', {});
      setResult(data);
      showToast(`Imported ${data.imported} games ✓`);
      setTimeout(onDone, 1500);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setImporting(false); }
  }

  async function fetchScores() {
    setImporting(true);
    try {
      const data = await api.post('/odds/scores', {});
      showToast(`Graded ${data.graded} games ✓`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setImporting(false); }
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>DraftKings Lines Import</p>
      </div>

      <div className="card" style={{padding:'16px', marginBottom:'10px'}}>
        <div style={{fontSize:'13px', color:'var(--sub)', marginBottom:'12px', lineHeight:'1.5'}}>
          Pulls this week's spreads and O/U from DraftKings via the Odds API.
          {week ? ` Will populate games for NFL Wk ${week.nfl_week}.` : ' ⚠️ No active week — create one first.'}
        </div>
        <button
          className="btn btn-primary btn-full"
          onClick={importOdds}
          disabled={importing || !week}
          style={{marginBottom:'8px'}}
        >
          {importing ? '🔄 Importing...' : '🔄 Import Lines Now'}
        </button>
        <button
          className="btn btn-secondary btn-full"
          onClick={fetchScores}
          disabled={importing}
          style={{marginBottom:'8px'}}
        >
          {importing ? 'Fetching...' : '📊 Fetch & Grade Final Scores'}
        </button>
        <button
          className="btn btn-secondary btn-full"
          onClick={checkStatus}
          disabled={checkingStatus}
        >
          {checkingStatus ? 'Checking...' : '📈 Check API Quota'}
        </button>
      </div>

      {result && (
        <div className="card" style={{padding:'12px'}}>
          <div style={{fontSize:'13px', fontWeight:'500', color:'var(--green)', marginBottom:'4px'}}>✓ Import successful</div>
          <div style={{fontSize:'12px', color:'var(--sub)'}}>
            {result.nfl} NFL games · {result.cfb} CFB games (Power 4 + Notre Dame)
          </div>
        </div>
      )}

      {status && (
        <div className="card" style={{padding:'12px'}}>
          <div style={{fontSize:'12px', color:'var(--sub)'}}>
            <div>Requests used: <strong>{status.requests_used}</strong></div>
            <div>Requests remaining: <strong style={{color: parseInt(status.requests_remaining) < 50 ? 'var(--red)' : 'var(--green)'}}>{status.requests_remaining}</strong></div>
            <div>Last call used: <strong>{status.requests_last}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PickOverride({ week, showToast, onBack }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!week) return;
    loadPicks();
  }, [week, filter]);

  async function loadPicks() {
    setLoading(true);
    try {
      const data = await api.get(`/picks/dashboard/${week.id}`);
      let p = data.picks || [];
      if (filter !== 'all') p = p.filter(x => x.result === filter || (!x.result && filter === 'pending'));
      setPicks(p);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function override(pickId, result) {
    setSaving(pickId);
    try {
      await api.put(`/picks/${pickId}/override`, { result });
      showToast('Pick updated ✓');
      await loadPicks();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(null); }
  }

  if (!week) return (
    <div>
      <button className="btn btn-secondary" onClick={onBack} style={{marginBottom:'16px'}}>← Back</button>
      <div className="empty-state">No active week.</div>
    </div>
  );

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <p className="sec-label" style={{margin:0}}>Override picks · Wk {week.nfl_week}</p>
      </div>
      <div className="pills" style={{marginBottom:'10px'}}>
        {['all','pending','win','loss','push'].map(f => (
          <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {loading && <div className="empty-state">Loading...</div>}
      {!loading && picks.length === 0 && <div className="empty-state">No picks found.</div>}
      {!loading && picks.map(p => (
        <div key={p.id} className="card" style={{padding:'10px 12px', marginBottom:'6px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px'}}>
            <div>
              <div style={{fontSize:'13px', fontWeight:'500', color:'var(--black)'}}>{p.player_name}</div>
              <div style={{fontSize:'11px', color:'var(--hint)'}}>
                {p.pick_type === 'spread' ? p.picked_team : p.pick_type === 'over' ? `Over ${p.total}` : `Under ${p.total}`}
                {p.is_lock ? ' 🔒' : ''} · {p.away_team} vs {p.home_team}
              </div>
            </div>
            <span className={`badge ${p.result === 'win' ? 'win' : p.result === 'loss' ? 'loss' : p.result === 'push' ? 'push' : 'pending'}`}>
              {p.result || 'pending'}
            </span>
          </div>
          <div style={{display:'flex', gap:'5px'}}>
            {['win','loss','push','void'].map(r => (
              <button
                key={r}
                onClick={() => override(p.id, r)}
                disabled={saving === p.id || p.result === r}
                style={{
                  flex:1, padding:'5px 4px', fontSize:'11px', fontWeight:'500',
                  borderRadius:'6px', border:'0.5px solid',
                  cursor: p.result === r ? 'default' : 'pointer',
                  fontFamily:'var(--font)',
                  background: p.result === r
                    ? (r === 'win' ? 'var(--gbg)' : r === 'loss' ? 'var(--rbg)' : '#F0EDE8')
                    : 'var(--card)',
                  color: p.result === r
                    ? (r === 'win' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : 'var(--sub)')
                    : 'var(--sub)',
                  borderColor: p.result === r
                    ? (r === 'win' ? 'var(--gbd)' : r === 'loss' ? 'var(--rbd)' : 'var(--card-border)')
                    : 'var(--card-border)',
                  opacity: saving === p.id ? 0.5 : 1,
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
