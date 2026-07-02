*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ink: #0f1923;
  --ink2: #1e3a4a;
  --slate: #4a6070;
  --fog: #8fa3b1;
  --line: #e2eaf0;
  --paper: #f7f9fb;
  --white: #ffffff;
  --gold: #c8922a;
  --gold-light: #f0d9a8;
  --emerald: #2a9d6b;
  --crimson: #c0392b;
  --sky: #1e4d8c;
  --shadow: 0 2px 8px rgba(15,25,35,.08);
  --shadow-lg: 0 8px 32px rgba(15,25,35,.14);
  --r: 8px;
}

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--paper);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
}

/* LAYOUT */
.app-shell { display: flex; min-height: 100vh; }
.sidebar {
  width: 240px; flex-shrink: 0;
  background: var(--ink);
  display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0;
  z-index: 10;
}
.main-content {
  margin-left: 240px;
  flex: 1;
  padding: 28px 32px;
  max-width: 1200px;
}

/* SIDEBAR */
.sidebar-brand {
  padding: 20px 18px 16px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.sidebar-logo {
  font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -.01em;
}
.sidebar-logo span { color: var(--gold); }
.sidebar-tag { font-size: 10px; color: rgba(255,255,255,.4); margin-top: 2px; letter-spacing: .04em; }
.sidebar-user {
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  font-size: 11px;
}
.sidebar-user-name { color: #fff; font-weight: 500; }
.sidebar-user-role { color: rgba(255,255,255,.4); font-size: 10px; margin-top: 1px; }
.sidebar-nav { flex: 1; padding: 10px 0; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 18px;
  color: rgba(255,255,255,.6);
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  border: none; background: none;
  width: 100%; text-align: left;
  transition: all .15s;
  text-decoration: none;
}
.nav-item:hover { background: rgba(255,255,255,.06); color: #fff; }
.nav-item.active { background: rgba(200,146,42,.15); color: var(--gold); }
.nav-item .nav-icon { font-size: 16px; width: 20px; flex-shrink: 0; }
.sidebar-footer {
  padding: 12px 18px;
  border-top: 1px solid rgba(255,255,255,.08);
}
.btn-logout {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px;
  background: rgba(192,57,43,.15); color: #e57368;
  border: 1px solid rgba(192,57,43,.3);
  border-radius: var(--r); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all .15s;
}
.btn-logout:hover { background: rgba(192,57,43,.25); }

/* TOPBAR */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px;
}
.page-title { font-size: 20px; font-weight: 700; color: var(--ink); letter-spacing: -.02em; }
.page-subtitle { font-size: 12px; color: var(--fog); margin-top: 2px; }

/* CARDS */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap: 14px; margin-bottom: 28px; }
.stat-card {
  background: var(--white); border: 1px solid var(--line);
  border-radius: var(--r); padding: 16px 18px;
  box-shadow: var(--shadow);
}
.stat-card-value { font-size: 28px; font-weight: 700; color: var(--ink); }
.stat-card-label { font-size: 11px; color: var(--fog); margin-top: 2px; text-transform: uppercase; letter-spacing: .05em; }
.stat-card.urgente .stat-card-value { color: var(--crimson); }
.stat-card.in-scadenza .stat-card-value { color: var(--gold); }
.stat-card.completati .stat-card-value { color: var(--emerald); }

/* TABELLA */
.table-wrap {
  background: var(--white); border: 1px solid var(--line);
  border-radius: var(--r); box-shadow: var(--shadow); overflow: hidden;
}
.table-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--line);
}
.table-title { font-size: 13px; font-weight: 600; color: var(--ink); }
table { width: 100%; border-collapse: collapse; }
thead th {
  background: var(--paper); padding: 10px 16px;
  text-align: left; font-size: 11px; font-weight: 600;
  color: var(--slate); letter-spacing: .05em; text-transform: uppercase;
  border-bottom: 1px solid var(--line);
}
tbody tr { border-bottom: 1px solid var(--line); transition: background .1s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: var(--paper); cursor: pointer; }
tbody td { padding: 12px 16px; font-size: 13px; color: var(--ink2); }

