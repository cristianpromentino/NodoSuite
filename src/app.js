import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './supabase-client.js';

// Client separato, con sessione NON persistita: usato solo per creare nuovi account
// (signUp) senza sostituire la sessione dello staff che sta operando nell'app.
const supabaseSignup = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-ant-signup-temp' },
});

const app = document.getElementById('app');

let state = {
  session: null,
  ruolo: null,       // 'staff' | 'atleta'
  atletaId: null,
  staffId: null,
  nomeUtente: '',
  tab: 'eventi',
  tabScelto: false, // true dopo il primo tap manuale sulla bottom-nav
  ruoloRisolto: false, // true dopo il primo tentativo di risoluzione ruolo, trovato o no
};

// ============================================================
// AUTENTICAZIONE
// ============================================================
async function init() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    state.session = data.session;
    await risolviRuolo();
  }
  render();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (session) await risolviRuolo();
    render();
  });

  setupInstallBanner();
}

async function risolviRuolo() {
  const userId = state.session.user.id;

  const [{ data: staff }, { data: atleta }] = await Promise.all([
    supabase.from('staff').select('id, nome, cognome').eq('auth_user_id', userId).maybeSingle(),
    supabase.from('atleti').select('id, nome, cognome').eq('auth_user_id', userId).maybeSingle(),
  ]);

  if (staff) { state.staffId = staff.id; }
  if (atleta) { state.atletaId = atleta.id; }

  if (staff && atleta) {
    // Doppio ruolo: non si sceglie in automatico, lo decide l'utente nella schermata dedicata
    state.nomeUtente = staff.nome;
    state.ruolo = null;
  } else if (staff) {
    state.ruolo = 'staff';
    state.nomeUtente = staff.nome;
  } else if (atleta) {
    state.ruolo = 'atleta';
    state.nomeUtente = atleta.nome;
  }

  state.ruoloRisolto = true;
}

async function handleLogin(email, password, errEl) {
  errEl.textContent = '';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = `Errore: ${error.message} (codice: ${error.status || 'n/d'})`;
    return;
  }
  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  await risolviRuolo();
  render();
}

async function handleLogout() {
  await supabase.auth.signOut();
  state = { session: null, ruolo: null, atletaId: null, staffId: null, nomeUtente: '', tab: 'eventi', tabScelto: false, ruoloRisolto: false };
  render();
}

// ============================================================
// RENDER PRINCIPALE
// ============================================================
function render() {
  if (!state.session) return renderAuth();
  if (!state.ruoloRisolto) return renderLoadingRuolo();
  if (!state.ruolo) {
    if (state.staffId && state.atletaId) return renderScegliRuolo();
    return renderRuoloNonTrovato();
  }
  return state.ruolo === 'staff' ? renderStaff() : renderAtleta();
}

function renderScegliRuolo() {
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo"><img src="icons/icon-512.png" alt="ANT"/></div>
      <div class="auth-title">Ciao ${state.nomeUtente}</div>
      <div class="auth-sub">Hai sia un profilo staff che un profilo atleta. Con cosa vuoi accedere?</div>
      <button id="scegli-staff" style="margin-bottom:10px;">Accedi come Staff</button>
      <button id="scegli-atleta" style="background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.25);">Accedi come Atleta</button>
    </div>
  `;
  document.getElementById('scegli-staff').addEventListener('click', () => { state.ruolo = 'staff'; state.tabScelto = false; render(); });
  document.getElementById('scegli-atleta').addEventListener('click', () => { state.ruolo = 'atleta'; state.tabScelto = false; render(); });
}

function renderAuth() {
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo"><img src="icons/icon-512.png" alt="ANT"/></div>
      <div class="auth-title">ANT - Touch In</div>
      <div class="auth-sub">Accedi con l'account creato dallo staff</div>
      <input type="email" id="login-email" placeholder="Email" autocomplete="username" />
      <input type="password" id="login-pass" placeholder="Password" autocomplete="current-password" />
      <button id="login-btn">Accedi</button>
      <div class="auth-error" id="login-error"></div>
    </div>
  `;
  document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    if (!email || !pass) { errEl.textContent = 'Inserisci email e password.'; return; }
    handleLogin(email, pass, errEl);
  });
}

function renderLoadingRuolo() {
  app.innerHTML = `<div class="auth-screen"><div class="auth-sub">Caricamento profilo...</div></div>`;
}

function renderRuoloNonTrovato() {
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo"><img src="icons/icon-512.png" alt="ANT"/></div>
      <div class="auth-title">Account non collegato</div>
      <div class="auth-sub">Il tuo login funziona, ma non risulta ancora nessun profilo atleta o staff collegato a questo account. Controlla che il campo "auth_user_id" nella tabella atleti/staff su Supabase corrisponda esattamente allo User UID di questo utente, poi riprova.</div>
      <button id="retry-btn">Riprova</button>
      <button id="logout-btn-2" style="background:transparent; color:#fff; margin-top:10px; border:1px solid rgba(255,255,255,0.2);">Esci</button>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click', async () => {
    await risolviRuolo();
    render();
  });
  document.getElementById('logout-btn-2').addEventListener('click', handleLogout);
}

// ============================================================
// SHELL ATLETA
// ============================================================
function renderAtleta() {
  app.innerHTML = `
    <div class="top">
      <div class="eyebrow">ANT · Ciao ${state.nomeUtente}</div>
      <h1 id="top-title">I tuoi allenamenti</h1>
      <div class="sub" id="top-sub"></div>
    </div>
    <div id="screen-body" style="flex:1; display:flex; flex-direction:column; min-height:0;"></div>
    <div class="bottom-nav">
      <button data-tab="eventi" class="${state.tab === 'eventi' ? 'active' : ''}"><div class="dot"></div>Calendario</button>
      <button data-tab="chat" class="${state.tab === 'chat' ? 'active' : ''}"><div class="dot"></div>Chat</button>
      <button data-tab="profilo" class="${state.tab === 'profilo' ? 'active' : ''}"><div class="dot"></div>Profilo</button>
    </div>
  `;
  wireBottomNav();
  if (state.tab === 'eventi') renderCalendarioAtleta();
  else if (state.tab === 'chat') renderChat();
  else renderProfilo();
}

// ============================================================
// SHELL STAFF
// ============================================================
function renderStaff() {
  if (!state.tabScelto) state.tab = 'dashboard'; // Dashboard è la schermata di apertura per lo staff

  app.innerHTML = `
    <div class="top">
      <div class="eyebrow">ANT · Staff</div>
      <h1 id="top-title">Eventi</h1>
      <div class="sub" id="top-sub"></div>
    </div>
    <div id="screen-body" style="flex:1; display:flex; flex-direction:column; min-height:0;"></div>
    <div class="bottom-nav">
      <button data-tab="dashboard" class="${state.tab === 'dashboard' ? 'active' : ''}"><div class="dot"></div>Dashboard</button>
      <button data-tab="eventi" class="${state.tab === 'eventi' ? 'active' : ''}"><div class="dot"></div>Eventi</button>
      <button data-tab="rosa" class="${state.tab === 'rosa' ? 'active' : ''}"><div class="dot"></div>Rosa</button>
      <button data-tab="chat" class="${state.tab === 'chat' ? 'active' : ''}"><div class="dot"></div>Chat</button>
      <button data-tab="profilo" class="${state.tab === 'profilo' ? 'active' : ''}"><div class="dot"></div>Profilo</button>
    </div>
  `;
  wireBottomNav();
  if (state.tab === 'eventi') renderEventiStaff();
  else if (state.tab === 'rosa') renderRosaStaff();
  else if (state.tab === 'dashboard') renderDashboardStaff();
  else if (state.tab === 'chat') renderChat();
  else renderProfilo();
}

function wireBottomNav() {
  document.querySelectorAll('.bottom-nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      state.tabScelto = true;
      render();
    });
  });
}

