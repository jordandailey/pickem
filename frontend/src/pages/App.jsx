import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import PicksScreen from '../components/PicksScreen';
import StandingsScreen from '../components/StandingsScreen';
import DashboardScreen from '../components/DashboardScreen';
import MyPicksScreen from '../components/MyPicksScreen';
import AdminScreen from '../components/AdminScreen';

function formatDeadline(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'Picks locked';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 48) { const days = Math.floor(h / 24); return `${days}d ${h % 24}h left`; }
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function App() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('picks');
  const [week, setWeek] = useState(null);
  const [myPicks, setMyPicks] = useState([]);
  const [toast, setToast] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => { loadWeek(); }, []);

  async function loadWeek() {
    try {
      const data = await api.get('/weeks/active');
      setWeek(data);
      if (data) {
        const picks = await api.get(`/picks/my/${data.id}`);
        setMyPicks(picks);
      }
    } catch (err) { showToast(err.message, 'error'); }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Pick'em</h1>
          <div style={{position:'relative'}}>
            <div className="avatar" title={user?.name} onClick={() => setShowProfile(p => !p)}>
              {initials}
            </div>
            {showProfile && (
              <div style={{
                position:'absolute', right:0, top:'42px', background:'#fff',
                border:'0.5px solid var(--card-border)', borderRadius:'var(--radius)',
                boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:200, minWidth:'160px', overflow:'hidden'
              }}>
                <div style={{padding:'12px 14px', borderBottom:'0.5px solid var(--card-border)'}}>
                  <div style={{fontSize:'13px', fontWeight:'500', color:'var(--black)'}}>{user?.name}</div>
                  <div style={{fontSize:'11px', color:'var(--hint)'}}>@{user?.username}</div>
                </div>
                <button
                  onClick={() => { setShowProfile(false); logout(); }}
                  style={{
                    width:'100%', padding:'11px 14px', background:'none', border:'none',
                    textAlign:'left', fontSize:'13px', color:'var(--red)', cursor:'pointer',
                    fontFamily:'var(--font)'
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        {week && (
          <div className="week-row">
            <div className="week-badge">
              <div className="week-dot" />
              <span>NFL Wk {week.nfl_week} · CFB Wk {week.cfb_week}</span>
            </div>
            <div className="deadline-chip">
              ⏱ {formatDeadline(week.submission_deadline)}
            </div>
          </div>
        )}
        {tab === 'picks' && week && (
          <div className="picks-track">
            {[0,1,2,3,4].map(i => (
              <div key={i} className={`pick-dot ${i < myPicks.length ? (myPicks[i]?.is_lock ? 'locked' : 'filled') : ''}`} />
            ))}
          </div>
        )}
      </header>

      {/* Overlay to close profile menu */}
      {showProfile && (
        <div style={{position:'fixed',inset:0,zIndex:199}} onClick={() => setShowProfile(false)} />
      )}

      <main className="screen">
        {tab === 'picks' && (
          <PicksScreen
            week={week}
            myPicks={myPicks}
            onPicksSubmitted={async () => { showToast('Picks submitted! 🎯'); await loadWeek(); }}
            showToast={showToast}
          />
        )}
        {tab === 'standings' && <StandingsScreen week={week} userId={user?.id} />}
        {tab === 'dashboard' && <DashboardScreen week={week} />}
        {tab === 'mypicks' && <MyPicksScreen week={week} myPicks={myPicks} />}
        {tab === 'admin' && user?.is_admin && (
          <AdminScreen week={week} onWeekUpdated={loadWeek} showToast={showToast} />
        )}
        <div className="spacer" />
      </main>

      <nav className="bottom-nav">
        {[
          { id: 'picks', icon: '✅', label: 'Picks' },
          { id: 'standings', icon: '🏆', label: 'Standings' },
          { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
          { id: 'mypicks', icon: '📋', label: 'My Picks' },
          ...(user?.is_admin ? [{ id: 'admin', icon: '⚙️', label: 'Admin' }] : []),
        ].map(t => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
