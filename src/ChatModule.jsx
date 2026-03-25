import { useState, useEffect, useRef, useCallback } from 'react';
import { getToken } from './api.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function authHeaders(extra = {}) {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

// ── Helper: timeAgo ────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 1) return `il y a ${sec}s`;
  if (min < 60) return `il y a ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months}mo`;
  return `il y a ${Math.floor(months / 12)}a`;
}

// ── Icons (inline SVG) ─────────────────────────────────────────────────────────

const Ic = {
  Chat: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Mic: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Expand: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  Shrink: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  History: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
};

// ── CSS Keyframes injection ────────────────────────────────────────────────────

const STYLE_ID = 'chat-module-keyframes';
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes chat-slide-in {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes chat-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.7; transform: scale(1.15); }
    }
    @keyframes chat-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes chat-bars {
      0%, 100% { transform: scaleY(0.4); }
      50%      { transform: scaleY(1); }
    }
  `;
  document.head.appendChild(style);
}

// ── AudioRecorder ──────────────────────────────────────────────────────────────

function AudioRecorder({ onSend }) {
  const [state, setState] = useState('idle'); // idle | recording | sending
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    mediaRef.current = null;
    chunksRef.current = [];
    setTimer(0);
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration = timer;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          setState('sending');
          onSend(base64, duration).finally(() => {
            setState('idle');
            cleanup();
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setState('recording');
      let s = 0;
      timerRef.current = setInterval(() => {
        s++;
        setTimer(s);
        if (s >= 120) stopRecording();
      }, 1000);
    } catch {
      setError('Micro non autorisé');
      setState('idle');
      cleanup();
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.ondataavailable = null;
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
    }
    cleanup();
    setState('idle');
  };

  useEffect(() => () => cleanup(), [cleanup]);

  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (state === 'sending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <div style={{ width: 14, height: 14, border: '2px solid var(--or)', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'chat-pulse 0.8s linear infinite' }}/>
        <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Envoi...</span>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#C8260E',
          animation: 'chat-pulse 1s ease-in-out infinite', flexShrink: 0 }}/>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#C8260E', fontVariantNumeric: 'tabular-nums',
          minWidth: 36 }}>{formatTime(timer)}</span>
        {/* Fake waveform bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 16, borderRadius: 2, background: '#C8260E', opacity: 0.5,
              animation: `chat-bars 0.8s ease-in-out ${i * 0.07}s infinite`, transformOrigin: 'bottom' }}/>
          ))}
        </div>
        <button onClick={cancelRecording} title="Annuler" style={{ background: 'none', border: 'none',
          cursor: 'pointer', padding: 4, color: 'var(--tx3)', display: 'flex' }}>
          <Ic.X />
        </button>
        <button onClick={stopRecording} title="Envoyer" style={{ background: '#C8260E', border: 'none',
          borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
          <Ic.Send />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={startRecording} title="Message vocal" style={{ background: 'none', border: 'none',
        cursor: 'pointer', padding: 6, color: 'var(--tx3)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', borderRadius: '50%', transition: 'color 0.15s, background 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--or)'; e.currentTarget.style.background = 'var(--or-l)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx3)'; e.currentTarget.style.background = 'none'; }}>
        <Ic.Mic />
      </button>
      {error && (
        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, background: '#fef2f2',
          color: '#C8260E', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
          whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>{error}</div>
      )}
    </div>
  );
}

// ── AudioMessage ───────────────────────────────────────────────────────────────

function AudioMessage({ audioData, duration, isOwn }) {
  const formatTime = s => {
    if (!s && s !== 0) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
  };

  const bars = Array.from({ length: 28 }).map(() => 4 + Math.random() * 14);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
      {/* Fake waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 28, flex: 1 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 2.5, height: h, borderRadius: 2,
            background: isOwn ? 'rgba(255,255,255,0.5)' : 'rgba(232,80,26,0.4)' }}/>
        ))}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(duration)}
      </span>
      {audioData && (
        <audio controls preload="metadata" style={{ display: 'none' }}
          src={audioData.startsWith('data:') ? audioData : `data:audio/webm;base64,${audioData}`}/>
      )}
    </div>
  );
}

// Wrapper to make waveform clickable to play
function PlayableAudioMessage({ audioData, duration, isOwn }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    else audioRef.current.play();
  };

  return (
    <div onClick={toggle} style={{ cursor: 'pointer', position: 'relative' }}>
      <AudioMessage audioData={audioData} duration={duration} isOwn={isOwn} />
      <audio ref={audioRef} preload="metadata"
        src={audioData ? (audioData.startsWith('data:') ? audioData : `data:audio/webm;base64,${audioData}`) : undefined}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}/>
      {/* Play / pause indicator */}
      <div style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 22,
        height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isOwn ? 'rgba(255,255,255,0.25)' : 'rgba(232,80,26,0.15)' }}>
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill={isOwn ? '#fff' : 'var(--or)'}>
            <rect x="5" y="3" width="5" height="18" rx="1"/><rect x="14" y="3" width="5" height="18" rx="1"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill={isOwn ? '#fff' : 'var(--or)'}>
            <polygon points="6,3 20,12 6,21"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#E06050', '#E8943C', '#A0824B', '#4A5A18', '#A05828', '#E0A468', '#C07040', '#E8C840', '#8B6914', '#6B7A30'];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 30 }) {
  const c = avatarColor(name);
  const letter = (name || '?')[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: c, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
      fontSize: size * 0.45, flexShrink: 0, fontFamily: 'var(--ff)' }}>
      {letter}
    </div>
  );
}

// ── MessageThread ──────────────────────────────────────────────────────────────

function MessageThread({ conversation, currentUser, users, dossiers, onBack, expanded, setExpanded, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const lastIdRef = useRef(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  const getUserName = id => {
    const u = (users || []).find(u => String(u.id) === String(id));
    return u ? u.name : `Utilisateur #${id}`;
  };

  // Load initial messages
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/messages?limit=50`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data);
      if (data.length > 0) lastIdRef.current = data[data.length - 1].id;
    } catch { /* ignore */ }
  }, [conversation.id]);

  // Poll new messages
  const pollMessages = useCallback(async () => {
    if (!lastIdRef.current) return;
    try {
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/messages?limit=50&after_id=${lastIdRef.current}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.length > 0) {
        setMessages(prev => [...prev, ...data]);
        lastIdRef.current = data[data.length - 1].id;
      }
    } catch { /* ignore */ }
  }, [conversation.id]);

  // Mark as read
  const markRead = useCallback(async () => {
    try {
      await fetch(`${API_URL}/chat/conversations/${conversation.id}/read`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ user_id: currentUser.id }),
      });
    } catch { /* ignore */ }
  }, [conversation.id, currentUser.id]);

  useEffect(() => {
    loadMessages();
    markRead();
    pollRef.current = setInterval(pollMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages, pollMessages, markRead]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = async (content, type = 'text', audioData = null, audioDuration = null) => {
    if (type === 'text' && !content.trim()) return;
    setSending(true);
    try {
      const body = { sender_id: currentUser.id, content, type };
      if (audioData) body.audio_data = audioData;
      if (audioDuration != null) body.audio_duration = audioDuration;
      const res = await fetch(`${API_URL}/chat/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        lastIdRef.current = msg.id;
        if (type === 'text') setText('');
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleSendAudio = async (base64, duration) => {
    await sendMessage('Message vocal', 'audio', base64, duration);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(text);
    }
  };

  // Group consecutive messages by same sender for cleaner display
  const isFirstInGroup = (msg, i) => i === 0 || String(messages[i - 1].sender_id) !== String(msg.sender_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header enrichi */}
      {(() => {
        const dos = conversation.dossier_id ? (dossiers || []).find(d => String(d.id) === String(conversation.dossier_id)) : null;
        const parts = (conversation.participants || [])
          .map(p => (users || []).find(u => String(u.id) === String(p.user_id)))
          .filter(Boolean);
        const others = parts.filter(u => String(u.id) !== String(currentUser.id));
        return <>
          <div style={{ padding: '10px 12px', borderBottom: '1.5px solid var(--bd)', flexShrink: 0, background: 'var(--bg2)' }}>
            {/* Top row: back + title + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, display: 'flex', color: 'var(--tx2)', borderRadius: 6, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Ic.Back />
              </button>
              {/* Avatar(s) des interlocuteurs */}
              {others.length > 0 && (
                <div style={{ display: 'flex', marginRight: -2 }}>
                  {others.slice(0, 3).map((u, idx) => (
                    <div key={u.id} style={{ marginLeft: idx > 0 ? -8 : 0, zIndex: 3 - idx }}>
                      <Avatar name={u.name} size={28} />
                    </div>
                  ))}
                  {others.length > 3 && <div style={{ marginLeft: -8, width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--bd)', color: 'var(--tx3)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '2px solid var(--bg2)' }}>
                    +{others.length - 3}
                  </div>}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Noms des interlocuteurs */}
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {others.length > 0 ? others.map(u => u.name).join(', ') : conversation.title}
                </div>
                {/* Titre de la conversation si différent */}
                {others.length > 0 && conversation.title && (
                  <div style={{ fontSize: 11, color: 'var(--or)', fontWeight: 600, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{conversation.title}</div>
                )}
              </div>
              {setExpanded && <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Réduire' : 'Agrandir'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  display: 'flex', color: 'var(--tx3)', borderRadius: 6, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                {expanded ? <Ic.Shrink /> : <Ic.Expand />}
              </button>}
              {onClose && <button onClick={onClose} title="Fermer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  display: 'flex', color: 'var(--tx3)', borderRadius: 6, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <Ic.X />
              </button>}
            </div>
            {/* Bandeau dossier */}
            {dos && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, paddingLeft: 32,
                flexWrap: 'wrap' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {dos.dp_number && <span style={{ fontSize: 10, fontWeight: 700, color: '#A0824B', background: '#A0824B14',
                  padding: '1px 7px', borderRadius: 8, border: '1px solid #A0824B25' }}>{dos.dp_number}</span>}
                {dos.client && <span style={{ fontSize: 11, color: 'var(--tx2)', fontWeight: 500 }}>{dos.client}</span>}
                {dos.client_org && <span style={{ fontSize: 10, color: 'var(--tx4)' }}>({dos.client_org})</span>}
              </div>
            )}
            {conversation.dossier_id && !dos && (
              <div style={{ marginTop: 6, paddingLeft: 32 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#A0824B', background: '#A0824B14',
                  padding: '1px 7px', borderRadius: 10, display: 'inline-block', border: '1px solid #A0824B25' }}>
                  Dossier #{conversation.dossier_id}
                </span>
              </div>
            )}
          </div>
        </>;
      })()}

      {/* Messages area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex',
        flexDirection: 'column', gap: 2, background: 'var(--bg3)' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx4)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Aucun message pour le moment</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Commencez la conversation !</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = String(msg.sender_id) === String(currentUser.id);
          const first = isFirstInGroup(msg, i);
          return (
            <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column',
              alignItems: isOwn ? 'flex-end' : 'flex-start',
              marginTop: first ? 10 : 1,
              animation: 'chat-fade-in 0.2s ease' }}>
              {/* Sender name + avatar */}
              {first && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                  flexDirection: isOwn ? 'row-reverse' : 'row', marginBottom: 3,
                  paddingLeft: isOwn ? 0 : 4, paddingRight: isOwn ? 4 : 0 }}>
                  <Avatar name={getUserName(msg.sender_id)} size={22} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)' }}>
                    {isOwn ? 'Vous' : getUserName(msg.sender_id)}
                  </span>
                </div>
              )}
              {/* Bubble */}
              <div style={{
                maxWidth: '82%',
                padding: msg.type === 'audio' ? '8px 12px 8px 28px' : '8px 14px',
                borderRadius: isOwn
                  ? (first ? '16px 16px 4px 16px' : '16px 4px 4px 16px')
                  : (first ? '16px 16px 16px 4px' : '4px 16px 16px 4px'),
                background: isOwn ? 'var(--or)' : 'var(--bg2)',
                color: isOwn ? '#fff' : 'var(--tx)',
                fontSize: 13.5,
                lineHeight: 1.45,
                wordBreak: 'break-word',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                position: 'relative',
              }}>
                {msg.type === 'audio' ? (
                  <PlayableAudioMessage audioData={msg.audio_data} duration={msg.audio_duration} isOwn={isOwn} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              {/* Time */}
              <span style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 2,
                paddingLeft: isOwn ? 0 : 6, paddingRight: isOwn ? 6 : 0 }}>
                {timeAgo(msg.created_at)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 12px', borderTop: '1.5px solid var(--bd)', background: 'var(--bg2)',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <AudioRecorder onSend={handleSendAudio} />
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Votre message..." disabled={sending}
          style={{ flex: 1, border: '1.5px solid var(--bd)', borderRadius: 20, padding: '8px 14px',
            fontSize: 13, fontFamily: 'var(--ff)', outline: 'none', background: 'var(--bg3)',
            color: 'var(--tx)', transition: 'border-color 0.15s' }}
          onFocus={e => e.target.style.borderColor = 'var(--or)'}
          onBlur={e => e.target.style.borderColor = 'var(--bd)'}/>
        <button onClick={() => sendMessage(text)} disabled={sending || !text.trim()}
          style={{ background: text.trim() ? 'var(--or)' : 'var(--bd)', border: 'none', borderRadius: '50%',
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: text.trim() ? 'pointer' : 'default', color: '#fff', flexShrink: 0,
            transition: 'background 0.15s, transform 0.15s',
            transform: text.trim() ? 'scale(1)' : 'scale(0.9)' }}>
          <Ic.Send />
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dossierLabel(d) {
  return [d.dp_number, d.client, d.client_org].filter(Boolean).join(' — ') || d.reference || `Dossier #${d.id}`;
}

// ── NewConversationForm ────────────────────────────────────────────────────────

function NewConversationForm({ currentUser, dossiers, users, onCreated, onCancel, initialDossier }) {
  const [dossierId, setDossierId] = useState(initialDossier ? String(initialDossier.id) : '');
  const [dossierSearch, setDossierSearch] = useState(initialDossier ? dossierLabel(initialDossier) : '');
  const [dossierDropOpen, setDossierDropOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const dossierSearchRef = useRef(null);
  const selectedDossier = dossierId ? (dossiers || []).find(dd => String(dd.id) === String(dossierId)) : null;

  // Sync when initialDossier changes (e.g. clicking chat icon from another dossier)
  useEffect(() => {
    if (initialDossier) {
      setDossierId(String(initialDossier.id));
      setDossierSearch(dossierLabel(initialDossier));
      setSelectedUsers([]);
      setError('');
    }
  }, [initialDossier?.id]);

  const toggleUser = id => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!dossierId) { setError('Sélectionnez un dossier'); return; }
    if (selectedUsers.length === 0) { setError('Sélectionnez au moins un participant'); return; }
    setError('');
    setCreating(true);
    const autoTitle = selectedDossier ? dossierLabel(selectedDossier) : `Dossier #${dossierId}`;
    try {
      const body = {
        title: autoTitle,
        type: 'dossier',
        scope: 'interne',
        participant_ids: [...selectedUsers, currentUser.id],
        created_by: currentUser.id,
        dossier_id: dossierId,
      };
      const res = await fetch(`${API_URL}/chat/conversations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const conv = await res.json();
        onCreated(conv);
      } else {
        setError('Erreur lors de la création');
      }
    } catch {
      setError('Erreur réseau');
    }
    setCreating(false);
  };

  const otherUsers = (users || []).filter(u => String(u.id) !== String(currentUser.id));
  const [userSearch, setUserSearch] = useState('');
  const [userDropOpen, setUserDropOpen] = useState(false);

  const uq = userSearch.toLowerCase();
  const filteredUsers = otherUsers.filter(u => {
    if (!uq) return true;
    const searchable = [u.name, u.email, u.role].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(uq);
  });

  const q = dossierSearch.toLowerCase();
  const filteredDossiers = (dossiers || []).filter(dd => {
    const searchable = [dd.dp_number, dd.client, dd.client_org, dd.reference, dd.title, `Dossier #${dd.id}`]
      .filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(q);
  });

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg2)', zIndex: 5,
      display: 'flex', flexDirection: 'column', animation: 'chat-fade-in 0.2s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1.5px solid var(--bd)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--or)' }}>Nouvelle conversation</span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer',
          padding: 4, color: 'var(--tx3)', display: 'flex', borderRadius: 6, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <Ic.X />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {/* Dossier search */}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--or)', display: 'block', marginBottom: 3 }}>Dossier</label>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--bd)',
            borderRadius: 'var(--r)', padding: '5px 10px', background: 'var(--bg3)' }}>
            <Ic.Search />
            <input ref={dossierSearchRef} value={dossierSearch}
              onChange={e => { setDossierSearch(e.target.value); setDossierId(''); setDossierDropOpen(true); }}
              onFocus={() => setDossierDropOpen(true)}
              onBlur={() => setTimeout(() => setDossierDropOpen(false), 150)}
              placeholder="N° DP, nom client, partenaire..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 12, fontFamily: 'var(--ff)', color: 'var(--tx)' }}
            />
            {selectedDossier && <button onClick={() => { setDossierId(''); setDossierSearch(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: 'var(--tx3)', display: 'flex', borderRadius: 4 }}><Ic.X /></button>}
          </div>
          {dossierDropOpen && filteredDossiers.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg2)', border: '1.5px solid var(--bd)', borderRadius: 'var(--r)',
              maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shl)', marginTop: 2 }}>
              {filteredDossiers.slice(0, 15).map(dd => (
                <div key={dd.id} onClick={() => {
                  setDossierId(String(dd.id));
                  setDossierSearch(dossierLabel(dd));
                  setDossierDropOpen(false);
                }} style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--tx)',
                  transition: 'background 0.1s', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--or-l)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {dd.dp_number && <span style={{ fontWeight: 700, color: 'var(--or)', fontSize: 10,
                    background: 'var(--or-l)', padding: '1px 5px', borderRadius: 6, flexShrink: 0 }}>{dd.dp_number}</span>}
                  <span style={{ fontWeight: 600 }}>{dd.client || `Dossier #${dd.id}`}</span>
                  {dd.client_org && <span style={{ color: 'var(--tx3)', fontSize: 11 }}>({dd.client_org})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedDossier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 8,
            background: 'var(--or-l)', borderRadius: 6, fontSize: 11, color: 'var(--or)', fontWeight: 600 }}>
            <span>{selectedDossier.client}</span>
            {selectedDossier.dp_number && <span style={{ opacity: 0.7 }}>— {selectedDossier.dp_number}</span>}
          </div>
        )}

        {/* Participants */}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--or)', display: 'block', marginBottom: 3 }}>Participants</label>
        {/* Selected chips */}
        {selectedUsers.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {selectedUsers.map(uid => {
              const u = otherUsers.find(x => x.id === uid);
              if (!u) return null;
              const isPart = u.role === 'partenaire';
              return <span key={uid} onClick={() => toggleUser(uid)} style={{ display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 20, background: 'var(--or-l)', color: 'var(--or)', fontSize: 11,
                fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(232,80,26,.2)' }}>
                {u.name}
                {isPart && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                  background: '#ede9fe', color: '#6B35C8' }}>Prestataire</span>}
                <span style={{ fontSize: 13, lineHeight: 1, marginLeft: 2, opacity: .6 }}>×</span>
              </span>;
            })}
          </div>
        )}
        {/* Search input with dropdown suggestions */}
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--bd)',
            borderRadius: 'var(--r)', padding: '5px 10px', background: 'var(--bg3)' }}>
            <Ic.Search />
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
              onFocus={() => setUserDropOpen(true)}
              onBlur={() => setTimeout(() => setUserDropOpen(false), 150)}
              placeholder="Tapez un nom de collaborateur ou prestataire..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 12, fontFamily: 'var(--ff)', color: 'var(--tx)' }} />
            {userSearch && <button onClick={() => setUserSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: 'var(--tx3)', display: 'flex', borderRadius: 4 }}><Ic.X /></button>}
          </div>
          {/* Suggestions dropdown */}
          {userDropOpen && userSearch.length > 0 && filteredUsers.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg2)', border: '1.5px solid var(--bd)', borderRadius: 'var(--r)',
              maxHeight: 170, overflowY: 'auto', boxShadow: 'var(--shl)', marginTop: 2 }}>
              {filteredUsers.map(u => {
                const already = selectedUsers.includes(u.id);
                const isPart = u.role === 'partenaire';
                return (
                  <div key={u.id} onClick={() => { if (!already) { toggleUser(u.id); setUserSearch(''); } }}
                    style={{ padding: '6px 10px', fontSize: 12, cursor: already ? 'default' : 'pointer',
                      color: already ? 'var(--tx4)' : 'var(--tx)', display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'background 0.1s', opacity: already ? .5 : 1 }}
                    onMouseEnter={e => { if (!already) e.currentTarget.style.background = 'var(--or-l)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                    {isPart && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: '#ede9fe', color: '#6B35C8', flexShrink: 0 }}>Prestataire</span>}
                    {u.role === 'employee' && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: 'var(--or-l)', color: 'var(--or)', flexShrink: 0 }}>Équipe</span>}
                    {(u.role === 'superadmin' || u.role === 'admin') && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: 'var(--bl-l)', color: 'var(--bl)', flexShrink: 0 }}>Admin</span>}
                    {already && <span style={{ fontSize: 9, color: 'var(--tx4)', marginLeft: 'auto' }}>déjà ajouté</span>}
                  </div>
                );
              })}
            </div>
          )}
          {userDropOpen && userSearch.length > 0 && filteredUsers.length === 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--bg2)', border: '1.5px solid var(--bd)', borderRadius: 'var(--r)',
              boxShadow: 'var(--shl)', marginTop: 2, padding: '8px 10px', fontSize: 11, color: 'var(--tx4)' }}>
              Aucun utilisateur trouvé pour « {userSearch} »
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--re-l)',
            color: 'var(--re)', fontSize: 11, fontWeight: 600 }}>{error}</div>
        )}
      </div>

      {/* Create button */}
      <div style={{ padding: '8px 12px', borderTop: '1.5px solid var(--bd)', flexShrink: 0 }}>
        <button onClick={handleCreate} disabled={creating}
          style={{ width: '100%', padding: '8px 0', borderRadius: 'var(--r)', border: 'none',
            background: 'var(--or)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'var(--ff)',
            cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1,
            transition: 'opacity 0.15s, transform 0.1s' }}
          onMouseEnter={e => { if (!creating) e.currentTarget.style.transform = 'scale(1.01)'; }}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          {creating ? 'Création...' : 'Créer la conversation'}
        </button>
      </div>
    </div>
  );
}