async function renderProfilo() {
  document.getElementById('top-title').textContent = 'Profilo';
  const body = document.getElementById('screen-body');
  const supportoPush = 'serviceWorker' in navigator && 'PushManager' in window;
  const permesso = supportoPush ? Notification.permission : 'unsupported';

  body.innerHTML = `
    <div class="content">
      <div class="card">
        <h3>${state.nomeUtente}</h3>
        <div class="time">${state.ruolo === 'staff' ? 'Staff / Allenatore' : 'Atleta'}</div>
      </div>

      ${state.staffId && state.atletaId ? `
        <button id="cambia-modalita-btn" style="width:100%; padding:13px; border-radius:12px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; margin-top:14px; cursor:pointer;">Cambia modalità (attualmente ${state.ruolo === 'staff' ? 'Staff' : 'Atleta'})</button>
      ` : ''}

      ${supportoPush ? `
        <div class="section-title" style="margin-top:20px;">Notifiche</div>
        <button id="notifiche-btn" style="width:100%; padding:13px; border-radius:12px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; cursor:pointer;">
          ${permesso === 'granted' ? 'Notifiche attive ✓ — tocca per disattivare' : 'Attiva notifiche push'}
        </button>
        <div class="auth-error" id="notifiche-error" style="color:var(--danger); text-align:left; margin-top:8px;"></div>
      ` : ''}

      <button id="logout-btn" style="width:100%; padding:14px; border-radius:12px; border:1px solid var(--line); background:#fff; color:var(--danger); font-weight:700; margin-top:20px; cursor:pointer;">Esci</button>
    </div>
  `;
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('cambia-modalita-btn')?.addEventListener('click', () => {
    state.ruolo = null;
    state.tabScelto = false;
    render();
  });

  if (supportoPush) {
    document.getElementById('notifiche-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('notifiche-error');
      errEl.textContent = '';
      try {
        if (Notification.permission === 'granted') {
          await disattivaNotifichePush();
        } else {
          await attivaNotifichePush();
        }
        renderProfilo();
      } catch (e) {
        errEl.textContent = 'Errore: ' + e.message;
      }
    });
  }
}

// Converte la chiave pubblica VAPID (base64url) nel formato richiesto da PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function attivaNotifichePush() {
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') throw new Error('Permesso negato dal browser.');

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      utente_auth_id: state.session.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    },
    { onConflict: 'utente_auth_id,endpoint' }
  );
  if (error) throw error;
}

async function disattivaNotifichePush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  }
}

