// Generated with Claude (SI), reviewed by the team.
import {useEffect, useState} from 'react'
import './styles.css'

const C = ['var(--ok)', 'var(--wa)', 'var(--al)'], L = ['Nominal', 'Watch', 'Action']
async function api(p, method = 'GET', body) {
  const r = await fetch('/api' + p, {method, headers: {'Content-Type': 'application/json'}, body: body && JSON.stringify(body)})
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.detail && j.detail[0] && j.detail[0].msg || 'Request failed').replace('Value error, ', '')) }
  return (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text()
}
const fmt = (k, v) => (k === 'temp' ? (+v).toFixed(1) : v)
const save = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text])); a.download = name; a.click() }

export default function App() {
  const [cfg, setCfg] = useState(null), [s, setS] = useState(null), [tab, setTab] = useState('home'), [toast, setToast] = useState(''), [k, setK] = useState('hr')
  const say = (m, ms = 2500) => { setToast(m); if (ms) setTimeout(() => setToast(''), ms) }
  const act = (p, m, b, msg) => api(p, m, b).then(x => { setS(x); if (msg) say(msg) }).catch(x => say(x.message))
  useEffect(() => { api('/config').then(setCfg); api('/state').then(setS) }, [])
  useEffect(() => { // in-app reminders (fire while the page is open)
    if (!s) return
    const fired = {}
    const id = setInterval(() => {
      const n = new Date(), hm = n.toTimeString().slice(0, 5)
      s.reminders.forEach((r, j) => {
        if (r.on && r.t === hm && fired[j] !== n.toDateString() + hm) {
          fired[j] = n.toDateString() + hm; say('⏰ ' + r.n + ' (tap to dismiss)', 0)
          if ('Notification' in window && Notification.permission === 'granted') new Notification('VitalOrbit', {body: r.n})
        }
      })
    }, 10000)
    return () => clearInterval(id)
  }, [s?.reminders])
  if (!cfg || !s) return <main>Loading… (is the Python API running on :8000?)</main>
  const {I, K} = cfg, e = s.entries[s.entries.length - 1], sm = s.summary, env = cfg.envs[s.env]
  const tabs = [['home', 'Overview'], ['body', 'Body map'], ['log', 'Log'], ['trend', 'Trends'], ['game', 'Missions']]
  return <main>
    <header><h1>🛰️ Vital<span>Orbit</span></h1>
      <label>Location <select value={s.env} onChange={ev => act('/env/' + ev.target.value, 'PUT')}>{Object.entries(cfg.envs).map(([id, v]) => <option key={id} value={id}>{v[0]}</option>)}</select></label></header>
    <nav>{tabs.map(([id, n]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{n}</button>)}</nav>
    {sm.alerts > 0 && <div className="warn">⚠ {sm.alerts} indicator(s) need action. Contact the flight surgeon (signal delay {env[1]}).</div>}
    {tab === 'home' && <Home {...{cfg, s, e, sm, env, setK, setTab}} />}
    {tab === 'body' && <Body {...{cfg, e, s}} />}
    {tab === 'log' && <Log {...{cfg, s, e, setS, say, setTab}} />}
    {tab === 'trend' && <Trend {...{cfg, s, k, setK}} />}
    {tab === 'game' && <Game {...{cfg, s, act, say}} />}
    {toast && <div id="toast" style={{display: 'block'}} onClick={() => setToast('')}>{toast}</div>}
    <footer>Educational prototype for NASA Space Apps 2026. Not a medical device. Rules live in backend/main.py.</footer>
  </main>
}

function Home({cfg, s, e, sm, env, setK, setTab}) {
  const c = sm.alerts ? C[2] : Object.values(sm.items).some(x => x.s) ? C[1] : C[0]
  return <>
    <div className="card top"><div className="ring" style={{background: `conic-gradient(${c} ${sm.readiness * 3.6}deg,var(--bd) 0)`}}><div><span><b>{sm.readiness}</b>readiness</span></div></div>
      <div><h2>Mission day {s.md} · {env[0]}</h2><p className="mut" style={{margin: 0}}>{env[2]}</p></div></div>
    <div className="grid">{cfg.K.map(k => { const x = sm.items[k], i = cfg.I[k]
      return <div className="k" key={k} style={{borderLeftColor: C[x.s]}} onClick={() => { setK(k); setTab('trend') }}>
        <small>{i.n}</small><br /><b>{fmt(k, x.v)}</b> <small>{i.u}</small><br /><span className="tag" style={{background: C[x.s]}}>{L[x.s]}</span> {x.drift && <small>↘ drift</small>}</div> })}</div>
    <div className="card" style={{marginTop: 12}}><h2>What to do now</h2>
      {sm.insights.length ? sm.insights.map(i => <div className="ins" key={i.k} style={{borderColor: C[i.level]}}>{i.text}</div>) : <p className="mut">All indicators nominal. Keep up the routine.</p>}</div>
  </>
}

function Body({cfg, e, s}) {
  const [r, setR] = useState('chest'), R = cfg.regions[r], w = id => Math.max(...cfg.regions[id].k.map(k => s.summary.items[k].s))
  const G = ({id, children}) => <g className={r === id ? 'sel' : ''} onClick={() => setR(id)} style={{opacity: .85}}>{children}</g>
  const fill = id => ({fill: C[w(id)]})
  return <div className="card two">
    <svg className="body" viewBox="0 0 200 360" role="img" aria-label="Clickable human body">
      <G id="head"><circle cx="100" cy="38" r="26" style={fill('head')} /></G>
      <G id="chest"><path d="M70 78h60q6 0 6 8v42H64V86q0-8 6-8z" style={fill('chest')} /></G>
      <G id="gut"><path d="M64 130h72v50q0 12-12 12H76q-12 0-12-12z" style={fill('gut')} /></G>
      <G id="arms"><rect x="36" y="82" width="22" height="110" rx="11" style={fill('arms')} /><rect x="142" y="82" width="22" height="110" rx="11" style={fill('arms')} /></G>
      <G id="legs"><rect x="70" y="200" width="28" height="140" rx="13" style={fill('legs')} /><rect x="102" y="200" width="28" height="140" rx="13" style={fill('legs')} /></G>
    </svg>
    <div><h2>{R.n}</h2><p><b>Hazard:</b> {R.h}<br /><b>Why it matters:</b> {R.y}</p><p className="mut"><small>Source: {R.s}</small></p>
      {R.k.map(k => { const x = s.summary.items[k], i = cfg.I[k]
        return <div className="ins" key={k} style={{borderColor: C[x.s]}}><b>{i.n}: {fmt(k, e[k])} {i.u}</b> <span className="tag" style={{background: C[x.s]}}>{L[x.s]}</span>
          <br /><small className="mut">How to measure: {i.how}</small>{x.s > 0 && <><br />{i.g[x.s - 1]}</>}</div> })}</div>
  </div>
}

function Log({cfg, s, e, setS, say, setTab}) {
  const [f, setF] = useState({...e, day: s.md}), [msg, setMsg] = useState('')
  useEffect(() => setF(x => ({...x, day: s.md})), [s.md])
  const submit = () => {
    const body = Object.fromEntries(Object.entries(f).filter(([a]) => a[0] !== '_').map(([a, v]) => [a, +v]))
    for (const k of cfg.K) { const [lo, hi] = cfg.RG[k]; if (isNaN(body[k]) || body[k] < lo || body[k] > hi) return setMsg(`${cfg.I[k].n} must be ${lo}–${hi} ${cfg.I[k].u}`) }
    if (!(body.day >= 1)) return setMsg('Mission day must be 1 or more')
    api('/entries', 'POST', body).then(x => { setS(x); setMsg(''); say('+10 XP · entry logged'); setTab('home') }).catch(x => setMsg(x.message))
  }
  const nextDay = () => api('/new-day', 'POST').then(x => { setS(x); say('Day ' + x.md + ' started. XP kept') })
  return <div className="card"><h2>Log today’s readings</h2>
    <form onSubmit={ev => { ev.preventDefault(); submit() }}>
      <label>Mission day<input type="number" min="1" step="1" value={f.day} onChange={ev => setF({...f, day: ev.target.value})} /><small>{s.tally.logged} days logged. One entry per day: saving an existing day replaces it. Tap “Start next day” to move on.</small></label>
      {cfg.K.map(k => { const [lo, hi, step] = cfg.RG[k]; return <label key={k}>{cfg.I[k].n} ({cfg.I[k].u})<input type="number" min={lo} max={hi} step={step} value={f[k]} onChange={ev => setF({...f, [k]: ev.target.value})} /><small>Allowed {lo}–{hi} {cfg.I[k].u}. {cfg.I[k].how}</small></label> })}
    </form>
    <p><button className="btn pri" onClick={submit}>Save entry (+10 XP)</button> <button className="btn" onClick={nextDay}>Start next day</button> <span className="mut">{msg}</span></p></div>
}

function Trend({cfg, s, k, setK}) {
  const i = cfg.I[k], d = s.entries.slice(-21), v = d.map(x => x[k])
  const y0 = Math.min(...v, i.w[0]); let y1 = Math.max(...v, Math.min(i.w[1], Math.max(...v) * 1.15)); if (y1 === y0) y1 = y0 + 1
  const X = j => 50 + j * 570 / Math.max(1, v.length - 1), Y = x => 210 - (x - y0) / (y1 - y0) * 180
  const b0 = Y(Math.max(y0, i.w[0])), b1 = Y(Math.min(y1, i.w[1]))
  return <div className="card"><label>Indicator <select value={k} onChange={ev => setK(ev.target.value)}>{cfg.K.map(x => <option key={x} value={x}>{cfg.I[x].n}</option>)}</select></label>
    <div className="scroll"><svg viewBox="0 0 640 250" style={{minWidth: 520, width: '100%'}}>
      <rect x="50" y={b1} width="570" height={b0 - b1} fill="var(--ok)" opacity=".15" /><line x1="50" y1="210" x2="620" y2="210" stroke="var(--bd)" />
      <polyline fill="none" stroke="var(--ac)" strokeWidth="2.5" points={v.map((x, j) => X(j) + ',' + Y(x)).join(' ')} />
      {v.map((x, j) => <circle key={j} cx={X(j)} cy={Y(x)} r="5" fill={C[d[j]._s[k]]}><title>Day {d[j].day}: {fmt(k, x)} {i.u}</title></circle>)}
      {d.map((x, j) => j % 2 === 0 && <text key={j} x={X(j)} y="232" textAnchor="middle" fill="var(--mut)" fontSize="11">D{x.day}</text>)}</svg></div>
    <p className="mut">{i.n} ({i.u}). Green band is the nominal range.</p></div>
}

function Game({cfg, s, act, say}) {
  const [rep, setRep] = useState(''), p = s.progress
  useEffect(() => { api('/report').then(setRep) }, [s.entries])
  const setRem = (j, patch) => act('/reminders', 'PUT', s.reminders.map((r, x) => (x === j ? {...r, ...patch} : r)))
  return <>
    <div className="card"><h2>{p.level} · {p.xp} XP</h2>
      <div style={{height: 10, background: 'var(--bg)', borderRadius: 9, overflow: 'hidden'}}><div style={{height: '100%', background: 'var(--ac)', width: p.into / 1.5 + '%'}} /></div>
      <p className="mut">📅 Mission day {s.md} · {s.tally.completed} mission days completed ({s.tally.perfect} with all tasks) · {s.tally.logged} days logged · 🔥 {p.streak}-day streak. XP is kept when you start a new day.</p>
      {cfg.tasks.map((t, j) => <label className="task" key={j}><input type="checkbox" disabled={j === 0} checked={!!s.tasks[j]} onChange={ev => act('/tasks/' + j, 'POST', {done: ev.target.checked}, ev.target.checked ? '+' + t.xp + ' XP' : '')} /> {t.n} <span className="mut">+{t.xp} XP</span></label>)}
      <button className="btn" onClick={() => act('/new-day', 'POST', null, 'New day started. XP kept')}>Start new day</button></div>
    <div className="card"><h2>⏰ Measurement reminders</h2>
      {s.reminders.map((r, j) => <label className="task" key={j}><input type="checkbox" checked={r.on} onChange={ev => setRem(j, {on: ev.target.checked})} /> {r.n} <input type="time" value={r.t} style={{marginLeft: 'auto', width: 'auto'}} onChange={ev => setRem(j, {t: ev.target.value})} /></label>)}
      <p><button className="btn" onClick={() => 'Notification' in window && Notification.requestPermission()}>Enable notifications</button> <button className="btn" onClick={() => say('⏰ Test reminder: log your vitals')}>Test reminder</button></p></div>
    <div className="card"><h2>📤 Flight surgeon export</h2><textarea readOnly value={rep} />
      <p><button className="btn pri" onClick={() => save('vitalorbit-report.txt', rep)}>Save report (.txt)</button> <button className="btn" onClick={() => api('/export.csv').then(t => save('vitalorbit-data.csv', t))}>Save data (.csv)</button> <button className="btn" onClick={() => navigator.clipboard.writeText(rep).then(() => say('Copied'))}>Copy</button></p></div>
    <div className="card"><h2>The 5 spaceflight hazards</h2>{cfg.hazards.map(h => <details key={h[0]}><summary>{h[0]}</summary><p><b>Effects:</b> {h[1]}<br /><b>Defense:</b> {h[2]}</p></details>)}</div>
    <div className="card"><h2>Sources and limits</h2><ul style={{paddingLeft: 18, margin: '0 0 8px'}}>
      <li><a href="https://www.nasa.gov/hrp/hazards/" target="_blank" rel="noreferrer">NASA HRP: The five hazards</a>: hazard names and descriptions.</li>
      <li><a href="https://www.nasa.gov/hrp/risks/" target="_blank" rel="noreferrer">NASA HRP: Risks of human spaceflight</a>: which health risks each indicator relates to.</li>
      <li><a href="https://www.nasa.gov/hrp/ongoing-hrp-research/" target="_blank" rel="noreferrer">NASA HRP: Ongoing research</a>: design inspiration only.</li>
      <li><a href="https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" target="_blank" rel="noreferrer">CSA: Monitoring radiation for astronaut health</a></li>
      <li><a href="https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp" target="_blank" rel="noreferrer">CSA: Why do we conduct science experiments in space?</a></li></ul>
      <p className="mut" style={{margin: 0}}>Not from these sources: every reference range and threshold, drift rule, readiness score, XP and signal-delay figures. Not monitored: radiation dose, eye and vision changes, balance, decompression sickness.</p></div>
  </>
}