// ── ConversationList ───────────────────────────────────────────────────────────

function ConversationList({ currentUser, users, dossiers, onSelect, onDelete }) {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chat/conversations?user_id=${currentUser.id}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => {
    loadConversations();
    pollRef.current = setInterval(loadConversations, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadConversations]);

  const handleDelete = async (e, conv) => {
    e.stopPropagation();
    if (!confirm(`Supprimer la conversation "${conv.title}" ?`)) return;
    try {
      await fetch(`${API_URL}/chat/conversations/${conv.id}`, { method: 'DELETE', headers: authHeaders() });
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (onDelete) onDelete(conv);
    } catch { /* ignore */ }
  };

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    if (c.title?.toLowerCase().includes(q)) return true;
    const dos = c.dossier_id ? (dossiers || []).find(d => String(d.id) === String(c.dossier_id)) : null;
    if (dos) {
      const searchable = [dos.dp_number, dos.client, dos.client_org].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) return true;
    }
    return false;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--bd)',
          borderRadius: 20, padding: '5px 12px', background: 'var(--bg3)', transition: 'border-color 0.15s' }}>
          <Ic.Search />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 12.5, fontFamily: 'var(--ff)', color: 'var(--tx)' }}/>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--tx4)', fontSize: 13 }}>
            Chargement...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx4)' }}>
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>💬</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Aucune conversation</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {search ? 'Aucun résultat pour cette recherche' : 'Créez une nouvelle conversation pour commencer'}
            </div>
          </div>
        )}
        {filtered.map(conv => {
          const dos = conv.dossier_id ? (dossiers || []).find(d => String(d.id) === String(conv.dossier_id)) : null;
          const parts = (conv.participants || [])
            .map(p => (users || []).find(u => String(u.id) === String(p.user_id)))
            .filter(Boolean);
          const hasUnread = conv.unread_count > 0;
          return (
          <div key={conv.id} onClick={() => onSelect(conv)}
            style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background 0.15s',
              borderBottom: '1px solid var(--bd)', borderLeft: hasUnread ? '3px solid var(--or)' : '3px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {/* Row 1: title + time + unread */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: hasUnread ? 'var(--or)' : 'var(--tx)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{conv.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {hasUnread && <span style={{ background: 'var(--or)', color: '#fff', fontSize: 9, fontWeight: 700,
                  borderRadius: 10, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>{conv.unread_count}</span>}
                <span style={{ fontSize: 10, color: 'var(--tx4)' }}>{timeAgo(conv.last_message_time)}</span>
              </div>
            </div>
            {/* Row 2: DP badge + client */}
            {dos && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                {dos.dp_number && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--bl)',
                  background: 'var(--bl-l)', padding: '1px 6px', borderRadius: 6, flexShrink: 0 }}>{dos.dp_number}</span>}
                <span style={{ fontSize: 11, color: 'var(--tx2)', fontWeight: 500, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dos.client}{dos.client_org ? ` — ${dos.client_org}` : ''}</span>
              </div>
            )}
            {/* Row 3: participants */}
            {parts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--tx4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                {parts.map(u => (
                  <span key={u.id} style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 8,
                    background: String(u.id) === String(currentUser.id) ? 'var(--or-l)' : 'var(--bg3)',
                    color: String(u.id) === String(currentUser.id) ? 'var(--or)' : 'var(--tx3)',
                    border: `1px solid ${String(u.id) === String(currentUser.id) ? 'rgba(232,80,26,.2)' : 'var(--bd)'}` }}>
                    {String(u.id) === String(currentUser.id) ? 'Moi' : u.name}
                  </span>
                ))}
              </div>
            )}
            {/* Row 4: last message + actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--tx4)', overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', fontStyle: conv.last_message ? 'normal' : 'italic', flex: 1 }}>
                {conv.last_message ? (conv.last_message.length > 50 ? conv.last_message.slice(0, 50) + '…' : conv.last_message) : 'Aucun message'}
              </span>
              <button onClick={e => handleDelete(e, conv)} title="Supprimer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                  color: 'var(--tx4)', display: 'flex', borderRadius: 4, transition: 'color 0.15s', flexShrink: 0, opacity: 0.5 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--re)'; e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx4)'; e.currentTarget.style.opacity = '0.5'; }}>
                <Ic.Trash />
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ChatPanel ──────────────────────────────────────────────────────────────────

function ChatPanel({ currentUser, dossiers, users, onClose, initialDossier }) {
  const [view, setView] = useState('new');
  const [activeConversation, setActiveConversation] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // When initialDossier changes (user clicked chat from a dossier), switch to new conversation form
  useEffect(() => {
    if (initialDossier) {
      setView('new');
      setActiveConversation(null);
    }
  }, [initialDossier?.id]);

  const openThread = conv => {
    setActiveConversation(conv);
    setView('thread');
  };

  const handleCreated = conv => {
    setActiveConversation(conv);
    setView('thread');
  };

  const compact = { width: 380, maxHeight: 560, bottom: 90, right: 24, borderRadius: 'var(--rl)' };
  const large = { width: 'min(720px, calc(100vw - 48px))', height: 'min(680px, calc(100vh - 100px))',
    maxHeight: 'none', bottom: 24, right: 24, borderRadius: 'var(--rl)' };
  const sz = expanded ? large : compact;

  const tabBtn = (label, icon, v) => {
    const active = view === v;
    return <button key={v} onClick={() => setView(v)} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: 'none', cursor: 'pointer',
      borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--ff)',
      background: active ? 'var(--or)' : 'transparent', color: active ? '#fff' : 'var(--tx3)',
      transition: 'background 0.15s, color 0.15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {icon}{label}
    </button>;
  };

  return (
    <div style={{
      position: 'fixed', ...sz,
      background: 'var(--bg2)', border: '1.5px solid var(--bd)',
      boxShadow: 'var(--shl)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      zIndex: 998, fontFamily: 'var(--ff)', animation: 'chat-slide-in 0.25s ease',
      transition: 'width 0.25s ease, height 0.25s ease, max-height 0.25s ease, bottom 0.25s ease',
      borderRadius: sz.borderRadius,
    }}>
      {/* Header */}
      {view !== 'thread' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderBottom: '1.5px solid var(--bd)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {tabBtn('Nouveau', <Ic.Plus />, 'new')}
            {tabBtn('Historique', <Ic.History />, 'list')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Réduire' : 'Agrandir'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                display: 'flex', color: 'var(--tx3)', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {expanded ? <Ic.Shrink /> : <Ic.Expand />}
            </button>
            <button onClick={onClose} title="Fermer"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                display: 'flex', color: 'var(--tx3)', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <Ic.X />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: expanded ? 400 : 300 }}>
        {view === 'list' && (
          <ConversationList currentUser={currentUser} users={users} dossiers={dossiers}
            onSelect={openThread} />
        )}
        {view === 'thread' && activeConversation && (
          <MessageThread conversation={activeConversation} currentUser={currentUser} users={users} dossiers={dossiers}
            onBack={() => { setView('list'); setActiveConversation(null); }}
            expanded={expanded} setExpanded={setExpanded} onClose={onClose} />
        )}
        {view === 'new' && (
          <NewConversationForm currentUser={currentUser} dossiers={dossiers} users={users}
            onCreated={handleCreated} onCancel={() => setView('list')} initialDossier={initialDossier} />
        )}
      </div>
    </div>
  );
}