// ============================================================
// CALENDARIO ATLETA + PRENOTAZIONE
// ============================================================
async function renderCalendarioAtleta(giorniAvanti = 30) {
  document.getElementById('top-title').textContent = 'I tuoi allenamenti';
  document.getElementById('top-sub').textContent = `Prossimi ${giorniAvanti} giorni`;
  const body = document.getElementById('screen-body');
  body.innerHTML = `<div class="content" id="lista-eventi"><div class="empty-state">Caricamento...</div></div>`;

  const oggi = new Date();
  const finestra = new Date(); finestra.setDate(oggi.getDate() + giorniAvanti);

  const { data: eventi, error } = await supabase
    .from('eventi')
    .select('*')
    .gte('data_ora', oggi.toISOString())
    .lte('data_ora', finestra.toISOString())
    .order('data_ora', { ascending: true });

  if (error) { document.getElementById('lista-eventi').innerHTML = `<div class="empty-state">Errore nel caricare gli eventi.</div>`; return; }
  if (!eventi.length) {
    document.getElementById('lista-eventi').innerHTML = `<div class="empty-state">Nessun evento nei prossimi ${giorniAvanti} giorni.</div>`;
    aggiungiPulsanteCaricaAltri('lista-eventi', giorniAvanti, renderCalendarioAtleta);
    return;
  }

  const { data: mieprenotazioni } = await supabase
    .from('prenotazioni')
    .select('evento_id, stato')
    .eq('atleta_id', state.atletaId);
  const mappaPrenotazioni = Object.fromEntries((mieprenotazioni || []).map((p) => [p.evento_id, p.stato]));

  const lista = document.getElementById('lista-eventi');
  lista.innerHTML = '';
  let ultimoGiorno = null;

  eventi.forEach((ev) => {
    const d = new Date(ev.data_ora);
    const giornoKey = d.toDateString();
    if (giornoKey !== ultimoGiorno) {
      ultimoGiorno = giornoKey;
      const label = document.createElement('div');
      label.className = 'day-label';
      label.textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      lista.appendChild(label);
    }

    const statoAttuale = mappaPrenotazioni[ev.id] || 'non_specificato';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${ev.titolo}${ev.avversario ? ' vs ' + ev.avversario : ''}</h3>
          <div class="time">${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${ev.luogo ? ' — ' + ev.luogo : ''}</div>
        </div>
        <span class="tag ${ev.obbligatorio ? 'oblig' : 'opz'}">${ev.obbligatorio ? 'Obbligatorio' : 'Facoltativo'}</span>
      </div>
      <div class="booking-row">
        <button data-stato="presente" class="${statoAttuale === 'presente' ? 'sel-yes' : ''}">Presente</button>
        <button data-stato="assente" class="${statoAttuale === 'assente' ? 'sel-no' : ''}">Assente</button>
      </div>
    `;
    const [btnSi, btnNo] = card.querySelectorAll('.booking-row button');
    const aggiorna = async (stato, btnAttivo, btnAltro, classeAttiva) => {
      await supabase.from('prenotazioni').upsert(
        { evento_id: ev.id, atleta_id: state.atletaId, stato, prenotato_at: new Date().toISOString() },
        { onConflict: 'evento_id,atleta_id' }
      );
      btnAttivo.classList.add(classeAttiva);
      btnAltro.classList.remove('sel-yes', 'sel-no');
    };
    btnSi.addEventListener('click', () => aggiorna('presente', btnSi, btnNo, 'sel-yes'));
    btnNo.addEventListener('click', () => aggiorna('assente', btnNo, btnSi, 'sel-no'));

    lista.appendChild(card);
  });

  aggiungiPulsanteCaricaAltri('lista-eventi', giorniAvanti, renderCalendarioAtleta);
}

// Pulsante condiviso per estendere la finestra temporale visibile (atleta e staff)
function aggiungiPulsanteCaricaAltri(containerId, giorniAttuali, renderFn) {
  const container = document.getElementById(containerId);
  const btn = document.createElement('button');
  btn.textContent = `Carica altri 30 giorni (mostrando i prossimi ${giorniAttuali})`;
  btn.style.cssText = 'width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; margin-top:8px; cursor:pointer;';
  btn.addEventListener('click', () => renderFn(giorniAttuali + 30));
  container.appendChild(btn);
}

// ============================================================
// EVENTI STAFF (lista -> check-in / statistiche)
// ============================================================
let eventiStaffGiorniAvanti = 30;

async function renderEventiStaff() {
  document.getElementById('top-title').textContent = 'Eventi';
  document.getElementById('top-sub').textContent = '';
  eventiStaffGiorniAvanti = 30;
  const body = document.getElementById('screen-body');
  body.innerHTML = `
    <div class="content">
      <button id="nuovo-evento-btn" style="width:100%; padding:13px; border-radius:12px; border:none; background:var(--pitch); color:#fff; font-weight:700; margin-bottom:16px; cursor:pointer;">+ Nuovo evento</button>
      <button id="genera-allenamenti-btn" style="width:100%; padding:13px; border-radius:12px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; margin-bottom:16px; cursor:pointer;">Genera allenamenti (lun/gio/sab, prossime 4 settimane)</button>
      <button id="elimina-tutti-eventi-btn" style="width:100%; padding:13px; border-radius:12px; border:none; background:#8C1D6B; color:#2FC6B8; font-weight:700; margin-bottom:16px; cursor:pointer;">Elimina eventi futuri senza movimenti</button>
      <div id="lista-eventi-staff"><div class="empty-state">Caricamento...</div></div>
    </div>
  `;
  document.getElementById('nuovo-evento-btn').addEventListener('click', () => renderFormEvento());
  document.getElementById('genera-allenamenti-btn').addEventListener('click', handleGeneraAllenamenti);
  document.getElementById('elimina-tutti-eventi-btn').addEventListener('click', renderConfermaEliminazioneEventi);

  await caricaListaEventiStaff();
}

async function caricaListaEventiStaff() {
  const oggi = new Date();
  const finestra = new Date(); finestra.setDate(oggi.getDate() + eventiStaffGiorniAvanti);

  const { data: eventi, error } = await supabase
    .from('eventi')
    .select('*')
    .gte('data_ora', oggi.toISOString())
    .lte('data_ora', finestra.toISOString())
    .order('data_ora', { ascending: true });

  const lista = document.getElementById('lista-eventi-staff');
  if (!lista) return;
  if (error || !eventi?.length) {
    lista.innerHTML = `<div class="empty-state">Nessun evento nei prossimi ${eventiStaffGiorniAvanti} giorni.</div>`;
    aggiungiPulsanteCaricaAltri('lista-eventi-staff', eventiStaffGiorniAvanti, (n) => { eventiStaffGiorniAvanti = n; caricaListaEventiStaff(); });
    return;
  }

  lista.innerHTML = '';
  eventi.forEach((ev) => {
    const d = new Date(ev.data_ora);
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${ev.titolo}${ev.avversario ? ' vs ' + ev.avversario : ''}</h3>
          <div class="time">${d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <span class="tag ${ev.obbligatorio ? 'oblig' : 'opz'}">${ev.tipo}</span>
      </div>
    `;
    card.addEventListener('click', () => renderDettaglioEventoStaff(ev));
    lista.appendChild(card);
  });

  aggiungiPulsanteCaricaAltri('lista-eventi-staff', eventiStaffGiorniAvanti, (n) => { eventiStaffGiorniAvanti = n; caricaListaEventiStaff(); });
}

function renderFormEvento(eventoEsistente = null) {
  const body = document.getElementById('screen-body');
  const ev = eventoEsistente || {};
  const dataOraLocale = ev.data_ora ? new Date(ev.data_ora).toISOString().slice(0, 16) : '';

  document.getElementById('top-title').textContent = eventoEsistente ? 'Modifica evento' : 'Nuovo evento';

  body.innerHTML = `
    <div class="content">
      <button id="back-form" style="background:none; border:none; color:var(--pitch); font-weight:700; font-size:13px; margin-bottom:14px; cursor:pointer; padding:0;">← Annulla</button>

      <div class="section-title">Tipo evento</div>
      <select id="f-tipo" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;">
        <option value="allenamento" ${ev.tipo === 'allenamento' ? 'selected' : ''}>Allenamento</option>
        <option value="torneo" ${ev.tipo === 'torneo' ? 'selected' : ''}>Torneo</option>
        <option value="partita" ${ev.tipo === 'partita' ? 'selected' : ''}>Partita</option>
        <option value="altro" ${ev.tipo === 'altro' ? 'selected' : ''}>Altro</option>
      </select>

      <div class="section-title">Titolo</div>
      <input id="f-titolo" type="text" value="${ev.titolo || ''}" placeholder="Es. Allenamento, Trofeo Estivo..." style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      <div class="section-title">Data e ora</div>
      <input id="f-data" type="datetime-local" value="${dataOraLocale}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      <div class="section-title">Luogo</div>
      <input id="f-luogo" type="text" value="${ev.luogo || ''}" placeholder="Es. Campo 1, Villaggio del Rugby" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      <div class="section-title">Avversario (solo torneo/partita)</div>
      <input id="f-avversario" type="text" value="${ev.avversario || ''}" placeholder="Nome squadra avversaria" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      <label style="display:flex; align-items:center; gap:10px; margin-bottom:22px; font-size:14px; font-weight:600;">
        <input id="f-obbligatorio" type="checkbox" ${ev.obbligatorio !== false ? 'checked' : ''} style="width:18px; height:18px;" />
        Presenza obbligatoria
      </label>

      <button id="salva-evento-btn" style="width:100%; padding:13px; border-radius:12px; border:none; background:var(--pitch); color:#fff; font-weight:700; margin-bottom:10px; cursor:pointer;">Salva evento</button>
      ${eventoEsistente ? `<button id="elimina-evento-btn" style="width:100%; padding:13px; border-radius:12px; border:1px solid var(--danger); background:#fff; color:var(--danger); font-weight:700; cursor:pointer;">Elimina evento</button>` : ''}
      <div class="auth-error" id="form-evento-error" style="color:var(--danger); text-align:left; margin-top:10px;"></div>
    </div>
  `;

  document.getElementById('back-form').addEventListener('click', renderEventiStaff);

  document.getElementById('salva-evento-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('form-evento-error');
    const titolo = document.getElementById('f-titolo').value.trim();
    const dataVal = document.getElementById('f-data').value;
    if (!titolo || !dataVal) { errEl.textContent = 'Titolo e data/ora sono obbligatori.'; return; }

    const payload = {
      tipo: document.getElementById('f-tipo').value,
      titolo,
      data_ora: new Date(dataVal).toISOString(),
      luogo: document.getElementById('f-luogo').value.trim() || null,
      avversario: document.getElementById('f-avversario').value.trim() || null,
      obbligatorio: document.getElementById('f-obbligatorio').checked,
    };

    let error;
    if (eventoEsistente) {
      ({ error } = await supabase.from('eventi').update(payload).eq('id', eventoEsistente.id));
    } else {
      ({ error } = await supabase.from('eventi').insert(payload));
    }
    if (error) { errEl.textContent = 'Errore nel salvataggio: ' + error.message; return; }
    renderEventiStaff();
  });

  if (eventoEsistente) {
    document.getElementById('elimina-evento-btn').addEventListener('click', async () => {
      if (!confirm('Eliminare definitivamente questo evento?')) return;
      await supabase.from('eventi').delete().eq('id', eventoEsistente.id);
      renderEventiStaff();
    });
  }
}

async function handleGeneraAllenamenti() {
  if (!confirm('Genera allenamenti per le prossime 4 settimane (lunedì e giovedì 20:30 obbligatori, sabato 10:00 facoltativo)?')) return;

  const eventiDaCreare = [];
  const oggi = new Date();
  for (let settimana = 0; settimana < 4; settimana++) {
    [
      { giorno: 1, ora: 20, minuti: 30, obbligatorio: true, titolo: 'Allenamento' },   // lunedì
      { giorno: 4, ora: 20, minuti: 30, obbligatorio: true, titolo: 'Allenamento' },   // giovedì
      { giorno: 6, ora: 10, minuti: 0, obbligatorio: false, titolo: 'Allenamento facoltativo' }, // sabato
    ].forEach(({ giorno, ora, minuti, obbligatorio, titolo }) => {
      const d = new Date(oggi);
      const diff = (giorno - d.getDay() + 7) % 7 + settimana * 7;
      d.setDate(d.getDate() + diff);
      d.setHours(ora, minuti, 0, 0);
      if (d < oggi) return;
      eventiDaCreare.push({
        tipo: 'allenamento',
        titolo,
        data_ora: d.toISOString(),
        obbligatorio,
        ricorrente: true,
      });
    });
  }

  const { error } = await supabase.from('eventi').insert(eventiDaCreare);
  if (error) { alert('Errore nella generazione: ' + error.message); return; }
  caricaListaEventiStaff();
}

