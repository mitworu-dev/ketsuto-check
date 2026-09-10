'use strict';

const DB_NAME = 'ketsuto-check-db';
const DB_VERSION = 1;
const STORE = 'days';

const ACTION_SECTIONS = [
  {
    id: 'morning',
    title: '朝',
    items: [
      ['morning_nuts', '朝ごはんを食べる前にナッツを1〜2個かじる'],
      ['morning_no_spike', '朝ごはんは、小麦やスムージーなどいきなり血糖値をあげるものを避ける'],
      ['morning_lowgi_protein', '低GIの糖質＋タンパク質が取れる朝ごはんを食べる（フルーツとゆで卵と米粉パンなど）']
    ]
  },
  {
    id: 'daytime',
    title: '日中の血糖コントロール',
    items: [
      ['daytime_snack', '1〜2時間に1回、ナッツ、干し芋、蜂蜜入りハーブティーなどをつまんで糖を補う'],
      ['daytime_10_15', '10時と15時に小さいおにぎりや干し芋などをおやつ替わりに補食']
    ]
  },
  {
    id: 'meal',
    title: '食事',
    items: [
      ['meal_pre_lowgi', '食事の30分前にナッツなど低GI食品をつまんでおく'],
      ['meal_order', 'スープやサラダ → たんぱく質 → 糖質の順番で食べる'],
      ['meal_pause', '食事を半分まで食べたら、5分ほど休憩をはさんでから残りを食べる'],
      ['meal_chew', '一口に月30回以上よく噛んで食べる'],
      ['meal_70_80', '腹7分目〜8分目で抑える'],
      ['meal_coffee_tea', '食後にブラックコーヒー or 緑茶を1杯飲む'],
      ['meal_move', '食後に食器洗いや軽い散歩、スクワットなど、軽く運動する'],
      ['meal_highgi_pre', 'GI値の高いものを食べる時は、その前にナッツなどを食べて急激な血糖値上昇を予防する'],
      ['meal_sweets_after', '甘いものを食べたい場合は、食後のデザートにする']
    ]
  },
  {
    id: 'sleep',
    title: '睡眠前（夜間低血糖対策）',
    items: [
      ['sleep_drink', '寝る前に甘酒ココアや、蜂蜜入りのハーブティーを飲む'],
      ['sleep_relax', '寝る前のスマホは控え、深呼吸をしてゆったり過ごす']
    ]
  },
  {
    id: 'avoid',
    title: '控えるもの',
    items: [
      ['avoid_sugar', '白砂糖を控える'],
      ['avoid_wheat', '小麦を控える'],
      ['avoid_hfcs', '果糖ぶどう液糖を控える'],
      ['avoid_driedfruit', 'ドライフルーツを控える（ドライデーツはOK）'],
      ['avoid_highgi', 'その他GI値のたかい食品を控える'],
      ['avoid_highgi_pre', 'GI値の高いものを摂る前に、ナッツなど低GI食材をとって血糖コントロールをしておく']
    ]
  }
];

const SYMPTOMS = [
  ['sym_sleepy_blur', '食後に強烈な眠気や集中力の低下、目が霞む感覚がある'],
  ['sym_dizzy', 'ふらつきや、倦怠感がある'],
  ['sym_pain', '肩こりや全身の痛みが出る'],
  ['sym_wakeup1', '寝起きがスッキリと起きられない'],
  ['sym_evening', '夕方以降体がだるくて仕方ない'],
  ['sym_irritable', '無性にイライラしたり、焦燥感や不安に駆られる'],
  ['sym_mood', 'メンタルのアップダウンが激しい。感情のコントロールが難しい（キレてしまうなど）'],
  ['sym_wakeup2', '朝スッキリと起きられない'],
  ['sym_dream', '寝ている間に夢を見たり寝ても疲れが取れた感じがしない']
];

const SCALES = [
  ['wake', '寝起きの気分や調子'],
  ['mental', 'メンタルの調子'],
  ['fatigue', '疲れやすさ'],
  ['skin', '肌の調子']
];

