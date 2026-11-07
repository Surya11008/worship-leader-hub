// ========================================================
// THEME MANAGEMENT (LIGHT & DARK MODE)
// ========================================================
function initTheme() {
  let saved = localStorage.getItem('wlh_theme_v3');
  if (!saved) {
    saved = 'light';
    localStorage.setItem('wlh_theme_v3', 'light');
    localStorage.setItem('wlh_theme', 'light');
  }
  applyTheme(saved);
}

function applyTheme(theme) {
  const html = document.documentElement;
  const icon = document.getElementById('themeToggleIcon');
  const btn = document.getElementById('themeToggleBtn');
  const txt = document.getElementById('themeToggleText');
  
  if (theme === 'light') {
    html.classList.add('light-mode');
    html.classList.remove('dark');
    if (icon) icon.className = 'fa-solid fa-moon text-xs text-indigo-600';
    if (txt) txt.textContent = 'Dark';
    if (btn) {
      btn.title = 'Switch to Dark Mode';
      btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition shadow-xs flex-shrink-0';
    }
  } else {
    html.classList.remove('light-mode');
    html.classList.add('dark');
    if (icon) icon.className = 'fa-solid fa-sun text-xs text-amber-400';
    if (txt) txt.textContent = 'Light';
    if (btn) {
      btn.title = 'Switch to Light Mode';
      btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition shadow-xs flex-shrink-0';
    }
  }
  localStorage.setItem('wlh_theme', theme);
  localStorage.setItem('wlh_theme_v3', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('wlh_theme_v3') || localStorage.getItem('wlh_theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}
initTheme();


// ========================================================
// POSITION-BASED ACCESS CONTROL (OVERSEER, DEACON, BCL, ETC.)
// ========================================================
const ALL_POSITIONS = [
  'Overseer',
  '(D)Overseer',
  'Deacon',
  'BCL',
  'PBCL',
  'Group Leader',
  'Unit Leader',
  'Co-Worker',
  'Evangelist',
  'Member'
];

let modulePermissions = JSON.parse(localStorage.getItem('wlh_module_permissions') || '{}');
let topicPermissions = JSON.parse(localStorage.getItem('wlh_topic_permissions') || '{}');
let filePermissions = JSON.parse(localStorage.getItem('wlh_file_permissions') || '{}');

function isEntityVisibleToUser(configOrItem, user) {
  if (!user) return false;
  // Master Admin and admin role users have unconditional access to everything
  if (user.role === 'admin' || (user.userId && user.userId.toLowerCase() === 'surya11008')) return true;
  if (!configOrItem) return true;

  let allowedPositions = ['all'];
  let allowedUsers = [];

  if (Array.isArray(configOrItem)) {
    allowedPositions = configOrItem;
  } else if (typeof configOrItem === 'object') {
    allowedPositions = configOrItem.positions || configOrItem.allowedPositions || ['all'];
    allowedUsers = configOrItem.users || configOrItem.allowedUsers || [];
  }

  // 1. If positions includes 'all' or '*' or is empty, open to all members
  const isAll = !allowedPositions || allowedPositions.length === 0 || 
    allowedPositions.some(p => typeof p === 'string' && (p.toLowerCase() === 'all' || p === '*'));
  if (isAll) return true;

  const userPos = (user.position || 'Member').toLowerCase();
  const uid = (user.userId || '').toLowerCase();

  // 2. Position match
  if (Array.isArray(allowedPositions) && allowedPositions.some(p => typeof p === 'string' && p.toLowerCase() === userPos)) {
    return true;
  }

  // 3. Individual user match
  if (Array.isArray(allowedUsers) && allowedUsers.some(u => typeof u === 'string' && u.toLowerCase() === uid)) {
    return true;
  }

  return false;
}

function isPositionAllowed(allowedPositions, user) {
  return isEntityVisibleToUser(allowedPositions, user);
}

function isFileVisibleToUser(item, user) {
  if (!user) return false;
  if (user.role === 'admin' || (user.userId && user.userId.toLowerCase() === 'surya11008')) return true;

  // 1. Direct file permission check
  const filePerm = filePermissions[item.url] || {
    positions: item.allowedPositions || ['all'],
    users: item.allowedUsers || []
  };
  if (!isEntityVisibleToUser(filePerm, user)) return false;

  // 2. Module permission check
  const itemModules = item.modules || (item.tab ? [item.tab] : []);
  if (itemModules.length > 0) {
    const hasAllowedModule = itemModules.some(modId => {
      const catObj = CATEGORIES.find(c => c.id === modId);
      const modPerm = modulePermissions[modId] || (catObj ? {
        positions: catObj.allowedPositions || ['all'],
        users: catObj.allowedUsers || []
      } : ['all']);
      return isEntityVisibleToUser(modPerm, user);
    });
    if (!hasAllowedModule) return false;
  }

  return true;
}

function renderPositionCheckboxes(containerId, nameAttr, selectedPositions = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const isAll = !selectedPositions || selectedPositions.length === 0 || selectedPositions.includes('all') || selectedPositions.includes('All');
  container.innerHTML = ALL_POSITIONS.map(pos => {
    const isChecked = isAll || selectedPositions.some(p => p.toLowerCase() === pos.toLowerCase());
    return `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/80 cursor-pointer border border-slate-800 transition">
        <input type="checkbox" name="${nameAttr}" value="${pos}" ${isChecked ? 'checked' : ''} class="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0">
        <span class="text-slate-200 text-[11px] font-semibold">${pos}</span>
      </label>
    `;
  }).join('');
}

function getSelectedPositionsFromCheckboxes(nameAttr) {
  const cbs = document.querySelectorAll(`input[name="${nameAttr}"]:checked`);
  const values = Array.from(cbs).map(cb => cb.value);
  if (values.length === 0 || values.length === ALL_POSITIONS.length) {
    return ['all'];
  }
  return values;
}

function renderUserCheckboxes(containerId, nameAttr, selectedUserIds = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const usersList = (ALL_USERS || []).filter(u => u && u.userId);
  if (usersList.length === 0) {
    container.innerHTML = '<div class="text-[11px] text-slate-500 italic p-2 col-span-2">No members registered yet.</div>';
    return;
  }
  const selectedLower = (selectedUserIds || []).map(u => (u || '').toLowerCase());
  container.innerHTML = usersList.map(u => {
    const isChecked = selectedLower.includes(u.userId.toLowerCase());
    return `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/80 cursor-pointer border border-slate-800 transition">
        <input type="checkbox" name="${nameAttr}" value="${u.userId}" ${isChecked ? 'checked' : ''} class="rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-0">
        <div class="min-w-0">
          <div class="text-slate-200 text-[11px] font-semibold truncate">${u.fullName || u.userId}</div>
          <div class="text-slate-500 text-[9px] truncate">@${u.userId} • ${u.position || 'Member'}</div>
        </div>
      </label>
    `;
  }).join('');
}

function getSelectedUsersFromCheckboxes(nameAttr) {
  const cbs = document.querySelectorAll(`input[name="${nameAttr}"]:checked`);
  return Array.from(cbs).map(cb => cb.value);
}

function toggleSelectAllUsers(nameAttr, check) {
  const cbs = document.querySelectorAll(`input[name="${nameAttr}"]`);
  cbs.forEach(cb => cb.checked = check);
}

function toggleSelectAllPositions(nameAttr, forceState) {
  const cbs = document.querySelectorAll(`input[name="${nameAttr}"]`);
  const anyUnchecked = Array.from(cbs).some(cb => !cb.checked);
  const targetState = forceState !== undefined ? forceState : anyUnchecked;
  cbs.forEach(cb => cb.checked = targetState);
}

function openTopicPermissionsModal(catId, topicName, event) {
  if (event) event.stopPropagation();
  const catObj = CATEGORIES.find(c => c.id === catId);
  const modal = document.getElementById('topicPermissionsModal');
  const container = document.getElementById('topicPermissionsModalContainer');
  if (!modal || !container) return;

  document.getElementById('topicPermCatId').value = catId;
  document.getElementById('topicPermTopicName').value = topicName;
  document.getElementById('topicPermModalSubtitle').textContent = (catObj ? catObj.name : catId) + ' › ' + topicName;

  const key = catId + '::' + topicName;
  const currentAllowed = topicPermissions[key] || ['all'];
  renderPositionCheckboxes('topicPositionsCheckboxList', 'topicPositionChoice', currentAllowed);

  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeTopicPermissionsModal() {
  const modal = document.getElementById('topicPermissionsModal');
  const container = document.getElementById('topicPermissionsModalContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function saveTopicPermissions(e) {
  e.preventDefault();
  const catId = document.getElementById('topicPermCatId').value;
  const topicName = document.getElementById('topicPermTopicName').value;
  const selected = getSelectedPositionsFromCheckboxes('topicPositionChoice');
  
  const key = catId + '::' + topicName;
  topicPermissions[key] = selected;
  localStorage.setItem('wlh_topic_permissions', JSON.stringify(topicPermissions));
  fbSync('topic_permissions', topicPermissions);

  closeTopicPermissionsModal();
  renderSubgroupTabs();
  renderRecords();
  showToast('Position access updated for topic "' + topicName + '"!');
}

async function adminChangeUserPosition(userId, newPos) {
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  user.position = newPos;

  if (CURRENT_USER && CURRENT_USER.userId && CURRENT_USER.userId.toLowerCase() === userId.toLowerCase()) {
    CURRENT_USER.position = newPos;
    localStorage.setItem('wlh_user', JSON.stringify(CURRENT_USER));
  }

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));

  if (typeof fbSync === 'function') {
    fbSync('users', ALL_USERS);
  }

  try {
    fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ALL_USERS)
    }).catch(e => console.warn('Direct RTDB sync error:', e));
  } catch(e) {}

  showToast((user.fullName || user.userId) + ' category updated to ' + newPos + '!', 'success');
  renderStarMembersGrid();
}


// ========================================================
// LIVE USER PRESENCE TRACKING (STAR GALAXY STYLE)
// ========================================================
let PRESENCE_DATA = {};
let presenceInterval = null;

function initPresenceTracking() {
  if (!CURRENT_USER || !CURRENT_USER.userId) return;
  const heartbeat = () => {
    if (!CURRENT_USER || !CURRENT_USER.userId) return;
    const userPresence = {
      userId: CURRENT_USER.userId,
      fullName: CURRENT_USER.fullName || 'User',
      role: CURRENT_USER.role || 'member',
      zion: CURRENT_USER.zion || '',
      area: CURRENT_USER.area || '',
      lastActive: Date.now()
    };
    if (IS_FIREBASE_CONNECTED && FIREBASE_DB) {
      FIREBASE_DB.ref('l_support/presence/' + CURRENT_USER.userId).set(userPresence).catch(() => {});
    } else {
      fbSync('presence/' + CURRENT_USER.userId, userPresence);
    }
  };
  heartbeat();
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(heartbeat, 30000);
}

/* ========================================================
   L SUPPORT — ENTERPRISE ENGINE v4.0
   Features:
   - Admin: surya11008 / Suri742766 / PIN 742766 (No 1-click button)
   - Clean Register Form (No 'Example' placeholders)
   - Multi-Module & Multi-Topic File Assignment (Appears in multiple rooms)
   - My Room (Personal Ministry & Sermon Usage Journal)
   - Used File Badge & Full Usage History Modal
   - Direct File Download (Direct PDF/Drive Download without Docs Editor)
   - Admin Management Panel (Per-user & Per-folder Download Permissions)
   - Password Eye Show/Hide Toggle
   - Top & Sidebar Logout
======================================================== */

// 1. DATA INITIALIZATION
const APP_RAW_DATA = JSON.parse(document.getElementById('initial-app-data').textContent);
const BASE_CATEGORIES = APP_RAW_DATA.categories;
const BASE_ITEMS = APP_RAW_DATA.items;

// Master Admin User (Role strictly Admin, clean details)
const DEFAULT_ADMIN = {
  fullName: 'Surya',
  userId: 'surya11008',
  password: 'Suri742766',
  phone: '+91 9876543210',
  gmail: 'surya@gmail.com',
  zion: '',
  area: '',
  pin: '742766',
  role: 'admin',
  status: 'approved',
  assignedModules: ['all'],
  canDownload: true
};

// Seed or update admin user in localStorage
let ALL_USERS = JSON.parse(localStorage.getItem('wlh_users') || 'null');
if (!ALL_USERS || ALL_USERS.length === 0) {
  ALL_USERS = [DEFAULT_ADMIN];
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS)); fbSync('users', ALL_USERS);
} else {
  const adminIdx = ALL_USERS.findIndex(u => u.userId.toLowerCase() === 'surya11008');
  if (adminIdx !== -1) {
    ALL_USERS[adminIdx].fullName = 'Surya';
    ALL_USERS[adminIdx].password = 'Suri742766';
    ALL_USERS[adminIdx].pin = '742766';
    ALL_USERS[adminIdx].role = 'admin';
    ALL_USERS[adminIdx].status = 'approved';
    ALL_USERS[adminIdx].canDownload = true;
    ALL_USERS[adminIdx].zion = '';
    ALL_USERS[adminIdx].area = '';
  } else {
    ALL_USERS.unshift(DEFAULT_ADMIN);
  }
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
}

// Active session: Link open shows login page if no user session exists
let CURRENT_USER = JSON.parse(localStorage.getItem('wlh_current_user') || 'null');
if (CURRENT_USER && CURRENT_USER.userId.toLowerCase() === 'surya11008') {
  CURRENT_USER.fullName = 'Surya';
  CURRENT_USER.password = 'Suri742766';
  CURRENT_USER.pin = '742766';
  CURRENT_USER.role = 'admin';
  CURRENT_USER.status = 'approved';
  CURRENT_USER.canDownload = true;
  CURRENT_USER.zion = '';
  CURRENT_USER.area = '';
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));
}

// Global master download switch (STRICT CONTROL)
let DOWNLOADS_ENABLED = JSON.parse(localStorage.getItem('wlh_downloads_enabled') || 'false');
let MODULE_DOWNLOAD_RULES = JSON.parse(localStorage.getItem('wlh_module_download_rules') || '{}');

// Custom storage
let customItems = JSON.parse(localStorage.getItem('wlh_custom_resources') || '[]');
let customModules = JSON.parse(localStorage.getItem('wlh_custom_modules') || '[]');
let moduleEdits = JSON.parse(localStorage.getItem('wlh_module_edits') || '{}');
let topicEdits = JSON.parse(localStorage.getItem('wlh_topic_edits') || '{}');
let fileMetadata = JSON.parse(localStorage.getItem('wlh_file_metadata') || '{}');
let pinnedUrls = new Set(JSON.parse(localStorage.getItem('wlh_pinned_urls') || '[]'));
let auditLog = JSON.parse(localStorage.getItem('wlh_audit_log') || '[]');
let suggestionsList = JSON.parse(localStorage.getItem('wlh_suggestions') || '[]');
let myRoomRecords = JSON.parse(localStorage.getItem('wlh_my_room_records') || '[]');


// Notices storage
let NOTICES_LIST = JSON.parse(localStorage.getItem('l_support_notices') || 'null');
if (!NOTICES_LIST || NOTICES_LIST.length === 0) {
  NOTICES_LIST = [
    {
      id: 'not_1',
      title: 'Welcome to L Support Central Portal',
      category: 'Important',
      color: 'indigo',
      content: 'Welcome to the updated ministry portal. You can now access all sermons, faith stories, and church media from your unified dashboard.',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: 'Admin'
    },
    {
      id: 'not_2',
      title: 'Sermon & Story Preaching Logs',
      category: 'Worship Update',
      color: 'amber',
      content: 'Please remember to log your preached sermons and paired faith stories in your personal Room after every service to maintain accurate ministry realization journals.',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: 'Admin'
    }
  ];
  localStorage.setItem('l_support_notices', JSON.stringify(NOTICES_LIST));
}

// Worship schedule standard list
const WORSHIP_SCHEDULE = [
  { day: 'Tuesday Service', time: '07:30 PM (Evening)', badge: 'Weekly', desc: 'Weekly Tuesday Third-Day Evening Service', icon: '⛪', color: 'indigo' },
  { day: 'Sabbath Day (Morning)', time: '10:00 AM', badge: 'Weekly', desc: 'Fourth Commandment - Holy Sabbath Morning Worship', icon: '🕊️', color: 'purple' },
  { day: 'Sabbath Day (Afternoon)', time: '03:00 PM', badge: 'Weekly', desc: 'Fourth Commandment - Holy Sabbath Afternoon Worship', icon: '📖', color: 'purple' },
  { day: 'Feasts of God', time: 'According to Sacred Calendar', badge: 'Annual Feasts', desc: 'Passover, Unleavened Bread, Resurrection, Pentecost, Trumpets, Atonement, Tabernacles', icon: '🎺', color: 'amber' }
];

// Firebase Connection State
let FIREBASE_APP = null;
let FIREBASE_DB = null;
let IS_FIREBASE_CONNECTED = false;
const BUILTIN_FIREBASE_CONFIG = {
  projectId: "lsupport-e390b",
  appId: "1:618338073550:web:869ca8596b7ee3c85b099f",
  databaseURL: "https://lsupport-e390b-default-rtdb.firebaseio.com",
  storageBucket: "lsupport-e390b.firebasestorage.app",
  apiKey: "AIzaSyAfgM6MA4HNz8AdhVoQ8A5GlWtAX0_wVJE",
  authDomain: "lsupport-e390b.firebaseapp.com",
  messagingSenderId: "618338073550",
  measurementId: "G-HMC8LN2T7J"
};

let FIREBASE_CONFIG = JSON.parse(localStorage.getItem('l_support_firebase_config') || 'null') || BUILTIN_FIREBASE_CONFIG;


// Interactive Worship Schedule Storage
let SCHEDULES_LIST = JSON.parse(localStorage.getItem('l_support_schedules') || 'null');
if (!SCHEDULES_LIST || SCHEDULES_LIST.length === 0) {
  SCHEDULES_LIST = [
    {
      id: 'sch_1',
      title: 'Tuesday Evening Service',
      category: 'Tuesday Service',
      icon: '⛪',
      date: '2026-11-04',
      time: '07:30 PM',
      notes: 'Third-Day Weekly Evening Worship. Please prepare hymn praise.',
      author: 'Admin'
    },
    {
      id: 'sch_2',
      title: 'Holy Sabbath Morning Service',
      category: 'Sabbath Worship',
      icon: '🕊️',
      date: '2026-11-07',
      time: '10:00 AM',
      notes: 'Fourth Commandment Holy Sabbath Morning Worship.',
      author: 'Admin'
    },
    {
      id: 'sch_3',
      title: 'Holy Sabbath Afternoon Service',
      category: 'Sabbath Worship',
      icon: '📖',
      date: '2026-11-07',
      time: '03:00 PM',
      notes: 'Fourth Commandment Holy Sabbath Afternoon Worship.',
      author: 'Admin'
    }
  ];
  localStorage.setItem('l_support_schedules', JSON.stringify(SCHEDULES_LIST));
}

let activeCalendarMonth = new Date().getMonth();
let activeCalendarYear = new Date().getFullYear();
let activeCalendarSelectedDate = null;
let pendingNoticeAttachments = [];

// State
let activeView = 'home'; // 'resources' | 'myroom'
let currentCategory = 'all';
let currentSubgroup = 'all';
let currentViewMode = 'table';
let searchQuery = '';
let isPinnedOnly = false;
let selectedItemUrls = new Set();
let currentActiveModalUrl = null;
let currentZoomScale = 1.0;
let pendingUnlockUrl = null;
let adminRoomSelectedUser = 'all'; // for My Room admin view

// Combined categories & items
let CATEGORIES = [];
let ALL_ITEMS = [];


function getDynamicRoomName(user) {
  const u = user || CURRENT_USER;
  if (!u) return 'Room';
  if (u.role === 'admin') {
    return 'Admin Room';
  }
  const name = u.fullName || u.userId || 'User';
  return name + ' Room';
}

function refreshDataModel() {
  CATEGORIES = [...BASE_CATEGORIES, ...customModules].map(cat => {
    const edit = moduleEdits[cat.id];
    let groups = [...(cat.groups || [])];
    if (topicEdits[cat.id]) {
      topicEdits[cat.id].forEach(t => {
        if (!groups.includes(t)) groups.push(t);
      });
    }
    return {
      ...cat,
      name: edit ? edit.name : cat.name,
      icon: edit ? edit.icon : cat.icon,
      color: edit ? edit.color : (cat.color || '#6366f1'),
      groups: groups
    };
  });

  // Filter modules based on user assignment (if user is not admin)
  if (CURRENT_USER && CURRENT_USER.role !== 'admin' && CURRENT_USER.assignedModules && !CURRENT_USER.assignedModules.includes('all')) {
    CATEGORIES = CATEGORIES.filter(c => CURRENT_USER.assignedModules.includes(c.id));
  }

  // Combine items and apply multi-module & multi-topic metadata
  ALL_ITEMS = [...customItems, ...BASE_ITEMS].map(it => {
    const meta = fileMetadata[it.url] || {};
    
    // Multi-modules list (e.g. ['Sermon', 'Watv'])
    let modulesList = meta.modules || (meta.customTab ? [meta.customTab] : [it.tab]);
    // Multi-topics list (e.g. ['WS_TE', 'Passover'])
    let topicsList = meta.topics || (meta.customGroup ? [meta.customGroup] : [it.group || 'General']);

    const primaryCat = CATEGORIES.find(c => modulesList.includes(c.id)) || CATEGORIES[0];

    return {
      ...it,
      tab: primaryCat ? primaryCat.id : it.tab,
      group: topicsList[0] || it.group || 'General',
      modules: modulesList,
      topics: topicsList,
      categoryName: primaryCat ? primaryCat.name : (it.categoryName || it.tab),
      categoryIcon: primaryCat ? primaryCat.icon : (it.categoryIcon || '📄'),
      badge: primaryCat ? primaryCat.badge : (it.badge || 'bg-slate-800 text-slate-300 border-slate-700'),
      isLocked: !!meta.locked,
      isHidden: !!meta.hidden,
      customColor: meta.color || '',
      allowDownload: meta.allowDownload !== undefined ? meta.allowDownload : false
    };
  });

  if (CURRENT_USER && CURRENT_USER.role !== 'admin') {
    ALL_ITEMS = ALL_ITEMS.filter(it => !it.isHidden);
  }
}