// Step 1 di sicurezza: schermata dedicata di conferma, limitata solo agli eventi
// futuri e privi di qualunque movimentazione (prenotazioni o check-in/giustificazioni).
async function renderConfermaEliminazioneEventi() {
  const body = document.getElementById('screen-body');
  document.getElementById('top-title').textContent = 'Elimina eventi futuri senza movimenti';
  body.innerHTML = `<div class="content"><div class="empty-state">Calcolo eventi eliminabili...</div></div>`;

  const eleggibili = await calcolaEventiEliminabili();

  document.getElementById('top-title').textContent = 'Elimina eventi futuri senza movimenti';
  body.innerHTML = `
    <div class="content">
      <button id="back-conferma" style="background:none; border:none; color:var(--pitch); font-weight:700; font-size:13px; margin-bottom:14px; cursor:pointer; padding:0;">← Annulla, torna agli eventi</button>

      <div class="card" style="border-color:var(--danger);">
        <h3 style="color:var(--danger);">Attenzione: azione irreversibile</h3>
        <div class="time" style="margin-top:6px; line-height:1.5;">
          Verranno eliminati solo gli eventi <strong>futuri</strong> e <strong>senza alcuna prenotazione o check-in registrato</strong> — gli eventi passati e quelli con movimenti (anche una sola prenotazione) restano intatti e non sono conteggiati qui.
        </div>
      </div>

      <div class="kpi-row" style="margin-top:18px;">
        <div class="kpi"><div class="num">${eleggibili.length}</div><div class="lbl">Eliminabili ora</div></div>
      </div>

      ${eleggibili.length === 0
        ? `<div class="empty-state">Nessun evento eliminabile al momento: tutti gli eventi futuri hanno già almeno una prenotazione o un check-in.</div>`
        : `
          <div class="section-title" style="margin-top:20px;">Per confermare, scrivi ELIMINA qui sotto</div>
          <input id="conferma-testo" type="text" placeholder="ELIMINA" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:18px; font-family:'Archivo'; font-size:14px; text-transform:uppercase;" />
          <button id="conferma-elimina-btn" disabled style="width:100%; padding:13px; border-radius:12px; border:none; background:#8C1D6B; color:#2FC6B8; font-weight:700; opacity:0.4; cursor:not-allowed;">Elimina definitivamente ${eleggibili.length} eventi</button>
        `
      }
      <div class="auth-error" id="elimina-error" style="color:var(--danger); text-align:left; margin-top:10px;"></div>
    </div>
  `;

  document.getElementById('back-conferma').addEventListener('click', renderEventiStaff);
  if (!eleggibili.length) return;

  const input = document.getElementById('conferma-testo');
  const btnConferma = document.getElementById('conferma-elimina-btn');
  input.addEventListener('input', () => {
    const abilitato = input.value.trim().toUpperCase() === 'ELIMINA';
    btnConferma.disabled = !abilitato;
    btnConferma.style.opacity = abilitato ? '1' : '0.4';
    btnConferma.style.cursor = abilitato ? 'pointer' : 'not-allowed';
  });

  btnConferma.addEventListener('click', async () => {
    const errEl = document.getElementById('elimina-error');
    btnConferma.disabled = true;
    btnConferma.textContent = 'Eliminazione in corso...';

    // Ricalcolo al momento dell'eliminazione per sicurezza (nel caso nel frattempo
    // qualcuno abbia prenotato uno di questi eventi mentre la schermata era aperta).
    const eleggibiliOra = await calcolaEventiEliminabili();
    const { error } = await supabase.from('eventi').delete().in('id', eleggibiliOra);

    if (error) { errEl.textContent = 'Errore durante l\'eliminazione: ' + error.message; btnConferma.disabled = false; btnConferma.textContent = `Elimina definitivamente ${eleggibili.length} eventi`; return; }
    renderEventiStaff();
  });
}

// Ritorna gli ID degli eventi futuri privi di prenotazioni e check-in
async function calcolaEventiEliminabili() {
  const { data: futuri } = await supabase.from('eventi').select('id').gt('data_ora', new Date().toISOString());
  const idsFuturi = (futuri || []).map((e) => e.id);
  if (!idsFuturi.length) return [];

  const [prenotazioniRes, checkinRes] = await Promise.all([
    supabase.from('prenotazioni').select('evento_id').in('evento_id', idsFuturi),
    supabase.from('check_in').select('evento_id').in('evento_id', idsFuturi),
  ]);

  const idsConMovimenti = new Set([
    ...(prenotazioniRes.data || []).map((p) => p.evento_id),
    ...(checkinRes.data || []).map((c) => c.evento_id),
  ]);

  return idsFuturi.filter((id) => !idsConMovimenti.has(id));
}

async function renderDettaglioEventoStaff(evento) {
  const body = document.getElementById('screen-body');
  document.getElementById('top-title').textContent = evento.titolo;
  document.getElementById('top-sub').textContent = new Date(evento.data_ora).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  body.innerHTML = `
    <div class="content">
      <button id="back-eventi" style="background:none; border:none; color:var(--pitch); font-weight:700; font-size:13px; margin-bottom:14px; cursor:pointer; padding:0;">← Torna agli eventi</button>
      <button id="modifica-evento-btn" style="width:100%; padding:11px; border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; margin-bottom:16px; cursor:pointer;">Modifica evento</button>
      <div class="section-title">Check-in presenze</div>
      <div id="roster"></div>
      ${evento.tipo === 'torneo' || evento.tipo === 'partita' ? `
        <div class="section-title" style="margin-top:22px;">Risultato</div>
        <div class="score-card">
          <div class="score-team"><div class="name">ANT</div><input type="number" id="punteggio-ant" value="${evento.punteggio_ant ?? ''}" style="width:56px; text-align:center; font-family:'Archivo Black'; font-size:24px; border:1px solid var(--line); border-radius:8px; padding:4px;" /></div>
          <div class="score-sep">—</div>
          <div class="score-team"><div class="name">${evento.avversario || 'Avv.'}</div><input type="number" id="punteggio-avv" value="${evento.punteggio_avversario ?? ''}" style="width:56px; text-align:center; font-family:'Archivo Black'; font-size:24px; border:1px solid var(--line); border-radius:8px; padding:4px;" /></div>
        </div>
        <button id="salva-risultato" style="width:100%; padding:12px; border-radius:10px; border:none; background:var(--pitch); color:#fff; font-weight:700; margin-bottom:20px; cursor:pointer;">Salva risultato</button>
      ` : ''}
    </div>
  `;

  document.getElementById('back-eventi').addEventListener('click', renderEventiStaff);
  document.getElementById('modifica-evento-btn').addEventListener('click', () => renderFormEvento(evento));

  if (evento.tipo === 'torneo' || evento.tipo === 'partita') {
    document.getElementById('salva-risultato').addEventListener('click', async () => {
      const pAnt = parseInt(document.getElementById('punteggio-ant').value, 10) || 0;
      const pAvv = parseInt(document.getElementById('punteggio-avv').value, 10) || 0;
      await supabase.from('eventi').update({ punteggio_ant: pAnt, punteggio_avversario: pAvv }).eq('id', evento.id);
    });
  }

  await caricaRoster(evento);
}