/* BADGE STATO */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 20px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
.badge-in_attesa { background: #fef3c7; color: #92400e; }
.badge-in_corso { background: #dbeafe; color: #1e40af; }
.badge-completato { background: #d1fae5; color: #065f46; }
.badge-bloccato { background: #fee2e2; color: #991b1b; }

/* BADGE ORIGINE */
.badge-verbale { background: #ede9fe; color: #5b21b6; }
.badge-diretto { background: #e0f2fe; color: #0369a1; }
.badge-segnalazione { background: #fce7f3; color: #9d174d; }

/* BUTTONS */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--r);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border: none; transition: all .15s; text-decoration: none;
  font-family: 'DM Sans', sans-serif;
}
.btn-primary { background: var(--ink); color: #fff; }
.btn-primary:hover { background: var(--ink2); }
.btn-gold { background: var(--gold); color: #fff; }
.btn-gold:hover { opacity: .9; }
.btn-outline { background: transparent; color: var(--ink); border: 1px solid var(--line); }
.btn-outline:hover { border-color: var(--slate); }
.btn-danger { background: transparent; color: var(--crimson); border: 1px solid rgba(192,57,43,.3); }
.btn-danger:hover { background: rgba(192,57,43,.08); }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-whatsapp { background: #25d366; color: #fff; }
.btn-whatsapp:hover { background: #1da851; }
.btn-email { background: #1e4d8c; color: #fff; }
.btn-email:hover { opacity: .9; }

/* FORM */
.form-card {
  background: var(--white); border: 1px solid var(--line);
  border-radius: var(--r); padding: 24px; box-shadow: var(--shadow);
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.form-full { grid-column: 1 / -1; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-label { font-size: 11px; font-weight: 600; color: var(--slate); letter-spacing: .04em; text-transform: uppercase; }
.form-input, .form-select, .form-textarea {
  padding: 9px 12px; border: 1px solid var(--line);
  border-radius: 6px; font-size: 13px; color: var(--ink);
  background: var(--white); font-family: 'DM Sans', sans-serif;
  transition: border-color .15s;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none; border-color: var(--gold);
}
.form-textarea { resize: vertical; min-height: 80px; }
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }

/* MODAL */
.modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15,25,35,.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: var(--white); border-radius: 12px;
  width: min(600px, 100%); max-height: 90vh; overflow-y: auto; overflow-x: hidden;
  box-shadow: var(--shadow-lg); padding: 28px;
}
.modal-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; color: var(--ink); }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--fog); padding: 4px; }
.modal-close:hover { color: var(--ink); }

/* LOG */
.log-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.log-item { border-left: 3px solid var(--line); padding: 8px 12px; }
.log-item-meta { font-size: 11px; color: var(--fog); margin-bottom: 4px; font-family: 'DM Mono', monospace; }
.log-item-text { font-size: 13px; color: var(--ink2); }

/* LOGIN */
.login-screen {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--ink);
}
.login-card {
  background: var(--white); border-radius: 14px;
  width: min(400px, 94vw); padding: 36px;
  box-shadow: var(--shadow-lg);
}
.login-logo { font-size: 22px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
.login-logo span { color: var(--gold); }
.login-sub { font-size: 12px; color: var(--fog); margin-bottom: 28px; }
.login-error { background: #fee2e2; color: #991b1b; padding: 10px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }

/* EMPTY STATE */
.empty-state { text-align: center; padding: 48px 20px; color: var(--fog); }
.empty-icon { font-size: 36px; margin-bottom: 12px; opacity: .4; }
.empty-text { font-size: 14px; }

/* TOAST */
.toast-wrap { position: fixed; bottom: 24px; right: 24px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
.toast {
  background: var(--ink); color: #fff; padding: 12px 18px;
  border-radius: var(--r); font-size: 13px; box-shadow: var(--shadow-lg);
  animation: slideUp .25s ease;
}
.toast.success { border-left: 4px solid var(--emerald); }
.toast.error { border-left: 4px solid var(--crimson); }
.toast.info { border-left: 4px solid var(--gold); }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* RESPONSIVE */
@media (max-width: 768px) {
  .sidebar { width: 100%; height: auto; position: relative; }
  .main-content { margin-left: 0; padding: 16px; }
  .form-grid, .form-grid-3 { grid-template-columns: 1fr; }
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