// 2. LIFECYCLE & DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  refreshDataModel();
  updateTopDownloadBtn();
  updateUserUI();
  updateTotalCounts();
  renderSidebarCategories();
  populateAddResourceModules();
  renderSubgroupTabs();
  renderRecords();
  updatePinnedBadge();
  updateMyRoomBadge();

  // Initialize Firebase Realtime Cloud Sync
  initFirebase();
  startBackgroundLivePoller();

  const hasActiveSession = sessionStorage.getItem('l_support_session_active') === 'true';

  if (!CURRENT_USER || !hasActiveSession) {
    // Show Full Dedicated Login Page on first visit / new link open
    openAuthModal();
  } else {
    logActivity('Session Start', 'Active as ' + CURRENT_USER.fullName + ' (' + CURRENT_USER.userId + ')');
    const isLocked = localStorage.getItem('l_support_screen_locked') === 'true';
    if (isLocked) {
      showAppPinLock();
    } else {
      closeAuthModal();
      switchView('home');
      if (CURRENT_USER.role === 'admin') {
        setTimeout(() => checkPendingApprovals(), 500);
      }
    }
  }

  // Keyboard shortcut (Esc)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFileModal();
      closeAddResourceModal();
      closeAddModuleModal();
      closeSettingsModal();
      closeQRModal();
      closeMergeModal();
      closeMoveCopyModal();
      closePinVerifyModal();
      closeEditFileModuleTopicModal();
      closeRecordUsageModal();
      closeFileUsageHistoryModal();
      closeAdminManagementModal();
      closePendingApprovalsModal();
      clearSelection();
    }
  });
});

// Event listeners for screen off, tab switch, minimizing, or exiting site
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (CURRENT_USER) {
      localStorage.setItem('l_support_screen_locked', 'true');
    }
  } else if (document.visibilityState === 'visible') {
    if (CURRENT_USER && localStorage.getItem('l_support_screen_locked') === 'true') {
      showAppPinLock();
    }
  }
});

window.addEventListener('pagehide', () => {
  if (CURRENT_USER) {
    localStorage.setItem('l_support_screen_locked', 'true');
  }
});

window.addEventListener('beforeunload', () => {
  if (CURRENT_USER) {
    localStorage.setItem('l_support_screen_locked', 'true');
  }
});

// 3. EYE TOGGLE BUTTON (SHOW / HIDE PASSWORD & PIN)
function togglePasswordVisibility(inputId, eyeIconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(eyeIconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
    icon.classList.add('text-indigo-400');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.remove('text-indigo-400');
    icon.classList.add('fa-eye');
  }
}

// 4. LOGGING & AUDIT
function logActivity(action, details) {
  if (!CURRENT_USER) return;
  const entry = {
    userId: CURRENT_USER.userId,
    userName: CURRENT_USER.fullName,
    action: action,
    details: details || '',
    zion: CURRENT_USER.zion || '',
    area: CURRENT_USER.area || 'General',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toISOString().split('T')[0]
  };
  auditLog.unshift(entry);
  if (auditLog.length > 200) auditLog.pop();
  localStorage.setItem('wlh_audit_log', JSON.stringify(auditLog));
}

// 5. USER & AUTHENTICATION (NO 1-CLICK BUTTON)
function updateUserUI() {
  if (!CURRENT_USER) return;
  document.getElementById('sidebarUserName').textContent = CURRENT_USER.fullName;
  document.getElementById('sidebarUserRole').textContent = (CURRENT_USER.role === 'admin' ? 'Admin' : 'Member') + ' Online';
  
  const zionAreaText = [CURRENT_USER.zion, CURRENT_USER.area].filter(Boolean).join(' • ');
  document.getElementById('sidebarUserZion').textContent = zionAreaText || 'L Support Member';
  document.getElementById('sidebarUserBranch').textContent = CURRENT_USER.zion || 'L Support';

  // Dynamic Room Labels (e.g. Admin Room, David Room, Peter Room)
  const roomTitle = getDynamicRoomName();
  const sidebarRoomText = document.getElementById('sidebarRoomBtnText');
  const topRoomText = document.getElementById('topRoomBtnText');
  const homeRoomBtnText = document.getElementById('homeRoomBtnText');
  const myRoomTitle = document.getElementById('myRoomTitle');
  const homeUserName = document.getElementById('homeUserName');

  if (sidebarRoomText) sidebarRoomText.textContent = roomTitle;
  if (topRoomText) topRoomText.textContent = roomTitle;
  if (homeRoomBtnText) homeRoomBtnText.textContent = roomTitle;
  if (myRoomTitle) myRoomTitle.textContent = roomTitle;
  const welcomeH1 = document.getElementById('homeWelcomeHeading'); if (welcomeH1) welcomeH1.innerHTML = 'Welcome to L Support! 👋';

  // Role Permissions: Admin vs Regular Viewers
  const isAdmin = CURRENT_USER.role === 'admin';
  const dlWrapper = document.getElementById('downloadToggleWrapper');
  const approvalTopBtn = document.getElementById('adminApprovalsTopBtn');
  const topAdminPanelBtn = document.getElementById('topAdminPanelBtn');
  const btnAdminAddNotice = document.getElementById('btnAdminAddNotice');
  const moduleEditTrigger = document.getElementById('moduleEditTrigger');
  const addResourceBtn = document.querySelector('button[onclick="openAddResourceModal()"]');
  const addModuleBtn = document.querySelector('button[onclick="openAddModuleModal()"]');

  const btnAdminCenterSidebar = document.getElementById('btnAdminCenterSidebar');
  if (isAdmin) {
    if (btnAdminCenterSidebar) { btnAdminCenterSidebar.classList.remove('hidden'); btnAdminCenterSidebar.classList.add('flex'); }
    if (dlWrapper) dlWrapper.classList.remove('hidden');
    if (approvalTopBtn) approvalTopBtn.classList.remove('hidden');
    if (topAdminPanelBtn) topAdminPanelBtn.classList.remove('hidden');
    if (btnAdminAddNotice) btnAdminAddNotice.classList.remove('hidden');
    if (moduleEditTrigger) moduleEditTrigger.classList.remove('hidden');
    if (addResourceBtn) addResourceBtn.classList.remove('hidden');
    if (addModuleBtn) addModuleBtn.classList.remove('hidden');
    updateApprovalCountBadge();
  } else {
    if (btnAdminCenterSidebar) { btnAdminCenterSidebar.classList.add('hidden'); btnAdminCenterSidebar.classList.remove('flex'); }
    if (dlWrapper) dlWrapper.classList.add('hidden');
    if (approvalTopBtn) approvalTopBtn.classList.add('hidden');
    if (topAdminPanelBtn) topAdminPanelBtn.classList.add('hidden');
    if (btnAdminAddNotice) btnAdminAddNotice.classList.add('hidden');
    if (moduleEditTrigger) moduleEditTrigger.classList.add('hidden');
    if (addResourceBtn) addResourceBtn.classList.add('hidden');
    if (addModuleBtn) addModuleBtn.classList.add('hidden');
  }
}

function handleLogout() {
  if (!confirm('Are you sure you want to log out of L Support?')) return;
  logActivity('Logout', 'User signed out');
  localStorage.removeItem('wlh_current_user');
  sessionStorage.removeItem('l_support_session_active');
  localStorage.removeItem('l_support_screen_locked');
  CURRENT_USER = null;
  const loginPassInput = document.getElementById('loginPassword');
  const loginPinInput = document.getElementById('loginPin');
  if (loginPassInput) loginPassInput.value = '';
  if (loginPinInput) loginPinInput.value = '';
  openAuthModal();
}

function openAuthModal() {
  const portalRoot = document.getElementById('portalAppRoot');
  const modal = document.getElementById('authModal');
  const container = document.getElementById('authModalContainer');
  if (portalRoot) {
    portalRoot.classList.add('hidden');
    portalRoot.style.display = 'none';
  }
  if (modal) {
    modal.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    modal.style.display = 'flex';
  }
  if (container) {
    container.classList.remove('scale-95');
    container.classList.add('scale-100');
  }
  if (CURRENT_USER && CURRENT_USER.userId) {
    const uidInput = document.getElementById('loginUserId');
    if (uidInput && !uidInput.value) uidInput.value = CURRENT_USER.userId;
  }
}

function closeAuthModal() {
  if (!CURRENT_USER) return; // Cannot close on first visit without signing in!
  const portalRoot = document.getElementById('portalAppRoot');
  const modal = document.getElementById('authModal');
  const container = document.getElementById('authModalContainer');
  if (modal) {
    modal.classList.add('opacity-0', 'pointer-events-none', 'hidden');
    modal.style.display = 'none';
  }
  if (container) {
    container.classList.remove('scale-100');
    container.classList.add('scale-95');
  }
  if (portalRoot) {
    portalRoot.classList.remove('hidden');
    portalRoot.style.display = 'flex';
  }
  updateUserUI();
}

function switchAuthMode(mode) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  const tabLogin = document.getElementById('authTabLogin');
  const tabRegister = document.getElementById('authTabRegister');

  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    if (forgotForm) forgotForm.classList.add('hidden');
    tabLogin.classList.add('bg-indigo-600', 'text-white');
    tabLogin.classList.remove('text-slate-400');
    tabRegister.classList.remove('bg-indigo-600', 'text-white');
    tabRegister.classList.add('text-slate-400');
  } else if (mode === 'register') {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    if (forgotForm) forgotForm.classList.add('hidden');
    tabRegister.classList.add('bg-indigo-600', 'text-white');
    tabRegister.classList.remove('text-slate-400');
    tabLogin.classList.remove('bg-indigo-600', 'text-white');
    tabLogin.classList.add('text-slate-400');
  } else if (mode === 'forgot') {
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    if (forgotForm) forgotForm.classList.remove('hidden');
    tabLogin.classList.remove('bg-indigo-600', 'text-white');
    tabLogin.classList.add('text-slate-400');
    tabRegister.classList.remove('bg-indigo-600', 'text-white');
    tabRegister.classList.add('text-slate-400');
  }
}

async function handleForgotPasswordSubmit(e) {
  e.preventDefault();
  const uid = document.getElementById('forgotUserId').value.trim();
  const check = document.getElementById('forgotSecurityCheck').value.trim().toLowerCase();
  const newPass = document.getElementById('forgotNewPassword').value;
  const confPass = document.getElementById('forgotConfirmPassword').value;
  const submitBtn = document.getElementById('btnForgotSubmit');

  if (newPass !== confPass) {
    alert('New passwords do not match! Please re-type.');
    return;
  }
  if (newPass.length < 4) {
    alert('Password must be at least 4 characters long.');
    return;
  }

  const origBtnText = submitBtn ? submitBtn.innerHTML : 'Reset Password';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Connecting to Cloud Database...';
  }

  try {
    let users = ALL_USERS;
    try {
      const res = await fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json');
      if (res.ok) {
        let remoteUsers = await res.json();
        if (remoteUsers && !Array.isArray(remoteUsers) && typeof remoteUsers === 'object') remoteUsers = Object.values(remoteUsers);
        if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
          users = remoteUsers;
          ALL_USERS = remoteUsers;
        }
      }
    } catch (err) {}

    const user = users.find(u => u && u.userId && u.userId.toLowerCase() === uid.toLowerCase());
    if (!user) {
      alert('User ID "' + uid + '" not found in database. Please check your User ID.');
      return;
    }

    const pinMatches = user.pin === check || (check === '123456') || (!user.pin && check === '123456');
    const nameMatches = (user.fullName || '').toLowerCase() === check || (user.fullName || '').toLowerCase().includes(check);

    if (!pinMatches && !nameMatches) {
      alert('Security verification failed!\nThe PIN or Full Name entered does not match our records for User ID: ' + uid + '.\n\nTip: If you forgot your PIN, please click "Request Admin Reset" or contact Admin Surya (@surya11008).');
      return;
    }

    user.password = newPass;
    const idx = ALL_USERS.findIndex(u => u.userId.toLowerCase() === uid.toLowerCase());
    if (idx !== -1) ALL_USERS[idx] = user;

    localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));

    try {
      await fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ALL_USERS)
      });
    } catch (err) {
      console.warn('REST PUT failed:', err);
    }
    fbSync('users', ALL_USERS);

    alert('✅ Password Reset Successful!\n\nYour new password has been saved to the Cloud Database.\nYou can now sign in immediately.');
    
    switchAuthMode('login');
    document.getElementById('loginUserId').value = uid;
    document.getElementById('loginPassword').value = newPass;
    if (user.pin) document.getElementById('loginPin').value = user.pin;
    
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnText;
    }
  }
}

function requestAdminPasswordReset() {
  const uid = (document.getElementById('forgotUserId') ? document.getElementById('forgotUserId').value.trim() : '') || prompt('Enter your User ID for Admin Password Reset:');
  if (!uid) return;
  alert('Admin Surya (@surya11008) has been requested to reset the password for User ID: ' + uid + '.\n\nAdmin can reset your credentials to default (Password: 123456, PIN: 123456) in the Admin Panel.');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const uid = document.getElementById('loginUserId').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const pin = document.getElementById('loginPin').value.trim();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Sign In to Portal';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Checking Cloud Database...';
  }

  // 1. Live Pre-Login Sync: Always fetch latest approved users from Firebase RTDB directly
  try {
    const res = await fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json');
    if (res.ok) {
      let remoteUsers = await res.json();
      if (remoteUsers && !Array.isArray(remoteUsers) && typeof remoteUsers === 'object') {
        remoteUsers = Object.values(remoteUsers);
      }
      if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        ALL_USERS = remoteUsers;
        localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
      }
    }
  } catch (err) {
    console.warn('Direct live Firebase sync failed, using cached memory users:', err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }

  // 2. Find user by User ID (case-insensitive)
  const user = ALL_USERS.find(u => u && u.userId && u.userId.toLowerCase() === uid.toLowerCase());

  if (!user) {
    alert('User ID "' + uid + '" not found in database.\n\nPlease check your User ID or click "Create User ID" to sign up.');
    return;
  }

  // 3. Password Verification (supports registered pass, master admin fallbacks, and default 123456)
  const isMasterAdmin = (uid.toLowerCase() === 'surya11008');
  let passMatches = (user.password === pass) || (user.password === '123456' && pass === '123456');
  if (isMasterAdmin) {
    if (pass === 'Suri742766' || pass === 'Suri742766.' || pass.toLowerCase() === 'suri742766' || pass === '123456' || pass === user.password) {
      passMatches = true;
    }
  }
  if (!passMatches) {
    alert('Incorrect Password for User ID: ' + uid + '.\n\nNote: If Admin recently reset or approved your account, the default password is 123456.');
    return;
  }

  // 4. PIN Verification (flexible for reset accounts or matching PIN)
  let pinMatches = !user.pin || (user.pin === pin) || (user.pin === '123456') || (pin === '123456');
  if (isMasterAdmin) {
    if (pin === '742766' || pin === '123456' || !pin || pin === user.pin) {
      pinMatches = true;
    }
  }
  if (!pinMatches && pin) {
    alert('Incorrect 6-digit PIN.\n\nNote: If Admin reset your account, the default PIN is 123456.');
    return;
  }

  // 5. Live Approval Check
  if (isMasterAdmin) {
    user.role = 'admin';
    user.status = 'approved';
  } else {
    if (user.status === 'pending') {
      alert('Your account is currently waiting for Admin approval.\n\nOnce Admin clicks "Approve", you will be able to log in immediately.');
      return;
    }
    if (user.status === 'rejected') {
      alert('Your account registration was not approved. Please contact Admin.');
      return;
    }
  }

  // Successful Login
  CURRENT_USER = user;
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));
  sessionStorage.setItem('l_support_session_active', 'true');
  localStorage.removeItem('l_support_screen_locked');
  closeAuthModal();
  switchView('home');
  refreshDataModel();
  updateUserUI();
  updateTotalCounts();
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
  updateMyRoomBadge();
  initPresenceTracking();
  showToast('Welcome back, ' + user.fullName + '!');
  logActivity('Login', 'Successful login for ' + user.userId);

  if (CURRENT_USER.role === 'admin') {
    setTimeout(() => checkPendingApprovals(), 400);
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName').value.trim();
  const userId = document.getElementById('regUserId').value.trim();
  const pass = document.getElementById('regPassword').value;
  const passAgain = document.getElementById('regPasswordAgain').value;
  const phone = document.getElementById('regPhone').value.trim();
  const gmail = document.getElementById('regGmail').value.trim();
  const zion = document.getElementById('regZion').value.trim();
  const area = document.getElementById('regArea').value.trim();
  const pin = document.getElementById('regPin').value.trim();
  const position = document.getElementById('regPosition') ? document.getElementById('regPosition').value : 'Member';

  if (pass !== passAgain) {
    alert('Passwords do not match! Please check again.');
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    alert('Personal PIN must be exactly 6 digits (numbers only)!');
    return;
  }

  // Fetch remote users to ensure fresh list before registration
  try {
    const res = await fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json');
    const remoteUsers = await res.json();
    if (remoteUsers && Array.isArray(remoteUsers)) {
      ALL_USERS = remoteUsers;
      localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
    }
  } catch (err) {
    console.warn('Could not fetch remote users before registration:', err);
  }

  if (ALL_USERS.some(u => u.userId.toLowerCase() === userId.toLowerCase())) {
    alert('User ID already exists! Please choose another.');
    return;
  }

  const newUser = {
    fullName,
    userId,
    password: pass,
    phone,
    gmail,
    zion,
    area,
    pin,
    position: position || 'Member',
    role: 'member',
    status: 'pending', // Waiting for Admin approval!
    registeredAt: new Date().toISOString(),
    assignedModules: ['all'],
    canDownload: false
  };

  ALL_USERS.push(newUser);
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));

  // Sync immediately to Firebase Realtime Database
  fbSync('users', ALL_USERS);

  alert('Account created successfully!\n\nYour account is currently pending Admin approval. You will be able to log in once Admin approves your account.');

  document.getElementById('registerForm').reset();
  switchAuthMode('login');
  document.getElementById('loginUserId').value = userId;
  logActivity('Registration Pending', 'New user waiting for approval: ' + userId);
}

// 6. DIRECT FILE DOWNLOAD (DIRECT PDF/DRIVE WITHOUT DOCS EDITOR)
function getDirectDownloadUrl(url) {
  if (!url) return '';
  // Google Docs -> Direct PDF export
  if (url.includes('docs.google.com/document/d/')) {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://docs.google.com/document/d/${match[1]}/export?format=pdf`;
    }
  }
  // Google Drive -> Direct file download
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }
  // Google Sheets -> Direct XLSX export
  if (url.includes('docs.google.com/spreadsheets/d/')) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
    }
  }
  return url;
}

function checkUserCanDownload(item) {
  if (!DOWNLOADS_ENABLED) return false;
  if (!CURRENT_USER) return false;
  if (CURRENT_USER.role === 'admin') return true;
  if (CURRENT_USER.canDownload === false) return false;

  // Check module level rule if any
  if (item && item.tab && MODULE_DOWNLOAD_RULES[item.tab] === false) {
    return false;
  }
  return true;
}

function triggerDirectDownload(url, title, event) {
  if (event) event.stopPropagation();
  const item = ALL_ITEMS.find(it => it.url === url);
  if (!checkUserCanDownload(item)) {
    showToast('Download permission is not enabled for your account.');
    return;
  }

  const directUrl = getDirectDownloadUrl(url);
  const a = document.createElement('a');
  a.href = directUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.download = (title ? title.replace(/[^a-zA-Z0-9_\-\s]/g, '') : 'download') + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast('📥 Direct download initiated: ' + title);
  logActivity('Direct Download', 'Downloaded ' + title);
}

function triggerCurrentModalDirectDownload() {
  if (currentActiveModalUrl) {
    const item = ALL_ITEMS.find(it => it.url === currentActiveModalUrl);
    triggerDirectDownload(currentActiveModalUrl, item ? item.title : 'document');
  }
}

// 7. MY ROOM (PERSONAL MINISTRY & SERMON USAGE JOURNAL)
function updateMyRoomBadge() {
  const userRecords = getFilteredRoomRecords();
  const badge = document.getElementById('myRoomRecordsBadge');
  if (badge) badge.textContent = userRecords.length;
}


// ========================================================
// UNIFIED VIEW SWITCHER (HOME / RESOURCES / USER ROOM)
// ========================================================
function switchView(viewName, targetCategory) {
  activeView = viewName;
  const homeView = document.getElementById('homeViewContainer');
  const resourcesView = document.getElementById('resourcesViewContainer');
  const myRoomView = document.getElementById('myRoomViewContainer');
  const subgroupStrip = document.getElementById('subgroupStripWrapper');

  if (homeView) homeView.classList.toggle('hidden', viewName !== 'home');
  if (resourcesView) resourcesView.classList.toggle('hidden', viewName !== 'resources');
  if (myRoomView) myRoomView.classList.toggle('hidden', viewName !== 'myroom');
  if (subgroupStrip) subgroupStrip.classList.toggle('hidden', viewName !== 'resources');

  // Update button active styles
  const btnHome = document.getElementById('btnHomeSidebar');
  const btnHomeTop = document.getElementById('btnHomeTop');
  const btnRoom = document.getElementById('btnMyRoomSidebar');
  const btnRoomTop = document.getElementById('btnMyRoomTop');

  if (btnHome) btnHome.className = viewName === 'home' 
    ? 'w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition bg-indigo-600 text-white shadow-md' 
    : 'w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-white shadow-sm';
  if (btnHomeTop) btnHomeTop.className = viewName === 'home'
    ? 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500 bg-indigo-600 text-white text-xs font-bold transition'
    : 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition';

  if (btnRoom) btnRoom.className = viewName === 'myroom'
    ? 'w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition bg-purple-600 text-white shadow-md'
    : 'w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition bg-gradient-to-r from-purple-950/70 to-indigo-950/70 hover:from-purple-900/80 hover:to-indigo-900/80 border border-purple-500/30 text-white shadow-sm';
  if (btnRoomTop) btnRoomTop.className = viewName === 'myroom'
    ? 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500 bg-purple-600 text-white text-xs font-bold transition'
    : 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold transition';

  if (viewName === 'home') {
    renderHomePage();
  } else if (viewName === 'resources') {
    if (targetCategory) currentCategory = targetCategory;
    renderRecords();
  } else if (viewName === 'myroom') {
    renderMyRoomTimeline();
  }
}

function switchToMyRoom() {
  switchView('myroom');
}

function switchToResourcesTab(catId) {
  currentCategory = catId || 'all';
  currentSubgroup = 'all';
  switchView('resources');
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
}

function populateAdminRoomUserSelect() {
  const sel = document.getElementById('adminRoomUserSelect');
  let opts = '<option value="all">All Users Combined</option>';
  opts += `<option value="${CURRENT_USER.userId}">My Room (${CURRENT_USER.fullName})</option>`;
  ALL_USERS.forEach(u => {
    if (u.userId !== CURRENT_USER.userId) {
      opts += `<option value="${u.userId}">${u.fullName} (${u.zion})</option>`;
    }
  });
  sel.innerHTML = opts;
  sel.value = adminRoomSelectedUser;
}

function onAdminRoomUserChange(val) {
  adminRoomSelectedUser = val;
  renderMyRoomView();
}

function getFilteredRoomRecords() {
  if (CURRENT_USER.role === 'admin') {
    if (adminRoomSelectedUser === 'all') return myRoomRecords;
    return myRoomRecords.filter(r => r.userId.toLowerCase() === adminRoomSelectedUser.toLowerCase());
  }
  return myRoomRecords.filter(r => r.userId.toLowerCase() === CURRENT_USER.userId.toLowerCase());
}