async function caricaRoster(evento) {
  const { data: righe, error } = await supabase.from('v_presenze_evento').select('*').eq('evento_id', evento.id);
  const rosterEl = document.getElementById('roster');
  if (error || !righe?.length) { rosterEl.innerHTML = `<div class="empty-state">Nessun atleta trovato.</div>`; return; }

  // Recupero lo stato "giustificata" già salvato per questo evento
  const { data: checkins } = await supabase.from('check_in').select('atleta_id, giustificata').eq('evento_id', evento.id);
  const mappaGiustificate = Object.fromEntries((checkins || []).map((c) => [c.atleta_id, c.giustificata]));

  rosterEl.innerHTML = '';
  righe.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'roster-row';
    row.style.flexWrap = 'wrap';
    const prenotazioneLabel = r.prenotazione === 'presente' ? 'Presente' : r.prenotazione === 'assente' ? 'Assente' : 'Non specificato';
    const match = (r.prenotazione === 'presente') === !!r.presenza_reale;
    const giustificata = !!mappaGiustificate[r.atleta_id];
    row.innerHTML = `
      <div style="flex:1;">
        <div class="roster-name">${r.nome} ${r.cognome}</div>
        <div class="roster-sub ${r.prenotazione !== 'non_specificato' ? (match ? 'match' : 'mismatch') : ''}">Prenotato: ${prenotazioneLabel}</div>
      </div>
      <div class="toggle ${r.presenza_reale ? 'on' : ''}"><div class="knob"></div></div>
      <label class="giustificata-label ${r.presenza_reale ? 'hidden' : ''}" style="display:flex; align-items:center; gap:6px; width:100%; margin-top:8px; font-size:12px; color:#8a8474;">
        <input type="checkbox" class="giustificata-check" ${giustificata ? 'checked' : ''} style="width:15px; height:15px;" />
        Assenza giustificata
      </label>
    `;
    const toggle = row.querySelector('.toggle');
    const labelGiustificata = row.querySelector('.giustificata-label');
    const checkGiustificata = row.querySelector('.giustificata-check');

    const salvaCheckIn = async (presente) => {
      await supabase.from('check_in').upsert(
        { evento_id: evento.id, atleta_id: r.atleta_id, presente, giustificata: presente ? false : checkGiustificata.checked, registrato_da: state.staffId, registrato_at: new Date().toISOString() },
        { onConflict: 'evento_id,atleta_id' }
      );
    };

    toggle.addEventListener('click', async () => {
      const nuovoStato = !toggle.classList.contains('on');
      toggle.classList.toggle('on');
      labelGiustificata.classList.toggle('hidden', nuovoStato);
      await salvaCheckIn(nuovoStato);
    });
    checkGiustificata.addEventListener('change', () => salvaCheckIn(false));

    rosterEl.appendChild(row);
  });
}

// ============================================================
// ROSA (gestione atleti e staff)
// ============================================================
let rosaSubTab = 'atleti';

async function renderRosaStaff() {
  document.getElementById('top-title').textContent = 'Rosa';
  document.getElementById('top-sub').textContent = '';
  const body = document.getElementById('screen-body');
  body.innerHTML = `
    <div class="content">
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button id="sub-atleti" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--line); font-weight:700; cursor:pointer; background:${rosaSubTab === 'atleti' ? 'var(--pitch)' : '#fff'}; color:${rosaSubTab === 'atleti' ? '#fff' : 'var(--pitch)'};">Atleti</button>
        <button id="sub-staff" style="flex:1; padding:10px; border-radius:10px; border:1px solid var(--line); font-weight:700; cursor:pointer; background:${rosaSubTab === 'staff' ? 'var(--pitch)' : '#fff'}; color:${rosaSubTab === 'staff' ? '#fff' : 'var(--pitch)'};">Staff</button>
      </div>
      <button id="nuovo-membro-btn" style="width:100%; padding:13px; border-radius:12px; border:none; background:var(--teal); color:var(--pitch-dark); font-weight:700; margin-bottom:16px; cursor:pointer;">+ Aggiungi ${rosaSubTab === 'atleti' ? 'atleta' : 'membro staff'}</button>
      <div id="lista-rosa"><div class="empty-state">Caricamento...</div></div>
    </div>
  `;
  document.getElementById('sub-atleti').addEventListener('click', () => { rosaSubTab = 'atleti'; renderRosaStaff(); });
  document.getElementById('sub-staff').addEventListener('click', () => { rosaSubTab = 'staff'; renderRosaStaff(); });
  document.getElementById('nuovo-membro-btn').addEventListener('click', () => renderFormMembro(rosaSubTab));

  await caricaListaRosa();
}

