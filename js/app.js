import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
const firebaseConfig = {
  apiKey: "AIzaSyDAvvqLF4aVQV5uQmLN8_FuJvnkDMAZeRI",
  authDomain: "maggiebump-454ea.firebaseapp.com",
  databaseURL: "https://maggiebump-454ea-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "maggiebump-454ea",
  storageBucket: "maggiebump-454ea.firebasestorage.app",
  messagingSenderId: "82266192471",
  appId: "1:82266192471:web:972c8f9590df9f15c90112"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

const cloudDataRef = ref(db, "maggieBump/main");

let cloudReady = false;
let isApplyingCloud = false;

const DATA_KEY='bumptrack-data-v1';
const ACTIVE_PAGE_KEY='maggiebump-active-page';
const CALENDAR_START_DATE='2026-04-01';
const SYNC_SECTIONS = [
  'settings',
  'fundDeposits',
  'expenses',
  'appointments',
  'notes',
  'checklist',
  'importantDates'
];

const PENDING_SYNC_KEY =
  'maggiebump-pending-sync-v1';

const PENDING_DELETE_KEY =
  'maggiebump-pending-deletes-v1';

function readStoredObject(key){
  try {
    const value =
      JSON.parse(
        localStorage.getItem(key) ||
        '{}'
      );

    return (
      value &&
      typeof value === 'object'
    )
      ? value
      : {};
  } catch {
    return {};
  }
}

let pendingSyncVersions =
  readStoredObject(
    PENDING_SYNC_KEY
  );

let pendingDeletedIds =
  readStoredObject(
    PENDING_DELETE_KEY
  );

const PREGNANCY = {
  conceptionDate: '2026-04-22',
  lmpDate: '2026-04-06',
  ultrasoundDate: '2026-05-29',
  ultrasoundAgeWeeks: 7,
  ultrasoundAgeDays: 0,
  fetalHeartRate: 131,
  crlCm: 1.0,
  gestationalSacCm: 0.3,
  cervicalLengthCm: 3.2,
  dueDate: '2027-01-15',
  sourceNote: 'Due date estimated from ultrasound CRL: 7 weeks 0 days on May 29, 2026.'
};const expenseCategories=[{name:'OB Checkups',
icon:'🩺',color:'#de8f6e'},{name:'Ultrasound',
icon:'🖥️',color:'#8bbbd9'},{name:'Vitamins & Medicine',
icon:'💊',color:'#97bd87'},{name:'Lab Tests',
icon:'🧪',color:'#b79bd6'},{name:'Food & Cravings',
icon:'🍲',color:'#e5bd67'},{name:'Transportation',
icon:'🚌',color:'#91a8d0'},{name:'Maternity Clothes',
icon:'👗',color:'#d89ac8'},{name:'Baby Items',
icon:'🍼',color:'#9bc9c2'},{name:'Hospital Bill',
icon:'🏥',
color:'#d96f6f'},{name:'Emergency',icon:'🚨',color:'#c95b5b'},{name:'Other',icon:'☰',color:'#a48b80'}];
const importantDateColors = [
  { name:'Coral', value:'#de8f6e' },
  { name:'Peach', value:'#f3b391' },
  { name:'Blue', value:'#8bbbd9' },
  { name:'Green', value:'#97bd87' },
  { name:'Yellow', value:'#e5bd67' },
  { name:'Purple', value:'#b79bd6' },
  { name:'Red', value:'#d96f6f' },
  { name:'Muted', value:'#a48b80' }
];
const babySizes=['poppy seed','sesame seed','lentil','blueberry','raspberry','grape','kumquat','fig','lime','peach','lemon','apple','avocado','pear','mango','banana','carrot','papaya','eggplant','corn','coconut','butternut squash','cabbage','pineapple','lettuce','cauliflower','small pumpkin','watermelon'];
const checklistTemplates={prepare:['Decide where to give birth','Estimate hospital bill and emergency buffer','Save weekly for pregnancy and hospital funds','Prepare government/insurance documents','Plan who will go with mom during delivery','List emergency contacts','Prepare transportation plan to hospital'],hospital:['Mom clothes and underwear','Baby clothes','Blanket and swaddle','Diapers and wipes','Toiletries','Phone charger','IDs and documents','Cash and cards','Snacks and water'],baby:['Newborn clothes','Diapers','Baby wipes','Blankets','Baby bottles','Baby soap/shampoo','Thermometer','Cotton balls','Changing mat','Baby towel']};
let data=loadData();
function defaultData(){
  return {
    settings: {
      dueDate: PREGNANCY.dueDate,
      lmp: PREGNANCY.lmpDate,
      momName: 'Maggie',
      pregnancyGoal: 30000,
      hospitalGoal: 80000,
      pregnancySaved: 0,
      hospitalSaved: 0
    },
    fundDeposits: [],
    expenses: [],
    appointments: [],
    notes: [],
    checklist: {},
    importantDates: []
  };
}

function normalizeChecklist(savedChecklist = {}){
  const nextChecklist = {};

  Object.keys(checklistTemplates).forEach(type => {
    if (Array.isArray(savedChecklist[type])) {
      nextChecklist[type] = savedChecklist[type]
        .map(item => ({
          id: item.id || uid('check'),
          text: String(item.text || '').trim(),
          done: Boolean(item.done),
          custom: Boolean(item.custom),
          createdAt: item.createdAt || Date.now()
        }))
        .filter(item => item.text);
    } else {
      nextChecklist[type] = checklistTemplates[type].map(text => ({
        id: uid('check'),
        text,
        done: false,
        custom: false,
        createdAt: Date.now()
      }));
    }
  });

  Object.keys(savedChecklist || {}).forEach(type => {
    if (!nextChecklist[type] && Array.isArray(savedChecklist[type])) {
      nextChecklist[type] = savedChecklist[type];
    }
  });

  return nextChecklist;
}

function normalizeRecordList(value){
  /*
    Firebase can sometimes return:
    - a normal array
    - a sparse array containing null entries
    - an object whose keys are record IDs or array indexes

    This converts all three formats into a clean array
    without deleting valid user records.
  */

  if (Array.isArray(value)) {
    return value.filter(
      item =>
        item &&
        typeof item === 'object'
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.entries(value)
      .filter(([, item]) =>
        item &&
        typeof item === 'object'
      )
      .map(([key, item]) => ({
        ...item,

        /*
          Preserve the existing ID.
          Only use the Firebase key when an ID
          is missing.
        */
        id: item.id || key
      }));
  }

  return [];
}

function normalizeData(source = {}){
  const base = defaultData();

  const next = {
    settings: {
      ...base.settings,
      ...(source.settings || {})
    },

fundDeposits:
  normalizeRecordList(
    source.fundDeposits
  ),

expenses:
  normalizeRecordList(
    source.expenses
  ),

appointments:
  normalizeRecordList(
    source.appointments
  ),

notes:
  normalizeRecordList(
    source.notes
  ),

checklist:
  normalizeChecklist(
    source.checklist || {}
  ),

importantDates:
  normalizeRecordList(
    source.importantDates
  )
};

  next.settings.dueDate = PREGNANCY.dueDate;
  next.settings.lmp = PREGNANCY.lmpDate;
  next.settings.momName = 'Maggie';

  return next;
}

function persistPendingSyncState(){
  localStorage.setItem(
    PENDING_SYNC_KEY,
    JSON.stringify(
      pendingSyncVersions
    )
  );

  localStorage.setItem(
    PENDING_DELETE_KEY,
    JSON.stringify(
      pendingDeletedIds
    )
  );
}

function isSectionPending(section){
  return Boolean(
    pendingSyncVersions[section]
  );
}

function markSectionPending(section){
  pendingSyncVersions[section] =
    Number(
      pendingSyncVersions[section] ||
      0
    ) + 1;

  persistPendingSyncState();
}

function markDeletedForSync(
  section,
  id
){
  if (!id) return;

  if (
    !pendingDeletedIds[section]
  ) {
    pendingDeletedIds[section] = {};
  }

  pendingDeletedIds[section][id] =
    Date.now();

  persistPendingSyncState();
}

function clearDeletedForSync(
  section,
  id
){
  if (
    !id ||
    !pendingDeletedIds[section]
  ) {
    return;
  }

  delete pendingDeletedIds[
    section
  ][id];

  if (
    !Object.keys(
      pendingDeletedIds[section]
    ).length
  ) {
    delete pendingDeletedIds[
      section
    ];
  }

  persistPendingSyncState();
}

function getPendingDeletedIds(
  section
){
  return new Set(
    Object.keys(
      pendingDeletedIds[section] ||
      {}
    )
  );
}

function getRecordMergeKey(
  item,
  index = 0
){
  if (item?.id) {
    return item.id;
  }

  return [
    item?.date || '',
    item?.time || '',
    item?.title ||
      item?.description ||
      item?.type ||
      item?.text ||
      '',
    item?.createdAt || index
  ].join('|');
}

function mergePendingRecordSection(
  section,
  cloudValue,
  localValue
){
  const merged = new Map();

  normalizeRecordList(
    cloudValue
  ).forEach((item, index) => {
    merged.set(
      getRecordMergeKey(
        item,
        index
      ),
      item
    );
  });

  /*
    Local pending records are added second,
    so a recent local edit wins over an
    older cloud copy of the same ID.
  */
  normalizeRecordList(
    localValue
  ).forEach((item, index) => {
    merged.set(
      getRecordMergeKey(
        item,
        index
      ),
      item
    );
  });

  getPendingDeletedIds(
    section
  ).forEach(id => {
    merged.delete(id);
  });

  return [
    ...merged.values()
  ];
}

function getChecklistMergeKey(
  item,
  index = 0
){
  if (
    item?.custom &&
    item?.id
  ) {
    return `custom:${item.id}`;
  }

  const text =
    String(item?.text || '')
      .trim()
      .toLowerCase();

  return text
    ? `text:${text}`
    : `item:${item?.id || index}`;
}

function mergePendingChecklist(
  cloudChecklist,
  localChecklist
){
  const cloud =
    normalizeChecklist(
      cloudChecklist || {}
    );

  const local =
    normalizeChecklist(
      localChecklist || {}
    );

  const result = {};

  const deleted =
    getPendingDeletedIds(
      'checklist'
    );

  const types =
    new Set([
      ...Object.keys(cloud),
      ...Object.keys(local)
    ]);

  types.forEach(type => {
    const merged =
      new Map();

    (cloud[type] || [])
      .forEach((item, index) => {
        merged.set(
          getChecklistMergeKey(
            item,
            index
          ),
          item
        );
      });

    (local[type] || [])
      .forEach((item, index) => {
        merged.set(
          getChecklistMergeKey(
            item,
            index
          ),
          item
        );
      });

    deleted.forEach(id => {
      for (
        const [key, item]
        of merged
      ) {
        if (item.id === id) {
          merged.delete(key);
        }
      }
    });

    result[type] = [
      ...merged.values()
    ];
  });

  return result;
}

function mergeCloudSnapshot(
  localSource,
  cloudSource
){
  const local =
    normalizeData(
      localSource || {}
    );

  const cloud =
    normalizeData(
      cloudSource || {}
    );

  const rawCloud =
    (
      cloudSource &&
      typeof cloudSource ===
        'object'
    )
      ? cloudSource
      : {};

  const merged = {
    ...cloud,

    settings: {
      ...cloud.settings
    }
  };

  SYNC_SECTIONS.forEach(
    section => {
      const cloudHasSection =
        Object.prototype
          .hasOwnProperty
          .call(
            rawCloud,
            section
          );

      /*
        If Firebase does not contain a
        section at all, keep the local
        section and queue it for upload.
      */
      if (!cloudHasSection) {
        merged[section] =
          local[section];

        markSectionPending(
          section
        );

        return;
      }

      /*
        A cloud section can replace local
        only when there is no unsynced local
        change waiting for confirmation.
      */
      if (
        !isSectionPending(
          section
        )
      ) {
        return;
      }

      if (
        section === 'settings'
      ) {
        merged.settings = {
          ...cloud.settings,
          ...local.settings
        };

        return;
      }

      if (
        section === 'checklist'
      ) {
        merged.checklist =
          mergePendingChecklist(
            cloud.checklist,
            local.checklist
          );

        return;
      }

      merged[section] =
        mergePendingRecordSection(
          section,
          cloud[section],
          local[section]
        );
    }
  );

  return normalizeData(merged);
}

async function pushSectionToCloud(
  section
){
  if (
    !cloudReady ||
    isApplyingCloud ||
    !isSectionPending(section)
  ) {
    return;
  }

  const version =
    pendingSyncVersions[section];

  try {
    /*
      Update only the requested section.
      The entire Firebase root is not replaced.
    */
    await update(
      cloudDataRef,
      {
        [section]:
          data[section]
      }
    );

    /*
      Do not clear a newer pending edit
      that happened while this request
      was still running.
    */
    if (
      pendingSyncVersions[
        section
      ] === version
    ) {
      delete pendingSyncVersions[
        section
      ];

      delete pendingDeletedIds[
        section
      ];

      persistPendingSyncState();
    }
  } catch (error) {
    console.error(
      `Could not sync ${section}:`,
      error
    );
  }
}

function flushPendingSections(){
  SYNC_SECTIONS.forEach(
    section => {
      pushSectionToCloud(
        section
      );
    }
  );
}

function loadData(){
  try {
    return normalizeData(JSON.parse(localStorage.getItem(DATA_KEY)) || {});
  } catch {
    return normalizeData({});
  }
}

function syncFixedPregnancy(){
  data = normalizeData(data);
}
function saveData(section = ''){
  syncFixedPregnancy();

  /*
    Keep the previous local snapshot as
    an emergency backup before replacing it.
  */
  const previousLocal =
    localStorage.getItem(
      DATA_KEY
    );

  if (previousLocal) {
    localStorage.setItem(
      `${DATA_KEY}-backup`,
      previousLocal
    );
  }

  localStorage.setItem(
    DATA_KEY,
    JSON.stringify(data)
  );

  const sections =
    section
      ? [section]
      : SYNC_SECTIONS;

  /*
    Mark the section pending before any
    asynchronous Firebase request starts.
  */
  sections.forEach(
    markSectionPending
  );

  if (
    cloudReady &&
    !isApplyingCloud
  ) {
    sections.forEach(
      pushSectionToCloud
    );
  }
}

function uid(p='id'){return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

function dateToISO(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}function parseLocalDate(v){if(!v)
  return null;const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d)}
function formatDate(v){const d=parseLocalDate(v);if(!d)
  return 'No date';
  return d.toLocaleDateString('en-US',{month:'long',day:'2-digit',year:'numeric'})}
function money(v){
  return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(v)||0)}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v}
