import React, { useState, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import PicksScreen from '../components/PicksScreen';
import StandingsScreen from '../components/StandingsScreen';
import DashboardScreen from '../components/DashboardScreen';
import MyPicksScreen from '../components/MyPicksScreen';
import AdminScreen from '../components/AdminScreen';
import ProfileScreen from '../components/ProfileScreen';

const SPONSOR_LOGOS = [
  { url: 'https://images.squarespace-cdn.com/content/v1/67927542fd3fea4f35716fa6/f58f95f2-5ea5-44c6-931c-6c3df795c8c2/Logo+TC+-+new.jpg?format=1500w', alt: 'TC' },
  { url: 'https://www.simplegreenslandscaping.com/wp-content/uploads/2023/12/simplegreenslogo.png', alt: 'Simple Greens' },
  { url: 'https://bluewebercapital.com/wp-content/uploads/2025/10/BlueWeberCapital-Logo-11.png', alt: 'Blue Weber Capital' },
];

function SponsorTicker() {
  const [current, setCurrent] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent(c => (c + 1) % SPONSOR_LOGOS.length);
        setFading(false);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{display:'flex', alignItems:'center', gap:'6px', flexShrink:0}}>
      <span style={{fontSize:'9px', color:'#666', whiteSpace:'nowrap', letterSpacing:'0.3px', textTransform:'uppercase'}}>Brought to you by</span>
      <div style={{width:'60px', height:'24px', position:'relative', overflow:'hidden'}}>
        <img
          src={SPONSOR_LOGOS[current].url}
          alt={SPONSOR_LOGOS[current].alt}
          style={{
            height:'24px', width:'60px', objectFit:'contain',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.4s ease',
            filter: 'brightness(0) invert(1)',
          }}
        />
      </div>
    </div>
  );
}

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

  // Profile screen overrides everything
  if (tab === 'profile') {
    return <ProfileScreen onBack={() => setTab('picks')} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Pick'em</h1>
          <SponsorTicker />
          <div
            className="avatar"
            title={user?.name}
            onClick={() => setTab('profile')}
            style={{cursor:'pointer'}}
          >
            {initials}
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

      <main className="screen">
        {tab === 'picks' && (
          <PicksScreen
            week={week}
            myPicks={myPicks}
            onPicksSubmitted={async () => {
              const isUpdate = myPicks?.length > 0;
              showToast(isUpdate ? 'Picks updated! ✏️' : 'Picks submitted! 🎯');
              await loadWeek();
              setTab('mypicks'); // Auto-navigate to My Picks
            }}
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