async function caricaListaRosa() {
  const tabella = rosaSubTab;
  const colonneExtra = tabella === 'atleti' ? 'categoria, ruolo, attivo, telefono, data_nascita, numero_maglia, scadenza_certificato, note' : 'ruolo';
  const { data, error } = await supabase.from(tabella).select(`id, nome, cognome, email, auth_user_id, ${colonneExtra}`).order('cognome');

  const lista = document.getElementById('lista-rosa');
  if (!lista) return;
  if (error || !data?.length) { lista.innerHTML = `<div class="empty-state">Nessun ${tabella === 'atleti' ? 'atleta' : 'membro staff'} ancora inserito.</div>`; return; }

  lista.innerHTML = '';
  data.forEach((persona) => {
    const card = document.createElement('div');
    card.className = 'card';
    const credenzialiOk = !!persona.auth_user_id;
    const numeroMagliaLabel = tabella === 'atleti' && persona.numero_maglia ? ` · #${persona.numero_maglia}` : '';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${persona.nome} ${persona.cognome}${tabella === 'atleti' && persona.attivo === false ? ' (disattivato)' : ''}</h3>
          <div class="time">${persona.categoria || persona.ruolo || ''}${numeroMagliaLabel}${persona.email ? ' · ' + persona.email : ''}</div>
        </div>
        <span class="tag ${credenzialiOk ? 'oblig' : 'opz'}">${credenzialiOk ? 'Account attivo' : 'Senza login'}</span>
      </div>
      <div class="booking-row">
        ${tabella === 'atleti' ? '<button class="btn-scheda" style="flex:1;">Scheda</button>' : ''}
        <button class="btn-modifica" style="flex:1;">Modifica</button>
        ${!credenzialiOk ? '<button class="btn-credenziali" style="flex:1;">Crea accesso</button>' : ''}
      </div>
    `;
    card.querySelector('.btn-scheda')?.addEventListener('click', () => renderSchedaAtleta(persona));
    card.querySelector('.btn-modifica').addEventListener('click', () => renderFormMembro(tabella, persona));
    card.querySelector('.btn-credenziali')?.addEventListener('click', () => renderFormCredenziali(tabella, persona));
    lista.appendChild(card);
  });
}

// Scheda atleta: anagrafica completa + statistiche stagionali (assiduità, marcature, MVP)
async function renderSchedaAtleta(persona) {
  document.getElementById('top-title').textContent = `${persona.nome} ${persona.cognome}`;
  document.getElementById('top-sub').textContent = persona.categoria || '';
  const body = document.getElementById('screen-body');
  body.innerHTML = `
    <div class="content">
      <button id="back-scheda" style="background:none; border:none; color:var(--pitch); font-weight:700; font-size:13px; margin-bottom:14px; cursor:pointer; padding:0;">← Torna alla rosa</button>

      <div class="section-title">Anagrafica</div>
      <div class="card" style="margin-bottom:20px;">
        ${righeInfo([
          ['Ruolo', persona.ruolo],
          ['Numero maglia', persona.numero_maglia ? `#${persona.numero_maglia}` : null],
          ['Data di nascita', persona.data_nascita ? new Date(persona.data_nascita).toLocaleDateString('it-IT') : null],
          ['Telefono', persona.telefono],
          ['Email', persona.email],
          ['Scadenza certificato medico', persona.scadenza_certificato ? new Date(persona.scadenza_certificato).toLocaleDateString('it-IT') : null],
          ['Note', persona.note],
        ])}
      </div>

      <div class="section-title">Statistiche stagionali</div>
      <div id="scheda-stats"><div class="empty-state">Caricamento...</div></div>

      <button id="modifica-da-scheda" style="width:100%; padding:13px; border-radius:12px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; margin-top:16px; cursor:pointer;">Modifica anagrafica</button>
    </div>
  `;
  document.getElementById('back-scheda').addEventListener('click', renderRosaStaff);
  document.getElementById('modifica-da-scheda').addEventListener('click', () => renderFormMembro('atleti', persona));

  const oggi = new Date();
  const inizioStagione = new Date(oggi.getFullYear(), 0, 1).toISOString(); // da inizio anno solare

  const [presenzeRes, marcatureRes, mvpRes] = await Promise.all([
    supabase.from('v_presenze_evento').select('*').eq('atleta_id', persona.id).eq('obbligatorio', true).gte('data_ora', inizioStagione),
    supabase.from('marcature').select('punti').eq('atleta_id', persona.id),
    supabase.from('mvp_voti').select('id').eq('votato_id', persona.id),
  ]);

  const presenze = presenzeRes.data || [];
  const totale = presenze.length;
  const presenti = presenze.filter((e) => e.presenza_reale).length;
  const percentuale = totale ? Math.round((presenti / totale) * 100) : 0;
  const puntiTotali = (marcatureRes.data || []).reduce((s, m) => s + (m.punti || 0), 0);
  const votiMvp = mvpRes.data?.length || 0;

  const statsEl = document.getElementById('scheda-stats');
  statsEl.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><div class="num">${percentuale}%</div><div class="lbl">Assiduità</div></div>
      <div class="kpi"><div class="num">${puntiTotali}</div><div class="lbl">Punti segnati</div></div>
      <div class="kpi"><div class="num">${votiMvp}</div><div class="lbl">Voti MVP ricevuti</div></div>
    </div>
    <div class="stat-detail" style="text-align:center;">${presenti} presenze su ${totale} sessioni obbligatorie (dall'inizio dell'anno)</div>
  `;
}

// Genera righe etichetta/valore, omettendo i campi non compilati
function righeInfo(coppie) {
  const valide = coppie.filter(([, valore]) => valore);
  if (!valide.length) return `<div class="stat-detail">Nessuna informazione aggiuntiva inserita.</div>`;
  return valide.map(([label, valore]) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--line);">
      <span style="color:#8a8474; font-size:13px;">${label}</span>
      <span style="font-weight:600; font-size:13px; text-align:right; max-width:60%;">${valore}</span>
    </div>
  `).join('');
}

function renderFormMembro(tabella, personaEsistente = null) {
  const body = document.getElementById('screen-body');
  const p = personaEsistente || {};
  document.getElementById('top-title').textContent = personaEsistente ? 'Modifica' : `Nuovo ${tabella === 'atleti' ? 'atleta' : 'membro staff'}`;

  body.innerHTML = `
    <div class="content">
      <button id="back-rosa" style="background:none; border:none; color:var(--pitch); font-weight:700; font-size:13px; margin-bottom:14px; cursor:pointer; padding:0;">← Torna alla rosa</button>

      <div class="section-title">Nome</div>
      <input id="f-nome" type="text" value="${p.nome || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      <div class="section-title">Cognome</div>
      <input id="f-cognome" type="text" value="${p.cognome || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      <div class="section-title">Email</div>
      <input id="f-email" type="email" value="${p.email || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />

      ${tabella === 'atleti' ? `
        <div class="section-title">Categoria</div>
        <input id="f-categoria" type="text" value="${p.categoria || ''}" placeholder="Es. Serie A" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
        <div class="section-title">Ruolo</div>
        <input id="f-ruolo" type="text" value="${p.ruolo || ''}" placeholder="Ruolo in campo" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
        <div class="section-title">Telefono</div>
        <input id="f-telefono" type="tel" value="${p.telefono || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
        <div class="section-title">Data di nascita</div>
        <input id="f-data-nascita" type="date" value="${p.data_nascita || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
        <div class="section-title">Numero maglia</div>
        <input id="f-numero-maglia" type="number" value="${p.numero_maglia ?? ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
        <div class="section-title">Scadenza certificato medico</div>
        <input id="f-scadenza-certificato" type="date" value="${p.scadenza_certificato || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
        <div class="section-title">Note (allergie, contatti emergenza, ecc.)</div>
        <textarea id="f-note" rows="3" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px; resize:vertical;">${p.note || ''}</textarea>
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:22px; font-size:14px; font-weight:600;">
          <input id="f-attivo" type="checkbox" ${p.attivo !== false ? 'checked' : ''} style="width:18px; height:18px;" />
          Atleta attivo
        </label>
      ` : `
        <div class="section-title">Ruolo</div>
        <input id="f-ruolo" type="text" value="${p.ruolo || ''}" placeholder="Es. Allenatore" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:22px; font-family:'Archivo'; font-size:14px;" />
      `}

      <button id="salva-membro-btn" style="width:100%; padding:13px; border-radius:12px; border:none; background:var(--pitch); color:#fff; font-weight:700; margin-bottom:10px; cursor:pointer;">Salva</button>
      ${personaEsistente ? `<button id="rimuovi-membro-btn" style="width:100%; padding:13px; border-radius:12px; border:1px solid var(--danger); background:#fff; color:var(--danger); font-weight:700; cursor:pointer;">Rimuovi</button>` : ''}
      <div class="auth-error" id="form-membro-error" style="color:var(--danger); text-align:left; margin-top:10px;"></div>
    </div>
  `;

  document.getElementById('back-rosa').addEventListener('click', renderRosaStaff);

  document.getElementById('salva-membro-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('form-membro-error');
    const nome = document.getElementById('f-nome').value.trim();
    const cognome = document.getElementById('f-cognome').value.trim();
    if (!nome || !cognome) { errEl.textContent = 'Nome e cognome sono obbligatori.'; return; }

    const payload = { nome, cognome, email: document.getElementById('f-email').value.trim() || null };
    if (tabella === 'atleti') {
      payload.categoria = document.getElementById('f-categoria').value.trim() || null;
      payload.ruolo = document.getElementById('f-ruolo').value.trim() || null;
      payload.telefono = document.getElementById('f-telefono').value.trim() || null;
      payload.data_nascita = document.getElementById('f-data-nascita').value || null;
      const numeroMaglia = document.getElementById('f-numero-maglia').value;
      payload.numero_maglia = numeroMaglia ? parseInt(numeroMaglia, 10) : null;
      payload.scadenza_certificato = document.getElementById('f-scadenza-certificato').value || null;
      payload.note = document.getElementById('f-note').value.trim() || null;
      payload.attivo = document.getElementById('f-attivo').checked;
    } else {
      payload.ruolo = document.getElementById('f-ruolo').value.trim() || null;
    }

    let error;
    if (personaEsistente) {
      ({ error } = await supabase.from(tabella).update(payload).eq('id', personaEsistente.id));
    } else {
      ({ error } = await supabase.from(tabella).insert(payload));
    }
    if (error) { errEl.textContent = 'Errore nel salvataggio: ' + error.message; return; }
    renderRosaStaff();
  });

  if (personaEsistente) {
    document.getElementById('rimuovi-membro-btn').addEventListener('click', async () => {
      if (!confirm(`Rimuovere ${p.nome} ${p.cognome}? L'eventuale account di accesso non viene eliminato, solo scollegato.`)) return;
      await supabase.from(tabella).delete().eq('id', personaEsistente.id);
      renderRosaStaff();
    });
  }
}