// ── ChatBubble (default export) ────────────────────────────────────────────────

export function openChatForDossier(dossier) {
  window.dispatchEvent(new CustomEvent('open-chat-dossier', { detail: dossier }));
}

export default function ChatBubble({ currentUser, dossiers, users }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [chatDossier, setChatDossier] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    injectKeyframes();
    const handler = e => {
      // Force re-render by clearing then setting, so ChatPanel/NewConversationForm detect the change
      setChatDossier(null);
      setTimeout(() => {
        setChatDossier(e.detail);
        setOpen(true);
      }, 0);
    };
    window.addEventListener('open-chat-dossier', handler);
    return () => window.removeEventListener('open-chat-dossier', handler);
  }, []);

  // Poll unread count
  const fetchUnread = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`${API_URL}/chat/unread-count?user_id=${currentUser.id}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.count || 0);
    } catch { /* ignore */ }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchUnread]);

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--or)', color: '#fff', border: 'none',
          boxShadow: 'var(--shl)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
        }}>
        <Ic.Chat />
        {/* Unread badge */}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#C8260E', color: '#fff',
            fontSize: 10, fontWeight: 800, fontFamily: 'var(--ff)',
            borderRadius: 10, padding: '1px 5px', minWidth: 18,
            textAlign: 'center', display: 'inline-block',
            border: '2px solid var(--bg2)',
            animation: 'chat-fade-in 0.2s ease',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <ChatPanel currentUser={currentUser} dossiers={dossiers} users={users}
          initialDossier={chatDossier}
          onClose={() => { setOpen(false); setChatDossier(null); }} />
      )}
    </>
  );
}