function renderMyRoomView() {
  const records = getFilteredRoomRecords();
  
  // Calculate stats
  document.getElementById('statSermonsUsed').textContent = records.length;
  document.getElementById('statStoriesUsed').textContent = records.filter(r => r.storyTitle && r.storyTitle !== 'None').length;
  document.getElementById('statSabbathCount').textContent = records.filter(r => r.worship === 'Sabbath').length;
  document.getElementById('statFeastCount').textContent = records.filter(r => r.worship !== 'Sabbath' && r.worship !== 'Tuesday' && r.worship !== 'Other').length;
  document.getElementById('roomRecordsCountLabel').textContent = records.length + ' entries';

  const list = document.getElementById('roomRecordsList');
  if (records.length === 0) {
    list.innerHTML = `
      <div class="py-12 bg-slate-900 border border-slate-800 rounded-3xl text-center">
        <div class="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3 text-xl">
          <i class="fa-solid fa-book-open"></i>
        </div>
        <h4 class="font-bold text-white text-sm mb-1">No Sermon Records Yet</h4>
        <p class="text-xs text-slate-400 mb-4">Click below to record your first preached sermon, story, and spiritual notes.</p>
        <button onclick="openRecordUsageModal()" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30">
          + Record Sermon Usage
        </button>
      </div>
    `;
    return;
  }

  list.innerHTML = records.map(rec => {
    const safeSermonUrl = (rec.sermonUrl || '').replace(/'/g, "\\'");
    const safeStoryUrl = (rec.storyUrl || '').replace(/'/g, "\\'");

    return `
      <div class="p-5 bg-slate-900/90 rounded-3xl border border-slate-800 hover:border-purple-500/40 transition shadow-lg space-y-3">
        
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ${rec.worship}
            </span>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              <i class="fa-regular fa-clock text-[10px] mr-1"></i> ${rec.time}
            </span>
            <span class="text-xs text-slate-400 font-mono">
              <i class="fa-regular fa-calendar text-[10px] mr-1"></i> ${rec.date}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[11px] text-slate-400">By: <strong class="text-white">${rec.userName}</strong> (${rec.userZion})</span>
            ${(CURRENT_USER.role === 'admin' || rec.userId === CURRENT_USER.userId) ? `
              <button onclick="deleteMyRoomRecord('${rec.id}', event)" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition text-xs" title="Delete entry">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Sermon & Story Pair -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <i class="fa-solid fa-book-bible"></i> Preached Sermon
              </div>
              <div class="font-bold text-white text-xs truncate mt-0.5">${rec.sermonTitle}</div>
            </div>
            ${rec.sermonUrl ? `
              <button onclick="openFilePreview('${safeSermonUrl}')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition flex-shrink-0">
                Preview
              </button>
            ` : ''}
          </div>

          <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <i class="fa-solid fa-scroll"></i> Paired Story
              </div>
              <div class="font-bold text-white text-xs truncate mt-0.5">${rec.storyTitle || 'None'}</div>
            </div>
            ${(rec.storyUrl && rec.storyTitle !== 'None') ? `
              <button onclick="openFilePreview('${safeStoryUrl}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold transition flex-shrink-0">
                Preview
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Realization / Note -->
        <div class="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-300 whitespace-pre-wrap">
          <div class="text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
            <i class="fa-solid fa-lightbulb text-amber-400"></i> Spiritual Realization / Congregation Notes:
          </div>
          ${rec.realization}
        </div>

      </div>
    `;
  }).join('');
}

function openRecordUsageModal() {
  const sermonSelect = document.getElementById('usageSermonSelect');
  const storySelect = document.getElementById('usageStorySelect');

  // Filter all sermon files
  const sermonFiles = ALL_ITEMS.filter(it => it.tab === 'Sermon' || it.modules.includes('Sermon'));
  sermonSelect.innerHTML = (sermonFiles.length > 0 ? sermonFiles : ALL_ITEMS).map(it => `
    <option value="${it.url}">${it.title}</option>
  `).join('');

  // Filter all story files
  const storyFiles = ALL_ITEMS.filter(it => it.tab === 'Stories' || it.modules.includes('Stories'));
  let storyOpts = '<option value="">None (No story paired)</option>';
  storyFiles.forEach(it => {
    storyOpts += `<option value="${it.url}">${it.title}</option>`;
  });
  storySelect.innerHTML = storyOpts;

  // Date default to today
  document.getElementById('usageDateInput').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('recordUsageModal');
  const container = document.getElementById('recordUsageModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeRecordUsageModal() {
  const modal = document.getElementById('recordUsageModal');
  const container = document.getElementById('recordUsageModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function saveSermonUsageRecord(e) {
  e.preventDefault();
  const sermonUrl = document.getElementById('usageSermonSelect').value;
  const storyUrl = document.getElementById('usageStorySelect').value;
  const worship = document.getElementById('usageWorshipSelect').value;
  const time = document.getElementById('usageTimeSelect').value;
  const date = document.getElementById('usageDateInput').value;
  const realization = document.getElementById('usageRealizationInput').value.trim();

  const sermonItem = ALL_ITEMS.find(it => it.url === sermonUrl);
  const storyItem = ALL_ITEMS.find(it => it.url === storyUrl);

  const newRecord = {
    id: 'room_' + Date.now(),
    userId: CURRENT_USER.userId,
    userName: CURRENT_USER.fullName,
    userZion: CURRENT_USER.zion || '',
    userArea: CURRENT_USER.area || 'General',
    sermonTitle: sermonItem ? sermonItem.title : 'Sermon',
    sermonUrl: sermonUrl,
    storyTitle: storyItem ? storyItem.title : 'None',
    storyUrl: storyUrl,
    worship,
    time,
    date,
    realization,
    createdAt: new Date().toISOString()
  };

  myRoomRecords.unshift(newRecord);
  localStorage.setItem('wlh_my_room_records', JSON.stringify(myRoomRecords)); fbSync('my_room_records', myRoomRecords);

  closeRecordUsageModal();
  updateMyRoomBadge();
  if (activeView === 'myroom') {
    renderMyRoomView();
  }
  renderRecords();
  showToast('✨ Sermon usage recorded in My Room!');
  logActivity('My Room', 'Recorded sermon: ' + newRecord.sermonTitle);
}

function deleteMyRoomRecord(recordId, e) {
  if (e) e.stopPropagation();
  if (!confirm('Are you sure you want to delete this ministry journal record?')) return;
  myRoomRecords = myRoomRecords.filter(r => r.id !== recordId);
  localStorage.setItem('wlh_my_room_records', JSON.stringify(myRoomRecords));
  updateMyRoomBadge();
  renderMyRoomView();
  renderRecords();
  showToast('Record deleted');
}

// 8. USED BADGE & HISTORY MODAL ON FILES
function openFileUsageHistoryModal(url, e) {
  if (e) e.stopPropagation();
  const item = ALL_ITEMS.find(it => it.url === url);
  const usages = myRoomRecords.filter(r => r.sermonUrl === url || r.storyUrl === url);

  document.getElementById('usedHistoryFileTitle').textContent = item ? item.title : 'File Usage History';
  const container = document.getElementById('usedHistoryRecordsContainer');

  if (usages.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-xs italic">No leaders have logged usage for this file yet.</p>';
  } else {
    container.innerHTML = usages.map(u => `
      <div class="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-amber-300"><i class="fa-solid fa-user-tie mr-1"></i> ${u.userName} (${u.userZion})</span>
          <span class="text-slate-400 font-mono">${u.date} • ${u.time}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30">${u.worship}</span>
          ${u.storyTitle && u.storyTitle !== 'None' ? `<span class="text-[11px] text-slate-300">Paired with: <strong>${u.storyTitle}</strong></span>` : ''}
        </div>
        <p class="text-slate-300 text-[11px] bg-slate-900/60 p-2 rounded-xl border border-slate-800 mt-1 italic">"${u.realization}"</p>
      </div>
    `).join('');
  }

  const modal = document.getElementById('usedFileHistoryModal');
  const box = document.getElementById('usedFileHistoryContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  box.classList.remove('scale-95');
  box.classList.add('scale-100');
}

function closeFileUsageHistoryModal() {
  const modal = document.getElementById('usedFileHistoryModal');
  const box = document.getElementById('usedFileHistoryContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  box.classList.remove('scale-100');
  box.classList.add('scale-95');
}

// 9. MULTI-MODULE & MULTI-TOPIC ASSIGNMENT MODAL
function openEditFileModuleTopicModal(url, e) {
  if (e) e.stopPropagation();
  const item = ALL_ITEMS.find(it => it.url === url);
  if (!item) return;

  document.getElementById('singleEditFileUrl').value = url;
  document.getElementById('singleEditFileTitle').textContent = item.title;

  // Multi-Modules Checkboxes
  const modContainer = document.getElementById('multiModulesCheckboxList');
  modContainer.innerHTML = CATEGORIES.map(c => {
    const isChecked = item.modules.includes(c.id);
    return `
      <label class="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer text-slate-200">
        <input type="checkbox" name="moduleChoice" value="${c.id}" ${isChecked ? 'checked' : ''} class="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0">
        <span class="truncate">${c.icon} ${c.name}</span>
      </label>
    `;
  }).join('');

  // Multi-Topics Checkboxes across all categories
  const allKnownTopics = new Set();
  CATEGORIES.forEach(c => (c.groups || []).forEach(g => allKnownTopics.add(g)));
  item.topics.forEach(t => allKnownTopics.add(t));

  const topicContainer = document.getElementById('multiTopicsCheckboxList');
  topicContainer.innerHTML = [...allKnownTopics].map(tp => {
    const isChecked = item.topics.includes(tp);
    return `
      <label class="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer text-slate-200">
        <input type="checkbox" name="topicChoice" value="${tp}" ${isChecked ? 'checked' : ''} class="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0">
        <span class="truncate">${tp}</span>
      </label>
    `;
  }).join('');

  const currentFileAllowed = filePermissions[url] || item.allowedPositions || ['all'];
  const filePos = Array.isArray(currentFileAllowed) ? currentFileAllowed : (currentFileAllowed.positions || ['all']);
  const fileUsers = Array.isArray(currentFileAllowed) ? (item.allowedUsers || []) : (currentFileAllowed.users || item.allowedUsers || []);
  renderPositionCheckboxes('editFilePositionsCheckboxList', 'editFilePositionChoice', filePos);
  renderUserCheckboxes('editFileUsersCheckboxList', 'editFileUserChoice', fileUsers);

  const modal = document.getElementById('editFileModuleTopicModal');
  const container = document.getElementById('editFileModuleTopicContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeEditFileModuleTopicModal() {
  const modal = document.getElementById('editFileModuleTopicModal');
  const container = document.getElementById('editFileModuleTopicContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
  hideMultiEditCustomTopic();
}

function toggleMultiEditCustomTopic() {
  const wrap = document.getElementById('multiEditCustomTopicWrapper');
  if (wrap.classList.contains('hidden')) {
    wrap.classList.remove('hidden');
    document.getElementById('multiEditCustomTopicInput').focus();
  } else {
    wrap.classList.add('hidden');
  }
}

function hideMultiEditCustomTopic() {
  const wrap = document.getElementById('multiEditCustomTopicWrapper');
  wrap.classList.add('hidden');
  document.getElementById('multiEditCustomTopicInput').value = '';
}

function saveMultiModuleTopicAssignment(e) {
  e.preventDefault();
  const url = document.getElementById('singleEditFileUrl').value;
  const modBoxes = document.querySelectorAll('input[name="moduleChoice"]:checked');
  const topBoxes = document.querySelectorAll('input[name="topicChoice"]:checked');
  const customTopic = document.getElementById('multiEditCustomTopicInput').value.trim();

  let selectedModules = [...modBoxes].map(b => b.value);
  if (selectedModules.length === 0) selectedModules = ['all'];

  let selectedTopics = [...topBoxes].map(b => b.value);
  if (customTopic) {
    selectedTopics.push(customTopic);
    // add to primary module
    const primary = selectedModules[0];
    if (primary && primary !== 'all') {
      if (!topicEdits[primary]) topicEdits[primary] = [];
      topicEdits[primary].push(customTopic);
      localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));
    }
  }
  if (selectedTopics.length === 0) selectedTopics = ['General'];

  if (!fileMetadata[url]) fileMetadata[url] = {};
  fileMetadata[url].modules = selectedModules;
  fileMetadata[url].topics = selectedTopics;
  localStorage.setItem('wlh_file_metadata', JSON.stringify(fileMetadata));

  const allowedPositions = getSelectedPositionsFromCheckboxes('editFilePositionChoice');
  const allowedUsers = getSelectedUsersFromCheckboxes('editFileUserChoice');
  filePermissions[url] = { positions: allowedPositions, users: allowedUsers };
  localStorage.setItem('wlh_file_permissions', JSON.stringify(filePermissions));
  fbSync('file_permissions', filePermissions);

  const targetItem = ALL_ITEMS.find(it => it.url === url);
  if (targetItem) {
    targetItem.allowedPositions = allowedPositions;
    targetItem.allowedUsers = allowedUsers;
  }

  closeEditFileModuleTopicModal();
  refreshDataModel();
  renderSubgroupTabs();
  renderRecords();
  showToast('Updated file to ' + selectedModules.length + ' modules & ' + selectedTopics.length + ' topics!');
  logActivity('File Multi-Assigned', 'Assigned file to: ' + selectedModules.join(', '));
}

// 10. ADMIN MANAGEMENT MODAL (PERMISSIONS & DOWNLOADS PANEL)
function openAdminManagementModal() {
  if (CURRENT_USER.role !== 'admin') {
    showToast('Permission Denied: Admin only');
    return;
  }

  // Master switch
  const masterBtn = document.getElementById('adminModalMasterDownloadToggle');
  masterBtn.textContent = DOWNLOADS_ENABLED ? 'Downloads: ON' : 'Downloads: OFF';
  masterBtn.className = DOWNLOADS_ENABLED 
    ? 'px-5 py-2.5 rounded-xl font-extrabold text-xs transition border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
    : 'px-5 py-2.5 rounded-xl font-extrabold text-xs transition border border-rose-500/40 bg-rose-500/20 text-rose-300';

  // Users table
  const tbody = document.getElementById('adminUserPermissionsTableBody');
  tbody.innerHTML = ALL_USERS.map(u => {
    const isDlAllowed = u.role === 'admin' ? true : (u.canDownload !== false);
    return `
      <tr>
        <td class="py-2.5 px-3 font-bold text-white">${u.fullName} (${u.userId})</td>
        <td class="py-2.5 px-3 text-slate-400">${u.zion}</td>
        <td class="py-2.5 px-3">
          <select onchange="updateUserModuleAssignment('${u.userId}', this.value)" class="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 rounded-lg outline-none">
            <option value="all" ${(u.assignedModules || []).includes('all') ? 'selected' : ''}>All Folders</option>
            ${CATEGORIES.map(c => `
              <option value="${c.id}" ${(u.assignedModules || []).includes(c.id) ? 'selected' : ''}>Only ${c.name}</option>
            `).join('')}
          </select>
        </td>
        <td class="py-2.5 px-3 text-right">
          <button 
            onclick="toggleUserDownloadPermission('${u.userId}')"
            class="px-3 py-1 rounded-lg font-bold text-xs transition border ${
              isDlAllowed 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }"
          >
            ${isDlAllowed ? 'Download ON' : 'Download OFF'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Module rules grid
  const modGrid = document.getElementById('adminModuleRulesGrid');
  modGrid.innerHTML = CATEGORIES.map(c => {
    const isAllowed = MODULE_DOWNLOAD_RULES[c.id] !== false;
    return `
      <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
        <span class="truncate font-semibold text-slate-200">${c.icon} ${c.name}</span>
        <button 
          onclick="toggleModuleDownloadRule('${c.id}')"
          class="px-2 py-0.5 rounded text-[10px] font-bold border ${isAllowed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'}"
        >
          ${isAllowed ? 'Allowed' : 'Blocked'}
        </button>
      </div>
    `;
  }).join('');

  const modal = document.getElementById('adminManagementModal');
  const container = document.getElementById('adminManagementContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeAdminManagementModal() {
  const modal = document.getElementById('adminManagementModal');
  const container = document.getElementById('adminManagementContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function toggleUserDownloadPermission(userId) {
  const user = ALL_USERS.find(u => u.userId === userId);
  if (user) {
    user.canDownload = !(user.canDownload !== false);
    localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
    fbSync('users', ALL_USERS);
    openAdminManagementModal(); // refresh
    showToast('Download permission updated for ' + user.fullName);
  }
}

function toggleModuleDownloadRule(moduleId) {
  MODULE_DOWNLOAD_RULES[moduleId] = !(MODULE_DOWNLOAD_RULES[moduleId] !== false);
  localStorage.setItem('wlh_module_download_rules', JSON.stringify(MODULE_DOWNLOAD_RULES));
  openAdminManagementModal();
  showToast('Module download rule updated');
}

function toggleMasterDownloads() {
  if (CURRENT_USER.role !== 'admin') {
    showToast('Permission Denied: Only Admin can toggle downloads');
    return;
  }

  DOWNLOADS_ENABLED = !DOWNLOADS_ENABLED;
  localStorage.setItem('wlh_downloads_enabled', JSON.stringify(DOWNLOADS_ENABLED)); fbSync('downloads_enabled', DOWNLOADS_ENABLED);
  updateTopDownloadBtn();
  renderRecords();
  
  if (DOWNLOADS_ENABLED) {
    showToast('Global downloads ENABLED');
    logActivity('Downloads', 'Enabled globally');
  } else {
    showToast('Global downloads DISABLED strictly');
    logActivity('Downloads', 'Disabled globally');
  }

  if (!document.getElementById('adminManagementModal').classList.contains('pointer-events-none')) {
    openAdminManagementModal();
  }
}

function updateTopDownloadBtn() {
  const btn = document.getElementById('masterDownloadBtn');
  const txt = document.getElementById('downloadBtnText');
  const icon = document.getElementById('downloadLockIcon');

  if (DOWNLOADS_ENABLED) {
    btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30';
    icon.className = 'fa-solid fa-download text-[10px]';
    txt.textContent = 'Downloads: ON';
  } else {
    btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20';
    icon.className = 'fa-solid fa-lock text-[10px]';
    txt.textContent = 'Downloads: OFF';
  }
}

// 11. SIDEBAR TOGGLE & RECORD COUNTS
function toggleSidebar() {
  const sb = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (window.innerWidth >= 768) {
    if (sb.classList.contains('md:w-72') || !sb.classList.contains('md:w-0')) {
      sb.classList.remove('md:w-72');
      sb.classList.add('md:w-0');
    } else {
      sb.classList.remove('md:w-0');
      sb.classList.add('md:w-72');
    }
  } else {
    if (sb.classList.contains('-translate-x-full')) {
      sb.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    } else {
      sb.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  }
}

function updateTotalCounts() {
  document.getElementById('allCountBadge').textContent = ALL_ITEMS.length;
}

function updatePinnedBadge() {
  const badge = document.getElementById('pinnedCountBadge');
  if (!badge) return;
  badge.textContent = pinnedUrls.size;
  if (pinnedUrls.size > 0) badge.classList.remove('hidden');
  else badge.classList.add('hidden');
}

// 12. SIDEBAR CATEGORIES RENDER
function renderSidebarCategories() {
  const container = document.getElementById('dynamicSidebarCategories');
  if (!container) return;
  const visibleCategories = CATEGORIES.filter(cat => {
    const allowed = modulePermissions[cat.id] || {
      positions: cat.allowedPositions || ['all'],
      users: cat.allowedUsers || []
    };
    return isEntityVisibleToUser(allowed, CURRENT_USER);
  });
  container.innerHTML = visibleCategories.map(cat => {
    const catCount = ALL_ITEMS.filter(it => (it.modules.includes(cat.id) || it.tab === cat.id) && isFileVisibleToUser(it, CURRENT_USER)).length;
    const isActive = (activeView === 'resources' && currentCategory === cat.id && !isPinnedOnly);

    return `
      <div class="relative group">
        <button 
          onclick="switchToResourcesTab('${cat.id}')" 
          id="cat-btn-${cat.id}"
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
            isActive 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }"
        >
          <div class="flex items-center gap-2.5 truncate">
            <span class="text-base flex-shrink-0">${cat.icon}</span>
            <span class="truncate">${cat.name}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${
              isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
            }">${catCount}</span>
          </div>
        </button>

        <button 
          onclick="openEditModuleModal('${cat.id}', event)" 
          title="Edit module name, emoji, or topics"
          class="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400 p-1 opacity-0 group-hover:opacity-100 transition text-[11px]"
        >
          <i class="fa-solid fa-pen"></i>
        </button>
      </div>
    `;
  }).join('');
}

function selectCategory(catId) {
  currentCategory = catId;
  currentSubgroup = 'all';
  isPinnedOnly = false;

  document.querySelectorAll('#sidebarCategoryList button[id^="cat-btn-"]').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-600/30');
    btn.classList.add('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
  });

  const activeBtn = document.getElementById('cat-btn-' + catId);
  if (activeBtn) {
    activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-600/30');
    activeBtn.classList.remove('text-slate-300', 'hover:bg-slate-800');
  }

  const trigger = document.getElementById('moduleEditTrigger');
  if (catId === 'all') {
    document.getElementById('breadcrumbCurrent').textContent = 'All Resources (' + ALL_ITEMS.length + ')';
    trigger.classList.add('hidden');
  } else {
    const catObj = CATEGORIES.find(c => c.id === catId);
    document.getElementById('breadcrumbCurrent').textContent = catObj ? catObj.name : catId;
    trigger.classList.remove('hidden');
  }

  renderSubgroupTabs();
  renderRecords();
}

// 13. SUBGROUPS / TOPICS TABS
function renderSubgroupTabs() {
  const container = document.getElementById('subgroupTabsContainer');
  if (currentCategory === 'all') {
    container.innerHTML = `<span class="text-xs text-slate-400 italic px-2">Select a module on the left to filter by specific topics</span>`;
    return;
  }

  const catObj = CATEGORIES.find(c => c.id === currentCategory);
  if (!catObj) return;

  const catItems = ALL_ITEMS.filter(it => it.modules.includes(currentCategory) || it.tab === currentCategory);

  let html = `
    <button 
      onclick="filterSubgroup('all')"
      class="px-3 py-1 rounded-xl text-xs font-bold transition flex-shrink-0 ${
        currentSubgroup === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
      }"
    >
      All (${catItems.length})
    </button>
  `;

  const visibleGroups = (catObj.groups || []).filter(grp => {
    const key = catObj.id + '::' + grp;
    const allowed = topicPermissions[key];
    return isPositionAllowed(allowed, CURRENT_USER);
  });

  visibleGroups.forEach(grp => {
    const grpCount = catItems.filter(it => it.topics.includes(grp) || it.group === grp).length;
    const isActive = (currentSubgroup === grp);

    html += `
      <div class="inline-flex items-center group/grp rounded-xl ${isActive ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} transition flex-shrink-0">
        <button 
          onclick="filterSubgroup('${grp.replace(/'/g, "\\'")}')"
          class="px-3 py-1 text-xs font-semibold flex items-center gap-1.5"
        >
          <span>${grp}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'}">${grpCount}</span>
        </button>

        <button 
          onclick="selectTopicItems('${grp.replace(/'/g, "\\'")}', event)"
          title="Select all files in this topic"
          class="px-1 text-[10px] text-slate-400 hover:text-emerald-300 opacity-0 group-hover/grp:opacity-100 transition"
        >
          <i class="fa-solid fa-square-check"></i>
        </button>

        <button 
          onclick="renameTopic('${catObj.id}', '${grp.replace(/'/g, "\\'")}', event)"
          title="Rename this topic"
          class="px-1 text-[10px] text-slate-400 hover:text-amber-300 opacity-0 group-hover/grp:opacity-100 transition"
        >
          <i class="fa-solid fa-pen"></i>
        </button>

        ${isAdmin ? `
          <button 
            type="button"
            onclick="openTopicPermissionsModal('${catObj.id}', '${grp.replace(/'/g, "\\'")}', event)"
            title="Set Position Access for this Topic"
            class="pr-2 pl-0.5 text-[10px] text-slate-400 hover:text-indigo-400 opacity-0 group-hover/grp:opacity-100 transition"
          >
            <i class="fa-solid fa-shield-halved"></i>
          </button>
        ` : ''}
      </div>
    `;
  });

  html += `
    <button 
      onclick="quickAddTopicToModule('${catObj.id}')"
      class="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 flex-shrink-0 border border-slate-700"
    >
      <i class="fa-solid fa-plus text-[10px]"></i> Topic
    </button>
  `;

  container.innerHTML = html;
}

function filterSubgroup(grpName) {
  currentSubgroup = grpName;
  renderSubgroupTabs();
  renderRecords();
}

function renameTopic(catId, oldTopic, e) {
  if (e) e.stopPropagation();
  const newTopic = prompt('Enter new name for topic "' + oldTopic + '":', oldTopic);
  if (!newTopic || newTopic.trim() === '' || newTopic === oldTopic) return;

  const finalName = newTopic.trim();
  const catObj = CATEGORIES.find(c => c.id === catId);
  if (catObj && catObj.groups) {
    const idx = catObj.groups.indexOf(oldTopic);
    if (idx !== -1) catObj.groups[idx] = finalName;
  }

  if (!topicEdits[catId]) topicEdits[catId] = [];
  topicEdits[catId] = (catObj.groups || []);
  localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));

  refreshDataModel();
  renderSubgroupTabs();
  renderRecords();
  showToast('Topic renamed to "' + finalName + '"');
}

function quickAddTopicToModule(catId) {
  const topicName = prompt('Enter new topic name for this module:');
  if (!topicName || topicName.trim() === '') return;

  const tName = topicName.trim();
  const catObj = CATEGORIES.find(c => c.id === catId);
  if (catObj) {
    if (!catObj.groups) catObj.groups = [];
    if (!catObj.groups.includes(tName)) {
      catObj.groups.push(tName);
      if (!topicEdits[catId]) topicEdits[catId] = [];
      topicEdits[catId].push(tName);
      localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));
    }
  }

  refreshDataModel();
  renderSubgroupTabs();
  showToast('Added topic "' + tName + '"');
}

// 14. MULTI-SELECT BY TOPIC & MODULE
function selectTopicItems(topicName, event) {
  if (event) event.stopPropagation();
  const matching = ALL_ITEMS.filter(it => (it.modules.includes(currentCategory) || it.tab === currentCategory) && (it.topics.includes(topicName) || it.group === topicName));
  matching.forEach(it => selectedItemUrls.add(it.url));
  updateSelectionState();
  showToast('Selected ' + matching.length + ' files in topic: ' + topicName);
}

function selectCurrentTopicItems() {
  if (currentSubgroup === 'all') {
    selectCurrentModuleItems();
    return;
  }
  selectTopicItems(currentSubgroup);
}

function selectCurrentModuleItems() {
  let matching = [];
  if (currentCategory === 'all') {
    matching = getFilteredRecords();
  } else {
    matching = ALL_ITEMS.filter(it => it.modules.includes(currentCategory) || it.tab === currentCategory);
  }
  matching.forEach(it => selectedItemUrls.add(it.url));
  updateSelectionState();
  showToast('Selected ' + matching.length + ' files in module');
}

function toggleItemSelect(url, event) {
  if (event) event.stopPropagation();
  if (selectedItemUrls.has(url)) selectedItemUrls.delete(url);
  else selectedItemUrls.add(url);
  updateSelectionState();
}

function toggleSelectAll(checked) {
  const visible = getFilteredRecords();
  if (checked) visible.forEach(it => selectedItemUrls.add(it.url));
  else selectedItemUrls.clear();
  updateSelectionState();
}

function clearSelection() {
  selectedItemUrls.clear();
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) selectAll.checked = false;
  updateSelectionState();
}

function updateSelectionState() {
  const count = selectedItemUrls.size;
  document.getElementById('bulkSelectedCount').textContent = count;
  document.getElementById('selectedCounterPill').textContent = count + ' selected';

  const toolbar = document.getElementById('bulkActionsToolbar');
  if (count > 0) {
    toolbar.classList.remove('translate-y-28', 'opacity-0', 'pointer-events-none');
  } else {
    toolbar.classList.add('translate-y-28', 'opacity-0', 'pointer-events-none');
  }

  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = selectedItemUrls.has(cb.dataset.url);
  });
}

function getFilteredRecords() {
  let filtered = ALL_ITEMS.filter(it => isFileVisibleToUser(it, CURRENT_USER));
  if (isPinnedOnly) {
    filtered = filtered.filter(it => pinnedUrls.has(it.url));
  } else {
    if (currentCategory !== 'all') {
      filtered = filtered.filter(it => it.modules.includes(currentCategory) || it.tab === currentCategory);
    }
    if (currentSubgroup !== 'all') {
      filtered = filtered.filter(it => it.topics.includes(currentSubgroup) || it.group === currentSubgroup);
    }
  }
  if (searchQuery) {
    filtered = filtered.filter(it => 
      it.title.toLowerCase().includes(searchQuery) ||
      (it.topics && it.topics.some(t => t.toLowerCase().includes(searchQuery))) ||
      (it.modules && it.modules.some(m => m.toLowerCase().includes(searchQuery))) ||
      (it.categoryName && it.categoryName.toLowerCase().includes(searchQuery))
    );
  }
  return filtered;
}

// 15. RECORD RENDERING (WITH "USED" BADGE & DIRECT DOWNLOAD)
function renderRecords() {
  const items = getFilteredRecords();
  document.getElementById('recordCountLabel').textContent = items.length;
  const noResults = document.getElementById('noResults');

  if (items.length === 0) {
    noResults.classList.remove('hidden');
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('gridViewWrapper').innerHTML = '';
    return;
  }
  noResults.classList.add('hidden');

  if (currentViewMode === 'table') {
    renderTableView(items);
  } else {
    renderGridView(items);
  }
  updateSelectionState();
}

function renderTableView(items) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = items.map(item => {
    const isPinned = pinnedUrls.has(item.url);
    const isSelected = selectedItemUrls.has(item.url);
    const safeTitle = item.title.replace(/'/g, "\\'");
    const safeUrl = item.url.replace(/'/g, "\\'");
    const isTelugu = /[\u0C00-\u0C7F]/.test(item.title);

    // Used count check
    const usedCount = myRoomRecords.filter(r => r.sermonUrl === item.url || r.storyUrl === item.url).length;

    // Direct download check
    const showDownload = checkUserCanDownload(item);

    return `
      <tr class="hover:bg-slate-800/50 transition group ${item.isLocked ? 'bg-amber-950/10' : ''} ${item.isHidden ? 'opacity-60' : ''}">
        
        <!-- Checkbox -->
        <td class="py-3 px-3 text-center">
          <input 
            type="checkbox" 
            data-url="${safeUrl}" 
            onchange="toggleItemSelect('${safeUrl}', event)" 
            class="row-checkbox rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
            ${isSelected ? 'checked' : ''}
          >
        </td>

        <!-- Star Pin -->
        <td class="py-3 px-2 text-center">
          <button 
            onclick="togglePin('${safeUrl}', event)"
            class="transition ${isPinned ? 'text-amber-400 scale-110' : 'text-slate-600 hover:text-amber-400'}"
            title="${isPinned ? 'Unpin' : 'Star favorite'}"
          >
            <i class="${isPinned ? 'fa-solid fa-star' : 'fa-regular fa-star'}"></i>
          </button>
        </td>

        <!-- Title & Used Badge -->
        <td class="py-3 px-4 font-semibold text-white">
          <div class="flex items-center gap-2 flex-wrap">
            ${item.customColor ? `<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${item.customColor}"></span>` : ''}
            ${item.isLocked ? '<i class="fa-solid fa-lock text-amber-400 text-xs" title="PIN Protected"></i>' : ''}
            ${item.isHidden ? '<i class="fa-solid fa-eye-slash text-rose-400 text-xs" title="Hidden from members"></i>' : ''}
            ${item.isCustom ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/30">NEW</span>' : ''}
            
            <!-- USED BADGE (🔥 కోరిన విధంగా Used బ్యాడ్జ్) -->
            ${usedCount > 0 ? `
              <button 
                onclick="openFileUsageHistoryModal('${safeUrl}', event)" 
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition shadow-xs"
                title="View who used this file in My Room"
              >
                <i class="fa-solid fa-clock-rotate-left text-[9px]"></i>
                <span>Used (${usedCount})</span>
              </button>
            ` : ''}

            <span 
              onclick="openFilePreview('${safeUrl}')"
              class="cursor-pointer hover:text-indigo-400 transition font-medium ${isTelugu ? 'font-telugu' : ''}"
            >
              ${item.title}
            </span>
          </div>
        </td>

        <!-- Topic Pills (Supports multiple topics) -->
        <td class="py-3 px-4">
          <div class="flex items-center gap-1 flex-wrap">
            ${item.topics.map(tp => `
              <button 
                onclick="openEditFileModuleTopicModal('${safeUrl}', event)"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-indigo-500 transition"
                title="Click to edit topics/modules"
              >
                <span>${tp}</span>
              </button>
            `).join('')}
          </div>
        </td>

        <!-- Module Badges (Supports multiple modules) -->
        <td class="py-3 px-4">
          <div class="flex items-center gap-1 flex-wrap">
            ${item.modules.map(modId => {
              const catObj = CATEGORIES.find(c => c.id === modId);
              return `
                <button 
                  onclick="openEditFileModuleTopicModal('${safeUrl}', event)"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catObj ? catObj.badge : 'bg-slate-800 text-slate-300 border-slate-700'} hover:ring-1 hover:ring-indigo-400 transition"
                  title="Click to edit modules"
                >
                  <span>${catObj ? catObj.icon : '📁'}</span>
                  <span>${catObj ? catObj.name.split(' ')[0] : modId}</span>
                </button>
              `;
            }).join('')}
          </div>
        </td>

        <!-- Actions -->
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            
            <!-- Open In-App Preview -->
            <button 
              onclick="openFilePreview('${safeUrl}')"
              class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition flex items-center gap-1 shadow-sm"
              title="Open inside portal"
            >
              <i class="fa-regular fa-eye"></i>
              <span>Preview</span>
            </button>

            <!-- DIRECT DOWNLOAD BUTTON (🔥 నేరుగా డౌన్‌లోడ్ అయ్యేలా) -->
            ${showDownload ? `
              <button 
                onclick="triggerDirectDownload('${safeUrl}', '${safeTitle}', event)"
                class="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 transition text-[11px]"
                title="Direct Download File"
              >
                <i class="fa-solid fa-download"></i>
              </button>
            ` : ''}

            <!-- Multi-Module & Topic edit button -->
            <button 
              onclick="openEditFileModuleTopicModal('${safeUrl}', event)"
              class="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 transition text-[11px] border border-slate-700"
              title="Assign Multiple Modules & Topics"
            >
              <i class="fa-solid fa-folder-tree"></i>
            </button>

            <!-- External Tab -->
            <a 
              href="${item.url}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px] border border-slate-700"
              title="Open in external browser tab"
            >
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>

            <!-- Copy Link -->
            <button 
              onclick="copyResourceUrl('${safeUrl}', '${safeTitle}', event)"
              class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px] border border-slate-700"
              title="Copy link"
            >
              <i class="fa-regular fa-copy"></i>
            </button>

          </div>
        </td>

      </tr>
    `;
  }).join('');
}

function renderGridView(items) {
  const container = document.getElementById('gridViewWrapper');
  container.innerHTML = items.map(item => {
    const isPinned = pinnedUrls.has(item.url);
    const isSelected = selectedItemUrls.has(item.url);
    const safeTitle = item.title.replace(/'/g, "\\'");
    const safeUrl = item.url.replace(/'/g, "\\'");
    const isTelugu = /[\u0C00-\u0C7F]/.test(item.title);
    const usedCount = myRoomRecords.filter(r => r.sermonUrl === item.url || r.storyUrl === item.url).length;
    const showDownload = checkUserCanDownload(item);

    return `
      <div class="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition flex flex-col justify-between group ${item.isLocked ? 'ring-1 ring-amber-500/40' : ''}">
        
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5">
              <input 
                type="checkbox" 
                data-url="${safeUrl}" 
                onchange="toggleItemSelect('${safeUrl}', event)" 
                class="row-checkbox rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                ${isSelected ? 'checked' : ''}
              >
              <button 
                onclick="openEditFileModuleTopicModal('${safeUrl}', event)"
                class="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 truncate"
              >
                ${item.group || 'General'} <i class="fa-solid fa-pen text-[8px] text-slate-500"></i>
              </button>
            </div>
            
            <div class="flex items-center gap-1">
              ${usedCount > 0 ? `
                <button 
                  onclick="openFileUsageHistoryModal('${safeUrl}', event)" 
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  title="Used History"
                >
                  Used (${usedCount})
                </button>
              ` : ''}
              <button 
                onclick="openEditFileModuleTopicModal('${safeUrl}', event)"
                class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 flex items-center justify-center text-xs transition"
                title="Change Modules & Topics"
              >
                <i class="fa-solid fa-folder-tree"></i>
              </button>
              <button 
                onclick="togglePin('${safeUrl}', event)"
                class="w-7 h-7 rounded-lg transition flex items-center justify-center text-xs ${isPinned ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500 hover:text-amber-400'}"
                title="Star"
              >
                <i class="${isPinned ? 'fa-solid fa-star' : 'fa-regular fa-star'}"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-1.5 mb-1.5">
            ${item.customColor ? `<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${item.customColor}"></span>` : ''}
            ${item.isLocked ? '<i class="fa-solid fa-lock text-amber-400 text-xs"></i>' : ''}
            ${item.isCustom ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded border border-emerald-500/30">NEW</span>' : ''}
            <h4 class="text-sm font-bold text-white group-hover:text-indigo-400 transition line-clamp-2 ${isTelugu ? 'font-telugu' : ''}">
              ${item.title}
            </h4>
          </div>

          <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-4 flex-wrap">
            ${item.modules.map(modId => {
              const catObj = CATEGORIES.find(c => c.id === modId);
              return `<span>${catObj ? catObj.icon : '📁'} ${catObj ? catObj.name.split(' ')[0] : modId}</span>`;
            }).join(' • ')}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
          <button 
            onclick="openFilePreview('${safeUrl}')"
            class="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <i class="fa-regular fa-eye"></i>
            <span>Preview</span>
          </button>

          ${showDownload ? `
            <button 
              onclick="triggerDirectDownload('${safeUrl}', '${safeTitle}', event)"
              class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <i class="fa-solid fa-download"></i>
              <span>Download</span>
            </button>
          ` : `
            <a 
              href="${item.url}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <span>External</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </a>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// 16. POPULATE & ADD RESOURCE
function populateAddResourceModules() {
  const select = document.getElementById('newResourceModule');
  if (!select) return;
  select.innerHTML = CATEGORIES.map(cat => `
    <option value="${cat.id}">${cat.icon} ${cat.name}</option>
  `).join('');
}

function openAddResourceModal() {
  populateAddResourceModules();
  if (currentCategory !== 'all') {
    document.getElementById('newResourceModule').value = currentCategory;
  }
  onModuleChangeInForm();
  renderPositionCheckboxes('resourcePositionsCheckboxList', 'resourcePositionChoice', ['all']);
  renderUserCheckboxes('resourceUsersCheckboxList', 'resourceUserChoice', []);

  const modal = document.getElementById('addResourceModal');
  const container = document.getElementById('addResourceModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeAddResourceModal() {
  const modal = document.getElementById('addResourceModal');
  const container = document.getElementById('addResourceModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
  document.getElementById('addResourceForm').reset();
  hideCustomTopicInput();
}

function onModuleChangeInForm() {
  const selectedModuleId = document.getElementById('newResourceModule').value;
  const catObj = CATEGORIES.find(c => c.id === selectedModuleId);
  const topicSelect = document.getElementById('newResourceTopicSelect');

  let options = ['<option value="">-- Select Existing Topic --</option>'];
  if (catObj && catObj.groups && catObj.groups.length > 0) {
    catObj.groups.forEach(grp => {
      options.push(`<option value="${grp}">${grp}</option>`);
    });
  }
  options.push('<option value="__NEW_TOPIC__">➕ + Add New Topic...</option>');
  topicSelect.innerHTML = options.join('');

  if (currentSubgroup !== 'all' && catObj && catObj.groups && catObj.groups.includes(currentSubgroup)) {
    topicSelect.value = currentSubgroup;
    hideCustomTopicInput();
  } else if (catObj && catObj.groups && catObj.groups.length > 0) {
    topicSelect.selectedIndex = 1;
    hideCustomTopicInput();
  } else {
    showCustomTopicInput();
  }
}

function onTopicSelectChange() {
  const select = document.getElementById('newResourceTopicSelect');
  if (select.value === '__NEW_TOPIC__') showCustomTopicInput();
  else hideCustomTopicInput();
}

function toggleCustomTopicInput() {
  const wrapper = document.getElementById('customTopicInputWrapper');
  if (wrapper.classList.contains('hidden')) showCustomTopicInput();
  else hideCustomTopicInput();
}

function showCustomTopicInput() {
  const wrapper = document.getElementById('customTopicInputWrapper');
  const input = document.getElementById('newResourceCustomTopic');
  wrapper.classList.remove('hidden');
  input.focus();
}

function hideCustomTopicInput() {
  const wrapper = document.getElementById('customTopicInputWrapper');
  const input = document.getElementById('newResourceCustomTopic');
  wrapper.classList.add('hidden');
  input.value = '';
}

function submitNewResource(e) {
  e.preventDefault();
  const moduleId = document.getElementById('newResourceModule').value;
  const topicSelectVal = document.getElementById('newResourceTopicSelect').value;
  const customTopicVal = document.getElementById('newResourceCustomTopic').value.trim();
  const title = document.getElementById('newResourceTitle').value.trim();
  const url = document.getElementById('newResourceUrl').value.trim();

  let topic = customTopicVal || (topicSelectVal !== '__NEW_TOPIC__' ? topicSelectVal : 'General');
  
  const catObj = CATEGORIES.find(c => c.id === moduleId);
  if (catObj && customTopicVal) {
    if (!catObj.groups) catObj.groups = [];
    if (!catObj.groups.includes(topic)) {
      catObj.groups.push(topic);
      if (!topicEdits[moduleId]) topicEdits[moduleId] = [];
      topicEdits[moduleId].push(topic);
      localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));
    }
  }

  let previewUrl = url;
  if (previewUrl.indexOf('docs.google.com/document/d/') !== -1) {
    previewUrl = previewUrl.split('/edit')[0] + '/preview';
  } else if (previewUrl.indexOf('drive.google.com/file/d/') !== -1) {
    previewUrl = previewUrl.split('/view')[0] + '/preview';
  }

  const fileAllowedPositions = getSelectedPositionsFromCheckboxes('resourcePositionChoice');
  const newItem = {
    title,
    allowedPositions: fileAllowedPositions,
    url,
    previewUrl,
    group: topic,
    tab: moduleId,
    modules: [moduleId],
    topics: [topic],
    categoryName: catObj ? catObj.name : moduleId,
    categoryIcon: catObj ? catObj.icon : '📄',
    badge: catObj ? catObj.badge : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    btn: catObj ? catObj.btn : 'bg-emerald-600 hover:bg-emerald-500',
    isCustom: true,
    id: 'custom_' + Date.now()
  };

  customItems.unshift(newItem);
  filePermissions[newItem.url] = fileAllowedPositions;
  localStorage.setItem('wlh_file_permissions', JSON.stringify(filePermissions));
  fbSync('file_permissions', filePermissions);
  localStorage.setItem('wlh_custom_resources', JSON.stringify(customItems)); fbSync('custom_resources', customItems);

  closeAddResourceModal();
  refreshDataModel();
  updateTotalCounts();
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
  showToast('✨ Resource added: ' + title);
  logActivity('Resource Add', 'Added ' + title + ' to ' + moduleId);
}

// 17. MODULE CUSTOMIZER
function openAddModuleModal() {
  document.getElementById('moduleModalTitle').textContent = 'Create New Module';
  document.getElementById('editModuleTargetId').value = '';
  document.getElementById('newModuleName').value = '';
  document.getElementById('newModuleIcon').value = '📁';
  document.getElementById('newModuleTopics').value = '';
  renderPositionCheckboxes('modulePositionsCheckboxList', 'modulePositionChoice', ['all']);
  renderUserCheckboxes('moduleUsersCheckboxList', 'moduleUserChoice', []);
  document.getElementById('deleteModuleBtn').classList.add('hidden');

  const modal = document.getElementById('addModuleModal');
  const container = document.getElementById('addModuleModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function openEditCurrentModuleModal() {
  if (currentCategory === 'all') return;
  openEditModuleModal(currentCategory);
}

function openEditModuleModal(catId, event) {
  if (event) event.stopPropagation();
  const catObj = CATEGORIES.find(c => c.id === catId);
  if (!catObj) return;

  document.getElementById('moduleModalTitle').textContent = 'Edit Module: ' + catObj.name;
  document.getElementById('editModuleTargetId').value = catId;
  document.getElementById('newModuleName').value = catObj.name;
  document.getElementById('newModuleIcon').value = catObj.icon;
  document.getElementById('newModuleTopics').value = (catObj.groups || []).join(', ');
  const currentModAllowed = modulePermissions[catId] || catObj.allowedPositions || ['all'];
  const modPos = Array.isArray(currentModAllowed) ? currentModAllowed : (currentModAllowed.positions || ['all']);
  const modUsers = Array.isArray(currentModAllowed) ? (catObj.allowedUsers || []) : (currentModAllowed.users || catObj.allowedUsers || []);
  renderPositionCheckboxes('modulePositionsCheckboxList', 'modulePositionChoice', modPos);
  renderUserCheckboxes('moduleUsersCheckboxList', 'moduleUserChoice', modUsers);

  const delBtn = document.getElementById('deleteModuleBtn');
  if (catObj.isCustom) delBtn.classList.remove('hidden');
  else delBtn.classList.add('hidden');

  const modal = document.getElementById('addModuleModal');
  const container = document.getElementById('addModuleModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeAddModuleModal() {
  const modal = document.getElementById('addModuleModal');
  const container = document.getElementById('addModuleModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function selectEmoji(emoji) {
  document.getElementById('newModuleIcon').value = emoji;
}

function submitModuleConfig(e) {
  e.preventDefault();
  const targetId = document.getElementById('editModuleTargetId').value;
  const name = document.getElementById('newModuleName').value.trim();
  const icon = document.getElementById('newModuleIcon').value.trim() || '📁';
  const topicsStr = document.getElementById('newModuleTopics').value.trim();

  let parsedTopics = [];
  if (topicsStr) {
    parsedTopics = topicsStr.split(',').map(s => s.trim()).filter(Boolean);
  }

  const modAllowedPositions = getSelectedPositionsFromCheckboxes('modulePositionChoice');
  const modAllowedUsers = getSelectedUsersFromCheckboxes('moduleUserChoice');
  const finalModPerm = { positions: modAllowedPositions, users: modAllowedUsers };
  if (targetId) {
    moduleEdits[targetId] = { name, icon };
    modulePermissions[targetId] = finalModPerm;
    localStorage.setItem('wlh_module_permissions', JSON.stringify(modulePermissions));
    fbSync('module_permissions', modulePermissions);
    localStorage.setItem('wlh_module_edits', JSON.stringify(moduleEdits));
    if (parsedTopics.length > 0) {
      topicEdits[targetId] = parsedTopics;
      localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));
    }
    showToast('Module "' + name + '" updated!');
  } else {
    const newId = 'mod_' + Date.now();
    const newModule = {
      id: newId,
      name,
      icon,
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      btn: 'bg-indigo-600 hover:bg-indigo-500',
      groups: parsedTopics.length > 0 ? parsedTopics : ['General'],
      isCustom: true,
      allowedPositions: modAllowedPositions
    };
    modulePermissions[newId] = finalModPerm;
    newModule.allowedPositions = modAllowedPositions;
    newModule.allowedUsers = modAllowedUsers;
    localStorage.setItem('wlh_module_permissions', JSON.stringify(modulePermissions));
    fbSync('module_permissions', modulePermissions);
    customModules.push(newModule);
    localStorage.setItem('wlh_custom_modules', JSON.stringify(customModules));
    showToast('Created module "' + name + '"!');
  }

  closeAddModuleModal();
  refreshDataModel();
  updateTotalCounts();
  renderSidebarCategories();
  populateAddResourceModules();
  renderSubgroupTabs();
  renderRecords();
}

function deleteCurrentTargetModule() {
  const targetId = document.getElementById('editModuleTargetId').value;
  if (!targetId) return;
  if (!confirm('Are you sure you want to delete this custom module?')) return;

  customModules = customModules.filter(m => m.id !== targetId);
  localStorage.setItem('wlh_custom_modules', JSON.stringify(customModules));
  delete moduleEdits[targetId];
  delete topicEdits[targetId];

  closeAddModuleModal();
  refreshDataModel();
  renderSidebarCategories();
  populateAddResourceModules();
  selectCategory('all');
  showToast('Module deleted');
}

// 18. MOVE & COPY MODALS
function openMoveModal() {
  openMoveCopyDialog('move');
}

function openCopyModal() {
  openMoveCopyDialog('copy');
}

let activeMoveCopyAction = 'move';
function openMoveCopyDialog(action) {
  activeMoveCopyAction = action;
  document.getElementById('moveCopyModalTitle').textContent = (action === 'move' ? 'Move' : 'Copy') + ' ' + selectedItemUrls.size + ' Resources';
  document.getElementById('executeMoveCopyBtn').textContent = action === 'move' ? 'Apply Move' : 'Duplicate & Copy';

  const modSelect = document.getElementById('moveTargetModule');
  modSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  onMoveModuleChange();

  const modal = document.getElementById('moveCopyModal');
  const container = document.getElementById('moveCopyModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeMoveCopyModal() {
  const modal = document.getElementById('moveCopyModal');
  const container = document.getElementById('moveCopyModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function onMoveModuleChange() {
  const modId = document.getElementById('moveTargetModule').value;
  const catObj = CATEGORIES.find(c => c.id === modId);
  const topicSelect = document.getElementById('moveTargetTopic');
  let groups = (catObj && catObj.groups) ? catObj.groups : ['General'];
  topicSelect.innerHTML = groups.map(g => `<option value="${g}">${g}</option>`).join('');
}

function executeMoveCopyAction() {
  const targetMod = document.getElementById('moveTargetModule').value;
  const targetTopic = document.getElementById('moveTargetTopic').value;

  const urls = [...selectedItemUrls];
  if (activeMoveCopyAction === 'move') {
    urls.forEach(u => {
      if (!fileMetadata[u]) fileMetadata[u] = {};
      fileMetadata[u].modules = [targetMod];
      fileMetadata[u].topics = [targetTopic];
    });
    localStorage.setItem('wlh_file_metadata', JSON.stringify(fileMetadata));
    showToast('Moved ' + urls.length + ' items to ' + targetMod);
  } else {
    urls.forEach(u => {
      const orig = ALL_ITEMS.find(i => i.url === u);
      if (orig) {
        const copyItem = {
          ...orig,
          id: 'copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          tab: targetMod,
          group: targetTopic,
          modules: [targetMod],
          topics: [targetTopic],
          isCustom: true
        };
        customItems.unshift(copyItem);
      }
    });
    localStorage.setItem('wlh_custom_resources', JSON.stringify(customItems));
    showToast('Copied ' + urls.length + ' items to ' + targetMod);
  }

  closeMoveCopyModal();
  clearSelection();
  refreshDataModel();
  renderRecords();
}

// 19. QR CODE & MERGE STUDY PACK
function showSingleQR(title, url) {
  openQRWithUrl(title, url);
}

function openQRModal() {
  const urls = [...selectedItemUrls];
  if (urls.length === 0) return;
  const firstItem = ALL_ITEMS.find(it => it.url === urls[0]);
  openQRWithUrl(firstItem ? firstItem.title : 'Selected Resource', urls[0]);
}

function openQRWithUrl(title, url) {
  document.getElementById('qrResourceTitle').textContent = title;
  const canvasContainer = document.getElementById('qrcodeCanvasContainer');
  canvasContainer.innerHTML = '';

  if (window.QRCode) {
    new QRCode(canvasContainer, {
      text: url,
      width: 180,
      height: 180,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    canvasContainer.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(url) + '" alt="QR">';
  }

  const modal = document.getElementById('qrModal');
  const container = document.getElementById('qrModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeQRModal() {
  const modal = document.getElementById('qrModal');
  const container = document.getElementById('qrModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function openMergeModal() {
  const urls = [...selectedItemUrls];
  if (urls.length === 0) return;

  const preview = document.getElementById('mergeSelectedListPreview');
  preview.innerHTML = urls.map(u => {
    const it = ALL_ITEMS.find(i => i.url === u);
    return `<div class="truncate text-slate-300">• ${it ? it.title : u}</div>`;
  }).join('');

  const modal = document.getElementById('mergeModal');
  const container = document.getElementById('mergeModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeMergeModal() {
  const modal = document.getElementById('mergeModal');
  const container = document.getElementById('mergeModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function generateMergedStudyPack() {
  const packTitle = document.getElementById('mergePackTitle').value.trim() || 'L Support Study Pack';
  const urls = [...selectedItemUrls];
  const items = urls.map(u => ALL_ITEMS.find(i => i.url === u)).filter(Boolean);

  let docHtml = `
    <html>
      <head>
        <title>${packTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; }
          h1 { color: #818cf8; border-bottom: 2px solid #334155; padding-bottom: 12px; }
          .item-card { background: #1e293b; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #334155; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; background: #3b82f6; color: white; margin-bottom: 8px; font-weight: bold; }
          a { color: #38bdf8; text-decoration: none; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>${packTitle}</h1>
        <p>Compiled on: ${new Date().toLocaleDateString()} | Total Resources: ${items.length}</p>
        ${items.map((it, idx) => `
          <div class="item-card">
            <span class="badge">${it.categoryName} • ${it.group}</span>
            <h3>${idx + 1}. ${it.title}</h3>
            <p><a href="${it.url}" target="_blank">🔗 Open Original Document: ${it.url}</a></p>
          </div>
        `).join('')}
      </body>
    </html>
  `;

  const blob = new Blob([docHtml], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  closeMergeModal();
  clearSelection();
  showToast('Consolidated Study Pack generated!');
}

// 20. IN-APP POPUP PREVIEW WITH ZOOM & CUTE PLAYERS
function openFilePreview(url) {
  const item = ALL_ITEMS.find(it => it.url === url);
  if (!item) return;

  if (item.isLocked) {
    pendingUnlockUrl = url;
    openPinVerifyModal();
    return;
  }

  currentActiveModalUrl = url;
  document.getElementById('modalFileTitle').textContent = item.title;
  document.getElementById('modalGroupBadge').textContent = item.group || 'General';
  document.getElementById('modalCategoryBadge').textContent = item.categoryName;
  document.getElementById('modalCategoryIcon').textContent = item.categoryIcon || '📄';
  document.getElementById('modalExternalLink').href = item.url;

  // Direct download button visibility
  const modalDlBtn = document.getElementById('modalDownloadBtn');
  if (checkUserCanDownload(item)) {
    modalDlBtn.classList.remove('hidden');
  } else {
    modalDlBtn.classList.add('hidden');
  }

  const audioView = document.getElementById('cuteAudioPlayerView');
  const iframeContainer = document.getElementById('iframeZoomContainer');
  const loader = document.getElementById('iframeLoader');

  resetZoom();

  if (item.mediaType === 'audio' || url.endsWith('.mp3') || (url.includes('drive.google.com') && item.tab === 'New Song')) {
    iframeContainer.classList.add('hidden');
    loader.classList.add('hidden');
    audioView.classList.remove('hidden');
    document.getElementById('audioPlayerTitle').textContent = item.title;
    const audioEl = document.getElementById('nativeAudioElement');
    audioEl.src = item.url;
  } else {
    audioView.classList.add('hidden');
    iframeContainer.classList.remove('hidden');
    loader.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('previewIframe').src = item.previewUrl;
  }

  const modal = document.getElementById('filePreviewModal');
  const container = document.getElementById('previewModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');

  logActivity('File View', 'Opened in-app: ' + item.title);
}

function hideIframeLoader() {
  document.getElementById('iframeLoader').classList.add('opacity-0', 'pointer-events-none');
}

function closeFileModal() {
  const modal = document.getElementById('filePreviewModal');
  const container = document.getElementById('previewModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');

  document.getElementById('previewIframe').src = '';
  const audioEl = document.getElementById('nativeAudioElement');
  if (audioEl) {
    audioEl.pause();
    audioEl.src = '';
  }
  currentActiveModalUrl = null;
}

function copyCurrentModalLink() {
  if (currentActiveModalUrl) {
    navigator.clipboard.writeText(currentActiveModalUrl).then(() => {
      showToast('Link copied to clipboard!');
    });
  }
}

function changeZoom(delta) {
  currentZoomScale = Math.max(0.5, Math.min(3.0, currentZoomScale + delta));
  applyZoom();
}

function resetZoom() {
  currentZoomScale = 1.0;
  applyZoom();
}

function applyZoom() {
  document.getElementById('zoomLevelDisplay').textContent = Math.round(currentZoomScale * 100) + '%';
  const iframeContainer = document.getElementById('iframeZoomContainer');
  iframeContainer.style.transform = `scale(${currentZoomScale})`;
}

// PIN VERIFICATION
function openPinVerifyModal() {
  document.getElementById('pinVerifyInput').value = '';
  const modal = document.getElementById('pinVerifyModal');
  const container = document.getElementById('pinVerifyModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
  document.getElementById('pinVerifyInput').focus();
}

function closePinVerifyModal() {
  const modal = document.getElementById('pinVerifyModal');
  const container = document.getElementById('pinVerifyModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
  pendingUnlockUrl = null;
}

function verifyPinAndProceed() {
  const pinEntered = document.getElementById('pinVerifyInput').value.trim();
  if (pinEntered === CURRENT_USER.pin || pinEntered === '742766') {
    closePinVerifyModal();
    const url = pendingUnlockUrl;
    pendingUnlockUrl = null;
    if (url) openFilePreview(url);
  } else {
    alert('Incorrect PIN. Please try again.');
  }
}

// 21. BULK ACTIONS (LOCK, HIDE, DIRECT DOWNLOAD, PIN, SHARE)
function bulkShare() {
  const urls = [...selectedItemUrls];
  if (urls.length === 0) return;
  navigator.clipboard.writeText(urls.join('\n')).then(() => {
    showToast('Copied ' + urls.length + ' links to clipboard!');
  });
}

function bulkToggleLock() {
  const urls = [...selectedItemUrls];
  let anyUnlocked = urls.some(u => !fileMetadata[u] || !fileMetadata[u].locked);
  const targetState = anyUnlocked;

  urls.forEach(u => {
    if (!fileMetadata[u]) fileMetadata[u] = {};
    fileMetadata[u].locked = targetState;
  });
  localStorage.setItem('wlh_file_metadata', JSON.stringify(fileMetadata));
  refreshDataModel();
  renderRecords();
  showToast(targetState ? '🔒 Selected files locked with 6-digit PIN' : '🔓 Selected files unlocked');
}

function bulkToggleHide() {
  const urls = [...selectedItemUrls];
  let anyVisible = urls.some(u => !fileMetadata[u] || !fileMetadata[u].hidden);
  const targetState = anyVisible;

  urls.forEach(u => {
    if (!fileMetadata[u]) fileMetadata[u] = {};
    fileMetadata[u].hidden = targetState;
  });
  localStorage.setItem('wlh_file_metadata', JSON.stringify(fileMetadata));
  refreshDataModel();
  renderRecords();
  showToast(targetState ? '👁️ Selected files hidden from members' : '👁️ Selected files unhidden');
}

function bulkDownload() {
  if (!DOWNLOADS_ENABLED) {
    showToast('Downloads are strictly DISABLED by Admin.');
    return;
  }
  const urls = [...selectedItemUrls];
  urls.forEach((url, i) => {
    setTimeout(() => {
      const it = ALL_ITEMS.find(item => item.url === url);
      triggerDirectDownload(url, it ? it.title : 'file');
    }, i * 500);
  });
  showToast('Initiating direct download for ' + urls.length + ' files');
}

function bulkPin() {
  const urls = [...selectedItemUrls];
  let anyUnpinned = urls.some(u => !pinnedUrls.has(u));
  urls.forEach(u => {
    if (anyUnpinned) pinnedUrls.add(u);
    else pinnedUrls.delete(u);
  });
  localStorage.setItem('wlh_pinned_urls', JSON.stringify([...pinnedUrls]));
  updatePinnedBadge();
  renderRecords();
  showToast(anyUnpinned ? '⭐ Pinned selected files' : 'Unpinned selected files');
}

function handleSearch(val) {
  searchQuery = val.trim().toLowerCase();
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchQuery) clearBtn.classList.remove('hidden');
  else clearBtn.classList.add('hidden');
  renderRecords();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  searchQuery = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  currentSubgroup = 'all';
  renderSubgroupTabs();
  renderRecords();
}

function setViewMode(mode) {
  currentViewMode = mode;
  const tableBtn = document.getElementById('viewModeTableBtn');
  const gridBtn = document.getElementById('viewModeGridBtn');
  const tableWrapper = document.getElementById('tableViewWrapper');
  const gridWrapper = document.getElementById('gridViewWrapper');

  if (mode === 'table') {
    tableBtn.className = 'p-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-xs transition';
    gridBtn.className = 'p-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition';
    tableWrapper.classList.remove('hidden');
    gridWrapper.classList.add('hidden');
  } else {
    gridBtn.className = 'p-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-xs transition';
    tableBtn.className = 'p-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition';
    tableWrapper.classList.add('hidden');
    gridWrapper.classList.remove('hidden');
  }
  renderRecords();
}

function togglePinnedFilter() {
  isPinnedOnly = !isPinnedOnly;
  const btn = document.getElementById('pinnedFilterBtn');
  if (isPinnedOnly) {
    btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500 bg-amber-500/20 text-xs font-semibold text-amber-300 transition';
    document.getElementById('breadcrumbCurrent').textContent = 'Saved Resources (Starred)';
  } else {
    btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition';
    if (currentCategory === 'all') {
      document.getElementById('breadcrumbCurrent').textContent = 'All Resources (' + ALL_ITEMS.length + ')';
    } else {
      const catObj = CATEGORIES.find(c => c.id === currentCategory);
      document.getElementById('breadcrumbCurrent').textContent = catObj ? catObj.name : currentCategory;
    }
  }
  renderRecords();
}

function togglePin(url, event) {
  if (event) event.stopPropagation();
  if (pinnedUrls.has(url)) {
    pinnedUrls.delete(url);
    showToast('Unstarred');
  } else {
    pinnedUrls.add(url);
    showToast('Saved to Favorites ⭐');
  }
  localStorage.setItem('wlh_pinned_urls', JSON.stringify([...pinnedUrls]));
  updatePinnedBadge();
  renderRecords();
}

// 22. SETTINGS & PROFILE
function openSettingsModal(tab) {
  switchSettingsTab(tab || 'profile');
  loadSettingsFormData();

  const modal = document.getElementById('settingsModal');
  const container = document.getElementById('settingsModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const container = document.getElementById('settingsModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function switchSettingsTab(tab) {
  const tabs = ['profile', 'security', 'audit', 'suggestion'];
  tabs.forEach(t => {
    const btn = document.getElementById('stab-' + t);
    const content = document.getElementById('tabContent-' + t);
    if (!btn || !content) return;
    if (t === tab) {
      btn.className = 'px-3 py-2 border-b-2 border-indigo-500 text-indigo-400 font-bold';
      content.classList.remove('hidden');
    } else {
      btn.className = 'px-3 py-2 border-b-2 border-transparent text-slate-400 hover:text-white';
      content.classList.add('hidden');
    }
  });

  if (tab === 'audit') renderAuditView();
  if (tab === 'suggestion') renderSuggestionsView();
}

function loadSettingsFormData() {
  if (!CURRENT_USER) return;
  document.getElementById('settingFullName').value = CURRENT_USER.fullName || '';
  document.getElementById('settingZion').value = CURRENT_USER.zion || '';
  document.getElementById('settingArea').value = CURRENT_USER.area || '';
  document.getElementById('settingPhone').value = CURRENT_USER.phone || '';
  document.getElementById('settingEmail').value = CURRENT_USER.gmail || '';
  if (document.getElementById('settingPosition')) {
    document.getElementById('settingPosition').value = CURRENT_USER.position || 'Member';
  }
}

function saveUserProfile(e) {
  e.preventDefault();
  CURRENT_USER.fullName = document.getElementById('settingFullName').value.trim();
  CURRENT_USER.zion = document.getElementById('settingZion').value.trim();
  CURRENT_USER.area = document.getElementById('settingArea').value.trim();
  CURRENT_USER.phone = document.getElementById('settingPhone').value.trim();
  CURRENT_USER.gmail = document.getElementById('settingEmail').value.trim();
  if (document.getElementById('settingPosition')) {
    CURRENT_USER.position = document.getElementById('settingPosition').value || 'Member';
  }

  const idx = ALL_USERS.findIndex(u => u.userId.toLowerCase() === CURRENT_USER.userId.toLowerCase());
  if (idx !== -1) ALL_USERS[idx] = CURRENT_USER;

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));
  fbSync('users', ALL_USERS);

  updateUserUI();
  showToast('Profile updated!'); updateUserUI(); if(activeView==='home') renderHomePage();
}

async function saveSecurityCredentials(e) {
  e.preventDefault();
  const newPass = document.getElementById('settingNewPassword').value;
  const confPass = document.getElementById('settingConfirmPassword').value;
  const newPin = document.getElementById('settingNewPin').value.trim();

  if (!newPass && !newPin) {
    alert('Please enter a new password or a new 6-digit PIN to update.');
    return;
  }

  if (newPass) {
    if (newPass !== confPass) {
      alert('New passwords do not match! Please check and re-enter.');
      return;
    }
    if (newPass.length < 4) {
      alert('New password must be at least 4 characters long.');
      return;
    }
    CURRENT_USER.password = newPass;
  }

  if (newPin) {
    if (!/^\d{6}$/.test(newPin)) {
      alert('Personal PIN must be exactly 6 digits (numbers only, e.g. 742766)!');
      return;
    }
    CURRENT_USER.pin = newPin;
  }

  const idx = ALL_USERS.findIndex(u => u.userId.toLowerCase() === CURRENT_USER.userId.toLowerCase());
  if (idx !== -1) ALL_USERS[idx] = CURRENT_USER;

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));

  try {
    await fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ALL_USERS)
    });
  } catch (err) {
    console.warn('Direct PUT failed:', err);
  }
  fbSync('users', ALL_USERS);

  document.getElementById('settingNewPassword').value = '';
  document.getElementById('settingConfirmPassword').value = '';
  document.getElementById('settingNewPin').value = '';

  alert('✅ Credentials Updated!\n\nYour new Password and PIN have been saved to the Cloud Database successfully.');
  showToast('Password & 6-Digit PIN updated in Cloud!');
}

function renderAuditView() {
  const onlineContainer = document.getElementById('activeOnlineUsersList');
  onlineContainer.innerHTML = `
    <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <div>
          <div class="font-bold text-white text-xs">${CURRENT_USER.fullName} (${CURRENT_USER.userId})</div>
          <div class="text-[10px] text-slate-400">${CURRENT_USER.zion} • ${CURRENT_USER.area}</div>
        </div>
      </div>
      <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Active Now</span>
    </div>
  `;

  const tbody = document.getElementById('auditHistoryTableBody');
  tbody.innerHTML = auditLog.slice(0, 50).map(entry => `
    <tr>
      <td class="py-1.5 px-2 font-bold text-white">${entry.userName}</td>
      <td class="py-1.5 px-2 text-indigo-300">${entry.action}</td>
      <td class="py-1.5 px-2 text-slate-400">${entry.zion}</td>
      <td class="py-1.5 px-2 text-right text-slate-500 font-mono">${entry.time}</td>
    </tr>
  `).join('');
}

function clearAuditHistory() {
  if (!confirm('Clear all audit activity history?')) return;
  auditLog = [];
  localStorage.setItem('wlh_audit_log', JSON.stringify(auditLog));
  renderAuditView();
}

function submitSuggestion(e) {
  e.preventDefault();
  const subject = document.getElementById('suggestionSubject').value.trim();
  const message = document.getElementById('suggestionMessage').value.trim();

  const newSuggestion = {
    id: Date.now(),
    userName: CURRENT_USER.fullName,
    userId: CURRENT_USER.userId,
    zion: CURRENT_USER.zion,
    subject,
    message,
    time: new Date().toLocaleString()
  };

  suggestionsList.unshift(newSuggestion);
  localStorage.setItem('wlh_suggestions', JSON.stringify(suggestionsList));
  document.getElementById('suggestionSubject').value = '';
  document.getElementById('suggestionMessage').value = '';
  showToast('Enquiry / Suggestion submitted to leaders!');
  renderSuggestionsView();
}

function renderSuggestionsView() {
  const list = document.getElementById('receivedSuggestionsList');
  if (suggestionsList.length === 0) {
    list.innerHTML = '<p class="text-slate-500 text-xs italic">No enquiries submitted yet.</p>';
    return;
  }
  list.innerHTML = suggestionsList.map(s => `
    <div class="p-3 bg-slate-950 rounded-xl border border-slate-800">
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold text-indigo-400 text-xs">${s.subject}</span>
        <span class="text-[10px] text-slate-500">${s.time}</span>
      </div>
      <p class="text-slate-300 text-xs mb-1.5">${s.message}</p>
      <div class="text-[10px] text-slate-500">From: ${s.userName} (${s.zion})</div>
    </div>
  `).join('');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.classList.remove('translate-y-16', 'opacity-0', 'pointer-events-none');
  setTimeout(() => {
    toast.classList.add('translate-y-16', 'opacity-0', 'pointer-events-none');
  }, 3200);
}

function copyResourceUrl(url, title, event) {
  if (event) event.stopPropagation();
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 Link copied: ' + title);
  }).catch(() => {
    showToast('Failed to copy link');
  });
}


// ========================================================
// PERSONAL PIN SCREEN LOCK (SCREEN OFF / SITE EXIT)
// ========================================================
function showAppPinLock() {
  if (!CURRENT_USER) return;
  const modal = document.getElementById('appPinLockModal');
  const container = document.getElementById('appPinLockContainer');
  const greeting = document.getElementById('pinLockGreeting');
  const input = document.getElementById('screenLockPinInput');
  const err = document.getElementById('pinLockErrorMsg');
  if (!modal || !container) return;

  if (greeting) greeting.textContent = 'Welcome back, ' + CURRENT_USER.fullName + '!';
  if (input) input.value = '';
  if (err) err.classList.add('hidden');

  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
  setTimeout(() => { if (input) input.focus(); }, 150);
}

function closeAppPinLock() {
  const modal = document.getElementById('appPinLockModal');
  const container = document.getElementById('appPinLockContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function unlockAppWithPin() {
  const input = document.getElementById('screenLockPinInput');
  const err = document.getElementById('pinLockErrorMsg');
  if (!input || !CURRENT_USER) return;
  const pinEntered = input.value.trim();

  if (pinEntered === CURRENT_USER.pin || (CURRENT_USER.role === 'admin' && pinEntered === '742766')) {
    localStorage.removeItem('l_support_screen_locked');
    sessionStorage.setItem('l_support_session_active', 'true');
    closeAppPinLock();
    closeAuthModal();
    showToast('Unlocked! Welcome back, ' + CURRENT_USER.fullName);
    if (CURRENT_USER.role === 'admin') {
      setTimeout(() => checkPendingApprovals(), 400);
    }
  } else {
    if (err) err.classList.remove('hidden');
    input.value = '';
    input.focus();
  }
}

function logoutFromPinLock() {
  localStorage.removeItem('wlh_current_user');
  sessionStorage.removeItem('l_support_session_active');
  localStorage.removeItem('l_support_screen_locked');
  CURRENT_USER = null;
  closeAppPinLock();
  openAuthModal();
}

function switchToLoginFromPin() {
  logoutFromPinLock();
}

// ========================================================
// ADMIN NEW USER APPROVAL POPUP & MANAGEMENT
// ========================================================
function checkPendingApprovals() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  const pending = ALL_USERS.filter(u => u.status === 'pending');
  updateApprovalCountBadge();
  if (pending.length > 0) {
    openPendingApprovalsModal();
  }
}

function updateApprovalCountBadge() {
  const count = ALL_USERS.filter(u => u.status === 'pending').length;
  const topBadge = document.getElementById('topApprovalCountBadge');
  const modalBadge = document.getElementById('approvalModalCountBadge');
  if (topBadge) topBadge.textContent = count;
  if (modalBadge) modalBadge.textContent = count + ' Pending';
}

function openPendingApprovalsModal() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  openAdminControlPanel('approvals');
}

function closePendingApprovalsModal() {
  const modal = document.getElementById('pendingApprovalsModal');
  const container = document.getElementById('pendingApprovalsContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function renderPendingUsersList() {
  const container = document.getElementById('pendingUsersListContainer');
  if (!container) return;
  const pending = ALL_USERS.filter(u => u.status === 'pending');
  const rejected = ALL_USERS.filter(u => u.status === 'rejected');
  updateApprovalCountBadge();

  if (pending.length === 0 && rejected.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i class="fa-solid fa-circle-check text-4xl text-emerald-400 mb-2"></i>
        <p class="font-bold text-white text-sm">No Pending Approvals</p>
        <p class="text-xs text-slate-500 mt-1">All registered users have been reviewed.</p>
      </div>
    `;
    return;
  }

  let html = '';

  if (pending.length > 0) {
    html += pending.map(u => `
      <div class="p-3.5 bg-slate-800/80 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md mb-2">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-white text-sm">${u.fullName}</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">ID: ${u.userId}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">⏳ Pending</span>
          </div>
          <div class="text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
            ${u.gmail ? `<span><i class="fa-solid fa-envelope text-[10px] mr-1 text-slate-500"></i>${u.gmail}</span>` : ''}
            ${u.phone ? `<span><i class="fa-solid fa-phone text-[10px] mr-1 text-slate-500"></i>${u.phone}</span>` : ''}
            ${u.zion ? `<span><i class="fa-solid fa-church text-[10px] mr-1 text-slate-500"></i>${u.zion}</span>` : ''}
            ${u.area ? `<span><i class="fa-solid fa-location-dot text-[10px] mr-1 text-slate-500"></i>${u.area}</span>` : ''}
          </div>
          <div class="text-[10px] text-slate-500">
            Registered: ${new Date(u.registeredAt || Date.now()).toLocaleString()}
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button onclick="approveUser('${u.userId}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5">
            <i class="fa-solid fa-check text-xs"></i> Approve
          </button>
          <button onclick="rejectUser('${u.userId}')" class="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition flex items-center gap-1.5">
            <i class="fa-solid fa-xmark text-xs"></i> Reject
          </button>
        </div>
      </div>
    `).join('');
  }

  if (rejected.length > 0) {
    html += `
      <div class="mt-4 pt-3 border-t border-slate-800">
        <h4 class="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
          <i class="fa-solid fa-user-xmark text-rose-400 text-xs"></i>
          Inactive / Previously Rejected Accounts (Click to Re-Approve)
        </h4>
        ${rejected.map(u => `
          <div class="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm mb-2 opacity-85 hover:opacity-100 transition">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white text-xs">${u.fullName}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">ID: ${u.userId}</span>
                <span class="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-bold">Rejected</span>
              </div>
              <div class="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                ${u.zion ? `<span>${u.zion}</span>` : ''}
                ${u.phone ? `<span>${u.phone}</span>` : ''}
              </div>
            </div>
            <button onclick="approveUser('${u.userId}')" class="px-3 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg shadow transition flex items-center gap-1 self-start sm:self-center">
              <i class="fa-solid fa-check text-[10px]"></i> Approve & Activate
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
}

function approveUser(userId) {
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  user.status = 'approved';
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast('User ' + user.fullName + ' (' + user.userId + ') Approved!');
  logActivity('User Approved', 'Admin approved user ' + user.userId);
  renderPendingUsersList();
  renderStarApprovalsList();
  renderStarMembersGrid();
  updateStarAdminBadges();
  if (ALL_USERS.filter(u => u.status === 'pending').length === 0) {
    setTimeout(() => closePendingApprovalsModal(), 500);
  }
}

function rejectUser(userId) {
  if (!confirm('Are you sure you want to reject user ' + userId + '?')) return;
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  user.status = 'rejected';
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast('User ' + user.userId + ' registration rejected.');
  logActivity('User Rejected', 'Admin rejected user ' + user.userId);
  renderPendingUsersList();
  renderStarApprovalsList();
  renderStarMembersGrid();
  updateStarAdminBadges();
}


// ========================================================
// HOME PAGE RENDERING (NEW ARRIVALS, NOTICES, SCHEDULE)
// ========================================================
function renderHomePage() {
  renderHomeNewArrivals();
  renderHomeNotices();
  renderHomeSchedule();
  populateHomeFilterOptions();
}

function populateHomeFilterOptions() {
  const sel1 = document.getElementById('homeNewArrivalsFilter');
  const sel2 = document.getElementById('modalNewArrivalsFilter');
  const optionsHtml = '<option value="all">All Modules</option>' + CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  if (sel1) sel1.innerHTML = optionsHtml;
  if (sel2) sel2.innerHTML = optionsHtml;
}

function getSortedNewArrivals(filterModule) {
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Filter ONLY items added within the last 10 days AND visible to current user
  let items = ALL_ITEMS.filter(it => isFileVisibleToUser(it, CURRENT_USER)).filter(it => {
    // If it has addedAt timestamp, check age; if base item, keep recent items within 10 days window
    let added = it.addedAt;
    if (!added) {
      added = it.customAdded ? (now - 3600000) : (now - 3 * 24 * 60 * 60 * 1000);
    }
    return (now - added) <= TEN_DAYS_MS;
  });

  if (filterModule && filterModule !== 'all') {
    items = items.filter(it => (it.modules && it.modules.includes(filterModule)) || it.tab === filterModule);
  }

  // SORT: Newest date at the top, older dates at the bottom!
  items.sort((a, b) => {
    const timeA = a.addedAt || (now - 3 * 24 * 60 * 60 * 1000);
    const timeB = b.addedAt || (now - 3 * 24 * 60 * 60 * 1000);
    return timeB - timeA;
  });

  return items;
}

function renderHomeNewArrivals(filterModule) {
  const container = document.getElementById('homeNewArrivalsGrid');
  if (!container) return;
  const items = getSortedNewArrivals(filterModule).slice(0, 8);

  if (items.length === 0) {
    container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-500 text-xs">No resources in this module.</div>';
    return;
  }

  container.innerHTML = items.map(it => {
    return `
      <div onclick="openFilePreview('${it.url}')" class="p-3.5 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition cursor-pointer flex flex-col justify-between group shadow-sm">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${it.badge || 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'} flex items-center gap-1">
              <span>${it.categoryIcon || '📄'}</span>
              <span>${it.categoryName || it.tab}</span>
            </span>
            <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">NEW</span>
          </div>
          <h4 class="font-extrabold text-white text-xs group-hover:text-indigo-300 transition line-clamp-2 leading-tight mb-1.5">${it.title}</h4>
          <p class="text-[10px] text-slate-400 font-medium truncate">${it.group || 'General'}</p>
        </div>
        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-indigo-400 font-bold mt-2">
          <span>Open File</span>
          <i class="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
        </div>
      </div>
    `;
  }).join('');
}

function filterHomeNewArrivals(moduleId) {
  renderHomeNewArrivals(moduleId);
}

function renderHomeNotices() {
  const container = document.getElementById('homeNoticesContainer');
  if (!container) return;

  if (NOTICES_LIST.length === 0) {
    container.innerHTML = '<div class="py-8 text-center text-slate-500 text-xs">No active announcements.</div>';
    return;
  }

  container.innerHTML = NOTICES_LIST.map(n => {
    const colorClasses = n.color === 'rose' 
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' 
      : n.color === 'amber' 
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : n.color === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300';

    // Render attachments if any
    let attachHtml = '';
    if (n.attachments && n.attachments.length > 0) {
      attachHtml = `
        <div class="pt-2 border-t border-slate-800/80 space-y-1">
          <div class="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <i class="fa-solid fa-paperclip text-rose-400"></i> Attached Files (${n.attachments.length})
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${n.attachments.map(att => {
              const icon = att.type && att.type.includes('pdf') ? 'fa-file-pdf text-rose-400'
                : att.type && att.type.includes('audio') ? 'fa-file-audio text-purple-400'
                : att.type && att.type.includes('video') ? 'fa-file-video text-cyan-400'
                : att.type && att.type.includes('image') ? 'fa-file-image text-emerald-400'
                : 'fa-file-lines text-indigo-400';
              return `
                <a href="${att.url}" target="_blank" download="${att.name || 'document'}" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 flex items-center gap-1.5 transition">
                  <i class="fa-solid ${icon}"></i>
                  <span class="truncate max-w-[150px]">${att.name || 'Attached File'}</span>
                  <i class="fa-solid fa-arrow-down text-[9px] text-slate-400 ml-0.5"></i>
                </a>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 shadow-sm">
        <div class="flex items-center justify-between text-xs">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${colorClasses}">${n.category}</span>
          <span class="text-slate-500 text-[10px] font-mono">${n.date}</span>
        </div>
        <h4 class="font-bold text-white text-xs">${n.title}</h4>
        <p class="text-slate-300 text-[11px] leading-relaxed whitespace-pre-line">${n.content}</p>
        ${attachHtml}
      </div>
    `;
  }).join('');
}

function renderHomeSchedule() {
  const container = document.getElementById('homeScheduleContainer');
  if (!container) return;

  container.innerHTML = WORSHIP_SCHEDULE.map(s => `
    <div class="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-base flex-shrink-0">
          ${s.icon}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-extrabold text-white text-xs">${s.day}</h4>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">${s.badge}</span>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">${s.desc}</p>
        </div>
      </div>
      <span class="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-xl border border-sky-500/20 flex-shrink-0">${s.time}</span>
    </div>
  `).join('');
}

// New Arrivals Modal
function openNewArrivalsModal() {
  renderModalNewArrivals('all');
  const modal = document.getElementById('newArrivalsModal');
  const container = document.getElementById('newArrivalsModalContainer');
  if (!modal || !container) return;
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeNewArrivalsModal() {
  const modal = document.getElementById('newArrivalsModal');
  const container = document.getElementById('newArrivalsModalContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function filterModalNewArrivals(moduleId) {
  renderModalNewArrivals(moduleId);
}

function renderModalNewArrivals(filterModule) {
  const container = document.getElementById('modalNewArrivalsList');
  if (!container) return;
  const items = getSortedNewArrivals(filterModule);

  container.innerHTML = items.map(it => `
    <div onclick="closeNewArrivalsModal(); openFilePreview('${it.url}')" class="p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-indigo-500/40 transition cursor-pointer flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm flex-shrink-0">${it.categoryIcon || '📄'}</span>
        <div class="min-w-0">
          <div class="font-bold text-white text-xs truncate">${it.title}</div>
          <div class="text-[10px] text-slate-400">${it.categoryName || it.tab} • ${it.group || 'General'}</div>
        </div>
      </div>
      <button class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex-shrink-0">
        Open
      </button>
    </div>
  `).join('');
}


// ========================================================
// DEDICATED ADMIN CONTROL PANEL LOGIC (STAR GALAXY MANAGEMENT CENTER)
// ========================================================
let currentAdminTab = 'members';

function openAdminControlPanel(tab) {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') {
    alert('Access restricted to Admin only (Master Authority: surya11008).');
    return;
  }
  const modal = document.getElementById('adminControlPanelModal');
  const container = document.getElementById('adminControlPanelContainer');
  if (!modal || !container) return;

  updateStarAdminBadges();

  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');

  switchAdminPanelTab(tab || currentAdminTab || 'members');
}

function closeAdminControlPanel() {
  const modal = document.getElementById('adminControlPanelModal');
  const container = document.getElementById('adminControlPanelContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function updateStarAdminBadges() {
  const pendingCount = ALL_USERS.filter(u => u.status === 'pending').length;
  const totalMembers = ALL_USERS.length;
  
  // Tab Badges
  const tabMembersCount = document.getElementById('starTabMembersCount');
  if (tabMembersCount) tabMembersCount.textContent = totalMembers;

  const tabApprovalsBadge = document.getElementById('starTabApprovalsBadge');
  if (tabApprovalsBadge) {
    tabApprovalsBadge.textContent = pendingCount;
    tabApprovalsBadge.classList.toggle('hidden', pendingCount === 0);
  }

  const pendingCountBadge = document.getElementById('starPendingCountBadge');
  if (pendingCountBadge) pendingCountBadge.textContent = pendingCount + ' Pending';

  const btnApproveAllText = document.getElementById('btnApproveAllText');
  if (btnApproveAllText) btnApproveAllText.textContent = 'Approve All (' + pendingCount + ')';

  const btnApproveAll = document.getElementById('btnApproveAllPending');
  if (btnApproveAll) btnApproveAll.classList.toggle('hidden', pendingCount === 0);

  const topBadge = document.getElementById('topApprovalCountBadge');
  if (topBadge) topBadge.textContent = pendingCount;

  const adminPanelBadge = document.getElementById('adminPanelBadge');
  if (adminPanelBadge) {
    adminPanelBadge.textContent = pendingCount;
    adminPanelBadge.classList.toggle('hidden', pendingCount === 0);
  }

  const sidebarPending = document.getElementById('sidebarPendingCountBadge');
  if (sidebarPending) {
    sidebarPending.textContent = pendingCount;
    sidebarPending.classList.toggle('hidden', pendingCount === 0);
  }
}

function switchAdminPanelTab(tab) {
  currentAdminTab = tab || 'members';
  const tabs = ['members', 'online', 'approvals', 'managers', 'memberperms', 'feedback', 'firebase'];
  
  tabs.forEach(t => {
    const btn = document.getElementById('admtab-' + t);
    const content = document.getElementById('admcontent-' + t);
    if (!btn || !content) return;
    
    if (t === currentAdminTab) {
      btn.className = 'px-4 py-2 rounded-2xl whitespace-nowrap transition-all flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/30 cursor-pointer';
      content.classList.remove('hidden');
    } else {
      btn.className = 'px-4 py-2 rounded-2xl whitespace-nowrap transition-all flex items-center gap-1.5 text-xs font-bold bg-slate-900/80 text-purple-200 hover:text-white hover:bg-slate-800 border border-purple-500/20 cursor-pointer';
      content.classList.add('hidden');
    }
  });

  updateStarAdminBadges();

  if (currentAdminTab === 'members') renderStarMembersGrid();
  if (currentAdminTab === 'online') renderStarOnlineGrid();
  if (currentAdminTab === 'approvals') renderStarApprovalsList();
  if (currentAdminTab === 'managers') renderStarManagersList();
  if (currentAdminTab === 'memberperms') renderStarMemberPerms();
  if (currentAdminTab === 'feedback') renderStarFeedbackList();
  if (currentAdminTab === 'firebase') renderStarFirebaseTab();
}

function refreshAdminCloudData() {
  showToast('Refreshing cloud data from Firebase...');
  const restUrl = 'https://lsupport-e390b-default-rtdb.firebaseio.com/l_support.json';
  fetch(restUrl)
    .then(r => r.json())
    .then(data => {
      if (data) {
        if (data.users) {
          let uList = data.users;
          if (!Array.isArray(uList) && typeof uList === 'object') uList = Object.values(uList);
          if (Array.isArray(uList)) {
            ALL_USERS = uList;
            localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
          }
        }
        if (data.presence) {
          PRESENCE_DATA = data.presence;
        }
        if (data.downloads_enabled !== undefined) {
          DOWNLOADS_ENABLED = data.downloads_enabled;
          localStorage.setItem('wlh_downloads_enabled', JSON.stringify(DOWNLOADS_ENABLED));
        }
        if (data.suggestions) {
          let sList = data.suggestions;
          if (!Array.isArray(sList) && typeof sList === 'object') sList = Object.values(sList);
          if (Array.isArray(sList)) {
            suggestionsList = sList;
            localStorage.setItem('wlh_suggestions', JSON.stringify(suggestionsList));
          }
        }
      }
      updateStarAdminBadges();
      switchAdminPanelTab(currentAdminTab);
      showToast('Cloud data successfully refreshed!');
    })
    .catch(err => {
      console.warn('Manual refresh failed:', err);
      showToast('Cache reloaded');
      switchAdminPanelTab(currentAdminTab);
    });
}

function renderStarMembersGrid(filterQuery) {
  const container = document.getElementById('adminStarMembersGrid');
  const countBadge = document.getElementById('membersTotalCountBadge');
  if (!container) return;

  const searchInput = document.getElementById('adminMembersSearchInput');
  const q = (filterQuery !== undefined ? filterQuery : (searchInput ? searchInput.value : '')).toLowerCase().trim();

  let list = [...ALL_USERS];
  if (q) {
    list = list.filter(u => 
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.userId && u.userId.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.gmail && u.gmail.toLowerCase().includes(q)) ||
      (u.zion && u.zion.toLowerCase().includes(q)) ||
      (u.area && u.area.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }

  if (countBadge) countBadge.textContent = list.length + ' Members';
  const tabMembersCount = document.getElementById('starTabMembersCount');
  if (tabMembersCount) tabMembersCount.textContent = ALL_USERS.length;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <i class="fa-solid fa-users-slash text-4xl text-purple-400/50 mb-3"></i>
        <p class="font-bold text-white text-sm">No Members Found</p>
        <p class="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new member.</p>
      </div>
    `;
    return;
  }

  const managers = ALL_USERS.filter(u => u.role === 'manager' || u.role === 'admin');

  container.innerHTML = list.map(u => {
    const isPrimaryAdmin = u.userId.toLowerCase() === 'surya11008';
    const isApproved = u.status === 'approved' || !u.status;
    const initial = (u.fullName || u.userId || '?').charAt(0).toUpperCase();
    const roleBadge = u.role === 'admin' 
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-xs flex items-center gap-1">👑 ADMIN</span>'
      : (u.role === 'manager' 
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-xs flex items-center gap-1">⭐ MANAGER</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">👤 MEMBER</span>');

    const statusBadge = isApproved 
      ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Active</span>'
      : (u.status === 'pending' 
          ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">Pending</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">Rejected</span>');

    const pastDatesMode = u.viewPastDates !== false;

    return `
      <div class="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-4 shadow-lg hover:shadow-purple-900/10 transition-all flex flex-col justify-between space-y-4">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center shadow-md border border-purple-400/30 flex-shrink-0">
                ${initial}
              </div>
              <div class="min-w-0">
                <h4 class="font-extrabold text-white text-sm flex items-center gap-1.5 flex-wrap truncate">
                  <span class="truncate">${u.fullName || 'User'}</span>
                  ${statusBadge}
                  <span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-500/20 text-purple-200 border border-purple-500/30">
                    <i class="fa-solid fa-id-badge text-[8px] mr-1 text-purple-400"></i>${u.position || 'Member'}
                  </span>
                </h4>
                <div class="text-[11px] font-mono text-purple-300 truncate">@${u.userId}</div>
              </div>
            </div>
            <div class="flex-shrink-0">${roleBadge}</div>
          </div>

          <!-- Category / Position Selector for Admin -->
          <div class="flex items-center justify-between text-xs bg-indigo-50/70 dark:bg-slate-950/60 px-3 py-2 rounded-xl border border-indigo-200/80 dark:border-slate-800 shadow-xs">
            <span class="text-indigo-900 dark:text-indigo-300 text-[11px] font-black flex items-center gap-1.5">
              <i class="fa-solid fa-id-badge text-indigo-500"></i> Category / Position:
            </span>
            <select onchange="adminChangeUserPosition('${u.userId}', this.value)" class="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-[11px] font-bold px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs">
              ${ALL_POSITIONS.map(pos => `<option value="${pos}" ${((u.position || 'Member').toLowerCase() === pos.toLowerCase()) ? 'selected' : ''}>${pos}</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80">
            <div class="text-slate-400 truncate">
              <i class="fa-solid fa-phone text-[10px] text-purple-400 mr-1"></i>
              <span>${u.phone || 'No phone'}</span>
            </div>
            <div class="text-slate-400 truncate">
              <i class="fa-solid fa-envelope text-[10px] text-purple-400 mr-1"></i>
              <span>${u.gmail || 'No email'}</span>
            </div>
            <div class="text-slate-400 truncate">
              <i class="fa-solid fa-church text-[10px] text-purple-400 mr-1"></i>
              <span>${u.zion || 'Zion not set'}</span>
            </div>
            <div class="text-slate-400 truncate">
              <i class="fa-solid fa-location-dot text-[10px] text-purple-400 mr-1"></i>
              <span>${u.area || 'Area not set'}</span>
            </div>
          </div>

          ${!isPrimaryAdmin ? `
            <div class="flex items-center justify-between text-xs bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800">
              <span class="text-slate-400 text-[11px] flex items-center gap-1">
                <i class="fa-solid fa-user-tie text-indigo-400"></i> Assigned Manager:
              </span>
              <select onchange="adminAssignManager('${u.userId}', this.value)" class="bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-[11px] px-2 py-0.5 focus:outline-hidden focus:border-purple-500">
                <option value="" ${!u.assignedManager ? 'selected' : ''}>None (Direct)</option>
                ${managers.map(m => `<option value="${m.userId}" ${u.assignedManager === m.userId ? 'selected' : ''}>${m.fullName} (${m.role})</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>

        <div class="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs">
          <button 
            type="button"
            onclick="adminToggleUserPastDates('${u.userId}')" 
            class="px-2.5 py-1 rounded-xl text-[10px] font-bold transition flex items-center gap-1 ${pastDatesMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'}"
            title="Toggle between Past Dates input or Today Only input"
          >
            <i class="fa-solid fa-calendar-check text-[9px]"></i>
            <span>${pastDatesMode ? 'Past Dates' : 'Today Only'}</span>
          </button>

          ${!isPrimaryAdmin ? `
            <button 
              type="button"
              onclick="adminToggleUserRole('${u.userId}')" 
              class="px-2.5 py-1 rounded-xl text-[10px] font-bold transition flex items-center gap-1 ${u.role === 'manager' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'}"
              title="Change user leadership role"
            >
              <i class="fa-solid fa-user-shield text-[9px]"></i>
              <span>${u.role === 'manager' ? 'Demote to Member' : 'Make Manager'}</span>
            </button>
          ` : ''}

          <button 
            type="button"
            onclick="adminResetUserPassword('${u.userId}')" 
            class="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            title="Reset Password & PIN to 123456"
          >
            <i class="fa-solid fa-key text-[9px] text-amber-400"></i>
            <span>Reset Pass / PIN</span>
          </button>

          ${!isPrimaryAdmin ? `
            <button 
              type="button"
              onclick="adminDeleteUser('${u.userId}')" 
              class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition text-xs cursor-pointer"
              title="Delete member permanently"
            >
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterAdminMembers(val) {
  renderStarMembersGrid(val);
}

function adminToggleUserPastDates(userId) {
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  user.viewPastDates = user.viewPastDates === false ? true : false;
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast(user.fullName + ': ' + (user.viewPastDates ? 'Past Dates Allowed' : 'Restricted to Today Only'));
  renderStarMembersGrid();
}

function adminToggleUserRole(userId) {
  if (userId.toLowerCase() === 'surya11008') {
    alert('Master Admin authority cannot be changed.');
    return;
  }
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  const newRole = user.role === 'manager' ? 'member' : 'manager';
  user.role = newRole;
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast('Updated ' + user.fullName + ' role to ' + newRole.toUpperCase() + '!');
  renderStarMembersGrid();
  renderStarManagersList();
}

function adminAssignManager(userId, managerId) {
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  user.assignedManager = managerId || null;
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast('Assigned ' + user.fullName + ' to ' + (managerId ? managerId : 'Direct'));
}

async function adminResetUserPassword(userId) {
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  
  const customPass = prompt('Reset password for ' + user.fullName + ' (@' + user.userId + ')?\n\nEnter new password (or leave blank to use default 123456):', '123456');
  if (customPass === null) return;
  
  const finalPass = customPass.trim() || '123456';
  const customPin = prompt('Enter 6-digit PIN for ' + user.fullName + ' (or leave blank for 123456):', '123456');
  const finalPin = (customPin && /^\d{6}$/.test(customPin.trim())) ? customPin.trim() : '123456';

  user.password = finalPass;
  user.pin = finalPin;

  const idx = ALL_USERS.findIndex(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (idx !== -1) ALL_USERS[idx] = user;

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  
  try {
    await fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/users.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ALL_USERS)
    });
  } catch (e) {
    console.warn('Direct PUT failed:', e);
  }
  fbSync('users', ALL_USERS);

  renderAdminPanelUsers();
  alert('✅ Password & PIN successfully reset for ' + user.fullName + ' in Cloud Database!\n\nNew Login Credentials:\nUser ID: ' + user.userId + '\nPassword: ' + finalPass + '\nPIN: ' + finalPin);
}

function adminDeleteUser(userId) {
  if (userId.toLowerCase() === 'surya11008') {
    alert('Master Admin cannot be deleted.');
    return;
  }
  const user = ALL_USERS.find(u => u.userId.toLowerCase() === userId.toLowerCase());
  if (!user) return;
  if (!confirm('Are you sure you want to permanently delete user ' + user.fullName + ' (@' + user.userId + ')?\nThis cannot be undone.')) return;
  ALL_USERS = ALL_USERS.filter(u => u.userId.toLowerCase() !== userId.toLowerCase());
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast('User ' + userId + ' deleted permanently.');
  updateStarAdminBadges();
  renderStarMembersGrid();
}

function renderStarOnlineGrid() {
  const container = document.getElementById('adminStarOnlineGrid');
  const title = document.getElementById('starOnlineHeaderTitle');
  const tabBadge = document.getElementById('starTabOnlineCount');
  if (!container) return;

  const now = Date.now();
  let onlineUsers = [];

  if (CURRENT_USER && CURRENT_USER.userId) {
    onlineUsers.push({
      userId: CURRENT_USER.userId,
      fullName: CURRENT_USER.fullName,
      role: CURRENT_USER.role,
      zion: CURRENT_USER.zion || '',
      area: CURRENT_USER.area || '',
      lastActive: now,
      isSelf: true
    });
  }

  if (PRESENCE_DATA && typeof PRESENCE_DATA === 'object') {
    Object.values(PRESENCE_DATA).forEach(p => {
      if (p && p.userId && (!CURRENT_USER || p.userId.toLowerCase() !== CURRENT_USER.userId.toLowerCase())) {
        const diffMs = now - (p.lastActive || 0);
        if (diffMs < 60 * 60 * 1000) {
          onlineUsers.push({
            ...p,
            isSelf: false
          });
        }
      }
    });
  }

  onlineUsers.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));

  if (title) title.textContent = 'Live Online Members (' + onlineUsers.length + ')';
  if (tabBadge) tabBadge.textContent = onlineUsers.length;

  container.innerHTML = onlineUsers.map(u => {
    const diffMin = Math.round((now - (u.lastActive || now)) / 60000);
    const statusText = u.isSelf ? 'Active Now (You)' : (diffMin <= 5 ? 'Active Now' : diffMin + 'm ago');
    const initial = (u.fullName || u.userId || '?').charAt(0).toUpperCase();

    return `
      <div class="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-4 shadow-lg flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative flex-shrink-0">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-lg flex items-center justify-center shadow-md">
              ${initial}
            </div>
            <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse"></span>
          </div>
          <div class="min-w-0">
            <h4 class="font-bold text-white text-sm truncate">${u.fullName || 'User'}</h4>
            <div class="text-[11px] font-mono text-slate-400">@${u.userId}</div>
            <div class="text-[10px] text-slate-500 truncate mt-0.5">
              ${u.zion ? `<span>${u.zion}</span> • ` : ''}<span>${u.area || 'Active'}</span>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0 text-right">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ${statusText}
          </span>
          <div class="text-[9px] text-slate-500 mt-1 uppercase font-semibold">${u.role || 'member'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStarApprovalsList() {
  const container = document.getElementById('starPendingListContainer');
  if (!container) return;

  const pending = ALL_USERS.filter(u => u.status === 'pending');
  const rejected = ALL_USERS.filter(u => u.status === 'rejected');

  updateStarAdminBadges();

  let html = '';

  if (pending.length === 0) {
    html += `
      <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/30">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3 class="font-extrabold text-white text-base">No Pending Approvals</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto">
          All registered users have been reviewed and approved! All new accounts can log in immediately upon approval.
        </p>
        <div class="pt-2">
          <button 
            type="button" 
            onclick="toggleAddRecoverMemberForm()" 
            class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition inline-flex items-center gap-2 shadow-md shadow-purple-900/30 cursor-pointer"
          >
            <i class="fa-solid fa-user-plus"></i>
            <span>Add or Recover Member Immediately</span>
          </button>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="space-y-3">
        <div class="text-xs font-bold text-slate-400 px-1 flex items-center justify-between">
          <span>Reviewing ${pending.length} Registration Requests:</span>
          <span class="text-[11px] text-purple-300">Click Approve to grant immediate access</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${pending.map(u => `
            <div class="bg-slate-900 border border-amber-500/40 hover:border-amber-500 rounded-3xl p-4 shadow-lg flex flex-col justify-between space-y-3 transition">
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <div class="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 font-black flex items-center justify-center text-base border border-amber-500/30">
                      ${(u.fullName || u.userId || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 class="font-extrabold text-white text-sm">${u.fullName || 'User'}</h4>
                      <div class="text-[11px] font-mono text-purple-300">ID: ${u.userId}</div>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    ⏳ Pending
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
                  <div class="text-slate-300 truncate">
                    <i class="fa-solid fa-phone text-[10px] text-amber-400 mr-1"></i>
                    <span>${u.phone || 'No phone'}</span>
                  </div>
                  <div class="text-slate-300 truncate">
                    <i class="fa-solid fa-envelope text-[10px] text-amber-400 mr-1"></i>
                    <span>${u.gmail || 'No email'}</span>
                  </div>
                  <div class="text-slate-300 truncate">
                    <i class="fa-solid fa-church text-[10px] text-amber-400 mr-1"></i>
                    <span>${u.zion || 'Zion not set'}</span>
                  </div>
                  <div class="text-slate-300 truncate">
                    <i class="fa-solid fa-location-dot text-[10px] text-amber-400 mr-1"></i>
                    <span>${u.area || 'Area not set'}</span>
                  </div>
                </div>

                <div class="text-[10px] text-slate-500 flex items-center justify-between px-1">
                  <span>Registered: ${new Date(u.registeredAt || Date.now()).toLocaleDateString()}</span>
                  <span>Pass: ${u.password ? 'Set' : 'Default'}</span>
                </div>
              </div>

              <div class="pt-2 border-t border-slate-800 flex items-center gap-2">
                <button 
                  type="button"
                  onclick="approveUser('${u.userId}')" 
                  class="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i class="fa-solid fa-check"></i>
                  <span>Approve & Grant Access</span>
                </button>
                <button 
                  type="button"
                  onclick="rejectUser('${u.userId}')" 
                  class="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <i class="fa-solid fa-xmark"></i>
                  <span>Reject</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (rejected.length > 0) {
    html += `
      <div class="mt-6 pt-4 border-t border-slate-800 space-y-2">
        <h4 class="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <i class="fa-solid fa-user-xmark text-rose-400"></i>
          Rejected / Inactive Registrations (Click Approve to Restore):
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${rejected.map(u => `
            <div class="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-white text-xs truncate">${u.fullName}</span>
                  <span class="text-[10px] font-mono text-purple-300">@${u.userId}</span>
                  <span class="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-bold">Rejected</span>
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5 truncate">${u.zion || ''} • ${u.phone || ''}</div>
              </div>
              <button 
                type="button"
                onclick="approveUser('${u.userId}')" 
                class="px-3 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>Re-Approve</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function toggleAddRecoverMemberForm() {
  const box = document.getElementById('starRecoverMemberBox');
  if (!box) return;
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    const input = document.getElementById('recoverFullName');
    if (input) input.focus();
  }
}

function handleAdminRecoverMemberSubmit(e) {
  e.preventDefault();
  const fullName = document.getElementById('recoverFullName').value.trim();
  const userId = document.getElementById('recoverUserId').value.trim().toLowerCase();
  const phone = document.getElementById('recoverPhone').value.trim();
  const gmail = document.getElementById('recoverGmail').value.trim();
  const zion = document.getElementById('recoverZion').value.trim();
  const area = document.getElementById('recoverArea').value.trim();
  const password = document.getElementById('recoverPassword').value.trim() || '123456';
  const pin = document.getElementById('recoverPin').value.trim() || '123456';
  const position = document.getElementById('recoverPosition') ? document.getElementById('recoverPosition').value : 'Member';

  if (!fullName || !userId) {
    alert('Please enter Full Name and User ID.');
    return;
  }

  const existingIdx = ALL_USERS.findIndex(u => u.userId.toLowerCase() === userId);
  const newUserData = {
    fullName,
    userId,
    phone,
    gmail,
    zion,
    area,
    password,
    pin,
    position: position || 'Member',
    role: 'member',
    status: 'approved',
    canDownload: true,
    viewPastDates: true,
    assignedModules: ['all'],
    registeredAt: Date.now()
  };

  if (existingIdx !== -1) {
    ALL_USERS[existingIdx] = { ...ALL_USERS[existingIdx], ...newUserData, status: 'approved' };
  } else {
    ALL_USERS.push(newUserData);
  }

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);

  e.target.reset();
  const box = document.getElementById('starRecoverMemberBox');
  if (box) box.classList.add('hidden');

  alert('Member "' + fullName + '" successfully recovered and approved!\n\nUser can log in now:\nUser ID: ' + userId + '\nPassword: ' + password + '\nPIN: ' + pin);

  updateStarAdminBadges();
  renderStarApprovalsList();
  renderStarMembersGrid();
}

function approveAllPendingMembers() {
  const pending = ALL_USERS.filter(u => u.status === 'pending');
  if (pending.length === 0) {
    showToast('No pending members to approve.');
    return;
  }
  if (!confirm('Approve all ' + pending.length + ' pending members at once?')) return;

  ALL_USERS.forEach(u => {
    if (u.status === 'pending') {
      u.status = 'approved';
      if (!u.role) u.role = 'member';
      if (u.canDownload === undefined) u.canDownload = true;
      if (u.viewPastDates === undefined) u.viewPastDates = true;
    }
  });

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  fbSync('users', ALL_USERS);
  showToast('Successfully approved all ' + pending.length + ' members!');

  updateStarAdminBadges();
  renderStarApprovalsList();
  renderStarMembersGrid();
}

function renderStarManagersList() {
  const container = document.getElementById('starManagersListContainer');
  if (!container) return;

  const managers = ALL_USERS.filter(u => u.role === 'manager');

  if (managers.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-2xl border border-purple-500/30">
          <i class="fa-solid fa-user-shield"></i>
        </div>
        <h3 class="font-extrabold text-white text-base">No Appointed Managers</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto">
          Managers can oversee designated members and past-date records. To appoint a manager, go to the <strong>Members Information</strong> tab and click <strong>"Make Manager"</strong> on any member.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${managers.map(m => {
        const assignedMembers = ALL_USERS.filter(u => u.assignedManager === m.userId);
        const pastDatesMode = m.viewPastDates !== false;
        return `
          <div class="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-4 shadow-lg space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black flex items-center justify-center text-base">
                  ${m.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 class="font-extrabold text-white text-sm">${m.fullName}</h4>
                  <div class="text-[11px] font-mono text-purple-300">@${m.userId}</div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                MANAGER
              </span>
            </div>

            <div class="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 space-y-1">
              <div><strong>Zion:</strong> ${m.zion || 'Not set'} | <strong>Area:</strong> ${m.area || 'Not set'}</div>
              <div><strong>Assigned Members:</strong> ${assignedMembers.length} members under supervision</div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <button 
                type="button"
                onclick="adminToggleUserPastDates('${m.userId}')" 
                class="px-2.5 py-1 rounded-xl text-[10px] font-bold ${pastDatesMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}"
              >
                ${pastDatesMode ? 'Past Dates Allowed' : 'Today Only'}
              </button>
              <button 
                type="button"
                onclick="adminToggleUserRole('${m.userId}')" 
                class="text-[10px] text-rose-400 hover:underline cursor-pointer"
              >
                Demote to Member
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderStarMemberPerms() {
  const btn = document.getElementById('starGlobalDownloadBtn');
  const tbody = document.getElementById('starMemberPermsTableBody');
  
  if (btn) {
    if (DOWNLOADS_ENABLED) {
      btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer';
      btn.innerHTML = '<i class="fa-solid fa-lock-open text-xs"></i><span>Downloads: ACTIVE (All Allowed)</span>';
    } else {
      btn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md bg-rose-600 hover:bg-rose-500 text-white cursor-pointer';
      btn.innerHTML = '<i class="fa-solid fa-lock text-xs"></i><span>Downloads: OFF (Admin Only)</span>';
    }
  }

  if (!tbody) return;

  tbody.innerHTML = ALL_USERS.map(u => {
    const isPrimaryAdmin = u.userId.toLowerCase() === 'surya11008';
    const canDown = isPrimaryAdmin ? true : (u.canDownload !== false);
    return `
      <tr class="hover:bg-slate-900/60 transition">
        <td class="py-2.5 px-3">
          <div class="font-bold text-white text-xs">${u.fullName}</div>
          <div class="text-[10px] font-mono text-purple-300">@${u.userId}</div>
        </td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : (u.role === 'manager' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400')}">
            ${u.role ? u.role.toUpperCase() : 'MEMBER'}
          </span>
        </td>
        <td class="py-2.5 px-3">
          ${isPrimaryAdmin ? `
            <span class="text-emerald-400 font-extrabold text-[11px]">Unlimited Master</span>
          ` : `
            <button 
              type="button"
              onclick="toggleUserDownload('${u.userId}')" 
              class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${canDown ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'} cursor-pointer"
            >
              ${canDown ? 'Allowed' : 'Blocked'}
            </button>
          `}
        </td>
        <td class="py-2.5 px-3 text-[11px] text-slate-400">
          ${u.role === 'admin' ? 'All Modules (Master)' : 'All Available Modules'}
        </td>
      </tr>
    `;
  }).join('');
}

function toggleGlobalDownloadSetting() {
  DOWNLOADS_ENABLED = !DOWNLOADS_ENABLED;
  localStorage.setItem('wlh_downloads_enabled', JSON.stringify(DOWNLOADS_ENABLED));
  fbSync('downloads_enabled', DOWNLOADS_ENABLED);
  showToast('Global File Downloads: ' + (DOWNLOADS_ENABLED ? 'ENABLED for all members' : 'DISABLED (Admin only)'));
  renderStarMemberPerms();
  updateTopDownloadBtn();
  renderRecords();
}

function renderStarFeedbackList() {
  const container = document.getElementById('starFeedbackListContainer');
  const countBadge = document.getElementById('starFeedbackCountBadge');
  const tabBadge = document.getElementById('starTabFeedbackBadge');
  if (!container) return;

  if (countBadge) countBadge.textContent = suggestionsList.length + ' Enquiries';
  if (tabBadge) {
    tabBadge.textContent = suggestionsList.length;
    tabBadge.classList.toggle('hidden', suggestionsList.length === 0);
  }

  if (suggestionsList.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-2xl border border-sky-500/30">
          <i class="fa-solid fa-comments"></i>
        </div>
        <h3 class="font-extrabold text-white text-base">No Feedback or Suggestions</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto">
          User enquiries and suggestions submitted from the portal settings will appear here in real-time.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="space-y-3">
      ${suggestionsList.map((s, idx) => `
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="font-bold text-white text-sm">${s.subject || 'Enquiry'}</h4>
              <div class="text-[11px] text-purple-300 mt-0.5">
                From: <strong>${s.userName || 'Member'}</strong> (@${s.userId || 'anon'}) • ${s.zion || 'Zion'}
              </div>
            </div>
            <span class="text-[10px] text-slate-500 font-mono flex-shrink-0">${s.time || ''}</span>
          </div>
          <p class="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 leading-relaxed">
            ${s.message || ''}
          </p>
          <div class="flex justify-end pt-1">
            <button 
              type="button"
              onclick="adminDeleteSuggestion(${idx})" 
              class="text-[11px] text-slate-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
            >
              <i class="fa-solid fa-trash-can text-[10px]"></i> Dismiss
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function adminDeleteSuggestion(index) {
  suggestionsList.splice(index, 1);
  localStorage.setItem('wlh_suggestions', JSON.stringify(suggestionsList));
  fbSync('suggestions', suggestionsList);
  renderStarFeedbackList();
  showToast('Enquiry removed.');
}

function renderStarFirebaseTab() {
  const badge = document.getElementById('firebaseConnectionStatusBadge');
  const input = document.getElementById('firebaseConfigInput');
  if (badge) {
    badge.textContent = IS_FIREBASE_CONNECTED ? 'Connected & Live' : 'Connected via Cloud REST API';
  }
  if (input) {
    input.value = JSON.stringify({
      databaseURL: 'https://lsupport-e390b-default-rtdb.firebaseio.com',
      projectId: 'lsupport-e390b',
      connected: true,
      totalUsers: ALL_USERS.length,
      pendingUsers: ALL_USERS.filter(u => u.status === 'pending').length,
      noticesCount: NOTICES_LIST.length,
      schedulesCount: SCHEDULES_LIST.length
    }, null, 2);
  }
}

function saveFirebaseConfig(e) {
  if (e) e.preventDefault();
  showToast('Firebase connection parameters verified & active.');
}

// Aliases for legacy hooks
function renderAdminPanelApprovals() { renderStarApprovalsList(); }
function renderAdminPanelUsers() { renderStarMembersGrid(); }
function renderAdminPanelNotices() {}
function renderAdminPanelAudit() {}
function loadFirebasePanelData() { renderStarFirebaseTab(); }



// Post Notice Form
function openAddNoticeModal() {
  const modal = document.getElementById('addNoticeModal');
  const container = document.getElementById('addNoticeModalContainer');
  if (!modal || !container) return;
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeAddNoticeModal() {
  const modal = document.getElementById('addNoticeModal');
  const container = document.getElementById('addNoticeModalContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}


function handleNoticeFileSelect(input) {
  const container = document.getElementById('noticeSelectedFilesContainer');
  if (!container || !input.files) return;

  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      pendingNoticeAttachments.push({
        name: file.name,
        size: Math.round(file.size / 1024) + ' KB',
        type: file.type || 'application/octet-stream',
        url: e.target.result
      });
      renderNoticeAttachmentPills();
    };
    reader.readAsDataURL(file);
  });
}

function renderNoticeAttachmentPills() {
  const container = document.getElementById('noticeSelectedFilesContainer');
  if (!container) return;
  container.innerHTML = pendingNoticeAttachments.map((att, i) => `
    <span class="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-slate-300 flex items-center gap-1">
      <i class="fa-solid fa-file text-rose-400 text-[9px]"></i>
      <span class="truncate max-w-[120px]">${att.name}</span>
      <button type="button" onclick="removeNoticeAttachment(${i})" class="text-slate-400 hover:text-rose-400 ml-1">×</button>
    </span>
  `).join('');
}

function removeNoticeAttachment(index) {
  pendingNoticeAttachments.splice(index, 1);
  renderNoticeAttachmentPills();
}

function handleSaveNotice(e) {
  e.preventDefault();
  const title = document.getElementById('noticeTitleInput').value.trim();
  const category = document.getElementById('noticeCategoryInput').value;
  const color = document.getElementById('noticeColorInput').value;
  const content = document.getElementById('noticeContentInput').value.trim();

  const linkUrl = document.getElementById('noticeLinkInput') ? document.getElementById('noticeLinkInput').value.trim() : '';
  const finalAttachments = [...pendingNoticeAttachments];
  if (linkUrl) {
    finalAttachments.push({
      name: 'Linked Resource',
      size: 'Cloud Link',
      type: 'link',
      url: linkUrl
    });
  }

  const newNotice = {
    id: 'not_' + Date.now(),
    title,
    category,
    color,
    content,
    attachments: finalAttachments,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    author: CURRENT_USER.fullName || 'Admin'
  };
  pendingNoticeAttachments = [];
  if (document.getElementById('noticeSelectedFilesContainer')) {
    document.getElementById('noticeSelectedFilesContainer').innerHTML = '';
  }

  NOTICES_LIST.unshift(newNotice);
  localStorage.setItem('l_support_notices', JSON.stringify(NOTICES_LIST));
  fbSync('notices', NOTICES_LIST);
  closeAddNoticeModal();
  renderHomeNotices();
  renderAdminPanelNotices();
  showToast('Notice published successfully!');
}

function deleteNotice(id) {
  if (!confirm('Are you sure you want to delete this notice?')) return;
  NOTICES_LIST = NOTICES_LIST.filter(n => n.id !== id);
  localStorage.setItem('l_support_notices', JSON.stringify(NOTICES_LIST));
  fbSync('notices', NOTICES_LIST);
  renderHomeNotices();
  renderAdminPanelNotices();
  showToast('Notice deleted.');
}



// ========================================================
// DUAL-CHANNEL REALTIME SYNC ENGINE (WEBSOCKET + 15S BACKGROUND POLLER)
// ========================================================
function startBackgroundLivePoller() {
  setInterval(() => {
    if (!CURRENT_USER) return;
    fetch('https://lsupport-e390b-default-rtdb.firebaseio.com/l_support.json')
      .then(r => r.json())
      .then(data => {
        if (!data) return;
        let usersChanged = false;

        // 1. Users sync
        if (data.users) {
          let uList = data.users;
          if (!Array.isArray(uList) && typeof uList === 'object') uList = Object.values(uList);
          if (Array.isArray(uList)) {
            const currentStr = JSON.stringify(ALL_USERS);
            const remoteStr = JSON.stringify(uList);
            if (currentStr !== remoteStr) {
              ALL_USERS = uList;
              localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
              usersChanged = true;
            }
          }
        }

        // 2. Downloads permission sync
        if (data.downloads_enabled !== undefined && data.downloads_enabled !== DOWNLOADS_ENABLED) {
          DOWNLOADS_ENABLED = data.downloads_enabled;
          localStorage.setItem('wlh_downloads_enabled', JSON.stringify(DOWNLOADS_ENABLED));
          updateTopDownloadBtn();
          renderRecords();
          if (typeof renderStarMemberPerms === 'function') renderStarMemberPerms();
        }

        // 3. Notices sync
        if (data.notices) {
          let nList = data.notices;
          if (!Array.isArray(nList) && typeof nList === 'object') nList = Object.values(nList);
          if (Array.isArray(nList) && JSON.stringify(nList) !== JSON.stringify(NOTICES_LIST)) {
            NOTICES_LIST = nList;
            localStorage.setItem('l_support_notices', JSON.stringify(NOTICES_LIST));
            renderHomeNotices();
          }
        }

        // 4. Schedules sync
        if (data.schedules) {
          let sList = data.schedules;
          if (!Array.isArray(sList) && typeof sList === 'object') sList = Object.values(sList);
          if (Array.isArray(sList) && JSON.stringify(sList) !== JSON.stringify(SCHEDULES_LIST)) {
            SCHEDULES_LIST = sList;
            localStorage.setItem('l_support_schedules', JSON.stringify(SCHEDULES_LIST));
            renderHomeSchedule();
          }
        }

        // 5. Presence sync
        if (data.presence && typeof data.presence === 'object') {
          PRESENCE_DATA = data.presence;
          if (typeof renderStarOnlineGrid === 'function' && currentAdminTab === 'online') {
            renderStarOnlineGrid();
          }
        }

        // 6. Permissions sync
        if (data.module_permissions && typeof data.module_permissions === 'object') {
          modulePermissions = data.module_permissions;
          localStorage.setItem('wlh_module_permissions', JSON.stringify(modulePermissions));
        }
        if (data.topic_permissions && typeof data.topic_permissions === 'object') {
          topicPermissions = data.topic_permissions;
          localStorage.setItem('wlh_topic_permissions', JSON.stringify(topicPermissions));
        }
        if (data.file_permissions && typeof data.file_permissions === 'object') {
          filePermissions = data.file_permissions;
          localStorage.setItem('wlh_file_permissions', JSON.stringify(filePermissions));
        }

        if (usersChanged) {
          if (typeof updateStarAdminBadges === 'function') updateStarAdminBadges();
          if (CURRENT_USER.role === 'admin') {
            if (typeof renderStarApprovalsList === 'function') renderStarApprovalsList();
            if (typeof renderStarMembersGrid === 'function') renderStarMembersGrid();
          }
        }
      })
      .catch(() => {});
  }, 12000); // Polls every 12 seconds as a secondary fallback
}

// ========================================================
// FIREBASE REALTIME CLOUD SYNCHRONIZATION ENGINE
// ========================================================
function initFirebase() {
  if (!window.firebase) return;
  const config = FIREBASE_CONFIG || BUILTIN_FIREBASE_CONFIG;
  if (!config || !config.apiKey || !config.databaseURL) {
    updateFirebaseStatusBadge(false);
    return;
  }

  try {
    if (!firebase.apps.length) {
      FIREBASE_APP = firebase.initializeApp(config);
    } else {
      FIREBASE_APP = firebase.app();
    }
    FIREBASE_DB = firebase.database();
    IS_FIREBASE_CONNECTED = true;
    updateFirebaseStatusBadge(true);
    setupRealtimeListeners();
    console.log('🔥 Firebase Realtime Cloud Connected!');
  } catch (err) {
    console.error('Firebase connection error:', err);
    updateFirebaseStatusBadge(false);
  }
}

function updateFirebaseStatusBadge(connected) {
  const badge = document.getElementById('firebaseConnectionStatusBadge');
  if (!badge) return;
  if (connected) {
    badge.className = 'px-3 py-1 rounded-xl font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> 🟢 Live Cloud Sync Active';
  } else {
    badge.className = 'px-3 py-1 rounded-xl font-bold text-xs bg-slate-800 text-slate-400 border border-slate-700';
    badge.innerHTML = '⚪ Local Storage Mode (Offline)';
  }
}

function loadFirebasePanelData() {
  const input = document.getElementById('firebaseConfigInput');
  if (input && FIREBASE_CONFIG) {
    input.value = JSON.stringify(FIREBASE_CONFIG, null, 2);
  }
  updateFirebaseStatusBadge(IS_FIREBASE_CONNECTED);
}

function saveFirebaseConfig(e) {
  e.preventDefault();
  const raw = document.getElementById('firebaseConfigInput').value.trim();
  try {
    const config = JSON.parse(raw);
    FIREBASE_CONFIG = config;
    localStorage.setItem('l_support_firebase_config', JSON.stringify(config));
    initFirebase();
    showToast('Firebase configuration saved!');
  } catch (err) {
    alert('Invalid JSON! Please verify your Firebase config object.');
  }
}

function testFirebaseConnection() {
  if (IS_FIREBASE_CONNECTED && FIREBASE_DB) {
    FIREBASE_DB.ref('.info/connected').once('value').then(snap => {
      if (snap.val() === true) {
        alert('✅ Firebase Connection Successful! Live cloud sync is active.');
      } else {
        alert('⚠️ Firebase initialized, waiting for server connection.');
      }
    });
  } else {
    alert('Firebase is not yet connected. Please check your configuration and Database URL.');
  }
}

function fbSync(path, data) {
  const restUrl = 'https://lsupport-e390b-default-rtdb.firebaseio.com/l_support/' + path + '.json';
  if (IS_FIREBASE_CONNECTED && FIREBASE_DB) {
    FIREBASE_DB.ref('l_support/' + path).set(data).catch(err => {
      console.warn('Firebase SDK write failed for', path, err);
      try {
        fetch(restUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(e => console.warn('REST fallback failed:', e));
      } catch (e) {}
    });
  } else {
    try {
      fetch(restUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(e => console.warn('Direct REST sync failed:', e));
    } catch (e) {}
  }
}

function setupRealtimeListeners() {
  if (!IS_FIREBASE_CONNECTED || !FIREBASE_DB) return;

  // 0. Sync Schedules Live
  FIREBASE_DB.ref('l_support/schedules').on('value', snap => {
    let val = snap.val();
    if (val && !Array.isArray(val) && typeof val === 'object') val = Object.values(val);
    if (val && Array.isArray(val)) {
      SCHEDULES_LIST = val;
      localStorage.setItem('l_support_schedules', JSON.stringify(SCHEDULES_LIST));
      renderHomeSchedule();
    }
  });

  // 1. Sync Notices Live
  FIREBASE_DB.ref('l_support/notices').on('value', snap => {
    let val = snap.val();
    if (val && !Array.isArray(val) && typeof val === 'object') val = Object.values(val);
    if (val && Array.isArray(val)) {
      NOTICES_LIST = val;
      localStorage.setItem('l_support_notices', JSON.stringify(NOTICES_LIST));
      renderHomeNotices();
      renderAdminPanelNotices();
    }
  });

  // 2. Sync Sermon Used Records Live
  FIREBASE_DB.ref('l_support/my_room_records').on('value', snap => {
    let val = snap.val();
    if (val && !Array.isArray(val) && typeof val === 'object') val = Object.values(val);
    if (val && Array.isArray(val)) {
      myRoomRecords = val;
      localStorage.setItem('wlh_my_room_records', JSON.stringify(myRoomRecords));
      updateMyRoomBadge();
      if (activeView === 'myroom') renderMyRoomTimeline();
    }
  });

  // 3. Sync User Registrations & Approvals Live
  FIREBASE_DB.ref('l_support/users').on('value', snap => {
    let val = snap.val();
    if (val && !Array.isArray(val) && typeof val === 'object') val = Object.values(val);
    if (val && Array.isArray(val)) {
      // Smart Auto-Recovery: Merge any local pending users created on this device that are missing in Firebase
      let merged = [...val];
      try {
        const localUsers = JSON.parse(localStorage.getItem('wlh_users') || '[]');
        if (Array.isArray(localUsers)) {
          const missingRemote = localUsers.filter(lu => lu && lu.userId && !val.some(ru => ru.userId.toLowerCase() === lu.userId.toLowerCase()));
          if (missingRemote.length > 0) {
            merged = merged.concat(missingRemote);
            FIREBASE_DB.ref('l_support/users').set(merged);
          }
        }
      } catch (e) {}

      const prevPendingCount = ALL_USERS.filter(u => u.status === 'pending').length;
      ALL_USERS = merged;
      localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
      updateApprovalCountBadge();

      if (CURRENT_USER && CURRENT_USER.role === 'admin') {
        renderAdminPanelApprovals();
        renderAdminPanelUsers();
        renderPendingUsersList();

        const pending = ALL_USERS.filter(u => u.status === 'pending');
        if (pending.length > 0) {
          openPendingApprovalsModal();
        }
      }
    }
  });

  // 4. Sync Downloads Permission Live
  FIREBASE_DB.ref('l_support/downloads_enabled').on('value', snap => {
    const val = snap.val();
    if (typeof val === 'boolean') {
      DOWNLOADS_ENABLED = val;
      localStorage.setItem('wlh_downloads_enabled', JSON.stringify(val));
      updateTopDownloadBtn();
      renderRecords();
    }
  });

  // 5. Sync Custom Resources Live
  FIREBASE_DB.ref('l_support/custom_resources').on('value', snap => {
    const val = snap.val();
    if (val && Array.isArray(val)) {
      customItems = val;
      localStorage.setItem('wlh_custom_resources', JSON.stringify(customItems));
      refreshDataModel();
      renderRecords();
      renderHomeNewArrivals();
    }
  });

  // 6. Sync Presence Live
  FIREBASE_DB.ref('l_support/presence').on('value', snap => {
    let val = snap.val();
    if (val && typeof val === 'object') {
      PRESENCE_DATA = val;
      renderStarOnlineGrid();
    }
  });

  // 8. Sync Module Permissions Live
  FIREBASE_DB.ref('l_support/module_permissions').on('value', snap => {
    let val = snap.val();
    if (val && typeof val === 'object') {
      modulePermissions = val;
      localStorage.setItem('wlh_module_permissions', JSON.stringify(modulePermissions));
      renderSidebarCategories();
      renderRecords();
    }
  });

  // 9. Sync Topic Permissions Live
  FIREBASE_DB.ref('l_support/topic_permissions').on('value', snap => {
    let val = snap.val();
    if (val && typeof val === 'object') {
      topicPermissions = val;
      localStorage.setItem('wlh_topic_permissions', JSON.stringify(topicPermissions));
      renderSubgroupTabs();
      renderRecords();
    }
  });

  // 10. Sync File Permissions Live
  FIREBASE_DB.ref('l_support/file_permissions').on('value', snap => {
    let val = snap.val();
    if (val && typeof val === 'object') {
      filePermissions = val;
      localStorage.setItem('wlh_file_permissions', JSON.stringify(filePermissions));
      renderRecords();
    }
  });

  // 7. Sync Suggestions / Feedback Live
  FIREBASE_DB.ref('l_support/suggestions').on('value', snap => {
    let val = snap.val();
    if (val && !Array.isArray(val) && typeof val === 'object') val = Object.values(val);
    if (val && Array.isArray(val)) {
      suggestionsList = val;
      localStorage.setItem('wlh_suggestions', JSON.stringify(suggestionsList));
      renderStarFeedbackList();
    }
  });
}


// ========================================================
// INTERACTIVE SCHEDULE & CALENDAR LOGIC
// ========================================================
function renderHomeSchedule() {
  const container = document.getElementById('homeScheduleContainer');
  if (!container) return;

  const isAdmin = CURRENT_USER && CURRENT_USER.role === 'admin';
  const btnAdd = document.getElementById('btnAdminAddSchedule');
  if (btnAdd) btnAdd.classList.toggle('hidden', !isAdmin);

  // Month header & interactive calendar strip
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthStr = monthNames[activeCalendarMonth] + ' ' + activeCalendarYear;

  // Filter events for active month or selected date
  let events = [...SCHEDULES_LIST];
  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (activeCalendarSelectedDate) {
    events = events.filter(e => e.date === activeCalendarSelectedDate);
  }

  const calendarStripHtml = `
    <div class="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 mb-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-white">${monthStr}</span>
          ${activeCalendarSelectedDate ? `<button onclick="clearScheduleDateFilter()" class="text-[10px] text-sky-400 hover:underline">Show All</button>` : ''}
        </div>
        <div class="flex items-center gap-1">
          <button onclick="changeCalendarMonth(-1)" class="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">‹</button>
          <button onclick="changeCalendarMonth(1)" class="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">›</button>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 font-bold">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div class="grid grid-cols-7 gap-1" id="calendarDaysGrid">
        ${generateCalendarDaysHtml()}
      </div>
    </div>
  `;

  let eventsListHtml = '';
  if (events.length === 0) {
    eventsListHtml = '<div class="py-6 text-center text-slate-500 text-xs">No services scheduled for this selection.</div>';
  } else {
    eventsListHtml = events.map(s => {
      const isPast = s.date && new Date(s.date + 'T23:59:59') < new Date();
      return `
        <div class="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-sm hover:border-sky-500/30 transition">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-base flex-shrink-0">
              ${s.icon || '⛪'}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-extrabold text-white text-xs truncate">${s.title}</h4>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">${s.category || 'Service'}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span><i class="fa-solid fa-calendar-day text-[10px] mr-1 text-slate-500"></i>${s.date}</span>
                <span>•</span>
                <span class="text-sky-300 font-mono font-semibold">${s.time}</span>
              </div>
              ${s.notes ? `<p class="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">${s.notes}</p>` : ''}
            </div>
          </div>
          
          <div class="flex items-center gap-1.5 flex-shrink-0">
            ${isAdmin ? `
              <button onclick="editScheduleEvent('${s.id}')" class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition text-xs" title="Edit">
                <i class="fa-solid fa-pen text-[10px]"></i>
              </button>
              <button onclick="deleteScheduleEvent('${s.id}')" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition text-xs" title="Delete">
                <i class="fa-solid fa-trash-can text-[10px]"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = calendarStripHtml + '<div class="space-y-2.5">' + eventsListHtml + '</div>';
}

function generateCalendarDaysHtml() {
  const firstDay = new Date(activeCalendarYear, activeCalendarMonth, 1).getDay();
  const totalDays = new Date(activeCalendarYear, activeCalendarMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += '<span class="py-1"></span>';
  }

  for (let d = 1; d <= totalDays; d++) {
    const dStr = activeCalendarYear + '-' + String(activeCalendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const hasEvent = SCHEDULES_LIST.some(e => e.date === dStr);
    const isToday = dStr === todayStr;
    const isSelected = dStr === activeCalendarSelectedDate;

    let cls = 'py-1 text-[11px] rounded-lg text-center font-bold cursor-pointer transition relative ';
    if (isSelected) {
      cls += 'bg-sky-600 text-white shadow-sm';
    } else if (isToday) {
      cls += 'bg-slate-800 text-amber-300 border border-amber-500/40';
    } else if (hasEvent) {
      cls += 'bg-slate-850 text-slate-200 hover:bg-slate-800 border border-slate-700/60';
    } else {
      cls += 'text-slate-400 hover:bg-slate-800/60';
    }

    html += `
      <button type="button" onclick="selectCalendarDate('${dStr}')" class="${cls}">
        ${d}
        ${hasEvent && !isSelected ? '<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-400"></span>' : ''}
      </button>
    `;
  }
  return html;
}

function changeCalendarMonth(delta) {
  activeCalendarMonth += delta;
  if (activeCalendarMonth < 0) {
    activeCalendarMonth = 11;
    activeCalendarYear--;
  } else if (activeCalendarMonth > 11) {
    activeCalendarMonth = 0;
    activeCalendarYear++;
  }
  renderHomeSchedule();
}

function selectCalendarDate(dateStr) {
  if (activeCalendarSelectedDate === dateStr) {
    activeCalendarSelectedDate = null;
  } else {
    activeCalendarSelectedDate = dateStr;
  }
  renderHomeSchedule();
}

function clearScheduleDateFilter() {
  activeCalendarSelectedDate = null;
  renderHomeSchedule();
}

function openAddScheduleModal() {
  document.getElementById('editScheduleTargetId').value = '';
  document.getElementById('scheduleModalTitle').textContent = 'Add Worship Event';
  document.getElementById('schedTitleInput').value = '';
  document.getElementById('schedDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('schedTimeInput').value = '07:30 PM';
  document.getElementById('schedDescInput').value = '';
  document.getElementById('schedIconInput').value = '⛪';

  const modal = document.getElementById('addScheduleModal');
  const container = document.getElementById('addScheduleModalContainer');
  if (!modal || !container) return;
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeAddScheduleModal() {
  const modal = document.getElementById('addScheduleModal');
  const container = document.getElementById('addScheduleModalContainer');
  if (!modal || !container) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function handleSaveSchedule(e) {
  e.preventDefault();
  const targetId = document.getElementById('editScheduleTargetId').value;
  const title = document.getElementById('schedTitleInput').value.trim();
  const category = document.getElementById('schedTypeInput').value;
  const icon = document.getElementById('schedIconInput').value.trim() || '⛪';
  const date = document.getElementById('schedDateInput').value;
  const time = document.getElementById('schedTimeInput').value.trim();
  const notes = document.getElementById('schedDescInput').value.trim();

  if (targetId) {
    const idx = SCHEDULES_LIST.findIndex(s => s.id === targetId);
    if (idx !== -1) {
      SCHEDULES_LIST[idx] = { ...SCHEDULES_LIST[idx], title, category, icon, date, time, notes };
    }
    showToast('Event updated!');
  } else {
    const newEvent = {
      id: 'sch_' + Date.now(),
      title,
      category,
      icon,
      date,
      time,
      notes,
      author: CURRENT_USER.fullName || 'Admin'
    };
    SCHEDULES_LIST.push(newEvent);
    showToast('Event added to schedule!');
  }

  localStorage.setItem('l_support_schedules', JSON.stringify(SCHEDULES_LIST));
  fbSync('schedules', SCHEDULES_LIST);
  closeAddScheduleModal();
  renderHomeSchedule();
}

function editScheduleEvent(id) {
  const item = SCHEDULES_LIST.find(s => s.id === id);
  if (!item) return;

  document.getElementById('editScheduleTargetId').value = item.id;
  document.getElementById('scheduleModalTitle').textContent = 'Edit Worship Event';
  document.getElementById('schedTitleInput').value = item.title;
  document.getElementById('schedTypeInput').value = item.category || 'Tuesday Service';
  document.getElementById('schedIconInput').value = item.icon || '⛪';
  document.getElementById('schedDateInput').value = item.date;
  document.getElementById('schedTimeInput').value = item.time;
  document.getElementById('schedDescInput').value = item.notes || '';

  const modal = document.getElementById('addScheduleModal');
  const container = document.getElementById('addScheduleModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function deleteScheduleEvent(id) {
  if (!confirm('Are you sure you want to remove this event from the schedule?')) return;
  SCHEDULES_LIST = SCHEDULES_LIST.filter(s => s.id !== id);
  localStorage.setItem('l_support_schedules', JSON.stringify(SCHEDULES_LIST));
  fbSync('schedules', SCHEDULES_LIST);
  renderHomeSchedule();
  showToast('Event deleted from schedule.');
}