// Crea le credenziali di accesso per un atleta/staff già presente in rosa, senza
// disconnettere la sessione dello staff che sta operando (vedi supabaseSignup sopra).
function renderFormCredenziali(tabella, persona) {
  const body = document.getElementById('screen-body');
  document.getElementById('top-title').textContent = 'Crea accesso';

  body.innerHTML = `
    <div class="content">
      <button id="back-rosa2" style="background:none; border:none; color:var(--pitch); font-weight:700; font-size:13px; margin-bottom:14px; cursor:pointer; padding:0;">← Annulla</button>
      <div class="card">
        <h3>${persona.nome} ${persona.cognome}</h3>
        <div class="time">Crea email e password per l'accesso all'app</div>
      </div>
      <div class="section-title" style="margin-top:18px;">Email di accesso</div>
      <input id="c-email" type="email" value="${persona.email || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px; font-family:'Archivo'; font-size:14px;" />
      <div class="section-title">Password provvisoria</div>
      <input id="c-password" type="text" placeholder="Almeno 6 caratteri" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); margin-bottom:18px; font-family:'Archivo'; font-size:14px;" />
      <button id="crea-credenziali-btn" style="width:100%; padding:13px; border-radius:12px; border:none; background:var(--teal); color:var(--pitch-dark); font-weight:700; margin-bottom:10px; cursor:pointer;">Crea account</button>
      <div class="auth-error" id="form-cred-error" style="color:var(--danger); text-align:left; margin-top:6px;"></div>
      <p style="font-size:11.5px; color:#8a8474; margin-top:14px; line-height:1.5;">Nota: se sul progetto Supabase è attiva la conferma email, la persona dovrà cliccare il link ricevuto via email prima di poter accedere. Per un uso interno alla squadra puoi disattivarla in Authentication → Settings.</p>
    </div>
  `;

  document.getElementById('back-rosa2').addEventListener('click', renderRosaStaff);

  document.getElementById('crea-credenziali-btn').addEventListener('click', async () => {
    const errEl = document.getElementById('form-cred-error');
    const email = document.getElementById('c-email').value.trim();
    const password = document.getElementById('c-password').value;
    if (!email || password.length < 6) { errEl.textContent = 'Email valida e password di almeno 6 caratteri.'; return; }

    const { data, error } = await supabaseSignup.auth.signUp({ email, password });
    if (error) { errEl.textContent = 'Errore nella creazione account: ' + error.message; return; }
    const nuovoUserId = data.user?.id;
    if (!nuovoUserId) { errEl.textContent = 'Account creato ma ID non ricevuto: collega manualmente da Supabase.'; return; }

    const { error: linkError } = await supabase.from(tabella).update({ auth_user_id: nuovoUserId, email }).eq('id', persona.id);
    if (linkError) { errEl.textContent = 'Account creato ma collegamento fallito: ' + linkError.message; return; }

    alert(`Account creato per ${persona.nome}.\nEmail: ${email}\nPassword: ${password}\n\nComunicagliela in modo sicuro.`);
    renderRosaStaff();
  });
}