function escapeHtml(v){
  return String(v||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function hexToRgba(hex, alpha = 0.14){
  const clean = String(hex || '#de8f6e').replace('#','');

  const r = parseInt(clean.substring(0,2), 16);
  const g = parseInt(clean.substring(2,4), 16);
  const b = parseInt(clean.substring(4,6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getColorName(value){
  return importantDateColors.find(color => color.value === value)?.name || 'Custom';
}

function setPage(id){
  const validPages = [
  'homePage',
  'fundPage',
  'expensePage',
  'appointmentPage',
  'notesPage',
  'checklistPage',
  'importantDatesPage',
  'archivePage'
];

  if (!validPages.includes(id)) {
    id = 'homePage';
  }

  document.querySelectorAll('.page').forEach(page => {
    page.classList.toggle('active', page.id === id);
  });

  document.querySelectorAll('[data-page]').forEach(button => {
    button.classList.toggle('active', button.dataset.page === id);
  });

  document.body.className = 'page-' + id.replace('Page', '').toLowerCase();

  localStorage.setItem(ACTIVE_PAGE_KEY, id);

  const quickMenu = document.getElementById('quickMenu');
  if (quickMenu) quickMenu.classList.remove('open');

render();
}

function openModal(id){
  document.getElementById(id).classList.add('open')}
function closeModal(id){
  document.getElementById(id).classList.remove('open')}
function toggleQuick(){
  document.getElementById('quickMenu').classList.toggle('open')}
let pendingDeleteAction = null;

function openDeleteConfirmation({
  title = 'Delete item?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  onConfirm
}){
  pendingDeleteAction =
    typeof onConfirm === 'function'
      ? onConfirm
      : null;

  setText('confirmDeleteTitle', title);
  setText('confirmDeleteMessage', message);
  setText('confirmDeleteConfirmBtn', confirmLabel);

  openModal('confirmDeleteModal');

  document
    .getElementById('confirmDeleteConfirmBtn')
    ?.focus();
}

function closeDeleteConfirmation(){
  pendingDeleteAction = null;
  closeModal('confirmDeleteModal');
}

const confirmDeleteModal =
  document.getElementById('confirmDeleteModal');

const confirmDeleteCancelBtn =
  document.getElementById('confirmDeleteCancelBtn');

const confirmDeleteCloseBtn =
  document.getElementById('confirmDeleteCloseBtn');

const confirmDeleteConfirmBtn =
  document.getElementById('confirmDeleteConfirmBtn');

confirmDeleteCancelBtn?.addEventListener(
  'click',
  closeDeleteConfirmation
);

confirmDeleteCloseBtn?.addEventListener(
  'click',
  closeDeleteConfirmation
);

confirmDeleteConfirmBtn?.addEventListener(
  'click',
  () => {
    const action = pendingDeleteAction;

    pendingDeleteAction = null;
    closeModal('confirmDeleteModal');

    if (typeof action === 'function') {
      action();
    }
  }
);

confirmDeleteModal?.addEventListener(
  'click',
  event => {
    if (event.target === confirmDeleteModal) {
      closeDeleteConfirmation();
    }
  }
);

window.addEventListener(
  'keydown',
  event => {
    if (
      event.key === 'Escape' &&
      confirmDeleteModal?.classList.contains('open')
    ) {
      closeDeleteConfirmation();
    }
  }
);
function openFundDepositModal(id = ''){
  const item = data.fundDeposits.find(f => f.id === id);

  editingFundDepositId.value = item?.id || '';
  fundDepositType.value = item?.fundType || 'pregnancy';
  fundDepositAmount.value = item?.amount || '';
  fundDepositDate.value = item?.date || todayISO();
  fundDepositAddedBy.value = item?.addedBy || 'Maggie';

  const title = document.querySelector('#fundDepositModal h2');
  const submitBtn = document.querySelector('#fundDepositForm button[type="submit"]');

  if (title) title.textContent = item ? 'Edit money added' : 'Add money to fund';
  if (submitBtn) submitBtn.textContent = item ? 'Save changes' : 'Add money';

  openModal('fundDepositModal');
}
function openFundGoalModal(){
  pregnancyGoalInput.value = data.settings.pregnancyGoal || '';
  hospitalGoalInput.value = data.settings.hospitalGoal || '';
  openModal('fundGoalModal');
}
function openExpenseModal(
  id=''){const item=data.expenses.find(e=>e.id===id);
  expenseModalTitle.textContent=item?'Edit expense':'Add expense';
  editingExpenseId.value=item?.id||'';
  expenseDate.value=item?.date||todayISO();
  expenseAmount.value=item?.amount||'';
  expenseCategory.value=item?.category||expenseCategories[0].name;
  expensePaidBy.value=item?.paidBy||'Ryan';
  expenseDescription.value=item?.description||'';
  expenseNotes.value=item?.notes||'';openModal('expenseModal');
  quickMenu.classList.remove('open')}
function openAppointmentModal(id=''){const item=data.appointments.find(a=>a.id===id);appointmentModalTitle.textContent=item?'Edit appointment':'Add appointment';editingAppointmentId.value=item?.id||'';appointmentDate.value=item?.date||todayISO();appointmentTime.value=item?.time||'';appointmentType.value=item?.type||'OB Checkup';appointmentDoctor.value=item?.doctor||'';appointmentNotes.value=item?.notes||'';openModal('appointmentModal');quickMenu.classList.remove('open')}
function renderImportantDateColorOptions(selected = '#de8f6e'){
  const box = document.getElementById('importantDateColorOptions');
  if (!box) return;

  box.innerHTML = importantDateColors.map(color => `
    <button
      class="color-preset ${color.value === selected ? 'active' : ''}"
      type="button"
      title="${color.name}"
      aria-label="${color.name}"
      onclick="setImportantDateColor('${color.value}')"
    >
      <span class="color-dot" style="background:${color.value}"></span>
    </button>
  `).join('');
}
function setImportantDateColor(color){
  importantDateColor.value = color;
  renderImportantDateColorOptions(color);
}
function openImportantDateModal(id = ''){
  syncFixedPregnancy();

  const item = (data.importantDates || []).find(date => date.id === id);

  editingImportantDateId.value = item?.id || '';
  importantDateDate.value = item?.date || todayISO();
  importantDateTime.value = item?.time || '';
  importantDateTitle.value = item?.title || '';
  importantDateNotes.value = item?.notes || '';
  importantDateColor.value = item?.color || '#de8f6e';

  importantDateModalTitle.textContent = item ? 'Edit important date' : 'Add important date';

  renderImportantDateColorOptions(importantDateColor.value);
  openModal('importantDateModal');
}
function openImportantDateModalForDate(date = todayISO()){
  openImportantDateModal();

  importantDateDate.value = date;
  importantDateModalTitle.textContent = `Add important date for ${formatDate(date)}`;
}

function openNoteModal(
  id=''){const item=data.notes.find(n=>n.id===id);noteModalTitle.textContent=item?'Edit note':'Add note';editingNoteId.value=item?.id||'';noteDate.value=item?.date||todayISO();noteType.value=item?.type||'Symptom';noteTitle.value=item?.title||'';noteBody.value=item?.body||'';openModal('noteModal');quickMenu.classList.remove('open')}
function deleteFundDeposit(id){
  const item =
    (data.fundDeposits || []).find(
      deposit => deposit.id === id
    );

  if (!item) return;

  const fundName =
    item.fundType === 'hospital'
      ? 'Hospital Bill Fund'
      : 'Pregnancy Fund';

  openDeleteConfirmation({
    title: 'Delete money added?',
    message:
      `Delete ${money(item.amount)} from ${fundName}? ` +
      `Fund totals will update on both synced devices.`,

    onConfirm: () => {
      markDeletedForSync(
        'fundDeposits',
        id
      );

      data.fundDeposits =
        (data.fundDeposits || []).filter(
          deposit => deposit.id !== id
        );

      saveData('fundDeposits');
      render();
    }
  });
}

function deleteExpense(id){
  const item =
    data.expenses.find(
      expense => expense.id === id
    );

  openDeleteConfirmation({
    title: 'Delete expense?',

    message: item
      ? `Delete ${money(item.amount)} for “${item.description || item.category}”?`
      : 'Delete this expense?',

    onConfirm: () => {
      markDeletedForSync(
        'expenses',
        id
      );

      data.expenses =
        data.expenses.filter(
          expense => expense.id !== id
        );

      saveData('expenses');
      render();
    }
  });
}

function deleteAppointment(id){
  const item =
    data.appointments.find(
      appointment => appointment.id === id
    );

  openDeleteConfirmation({
    title: 'Delete appointment?',

    message: item
      ? `Delete ${item.type || 'this appointment'} on ${formatDate(item.date)}?`
      : 'Delete this appointment?',

    onConfirm: () => {
      markDeletedForSync(
        'appointments',
        id
      );

      data.appointments =
        data.appointments.filter(
          appointment => appointment.id !== id
        );

      saveData('appointments');
      render();
    }
  });
}

function deleteNote(id){
  const item =
    data.notes.find(
      note => note.id === id
    );

  openDeleteConfirmation({
    title: 'Delete note?',

    message: item
      ? `Delete “${item.title || item.type}”?`
      : 'Delete this note?',

    onConfirm: () => {
      markDeletedForSync(
        'notes',
        id
      );

      data.notes =
        data.notes.filter(
          note => note.id !== id
        );

      saveData('notes');
      render();
    }
  });
}

function deleteImportantDate(id){
  const item =
    (data.importantDates || []).find(
      importantDate => importantDate.id === id
    );

  openDeleteConfirmation({
    title: 'Delete important date?',

    message: item
      ? `Delete “${item.title}” on ${formatDate(item.date)}?`
      : 'Delete this important date?',

    onConfirm: () => {
      syncFixedPregnancy();

      markDeletedForSync(
        'importantDates',
        id
      );

      data.importantDates =
        (data.importantDates || []).filter(
          importantDate => importantDate.id !== id
        );

      saveData('importantDates');
      renderImportantCalendar();
    }
  });
}

function getPregnancyInfo(){const due=parseLocalDate(PREGNANCY.dueDate);
  const today=new Date();today.setHours(0,0,0,0);due.setHours(0,0,0,0);
  const daysLeft=Math.ceil((due-today)/86400000);
  const safeDays=Math.max(0,Math.min(280,280-daysLeft));
  const week=Math.floor(safeDays/7);
  const day=safeDays%7;let trimester='First trimester';if(week>=28)trimester='Third trimester';else if(week>=14)trimester='Second trimester';return{daysLeft,week,day,trimester}}
  function percent(c,g){return g?Math.max(0,Math.min(100,(Number(c)/Number(g))*100)):0}
  function updateProgress(id,c,g){
    const el=document.getElementById(id);if(el)el.style.width=percent(c,g)+'%'}
  function sortNewest(a,b){return `${b.date||''}${b.createdAt||''}`.localeCompare(`${a.date||''}${a.createdAt||''}`)}
  
  function getFundTotals(){
  return (data.fundDeposits || []).reduce((totals, item) => {
    const amount = Number(item.amount) || 0;

    if (item.fundType === 'pregnancy') {
      totals.pregnancy += amount;
    }

    if (item.fundType === 'hospital') {
      totals.hospital += amount;
    }

    return totals;
  }, {
    pregnancy: 0,
    hospital: 0
  });
}

document
  .getElementById('fundDepositForm')
  .addEventListener('submit', e => {
    e.preventDefault();

    const amount =
      Number(
        document.getElementById(
          'fundDepositAmount'
        ).value
      ) || 0;

    if (!amount) return;

    const editingId =
      document.getElementById(
        'editingFundDepositId'
      ).value;

    const id = editingId || uid('fund');

    clearDeletedForSync(
  'fundDeposits',
  id
);

    const existing =
      (data.fundDeposits || []).find(
        item => item.id === id
      );

    const deposit = {
      id,

      amount,

      date:
        document.getElementById(
          'fundDepositDate'
        ).value || todayISO(),

      addedBy:
        document.getElementById(
          'fundDepositAddedBy'
        ).value,

      fundType:
        document.getElementById(
          'fundDepositType'
        ).value,

      createdAt:
        existing?.createdAt || Date.now()
    };

    const index =
      (data.fundDeposits || []).findIndex(
        item => item.id === id
      );

    if (index >= 0) {
      data.fundDeposits[index] = deposit;
    } else {
      data.fundDeposits.push(deposit);
    }

    saveData('fundDeposits');
    closeModal('fundDepositModal');
    render();
  });


document
  .getElementById('fundForm')
  .addEventListener('submit', e => {
    e.preventDefault();

    data.settings.pregnancyGoal =
      Number(
        document.getElementById(
          'pregnancyGoalInput'
        ).value
      ) || 0;

    data.settings.hospitalGoal =
      Number(
        document.getElementById(
          'hospitalGoalInput'
        ).value
      ) || 0;

    saveData('settings');
    closeModal('fundGoalModal');
    render();
  });


document
  .getElementById('expenseForm')
  .addEventListener('submit', e => {
    e.preventDefault();

    const editingId =
      document.getElementById(
        'editingExpenseId'
      ).value;

    const id =
      editingId || uid('expense');

      clearDeletedForSync(
  'expenses',
  id
);

    const existing =
      data.expenses.find(
        item => item.id === id
      );

    const item = {
      id,

      date:
        document.getElementById(
          'expenseDate'
        ).value,

      amount:
        Number(
          document.getElementById(
            'expenseAmount'
          ).value
        ) || 0,

      category:
        document.getElementById(
          'expenseCategory'
        ).value,

      paidBy:
        document.getElementById(
          'expensePaidBy'
        ).value,

      description:
        document.getElementById(
          'expenseDescription'
        ).value.trim(),

      notes:
        document.getElementById(
          'expenseNotes'
        ).value.trim(),

      createdAt:
        existing?.createdAt || Date.now()
    };

    const index =
      data.expenses.findIndex(
        record => record.id === id
      );

    if (index >= 0) {
      data.expenses[index] = item;
    } else {
      data.expenses.push(item);
    }

    saveData('expenses');
    closeModal('expenseModal');
    render();
  });


document
  .getElementById('appointmentForm')
  .addEventListener('submit', e => {
    e.preventDefault();

    const editingId =
      document.getElementById(
        'editingAppointmentId'
      ).value;

    const id =
      editingId || uid('appt');

      clearDeletedForSync(
  'appointments',
  id
);

    const existing =
      data.appointments.find(
        item => item.id === id
      );

    const item = {
      id,

      date:
        document.getElementById(
          'appointmentDate'
        ).value,

      time:
        document.getElementById(
          'appointmentTime'
        ).value,

      type:
        document.getElementById(
          'appointmentType'
        ).value,

      doctor:
        document.getElementById(
          'appointmentDoctor'
        ).value.trim(),

      notes:
        document.getElementById(
          'appointmentNotes'
        ).value.trim(),

      createdAt:
        existing?.createdAt || Date.now()
    };

    const index =
      data.appointments.findIndex(
        record => record.id === id
      );

    if (index >= 0) {
      data.appointments[index] = item;
    } else {
      data.appointments.push(item);
    }

    saveData('appointments');
    closeModal('appointmentModal');
    render();
  });


document
  .getElementById('noteForm')
  .addEventListener('submit', e => {
    e.preventDefault();

    const editingId =
      document.getElementById(
        'editingNoteId'
      ).value;

    const id =
      editingId || uid('note');

      clearDeletedForSync(
  'notes',
  id
);

    const existing =
      data.notes.find(
        item => item.id === id
      );

    const item = {
      id,

      date:
        document.getElementById(
          'noteDate'
        ).value,

      type:
        document.getElementById(
          'noteType'
        ).value,

      title:
        document.getElementById(
          'noteTitle'
        ).value.trim(),

      body:
        document.getElementById(
          'noteBody'
        ).value.trim(),

      createdAt:
        existing?.createdAt || Date.now()
    };

    const index =
      data.notes.findIndex(
        record => record.id === id
      );

    if (index >= 0) {
      data.notes[index] = item;
    } else {
      data.notes.push(item);
    }

    saveData('notes');
    closeModal('noteModal');
    render();
  });

document
  .getElementById('importantDateForm')
  .addEventListener('submit', e => {
  e.preventDefault();

  syncFixedPregnancy();

  const id = editingImportantDateId.value || uid('date');

  clearDeletedForSync(
  'importantDates',
  id
);

  const item = {
    id,
    date: importantDateDate.value,
    time: importantDateTime.value,
    title: importantDateTitle.value.trim(),
    notes: importantDateNotes.value.trim(),
    color: importantDateColor.value || '#de8f6e',
    createdAt: (data.importantDates || []).find(date => date.id === id)?.createdAt || Date.now()
  };

  const index = (data.importantDates || []).findIndex(date => date.id === id);

  if (index >= 0) {
    data.importantDates[index] = item;
  } else {
    data.importantDates.push(item);
  }

saveData('importantDates');
closeModal('importantDateModal');

/*
  The user is already on the Important Dates page.
  Redraw only this section immediately instead of
  rerendering the entire application.
*/
renderImportantCalendar();
});

  function categoryTotals(){
    const t={};data.expenses.forEach(e=>t[e.category]=(t[e.category]||0)+Number(e.amount||0));return t}
function render(){
  renderSelects();
  renderHome();
  renderFunds();
  renderExpenses();
  renderAppointments();
  renderNotes();
  renderChecklist();
  renderExpenseChart();
  renderImportantCalendar();
}
function renderSelects(){if(expenseCategory&&!expenseCategory.children.length)expenseCategory.innerHTML=expenseCategories.map(c=>`<option>${c.name}</option>`).join('')}
function renderHome(){
const info = getPregnancyInfo();
const fundTotals = getFundTotals();
const totalExpenses = data.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
const totalSaved = fundTotals.pregnancy + fundTotals.hospital;
  if(!info){setText('daysLeft','—');
  setText('dueDateText','Due date is fixed from ultrasound.');
  setText('pregnancyWeek','—');
  setText('trimesterText','Trimester will appear here.');
setText('babySizeTitle','Baby size');
setText('babySizeText','Pregnancy age is calculated from the fixed due date.');
setText('babyIcon','🌱')}else{
  setText('daysLeft',info.daysLeft>=0?`${info.daysLeft} days`:`${Math.abs(info.daysLeft)} days past`);
  setText('dueDateText',`Estimated due date: ${formatDate(PREGNANCY.dueDate)}`);
  setText('pregnancyWeek',`${info.week}w ${info.day}d`);
  setText('trimesterText',info.trimester);
  const idx=Math.max(0,Math.min(babySizes.length-1,Math.floor((info.week-4)/1.2)));
  setText('babySizeTitle',`Around week ${info.week}`);
  setText('babySizeText',`Baby is roughly comparable to a ${babySizes[idx]||'small fruit'} right now. Ultrasound record: CRL ${PREGNANCY.crlCm} cm, fetal heart rate ${PREGNANCY.fetalHeartRate} bpm, cervical length ${PREGNANCY.cervicalLengthCm} cm.`);
  setText('babyIcon',info.week<14?'🌱':info.week<28?'🍋':'👶')}
  setText('homeSaved',money(totalSaved));
  setText('homeExpenses',money(totalExpenses));
updateProgress('pregFundProgress', fundTotals.pregnancy, data.settings.pregnancyGoal);
updateProgress('hospitalFundProgress', fundTotals.hospital, data.settings.hospitalGoal);

setText('pregFundLabel', `${money(fundTotals.pregnancy)} / ${money(data.settings.pregnancyGoal)}`);
setText('hospitalFundLabel', `${money(fundTotals.hospital)} / ${money(data.settings.hospitalGoal)}`);
  const upcoming=data.appointments.filter(a=>a.date>=todayISO()).sort((a,b)=>`${a.date}T${a.time||''}`.localeCompare(`${b.date}T${b.time||''}`))[0];
  if(upcoming){nextAppointmentBox.className='record-row';nextAppointmentBox.innerHTML=`<div class="record-icon">📅</div><div><div class="record-title">${escapeHtml(upcoming.type)}</div>
  <div class="record-meta">${formatDate(upcoming.date)} ${upcoming.time||''}<br>${escapeHtml(upcoming.doctor||'No clinic/doctor added')}</div></div><span class="pill">Next</span>`}else{nextAppointmentBox.className='empty';nextAppointmentBox.textContent='No upcoming appointments yet.'}renderRecordList('recentExpensesList',data.expenses.slice().sort(sortNewest).slice(0,5),'expense')}
function renderFunds(){
const fundTotals = getFundTotals();
const totalGoal = Number(data.settings.pregnancyGoal || 0) + Number(data.settings.hospitalGoal || 0);
const totalSaved = fundTotals.pregnancy + fundTotals.hospital;
const remaining = Math.max(0, totalGoal - totalSaved);
const info = getPregnancyInfo();
const weeksLeft = info ? Math.max(1, Math.ceil(info.daysLeft / 7)) : 0,
  weekly=weeksLeft?remaining/weeksLeft:0,monthsLeft=weeksLeft?Math.max(1,weeksLeft/4.345):0,monthly=monthsLeft?remaining/monthsLeft:0;
  setText('pregnancyGoalValue',money(data.settings.pregnancyGoal));
  setText('hospitalGoalValue',money(data.settings.hospitalGoal));
  setText('remainingNeeded',money(remaining));
  setText('weeklySave',money(weekly));
  setText('monthlySave',money(monthly));
 setText('pregnancyGoalCard', money(data.settings.pregnancyGoal));
setText('hospitalGoalCard', money(data.settings.hospitalGoal));
renderFundDeposits();
updateProgress('fundPagePregProgress', fundTotals.pregnancy, data.settings.pregnancyGoal);
updateProgress('fundPageHospitalProgress', fundTotals.hospital, data.settings.hospitalGoal);

setText('fundPagePregLabel', `${money(fundTotals.pregnancy)} / ${money(data.settings.pregnancyGoal)}`);
setText('fundPageHospitalLabel', `${money(fundTotals.hospital)} / ${money(data.settings.hospitalGoal)}`);
setText(
  'savingsAdvice',
  info
    ? `You have about ${weeksLeft} week(s) left. Save around ${money(weekly)} per week to hit both goals.`
    : 'Fund goals are ready. Add saved amounts to see progress.'
);
}
  function renderFundDeposits(){
  const box = document.getElementById('fundDepositsList');
  if (!box) return;

  const deposits = (data.fundDeposits || []).slice().sort(sortNewest);

  if (!deposits.length) {
    box.innerHTML = '<div class="empty">No money added yet.</div>';
    return;
  }

  box.innerHTML = deposits.map(item => `
    <div class="record-row">
      <div class="record-icon">${item.fundType === 'pregnancy' ? '🤰' : '🏥'}</div>
      <div>
        <div class="record-title">${item.fundType === 'pregnancy' ? 'Pregnancy Fund' : 'Hospital Bill Fund'}</div>
        <div class="record-meta">${formatDate(item.date)} · Added by ${escapeHtml(item.addedBy || '—')}</div>
      </div>
      <div>
  <div class="record-amount">${money(item.amount)}</div>
<div class="mini-actions">
  <button onclick="openFundDepositModal('${item.id}')">✎</button>

  <button
    class="danger"
    onclick="deleteFundDeposit('${item.id}')">
    ×
  </button>
</div>
</div>
    </div>
  `).join('');
}
  function renderExpenses(){
    const total=data.expenses.reduce((s,e)=>s+Number(e.amount||0),0),month=todayISO().slice(0,7),monthTotal=data.expenses.filter(e=>(e.date||'').startsWith(month)).reduce((s,e)=>s+Number(e.amount||0),0),by=categoryTotals(),big=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];setText('expenseTotal',money(total));setText('thisMonthExpense',money(monthTotal));setText('expenseCount',data.expenses.length);setText('biggestCategory',big?big[0]:'—');categorySummary.innerHTML=expenseCategories.map(c=>`<div class="category-card"><div class="category-emoji">${c.icon}</div><div class="category-name">${c.name}</div><div class="category-total">${money(by[c.name]||0)}</div></div>`).join('');renderRecordList('expensesList',data.expenses.slice().sort(sortNewest),'expense')}
function renderAppointments(){renderRecordList('appointmentsList',data.appointments.slice().sort((a,b)=>`${a.date}T${a.time||''}`.localeCompare(`${b.date}T${b.time||''}`)),'appointment')}
function getImportantDates(){
  const fixedDates = [
    {
      id:'fixed_conception',
      date:PREGNANCY.conceptionDate,
      title:'Possible conception date',
      notes:'Based on the date recorded in the app.',
      color:'#de8f6e',
      fixed:true
    },
    {
      id:'fixed_ultrasound',
      date:PREGNANCY.ultrasoundDate,
      title:'First ultrasound record',
      notes:`CRL ${PREGNANCY.crlCm} cm · FHR ${PREGNANCY.fetalHeartRate} bpm · 7w0d by CRL`,
      color:'#8bbbd9',
      fixed:true
    },
    {
      id:'fixed_due_date',
      date:PREGNANCY.dueDate,
      title:'Estimated due date',
      notes:'Calculated from ultrasound CRL.',
      color:'#97bd87',
      fixed:true
    }
  ];

return [
  ...fixedDates,
  ...normalizeRecordList(
    data.importantDates
  )
].filter(
  item =>
    item &&
    item.date
);
}
function renderCalendarMonth(monthDate, importantDates){
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthTitle = monthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  let html = `
    <section class="calendar-month">
      <div class="calendar-month-title">${monthTitle}</div>
      <div class="calendar-grid">
        ${dayNames.map(day => `<div class="calendar-day-name">${day}</div>`).join('')}
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-cell empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = dateToISO(date);
    const events = importantDates.filter(item => item.date === iso);
    const firstColor = events[0]?.color || '';
    const cellStyle = firstColor
      ? `style="background:${hexToRgba(firstColor, .13)}; border-color:${firstColor}"`
      : '';

    html += `
      <div
        class="calendar-cell clickable ${iso === today ? 'today' : ''} ${events.length ? 'has-events' : ''}"
        ${cellStyle}
        onclick="openImportantDateModalForDate('${iso}')"
      >
        <div class="calendar-date">${day}</div>

        ${events.slice(0, 3).map(event => `
          <span
            class="calendar-event"
            style="background:${event.color || '#de8f6e'}; color:white;"
            title="${escapeHtml(event.notes || '')}"
          >
            ${escapeHtml(event.title)}
          </span>
        `).join('')}

        ${events.length > 3 ? `<span class="calendar-event">+${events.length - 3} more</span>` : ''}
      </div>
    `;
  }

  html += `
      </div>
    </section>
  `;

  return html;
}

function renderImportantCalendar(){
  const calendar = document.getElementById('continuousCalendar');
  const legend = document.getElementById('calendarLegend');

  if (!calendar || !legend) return;

  const importantDates = getImportantDates();

const start = parseLocalDate(CALENDAR_START_DATE);
start.setHours(0,0,0,0);

  const due = parseLocalDate(PREGNANCY.dueDate);
  const monthsUntilDue = due
    ? ((due.getFullYear() - start.getFullYear()) * 12) + (due.getMonth() - start.getMonth()) + 1
    : 10;

  const monthsToShow = Math.max(10, monthsUntilDue + 1);

  let calendarHtml = '';

  for (let i = 0; i < monthsToShow; i++) {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
    calendarHtml += renderCalendarMonth(monthDate, importantDates);
  }

  calendar.innerHTML = calendarHtml;

    const timelineDates = importantDates
    .slice()
    .sort((a,b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));

  if (!timelineDates.length) {
    legend.innerHTML = '<div class="empty">No important dates yet.</div>';
    return;
  }

  legend.innerHTML = timelineDates.map(item => `
    <div class="record-row">
      <div class="record-icon" style="background:${item.color || '#de8f6e'}">★</div>
      <div>
        <div class="record-title">${escapeHtml(item.title)}</div>
        <div class="record-meta">
          ${formatDate(item.date)} ${item.time || ''} · ${item.fixed ? 'Fixed record' : getColorName(item.color)}
        </div>
        ${item.notes ? `<div class="record-meta">${escapeHtml(item.notes)}</div>` : ''}
        ${!item.fixed ? `
          <div class="mini-actions">
            <button onclick="openImportantDateModal('${item.id}')">✎</button>
            <button class="danger" onclick="deleteImportantDate('${item.id}')">×</button>
          </div>
        ` : ''}
      </div>
      <span class="pill">${item.fixed ? 'Fixed' : 'Saved'}</span>
    </div>
  `).join('');
}


function renderNotes(){renderRecordList('notesList',data.notes.slice().sort(sortNewest),'note')}
function ensureChecklistType(type){
  if (!checklistTemplates[type]) {
    type = 'prepare';
  }

  if (!data.checklist) {
    data.checklist = {};
  }

  if (!Array.isArray(data.checklist[type])) {
    data.checklist[type] = checklistTemplates[type].map(text => ({
      id: uid('check'),
      text,
      done: false,
      custom: false,
      createdAt: Date.now()
    }));
  }

  return type;
}

function renderChecklist(){
  const type = ensureChecklistType(checklistType.value);

  checklist.innerHTML =
    data.checklist[type].map(item => `
      <div class="check-row ${item.done ? 'done' : ''}">
        <div class="check-box" onclick="toggleCheck('${type}','${item.id}')">
          ${item.done ? '✓' : ''}
        </div>
        <div class="check-text">${escapeHtml(item.text)}</div>
        <button class="danger" onclick="deleteCheck('${type}','${item.id}')">×</button>
      </div>
    `).join('') +
    `
      <div class="row">
        <input id="newCheckInput" placeholder="Add custom checklist item">
        <button class="btn primary" onclick="addCheck('${type}')">Add</button>
      </div>
    `;
}

document
  .getElementById('checklistType')
  ?.addEventListener(
    'change',
    renderChecklist
  );

function toggleCheck(type, id){
  type = ensureChecklistType(type);

  const item = data.checklist[type].find(item => item.id === id);

  if (item) {
    item.done = !item.done;
    saveData('checklist');
    renderChecklist();
  }
}

function addCheck(type){
  type = ensureChecklistType(type);

  const input = document.getElementById('newCheckInput');
  const text = input.value.trim();

  if (!text) return;

  data.checklist[type].push({
    id: uid('check'),
    text,
    done: false,
    custom: true,
    createdAt: Date.now()
  });

  input.value = '';

  saveData('checklist');
  renderChecklist();
}

function deleteCheck(type, id){
  type = ensureChecklistType(type);

  const item =
    data.checklist[type].find(
      checklistItem => checklistItem.id === id
    );

  if (!item) return;

  openDeleteConfirmation({
    title: 'Delete checklist item?',

    message:
      `Delete “${item.text}”? ` +
      `Its checked state and other checklist items will not be changed.`,

    onConfirm: () => {
      markDeletedForSync(
        'checklist',
        id
      );

      data.checklist[type] =
        data.checklist[type].filter(
          checklistItem => checklistItem.id !== id
        );

      saveData('checklist');
      renderChecklist();
    }
  });
}


function renderRecordList(id,items,type){
  const box=document.getElementById(id);if(!box)return;if(!items.length){box.innerHTML='<div class="empty">Nothing added yet.</div>';return}box.innerHTML=items.map(item=>{if(type==='expense'){
  const cat=expenseCategories.find(c=>c.name===item.category)||expenseCategories.at(-1);return `<div class="record-row"><div class="record-icon" style="background:${cat.color}">${cat.icon}</div><div><div class="record-title">${escapeHtml(item.description||item.category)}</div><div class="record-meta">${formatDate(item.date)} · ${escapeHtml(item.category)} · Paid by ${escapeHtml(item.paidBy||'—')}</div>${item.notes?`<div class="record-meta">${escapeHtml(item.notes)}</div>`:''}<div class="mini-actions"><button onclick="openExpenseModal('${item.id}')">✎</button><button class="danger" onclick="deleteExpense('${item.id}')">×</button></div></div><div class="record-amount">${money(item.amount)}</div></div>`}if(type==='appointment')return `<div class="record-row"><div class="record-icon">📅</div><div><div class="record-title">${escapeHtml(
    item.type)}</div><div class="record-meta">${formatDate(
      item.date)} ${item.time||''} · ${escapeHtml(item.doctor||'No clinic/doctor')}</div>${item.notes?`<div class="record-meta">${escapeHtml(item.notes)}
  </div>`:''}<div class="mini-actions"><button onclick="openAppointmentModal('${item.id}')">✎</button><button class="danger" onclick="deleteAppointment('${item.id}')">×</button></div></div><span class="pill">${item.date>=todayISO()?'Upcoming':'Done'}</span></div>`;return `<div class="record-row"><div class="record-icon">📝</div><div><div class="record-title">${escapeHtml(item.title||item.type)}</div><div class="record-meta">${formatDate(item.date)} · ${escapeHtml(item.type)}</div>${item.body?`<div class="record-meta">${escapeHtml(item.body)}</div>`:''}<div class="mini-actions"><button onclick="openNoteModal('${item.id}')">✎</button><button class="danger" onclick="deleteNote('${item.id}')">×</button></div></div><span class="pill">Note</span></div>`}).join('')}
function renderExpenseChart(){
  const canvas =
    document.getElementById(
      'expenseChart'
    );

  if (!canvas) return;

  const expensePage =
    document.getElementById(
      'expensePage'
    );

  /*
    Do not draw the chart while its page
    is hidden. A hidden canvas has a width
    of zero and was crashing the full render.
  */
  if (
    !expensePage?.classList.contains(
      'active'
    )
  ) {
    return;
  }

  const rect =
    canvas.getBoundingClientRect();

  if (
    rect.width <= 160 ||
    rect.height <= 0
  ) {
    return;
  }

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    rect.width * ratio;

  canvas.height =
    rect.height * ratio;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) return;

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  const totals =
    Object.entries(categoryTotals())
      .filter(([, amount]) =>
        amount > 0
      )
      .sort((a, b) =>
        b[1] - a[1]
      )
      .slice(0, 8);

  if (!totals.length) {
    ctx.fillStyle = '#7d6860';
    ctx.font = '14px Segoe UI';

    ctx.fillText(
      'No expenses yet.',
      20,
      40
    );

    return;
  }

  const max =
    Math.max(
      ...totals.map(
        ([, amount]) => amount
      )
    );

  const left = 120;
  const right = rect.width - 30;

  const availableWidth =
    Math.max(
      1,
      right - left
    );

  const barHeight = 22;
  const gap = 12;

  totals.forEach(
    ([name, amount], index) => {
      const category =
        expenseCategories.find(
          item => item.name === name
        ) ||
        expenseCategories.at(-1);

      const y =
        30 +
        index *
        (barHeight + gap);

      const width =
        Math.max(
          0,
          (
            availableWidth *
            amount
          ) / max
        );

      ctx.fillStyle = '#7d6860';
      ctx.font = '12px Segoe UI';

      ctx.fillText(
        name,
        12,
        y + 16
      );

      ctx.fillStyle = '#fff1e5';

      roundRect(
        ctx,
        left,
        y,
        availableWidth,
        barHeight,
        11
      );

      ctx.fill();

      ctx.fillStyle =
        category.color;

      roundRect(
        ctx,
        left,
        y,
        width,
        barHeight,
        11
      );

      ctx.fill();

      ctx.fillStyle = '#2b2320';
      ctx.font = '12px Segoe UI';

      ctx.fillText(
        money(amount),
        left + width + 8,
        y + 16
      );
    }
  );
}

function roundRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
){
  if (
    width <= 0 ||
    height <= 0
  ) {
    return;
  }

  const safeRadius =
    Math.max(
      0,
      Math.min(
        radius,
        width / 2,
        height / 2
      )
    );

  ctx.beginPath();

  ctx.moveTo(
    x + safeRadius,
    y
  );

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    safeRadius
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    safeRadius
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    safeRadius
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    safeRadius
  );

  ctx.closePath();
}

/* CONNECT MODULE FUNCTIONS TO HTML BUTTONS */

window.setPage = setPage;

window.openModal = openModal;
window.closeModal = closeModal;
window.toggleQuick = toggleQuick;

window.openFundDepositModal =
  openFundDepositModal;

window.openFundGoalModal =
  openFundGoalModal;

window.openExpenseModal =
  openExpenseModal;

window.openAppointmentModal =
  openAppointmentModal;

window.openNoteModal =
  openNoteModal;

window.openImportantDateModal =
  openImportantDateModal;

window.openImportantDateModalForDate =
  openImportantDateModalForDate;

window.setImportantDateColor =
  setImportantDateColor;

  window.deleteFundDeposit =
  deleteFundDeposit;

window.deleteExpense =
  deleteExpense;

window.deleteAppointment =
  deleteAppointment;

window.deleteImportantDate =
  deleteImportantDate;

window.deleteNote =
  deleteNote;

window.toggleCheck =
  toggleCheck;

window.addCheck =
  addCheck;

window.deleteCheck =
  deleteCheck;

/* CONNECT THE MAIN NAVIGATION TABS */

document
  .querySelectorAll('[data-page]')
  .forEach(button => {

    button.addEventListener(
      'click',
      () => {
        setPage(
          button.dataset.page
        );
      }
    );

  });

const savedPage =
  localStorage.getItem(ACTIVE_PAGE_KEY);

const validPages = [
  'homePage',
  'fundPage',
  'expensePage',
  'appointmentPage',
  'notesPage',
  'checklistPage',
  'importantDatesPage',
  'archivePage'
];

setPage(
  validPages.includes(savedPage)
    ? savedPage
    : 'homePage'
);

onValue(
  cloudDataRef,
  snapshot => {
    const cloudData =
      snapshot.val();

    isApplyingCloud = true;

    try {
      if (cloudData) {
        /*
          Merge the cloud snapshot with any
          local sections that are still waiting
          to be synced.
        */
        data =
          mergeCloudSnapshot(
            data,
            cloudData
          );
      } else {
        /*
          Firebase is empty. Keep local data
          and upload each section separately.
        */
        syncFixedPregnancy();

        SYNC_SECTIONS.forEach(
          markSectionPending
        );
      }

      const previousLocal =
        localStorage.getItem(
          DATA_KEY
        );

      if (previousLocal) {
        localStorage.setItem(
          `${DATA_KEY}-backup`,
          previousLocal
        );
      }

      localStorage.setItem(
        DATA_KEY,
        JSON.stringify(data)
      );

      cloudReady = true;
    } catch (error) {
      console.error(
        'Could not safely apply cloud data:',
        error
      );
    } finally {
      isApplyingCloud = false;
    }

    render();
    flushPendingSections();
  }
);
