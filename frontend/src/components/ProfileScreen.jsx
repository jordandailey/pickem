import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ onBack }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/profile').then(setProfile).catch(console.error);
  }, []);

  function showMsg(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPw !== confirmPw) return showMsg('New passwords do not match', 'error');
    if (newPw.length < 4) return showMsg('Password must be at least 4 characters', 'error');
    setSaving(true);
    try {
      await api.put('/profile/password', { current_password: currentPw, new_password: newPw });
      showMsg('Password updated ✓');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showMsg('Image must be under 2MB', 'error');
    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        await api.post('/profile/avatar', { avatar_url: base64 });
        setProfile(p => ({ ...p, avatar_url: base64 }));
        showMsg('Avatar updated ✓');
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showMsg(err.message, 'error');
      setUploadingAvatar(false);
    }
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{padding:'12px', background:'var(--page)', minHeight:'100vh'}}>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px'}}>
        <button className="btn btn-secondary" onClick={onBack} style={{padding:'7px 12px'}}>← Back</button>
        <p className="sec-label" style={{margin:0}}>My Profile</p>
      </div>

      {msg && (
        <div style={{
          background: msg.type === 'error' ? 'var(--red-bg)' : 'var(--gbg)',
          color: msg.type === 'error' ? 'var(--red)' : 'var(--green)',
          border: `0.5px solid ${msg.type === 'error' ? 'var(--rbd)' : 'var(--gbd)'}`,
          borderRadius:'var(--radius-sm)', padding:'10px 12px', marginBottom:'12px', fontSize:'13px'
        }}>
          {msg.text}
        </div>
      )}

      {/* Avatar */}
      <div className="card" style={{padding:'16px', marginBottom:'10px'}}>
        <p className="sec-label">Profile Photo</p>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width:'72px', height:'72px', borderRadius:'50%',
              background: profile?.avatar_url ? 'transparent' : 'var(--gold-border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', overflow:'hidden', flexShrink:0,
              border:'2px solid var(--card-border)', position:'relative'
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              <span style={{fontSize:'24px', fontWeight:'600', color:'#000'}}>{initials}</span>
            )}
            {uploadingAvatar && (
              <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%'}}>
                <span style={{color:'#fff', fontSize:'12px'}}>...</span>
              </div>
            )}
          </div>
          <div>
            <div style={{fontSize:'16px', fontWeight:'500', color:'var(--black)', marginBottom:'4px'}}>{user?.name}</div>
            <div style={{fontSize:'12px', color:'var(--hint)', marginBottom:'8px'}}>@{user?.username}</div>
            <button
              className="btn btn-secondary"
              style={{fontSize:'12px', padding:'6px 12px'}}
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? 'Uploading...' : 'Change photo'}
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange} />
      </div>

      {/* Change Password */}
      <div className="card" style={{padding:'16px', marginBottom:'10px'}}>
        <p className="sec-label">Change Password</p>
        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label className="form-label">Current password</label>
            <input className="form-input" type="password" value={currentPw}
              onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input className="form-input" type="password" value={newPw}
              onChange={e => setNewPw(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm new password</label>
            <input className="form-input" type="password" value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div className="card" style={{padding:'0', marginBottom:'10px', overflow:'hidden'}}>
        <button
          onClick={logout}
          style={{
            width:'100%', padding:'14px 16px', background:'none', border:'none',
            textAlign:'left', fontSize:'14px', color:'var(--red)', cursor:'pointer',
            fontFamily:'var(--font)', fontWeight:'500'
          }}
        >
          ↩️ Sign out
        </button>
      </div>
    </div>
  );
}