const ALL_ACTIONS = ACTION_SECTIONS.flatMap(s => s.items);
let db;
let currentDate = todayISO();
let noteTimer = null;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'date' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getDay(date) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(date);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function putDay(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function getAllDays() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function buildUI() {
  const actionRoot = document.getElementById('actionSections');
  actionRoot.innerHTML = ACTION_SECTIONS.map(section => `
    <section class="card">
      <div class="section-heading"><h2>${escapeHTML(section.title)}</h2><span class="badge">できたらチェック</span></div>
      <div class="check-list">
        ${section.items.map(([id, text]) => checkHTML('action', id, text)).join('')}
      </div>
    </section>
  `).join('');

  document.getElementById('symptomList').innerHTML = SYMPTOMS.map(([id, text]) => checkHTML('symptom', id, text)).join('');

  document.getElementById('scaleList').innerHTML = SCALES.map(([id, name]) => `
    <div class="scale-row" data-scale-row="${id}">
      <div class="scale-name">${escapeHTML(name)}</div>
      <div class="scale-buttons" role="group" aria-label="${escapeHTML(name)}">
        ${[1,2,3,4,5].map(n => `<button type="button" class="scale-btn" data-scale="${id}" data-value="${n}" aria-pressed="false">${n}</button>`).join('')}
      </div>
    </div>
  `).join('');
}

function checkHTML(kind, id, text) {
  return `<label class="check-item"><input type="checkbox" data-kind="${kind}" data-id="${id}"><span class="check-text">${escapeHTML(text)}</span></label>`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function emptyRecord(date) {
  return { date, actions: {}, symptoms: {}, scales: {}, note: '', updatedAt: null };
}

async function loadDate(date) {
  currentDate = date;
  document.getElementById('datePicker').value = date;
  document.getElementById('dateLabel').textContent = formatDateLong(date);
  const record = (await getDay(date)) || emptyRecord(date);

  document.querySelectorAll('input[type="checkbox"][data-kind="action"]').forEach(el => {
    el.checked = Boolean(record.actions?.[el.dataset.id]);
  });
  document.querySelectorAll('input[type="checkbox"][data-kind="symptom"]').forEach(el => {
    el.checked = Boolean(record.symptoms?.[el.dataset.id]);
  });
  document.querySelectorAll('.scale-btn').forEach(btn => {
    const active = Number(record.scales?.[btn.dataset.scale]) === Number(btn.dataset.value);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.getElementById('dailyNote').value = record.note || '';
  updateDerived();
  setSaveStatus(record.updatedAt ? '保存済み' : '未記録', Boolean(record.updatedAt));
}

function collectRecord() {
  const actions = {};
  document.querySelectorAll('input[type="checkbox"][data-kind="action"]').forEach(el => actions[el.dataset.id] = el.checked);
  const symptoms = {};
  document.querySelectorAll('input[type="checkbox"][data-kind="symptom"]').forEach(el => symptoms[el.dataset.id] = el.checked);
  const scales = {};
  SCALES.forEach(([id]) => {
    const btn = document.querySelector(`.scale-btn.active[data-scale="${id}"]`);
    if (btn) scales[id] = Number(btn.dataset.value);
  });
  return {
    date: currentDate,
    actions,
    symptoms,
    scales,
    note: document.getElementById('dailyNote').value.trim(),
    updatedAt: new Date().toISOString()
  };
}

async function saveNow() {
  setSaveStatus('保存中…', false);
  try {
    await putDay(collectRecord());
    setSaveStatus('保存済み', true);
    updateDerived();
  } catch (e) {
    console.error(e);
    setSaveStatus('保存エラー', false);
    showToast('保存に失敗しました');
  }
}

function setSaveStatus(text, saved) {
  const el = document.getElementById('saveStatus');
  el.textContent = text;
  el.classList.toggle('saved', saved);
}

function updateDerived() {
  const checked = [...document.querySelectorAll('input[type="checkbox"][data-kind="action"]')].filter(el => el.checked).length;
  const total = ALL_ACTIONS.length;
  const pct = total ? Math.round((checked / total) * 100) : 0;
  document.getElementById('progressText').textContent = `${pct}%`;
  document.getElementById('progressCount').textContent = `${checked} / ${total}`;
  document.getElementById('progressBar').style.width = `${pct}%`;
  document.getElementById('reportPreview').textContent = buildReport(false);
}

function reportDateLabel(date) {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getMonth()+1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`;
}

function formatDateLong(date) {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`;
}

function buildReport(short = false) {
  const record = collectRecord();
  const checkedCount = Object.values(record.actions).filter(Boolean).length;
  const pct = Math.round((checkedCount / ALL_ACTIONS.length) * 100);
  const scaleMap = Object.fromEntries(SCALES);

  if (short) {
    const sectionLines = ACTION_SECTIONS.map(section => {
      const done = section.items.filter(([id]) => record.actions[id]).length;
      return `${section.title.replace('（夜間低血糖対策）','')}：${done}/${section.items.length}`;
    });
    const symptomNames = SYMPTOMS.filter(([id]) => record.symptoms[id]).map(([, text]) => text);
    const scaleLines = SCALES.map(([id, name]) => `${name}：${record.scales[id] ?? '未入力'}`);
    return [
      `【${reportDateLabel(record.date)}】`,
      `達成率：${pct}%`,
      '',
      ...sectionLines,
      '',
      ...scaleLines,
      '',
      `症状：${symptomNames.length ? symptomNames.join('／') : 'なし'}`,
      ...(record.note ? ['', `メモ：${record.note}`] : [])
    ].join('\n');
  }

  const lines = [`【${reportDateLabel(record.date)} 血糖コントロール記録】`, ''];
  ACTION_SECTIONS.forEach(section => {
    lines.push(`■ ${section.title}`);
    section.items.forEach(([id, text]) => lines.push(`${record.actions[id] ? '○' : '×'} ${text}`));
    lines.push('');
  });

  lines.push('■ 血糖値が乱れているサイン');
  const present = SYMPTOMS.filter(([id]) => record.symptoms[id]);
  if (!present.length) lines.push('なし');
  else present.forEach(([, text]) => lines.push(`・${text}`));
  lines.push('');

  lines.push('■ スコア');
  SCALES.forEach(([id, name]) => lines.push(`${name}：${record.scales[id] ?? '未入力'}`));
  lines.push('');
  lines.push(`達成率：${pct}%（${checkedCount}/${ALL_ACTIONS.length}）`);
  if (record.note) {
    lines.push('', '■ 今日のメモ', record.note);
  }
  return lines.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function shiftDate(days) {
  const d = new Date(`${currentDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  loadDate(`${y}-${m}-${day}`);
}

async function requestPersistentStorage() {
  const status = document.getElementById('storageStatus');
  if (!navigator.storage) {
    status.textContent = 'このブラウザでは保存状態を取得できません。記録自体はIndexedDBへ保存します。';
    return;
  }
  try {
    let persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    if (!persisted && navigator.storage.persist) persisted = await navigator.storage.persist();
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : null;
    const usedKB = estimate?.usage ? Math.round(estimate.usage / 1024) : null;
    status.textContent = persisted
      ? `端末内の永続ストレージを使用中${usedKB !== null ? `（使用量 約${usedKB}KB）` : ''}`
      : `端末内に自動保存中${usedKB !== null ? `（使用量 約${usedKB}KB）` : ''}。念のため定期的にバックアップしてください。`;
  } catch {
    status.textContent = '端末内に自動保存中です。念のため定期的にバックアップしてください。';
  }
}

function csvEscape(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

async function exportCSV() {
  const days = (await getAllDays()).sort((a,b) => a.date.localeCompare(b.date));
  const headers = [
    'date','completion_rate',
    ...ALL_ACTIONS.map(([id]) => id),
    ...SYMPTOMS.map(([id]) => id),
    ...SCALES.map(([id]) => `scale_${id}`),
    'note','updatedAt'
  ];
  const rows = [headers.map(csvEscape).join(',')];
  for (const r of days) {
    const checked = ALL_ACTIONS.filter(([id]) => r.actions?.[id]).length;
    const pct = Math.round((checked / ALL_ACTIONS.length) * 100);
    const values = [
      r.date, pct,
      ...ALL_ACTIONS.map(([id]) => r.actions?.[id] ? 1 : 0),
      ...SYMPTOMS.map(([id]) => r.symptoms?.[id] ? 1 : 0),
      ...SCALES.map(([id]) => r.scales?.[id] ?? ''),
      r.note || '', r.updatedAt || ''
    ];
    rows.push(values.map(csvEscape).join(','));
  }
  downloadBlob(new Blob(['\ufeff' + rows.join('\r\n')], {type:'text/csv;charset=utf-8'}), `血糖チェック_${todayISO()}.csv`);
  showToast('CSVを書き出しました');
}

async function exportJSON() {
  const days = await getAllDays();
  const payload = {
    app: '血糖コントロールチェック',
    version: 1,
    exportedAt: new Date().toISOString(),
    days
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'}), `血糖チェック_バックアップ_${todayISO()}.json`);
  showToast('バックアップを保存しました');
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

async function importJSON(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.days)) throw new Error('invalid');
    for (const r of data.days) {
      if (r?.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) await putDay(r);
    }
    await loadDate(currentDate);
    showToast(`${data.days.length}日分を復元しました`);
  } catch (e) {
    console.error(e);
    showToast('バックアップを読み込めませんでした');
  }
}

function attachEvents() {
  document.addEventListener('change', e => {
    if (e.target.matches('input[type="checkbox"][data-kind]')) saveNow();
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.scale-btn');
    if (!btn) return;
    document.querySelectorAll(`.scale-btn[data-scale="${btn.dataset.scale}"]`).forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed','false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed','true');
    saveNow();
  });

  document.getElementById('dailyNote').addEventListener('input', () => {
    updateDerived();
    clearTimeout(noteTimer);
    noteTimer = setTimeout(saveNow, 300);
  });
  document.getElementById('dailyNote').addEventListener('blur', () => { clearTimeout(noteTimer); saveNow(); });

  document.getElementById('datePicker').addEventListener('change', e => loadDate(e.target.value || todayISO()));
  document.getElementById('prevDay').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDay').addEventListener('click', () => shiftDate(1));
  document.getElementById('todayBtn').addEventListener('click', () => loadDate(todayISO()));

  document.getElementById('copyFullBtn').addEventListener('click', async () => {
    await saveNow();
    await copyText(buildReport(false));
    showToast('報告文をコピーしました');
  });
  document.getElementById('copyShortBtn').addEventListener('click', async () => {
    await saveNow();
    await copyText(buildReport(true));
    showToast('短縮版をコピーしました');
  });
  document.getElementById('shareBtn').addEventListener('click', async () => {
    await saveNow();
    const text = buildReport(false);
    if (navigator.share) {
      try { await navigator.share({ text }); }
      catch (e) { if (e?.name !== 'AbortError') showToast('共有できませんでした'); }
    } else {
      await copyText(text);
      showToast('共有非対応のためコピーしました');
    }
  });

  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
  document.getElementById('importJsonInput').addEventListener('change', e => importJSON(e.target.files?.[0]));

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (currentDate === window._lastToday && todayISO() !== window._lastToday) await loadDate(todayISO());
    window._lastToday = todayISO();
  });
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { await navigator.serviceWorker.register('./service-worker.js'); }
    catch (e) { console.warn('Service Worker registration failed', e); }
  }
}

async function init() {
  buildUI();
  attachEvents();
  window._lastToday = todayISO();
  try {
    db = await openDB();
    await loadDate(currentDate);
    await requestPersistentStorage();
    await registerServiceWorker();
  } catch (e) {
    console.error(e);
    setSaveStatus('初期化エラー', false);
    document.getElementById('storageStatus').textContent = 'この環境では端末保存を初期化できませんでした。';
  }
}

init();