// ============================================================
// DASHBOARD STAFF
// ============================================================
async function renderDashboardStaff() {
  document.getElementById('top-title').textContent = 'Analisi presenze';
  document.getElementById('top-sub').textContent = 'Mese corrente · solo sessioni obbligatorie';
  const body = document.getElementById('screen-body');
  body.innerHTML = `<div class="content" id="dash-content"><div class="empty-state">Caricamento...</div></div>`;

  const oggi = new Date();
  const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1).toISOString();

  const { data: atleti } = await supabase.from('atleti').select('id, nome, cognome').eq('attivo', true);
  if (!atleti?.length) { document.getElementById('dash-content').innerHTML = `<div class="empty-state">Nessun atleta.</div>`; return; }

  const risultati = await Promise.all(atleti.map(async (a) => {
    const { data } = await supabase.from('v_presenze_evento').select('*').eq('atleta_id', a.id).eq('obbligatorio', true).gte('data_ora', inizioMese);
    const totale = data?.length || 0;
    const presenti = data?.filter((e) => e.presenza_reale).length || 0;
    const percentuale = totale ? Math.round((presenti / totale) * 100) : 0;

    // Recupero il dettaglio giustificata/non giustificata per le assenze del mese
    const eventiIds = (data || []).filter((e) => !e.presenza_reale).map((e) => e.evento_id);
    let assenzeGiustificate = 0;
    if (eventiIds.length) {
      const { data: checkins } = await supabase.from('check_in').select('giustificata').eq('atleta_id', a.id).in('evento_id', eventiIds);
      assenzeGiustificate = (checkins || []).filter((c) => c.giustificata).length;
    }
    const assenzeTotali = totale - presenti;

    return { ...a, percentuale, totale, presenti, assenzeTotali, assenzeGiustificate };
  }));
  risultati.sort((a, b) => a.percentuale - b.percentuale);

  const mediaGenerale = risultati.length ? Math.round(risultati.reduce((s, r) => s + r.percentuale, 0) / risultati.length) : 0;
  const sessioniTotali = risultati[0]?.totale || 0;
  const inCalo = risultati.filter((r) => r.percentuale < 60).length;

  const dash = document.getElementById('dash-content');
  dash.innerHTML = `
    <div class="kpi-row">
      <div class="kpi"><div class="num">${mediaGenerale}%</div><div class="lbl">Assiduità media</div></div>
      <div class="kpi"><div class="num">${sessioniTotali}</div><div class="lbl">Sessioni svolte</div></div>
      <div class="kpi"><div class="num">${inCalo}</div><div class="lbl">Atleti in calo</div></div>
    </div>
    <button id="export-csv-btn" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--pitch); font-weight:700; margin-bottom:20px; cursor:pointer;">Esporta CSV</button>
    <div class="section-title">Assiduità per atleta</div>
    <div id="stat-rows"></div>
  `;

  const rowsEl = document.getElementById('stat-rows');
  risultati.forEach((r) => {
    const colore = r.percentuale >= 80 ? '#2FC6B8' : r.percentuale >= 60 ? '#8C1D6B' : '#A63D40';
    const dettaglioAssenze = r.assenzeTotali > 0
      ? ` · ${r.assenzeTotali} assenz${r.assenzeTotali === 1 ? 'a' : 'e'}${r.assenzeGiustificate > 0 ? ` (${r.assenzeGiustificate} giustificat${r.assenzeGiustificate === 1 ? 'a' : 'e'})` : ' non giustificate'}`
      : '';
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <div class="stat-top"><span class="stat-name">${r.nome} ${r.cognome}</span><span class="stat-pct" style="color:${colore}">${r.percentuale}%</span></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${r.percentuale}%; background:${colore}"></div></div>
      <div class="stat-detail">${r.presenti} presenze su ${r.totale}${dettaglioAssenze}</div>
    `;
    rowsEl.appendChild(row);
  });

  document.getElementById('export-csv-btn').addEventListener('click', () => esportaCsv(risultati, oggi));
}

function esportaCsv(risultati, oggi) {
  const intestazione = ['Nome', 'Cognome', 'Assiduità %', 'Presenze', 'Sessioni totali', 'Assenze', 'Di cui giustificate'];
  const righe = risultati.map((r) => [r.nome, r.cognome, r.percentuale, r.presenti, r.totale, r.assenzeTotali, r.assenzeGiustificate]);
  const csv = [intestazione, ...righe].map((riga) => riga.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presenze-ANT-${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// CHAT DI SQUADRA
// ============================================================
let chatChannel = null;
let chatLettureChannel = null;

async function renderChat() {
  document.getElementById('top-title').textContent = 'Chat squadra';
  document.getElementById('top-sub').textContent = 'Canale unico ANT';
  const body = document.getElementById('screen-body');
  body.innerHTML = `
    <div class="chat-content" id="chat-messages"><div class="empty-state">Caricamento...</div></div>
    <div class="auth-error" id="chat-error" style="color:var(--danger); text-align:center; padding:0 16px;"></div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Scrivi un messaggio..." />
      <button id="chat-send">Invia</button>
    </div>
  `;

  const msgsEl = document.getElementById('chat-messages');
  const errEl = document.getElementById('chat-error');
  const totalePartecipanti = await contaPartecipantiTotali();

  const { data: messaggi, error } = await supabase.from('messaggi').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) {
    msgsEl.innerHTML = '';
    errEl.textContent = 'Errore nel caricare i messaggi: ' + error.message;
    return;
  }
  msgsEl.innerHTML = '';
  const listaMessaggi = (messaggi || []).reverse();
  if (!listaMessaggi.length) {
    msgsEl.innerHTML = `<div class="empty-state">Nessun messaggio ancora. Scrivi il primo!</div>`;
  } else {
    listaMessaggi.forEach((m) => appendBubble(msgsEl, m));
    msgsEl.scrollTop = msgsEl.scrollHeight;
    await segnaConsegnatiELetti(listaMessaggi);
    await aggiornaSpuntePerMieiMessaggi(msgsEl, listaMessaggi, totalePartecipanti);
  }

  if (chatChannel) supabase.removeChannel(chatChannel);
  chatChannel = supabase
    .channel('chat-squadra')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messaggi' }, async (payload) => {
      if (payload.new.autore_auth_id === state.session?.user?.id) return; // già mostrato in modo ottimistico
      if (msgsEl.querySelector('.empty-state')) msgsEl.innerHTML = '';
      appendBubble(msgsEl, payload.new);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      await segnaConsegnatiELetti([payload.new]);
    })
    .subscribe();

  // Aggiorna le spunte quando qualcuno segna un mio messaggio come consegnato/letto
  if (chatLettureChannel) supabase.removeChannel(chatLettureChannel);
  chatLettureChannel = supabase
    .channel('chat-letture')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messaggi_letture' }, async () => {
      const idsAttuali = Array.from(msgsEl.querySelectorAll('.spunte[data-msg-id]')).map((el) => el.dataset.msgId);
      if (idsAttuali.length) await aggiornaSpuntePerMieiMessaggi(msgsEl, idsAttuali.map((id) => ({ id, autore_auth_id: state.session.user.id })), totalePartecipanti);
    })
    .subscribe();

  // Se l'utente torna a guardare la chat dopo averla lasciata in background, segna come letti i messaggi visibili
  document.removeEventListener('visibilitychange', handleVisibilityChangeChat);
  document.addEventListener('visibilitychange', handleVisibilityChangeChat);
  async function handleVisibilityChangeChat() {
    if (document.visibilityState === 'visible' && state.tab === 'chat') {
      await segnaConsegnatiELetti(listaMessaggi);
    }
  }

  const invia = async () => {
    errEl.textContent = '';
    const input = document.getElementById('chat-input');
    const testo = input.value.trim();
    if (!testo) return;
    input.value = '';

    const idTemporaneo = `temp-${Date.now()}`;
    const messaggioOttimistico = { id: idTemporaneo, autore_auth_id: state.session.user.id, autore_nome: state.nomeUtente, testo, created_at: new Date().toISOString() };
    if (msgsEl.querySelector('.empty-state')) msgsEl.innerHTML = '';
    appendBubble(msgsEl, messaggioOttimistico);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    const { data: inserito, error: sendError } = await supabase
      .from('messaggi')
      .insert({ autore_auth_id: state.session.user.id, autore_nome: state.nomeUtente, testo })
      .select()
      .single();

    if (sendError) { errEl.textContent = 'Messaggio non inviato: ' + sendError.message; return; }

    // Sostituisco l'ID temporaneo con quello reale, così le spunte di lettura potranno aggiornarsi
    const spuntaEl = msgsEl.querySelector(`.spunte[data-msg-id="${idTemporaneo}"]`);
    if (spuntaEl && inserito) spuntaEl.dataset.msgId = inserito.id;
    listaMessaggi.push(inserito);
  };
  document.getElementById('chat-send').addEventListener('click', invia);
  document.getElementById('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') invia(); });
}

// Conta quante persone (atleti attivi + staff) potrebbero leggere i messaggi, per calcolare "letto da tutti"
async function contaPartecipantiTotali() {
  const { count: countAtleti } = await supabase.from('atleti').select('id', { count: 'exact', head: true }).eq('attivo', true);
  const { count: countStaff } = await supabase.from('staff').select('id', { count: 'exact', head: true });
  return (countAtleti || 0) + (countStaff || 0);
}

// Segna i messaggi altrui come consegnati sempre, e come letti solo se la scheda è effettivamente visibile
async function segnaConsegnatiELetti(messaggi) {
  const mieUid = state.session?.user?.id;
  if (!mieUid) return;
  const altri = messaggi.filter((m) => m.autore_auth_id !== mieUid && !String(m.id).startsWith('temp-'));
  if (!altri.length) return;

  const visibile = document.visibilityState === 'visible';
  const righe = altri.map((m) => ({
    messaggio_id: m.id,
    utente_auth_id: mieUid,
    consegnato_at: new Date().toISOString(),
    letto_at: visibile ? new Date().toISOString() : null,
  }));

  await supabase.from('messaggi_letture').upsert(righe, { onConflict: 'messaggio_id,utente_auth_id', ignoreDuplicates: false });
}

// Ricalcola e aggiorna nel DOM le spunte (1/2/2 viola) per i miei messaggi visibili
async function aggiornaSpuntePerMieiMessaggi(msgsEl, messaggi, totalePartecipanti) {
  const mieUid = state.session?.user?.id;
  const mieiIds = messaggi.filter((m) => m.autore_auth_id === mieUid && !String(m.id).startsWith('temp-')).map((m) => m.id);
  if (!mieiIds.length) return;

  const { data: letture } = await supabase.from('messaggi_letture').select('messaggio_id, consegnato_at, letto_at').in('messaggio_id', mieiIds);
  const mappa = {};
  (letture || []).forEach((l) => {
    if (!mappa[l.messaggio_id]) mappa[l.messaggio_id] = { consegnati: 0, letti: 0 };
    if (l.consegnato_at) mappa[l.messaggio_id].consegnati++;
    if (l.letto_at) mappa[l.messaggio_id].letti++;
  });

  mieiIds.forEach((id) => {
    const el = msgsEl.querySelector(`.spunte[data-msg-id="${id}"]`);
    if (!el) return;
    const c = mappa[id] || { consegnati: 0, letti: 0 };
    const denom = Math.max(totalePartecipanti - 1, 0); // esclude me stesso
    if (denom > 0 && c.letti >= denom) {
      el.innerHTML = '✓✓';
      el.style.color = '#2FC6B8';
    } else if (denom > 0 && c.consegnati >= denom) {
      el.innerHTML = '✓✓';
      el.style.color = 'rgba(255,255,255,0.55)';
    } else {
      el.innerHTML = '✓';
      el.style.color = 'rgba(255,255,255,0.55)';
    }
  });
}

function appendBubble(container, msg) {
  const mio = msg.autore_auth_id === state.session?.user?.id;
  const d = msg.created_at ? new Date(msg.created_at) : new Date();
  const oraTesto = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const dataTesto = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  const row = document.createElement('div');
  row.className = 'bubble-row' + (mio ? ' mio' : '');
  row.innerHTML = `
    <div class="bubble ${mio ? 'mio' : ''}">
      <div class="autore" style="color:#2FC6B8;">${mio ? 'Tu' : msg.autore_nome}</div>
      <div class="testo"></div>
      <div class="bubble-meta" style="display:flex; justify-content:flex-end; align-items:center; gap:5px; margin-top:4px; font-size:10.5px; opacity:0.65;">
        <span>${dataTesto} · ${oraTesto}</span>
        ${mio ? `<span class="spunte" data-msg-id="${msg.id}" style="color:rgba(255,255,255,0.55); font-weight:700;">✓</span>` : ''}
      </div>
    </div>
  `;
  row.querySelector('.testo').textContent = msg.testo; // textContent per evitare injection
  container.appendChild(row);
}

// ============================================================
// INSTALL BANNER (Add to Home Screen)
// ============================================================
function setupInstallBanner() {
  let deferredPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  if (isStandalone) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner(async () => {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideBanner();
    });
  });

  if (isIos) {
    showBanner(null, true);
  }
}

function showBanner(onInstall, isIosHint = false) {
  if (document.getElementById('install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner';
  banner.innerHTML = isIosHint
    ? `<p>Installa ANT - Touch In: tocca <strong>Condividi</strong> in Safari, poi <strong>"Aggiungi a Home"</strong></p><button class="close">✕</button>`
    : `<p>Installa ANT - Touch In sulla tua home per accedere più velocemente</p><button id="install-confirm">Installa</button><button class="close">✕</button>`;
  document.body.appendChild(banner);
  document.body.classList.add('has-install-bar');
  document.documentElement.style.setProperty('--install-bar-height', banner.offsetHeight + 'px');

  banner.querySelector('.close').addEventListener('click', hideBanner);
  if (onInstall) banner.querySelector('#install-confirm')?.addEventListener('click', onInstall);
}

function hideBanner() {
  document.getElementById('install-banner')?.remove();
  document.body.classList.remove('has-install-bar');
}

// ============================================================
init();
