/* ========================================================
   WORSHIP LEADER HUB — ENTERPRISE ENGINE
   Features:
   - Auth (Login, Register with Zion, Area, 6-digit PIN)
   - Online Users & Activity Audit Log
   - Strict Download Permission Controls (Master & Per-file)
   - Multi-Select & Bulk Toolbar (Share, Lock, Hide, Move, Copy, QR, Merge, Color, Pin)
   - Module & Topic Customizer (Rename, Emoji, Add/Remove Topics)
   - In-App Popup Preview with Zoom In/Out & Cute Audio Player
   - Side Panel Open/Close Toggle
   - Settings Modal (Profile, Zion, PIN change, Enquiry/Suggestions)
======================================================== */

// 1. DATA INITIALIZATION
const APP_RAW_DATA = JSON.parse(document.getElementById('initial-app-data').textContent);
const BASE_CATEGORIES = APP_RAW_DATA.categories;
const BASE_ITEMS = APP_RAW_DATA.items;
const DEFAULT_ADMIN = APP_RAW_DATA.defaultAdmin;

// Seed initial users if not present
let ALL_USERS = JSON.parse(localStorage.getItem('wlh_users') || 'null');
if (!ALL_USERS || ALL_USERS.length === 0) {
  ALL_USERS = [DEFAULT_ADMIN];
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
}

// Active session
let CURRENT_USER = JSON.parse(localStorage.getItem('wlh_current_user') || 'null');
if (!CURRENT_USER) {
  // Auto-login default admin for seamless immediate access
  CURRENT_USER = DEFAULT_ADMIN;
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));
}

// Global master download switch (STRICT CONTROL: Default is OFF as requested)
let DOWNLOADS_ENABLED = JSON.parse(localStorage.getItem('wlh_downloads_enabled') || 'false');

// Custom storage
let customItems = JSON.parse(localStorage.getItem('wlh_custom_resources') || '[]');
let customModules = JSON.parse(localStorage.getItem('wlh_custom_modules') || '[]');
let moduleEdits = JSON.parse(localStorage.getItem('wlh_module_edits') || '{}');
let topicEdits = JSON.parse(localStorage.getItem('wlh_topic_edits') || '{}');
let fileMetadata = JSON.parse(localStorage.getItem('wlh_file_metadata') || '{}'); // { [url]: { locked, hidden, color, allowDownload } }
let pinnedUrls = new Set(JSON.parse(localStorage.getItem('wlh_pinned_urls') || '[]'));
let auditLog = JSON.parse(localStorage.getItem('wlh_audit_log') || '[]');
let suggestionsList = JSON.parse(localStorage.getItem('wlh_suggestions') || '[]');

// State
let currentCategory = 'all';
let currentSubgroup = 'all';
let currentViewMode = 'table';
let searchQuery = '';
let isPinnedOnly = false;
let selectedItemUrls = new Set();
let currentActiveModalUrl = null;
let currentZoomScale = 1.0;
let pendingUnlockUrl = null;

// Combined categories & items
let CATEGORIES = [];
let ALL_ITEMS = [];

function refreshDataModel() {
  // Combine base categories with custom modules and apply renames/emojis
  CATEGORIES = [...BASE_CATEGORIES, ...customModules].map(cat => {
    const edit = moduleEdits[cat.id];
    let groups = [...(cat.groups || [])];
    if (topicEdits[cat.id]) {
      // Add custom topics
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

  // Combine items
  ALL_ITEMS = [...customItems, ...BASE_ITEMS].map(it => {
    const meta = fileMetadata[it.url] || {};
    const catObj = CATEGORIES.find(c => c.id === it.tab);
    return {
      ...it,
      categoryName: catObj ? catObj.name : (it.categoryName || it.tab),
      categoryIcon: catObj ? catObj.icon : (it.categoryIcon || '📄'),
      badge: catObj ? catObj.badge : (it.badge || 'bg-slate-800 text-slate-300 border-slate-700'),
      isLocked: !!meta.locked,
      isHidden: !!meta.hidden,
      customColor: meta.color || '',
      allowDownload: meta.allowDownload !== undefined ? meta.allowDownload : false
    };
  });

  // Filter out hidden files for non-admins
  if (CURRENT_USER && CURRENT_USER.role !== 'admin') {
    ALL_ITEMS = ALL_ITEMS.filter(it => !it.isHidden);
  }
}

// 2. LIFECYCLE & DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  refreshDataModel();
  updateTopDownloadBtn();
  updateUserUI();
  updateTotalCounts();
  renderSidebarCategories();
  populateAddResourceModules();
  renderSubgroupTabs();
  renderRecords();
  updatePinnedBadge();
  logActivity('Session Start', 'Logged in as ' + CURRENT_USER.fullName);

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
      clearSelection();
    }
  });
});

// 3. LOGGING & AUDIT
function logActivity(action, details) {
  if (!CURRENT_USER) return;
  const entry = {
    userId: CURRENT_USER.userId,
    userName: CURRENT_USER.fullName,
    action: action,
    details: details || '',
    zion: CURRENT_USER.zion || 'Main Zion',
    area: CURRENT_USER.area || 'General',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toISOString().split('T')[0]
  };
  auditLog.unshift(entry);
  if (auditLog.length > 200) auditLog.pop();
  localStorage.setItem('wlh_audit_log', JSON.stringify(auditLog));
}

// 4. USER & PERMISSION MANAGEMENT
function updateUserUI() {
  if (!CURRENT_USER) return;
  document.getElementById('sidebarUserName').textContent = CURRENT_USER.fullName;
  document.getElementById('sidebarUserRole').textContent = (CURRENT_USER.role === 'admin' ? 'Leader (Admin)' : 'Member') + ' Online';
  document.getElementById('sidebarUserZion').textContent = (CURRENT_USER.zion || 'Main Zion') + ' • ' + (CURRENT_USER.area || 'Area');
  document.getElementById('sidebarUserBranch').textContent = CURRENT_USER.zion || 'Worship Leader Hub';

  // Master download button only active/visible to Admin
  const dlWrapper = document.getElementById('downloadToggleWrapper');
  if (CURRENT_USER.role === 'admin') {
    dlWrapper.classList.remove('hidden');
  } else {
    dlWrapper.classList.add('hidden');
  }
}

function handleLogout() {
  logActivity('Logout', 'User signed out');
  localStorage.removeItem('wlh_current_user');
  CURRENT_USER = null;
  openAuthModal();
}

function openAuthModal() {
  const modal = document.getElementById('authModal');
  const container = document.getElementById('authModalContainer');
  modal.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  const container = document.getElementById('authModalContainer');
  modal.classList.add('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-100');
  container.classList.add('scale-95');
}

function switchAuthMode(mode) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('authTabLogin');
  const tabRegister = document.getElementById('authTabRegister');

  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('bg-indigo-600', 'text-white');
    tabLogin.classList.remove('text-slate-400');
    tabRegister.classList.remove('bg-indigo-600', 'text-white');
    tabRegister.classList.add('text-slate-400');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    tabRegister.classList.add('bg-indigo-600', 'text-white');
    tabRegister.classList.remove('text-slate-400');
    tabLogin.classList.remove('bg-indigo-600', 'text-white');
    tabLogin.classList.add('text-slate-400');
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const uid = document.getElementById('loginUserId').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const pin = document.getElementById('loginPin').value.trim();

  const user = ALL_USERS.find(u => u.userId.toLowerCase() === uid.toLowerCase() && u.password === pass && u.pin === pin);
  if (!user) {
    alert('Invalid User ID, Password, or 6-digit PIN. Please verify your credentials.');
    return;
  }

  CURRENT_USER = user;
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));
  closeAuthModal();
  refreshDataModel();
  updateUserUI();
  updateTotalCounts();
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
  showToast('Welcome back, ' + user.fullName + '!');
  logActivity('Login', 'Successful login');
}

function quickDemoAdminLogin() {
  CURRENT_USER = DEFAULT_ADMIN;
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));
  closeAuthModal();
  refreshDataModel();
  updateUserUI();
  updateTotalCounts();
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
  showToast('Logged in as Surya (Admin)');
  logActivity('Login', 'Fast Admin Demo Login');
}

function handleRegisterSubmit(e) {
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

  if (pass !== passAgain) {
    alert('Passwords do not match! Please check again.');
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    alert('Personal PIN must be exactly 6 digits (numbers only)!');
    return;
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
    role: 'member',
    assignedModules: ['all']
  };

  ALL_USERS.push(newUser);
  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  CURRENT_USER = newUser;
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));

  closeAuthModal();
  refreshDataModel();
  updateUserUI();
  updateTotalCounts();
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
  showToast('Account created! Welcome, ' + fullName);
  logActivity('Register', 'New account created: ' + userId);
}

// 5. MASTER DOWNLOAD TOGGLE (STRICT ADMIN CONTROL)
function toggleMasterDownloads() {
  if (CURRENT_USER.role !== 'admin') {
    showToast('Permission Denied: Only Admin can toggle downloads');
    return;
  }

  DOWNLOADS_ENABLED = !DOWNLOADS_ENABLED;
  localStorage.setItem('wlh_downloads_enabled', JSON.stringify(DOWNLOADS_ENABLED));
  updateTopDownloadBtn();
  renderRecords();
  
  if (DOWNLOADS_ENABLED) {
    showToast('Downloads ENABLED for permitted files');
    logActivity('Download Permission', 'Downloads enabled globally');
  } else {
    showToast('Downloads DISABLED strictly');
    logActivity('Download Permission', 'Downloads disabled globally');
  }
}

function updateTopDownloadBtn() {
  const btn = document.getElementById('masterDownloadBtn');
  const txt = document.getElementById('downloadBtnText');
  const icon = document.getElementById('downloadLockIcon');
  const settingBtn = document.getElementById('settingMasterDownloadToggle');

  if (DOWNLOADS_ENABLED) {
    btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30';
    icon.className = 'fa-solid fa-download text-[10px]';
    txt.textContent = 'Downloads: ON';
    if (settingBtn) {
      settingBtn.className = 'px-4 py-2 rounded-xl font-extrabold text-xs transition border border-emerald-500/40 bg-emerald-500/20 text-emerald-300';
      settingBtn.textContent = 'Downloads: ON';
    }
  } else {
    btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20';
    icon.className = 'fa-solid fa-lock text-[10px]';
    txt.textContent = 'Downloads: OFF';
    if (settingBtn) {
      settingBtn.className = 'px-4 py-2 rounded-xl font-extrabold text-xs transition border border-rose-500/40 bg-rose-500/20 text-rose-300';
      settingBtn.textContent = 'Downloads: OFF';
    }
  }
}

// 6. SIDE PANEL OPEN & CLOSE (COLLAPSIBLE SIDEBAR)
function toggleSidebar() {
  const sb = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  // Desktop collapse toggle
  if (window.innerWidth >= 768) {
    if (sb.classList.contains('md:w-72') || !sb.classList.contains('md:w-0')) {
      sb.classList.remove('md:w-72');
      sb.classList.add('md:w-0');
    } else {
      sb.classList.remove('md:w-0');
      sb.classList.add('md:w-72');
    }
  } else {
    // Mobile slide toggle
    if (sb.classList.contains('-translate-x-full')) {
      sb.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    } else {
      sb.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  }
}

// 7. COUNTS & BADGES
function updateTotalCounts() {
  document.getElementById('allCountBadge').textContent = ALL_ITEMS.length;
}

function updatePinnedBadge() {
  const badge = document.getElementById('pinnedCountBadge');
  badge.textContent = pinnedUrls.size;
  if (pinnedUrls.size > 0) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// 8. SIDEBAR CATEGORIES RENDER
function renderSidebarCategories() {
  const container = document.getElementById('dynamicSidebarCategories');
  container.innerHTML = CATEGORIES.map(cat => {
    const catCount = ALL_ITEMS.filter(it => it.tab === cat.id).length;
    const isActive = (currentCategory === cat.id && !isPinnedOnly);

    return `
      <div class="relative group">
        <button 
          onclick="selectCategory('${cat.id}')" 
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

        <!-- Edit Module Pencil Icon -->
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

  // Close mobile sidebar if open
  if (window.innerWidth < 768) {
    const sb = document.getElementById('mainSidebar');
    if (!sb.classList.contains('-translate-x-full')) {
      toggleSidebar();
    }
  }

  renderSubgroupTabs();
  renderRecords();
}

// 9. SUBGROUPS / TOPICS TABS
function renderSubgroupTabs() {
  const container = document.getElementById('subgroupTabsContainer');
  if (currentCategory === 'all') {
    container.innerHTML = `
      <span class="text-xs text-slate-400 italic px-2">Select a module on the left to browse and edit topics</span>
    `;
    return;
  }

  const catObj = CATEGORIES.find(c => c.id === currentCategory);
  if (!catObj) return;

  const catItems = ALL_ITEMS.filter(it => it.tab === currentCategory);

  let html = `
    <button 
      onclick="filterSubgroup('all')"
      class="px-3 py-1 rounded-xl text-xs font-bold transition flex-shrink-0 ${
        currentSubgroup === 'all' 
          ? 'bg-indigo-600 text-white shadow-xs' 
          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
      }"
    >
      All (${catItems.length})
    </button>
  `;

  (catObj.groups || []).forEach(grp => {
    const grpCount = catItems.filter(it => it.group === grp).length;
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
          onclick="renameTopic('${catObj.id}', '${grp.replace(/'/g, "\\'")}', event)"
          title="Rename this topic"
          class="pr-2 pl-0.5 text-[10px] text-slate-400 hover:text-amber-300 opacity-0 group-hover/grp:opacity-100 transition"
        >
          <i class="fa-solid fa-pen"></i>
        </button>
      </div>
    `;
  });

  // + Add Topic button
  html += `
    <button 
      onclick="quickAddTopicToModule('${catObj.id}')"
      class="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 flex-shrink-0 border border-slate-700"
      title="Add topic to this module"
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

// Quick rename topic
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

  // Update in topicEdits
  if (!topicEdits[catId]) topicEdits[catId] = [];
  topicEdits[catId] = (catObj.groups || []);
  localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));

  // Update all items belonging to oldTopic
  customItems.forEach(it => {
    if (it.tab === catId && it.group === oldTopic) it.group = finalName;
  });
  localStorage.setItem('wlh_custom_resources', JSON.stringify(customItems));

  refreshDataModel();
  renderSubgroupTabs();
  renderRecords();
  showToast('Topic renamed to "' + finalName + '"');
  logActivity('Topic Edit', 'Renamed topic ' + oldTopic + ' to ' + finalName);
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
  logActivity('Topic Add', 'Added topic ' + tName + ' to ' + catId);
}

// 10. SEARCH & FILTERS
function handleSearch(val) {
  searchQuery = val.trim().toLowerCase();
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchQuery) {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }
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

// 11. MULTI-SELECT & BULK ACTIONS
function toggleItemSelect(url, event) {
  if (event) event.stopPropagation();
  if (selectedItemUrls.has(url)) {
    selectedItemUrls.delete(url);
  } else {
    selectedItemUrls.add(url);
  }
  updateSelectionState();
}

function toggleSelectAll(checked) {
  const visible = getFilteredRecords();
  if (checked) {
    visible.forEach(it => selectedItemUrls.add(it.url));
  } else {
    selectedItemUrls.clear();
  }
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

  // Update check states in DOM without re-rendering everything
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = selectedItemUrls.has(cb.dataset.url);
  });
}

function getFilteredRecords() {
  let filtered = ALL_ITEMS;
  if (isPinnedOnly) {
    filtered = filtered.filter(it => pinnedUrls.has(it.url));
  } else {
    if (currentCategory !== 'all') {
      filtered = filtered.filter(it => it.tab === currentCategory);
    }
    if (currentSubgroup !== 'all') {
      filtered = filtered.filter(it => it.group === currentSubgroup);
    }
  }
  if (searchQuery) {
    filtered = filtered.filter(it => 
      it.title.toLowerCase().includes(searchQuery) ||
      (it.group && it.group.toLowerCase().includes(searchQuery)) ||
      (it.tab && it.tab.toLowerCase().includes(searchQuery)) ||
      (it.categoryName && it.categoryName.toLowerCase().includes(searchQuery))
    );
  }
  return filtered;
}

// BULK ACTIONS IMPLEMENTATIONS
function bulkShare() {
  const urls = [...selectedItemUrls];
  if (urls.length === 0) return;
  const text = urls.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied ' + urls.length + ' links to clipboard!');
  });
}

function bulkToggleLock() {
  const urls = [...selectedItemUrls];
  let anyUnlocked = urls.some(u => !fileMetadata[u] || !fileMetadata[u].locked);
  const targetState = anyUnlocked; // if any unlocked, lock all

  urls.forEach(u => {
    if (!fileMetadata[u]) fileMetadata[u] = {};
    fileMetadata[u].locked = targetState;
  });
  localStorage.setItem('wlh_file_metadata', JSON.stringify(fileMetadata));
  refreshDataModel();
  renderRecords();
  showToast(targetState ? '🔒 Selected files locked with 6-digit PIN' : '🔓 Selected files unlocked');
  logActivity('Security', (targetState ? 'Locked ' : 'Unlocked ') + urls.length + ' files');
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
  logActivity('Visibility', (targetState ? 'Hidden ' : 'Unhidden ') + urls.length + ' files');
}

function bulkDownload() {
  if (!DOWNLOADS_ENABLED) {
    showToast('Downloads are strictly DISABLED by Admin.');
    return;
  }
  const urls = [...selectedItemUrls];
  urls.forEach((url, i) => {
    setTimeout(() => {
      window.open(url, '_blank');
    }, i * 400);
  });
  showToast('Initiated download for ' + urls.length + ' files');
  logActivity('Download', 'Bulk downloaded ' + urls.length + ' files');
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

function bulkOpenTabs() {
  const urls = [...selectedItemUrls];
  urls.slice(0, 10).forEach(u => window.open(u, '_blank'));
  showToast('Opened ' + Math.min(urls.length, 10) + ' tabs');
}

// 12. IN-APP POPUP PREVIEW WITH ZOOM & CUTE PLAYERS
function openFilePreview(url) {
  const item = ALL_ITEMS.find(it => it.url === url);
  if (!item) return;

  // Check if locked
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

  // STRICT DOWNLOAD VISIBILITY:
  // Show download button ONLY if DOWNLOADS_ENABLED is true AND item permits it!
  const modalDlBtn = document.getElementById('modalDownloadBtn');
  if (DOWNLOADS_ENABLED || (CURRENT_USER && CURRENT_USER.role === 'admin' && DOWNLOADS_ENABLED)) {
    modalDlBtn.classList.remove('hidden');
    modalDlBtn.href = item.url;
  } else {
    modalDlBtn.classList.add('hidden');
    modalDlBtn.removeAttribute('href');
  }

  const audioView = document.getElementById('cuteAudioPlayerView');
  const iframeContainer = document.getElementById('iframeZoomContainer');
  const loader = document.getElementById('iframeLoader');

  resetZoom();

  // Cute Audio Player check (e.g. mp3 or New Song audio)
  if (item.mediaType === 'audio' || url.endsWith('.mp3') || url.includes('drive.google.com') && item.tab === 'New Song') {
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

  // Open modal
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

// ZOOM CONTROLS
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
  if (pinEntered === CURRENT_USER.pin || pinEntered === DEFAULT_ADMIN.pin) {
    closePinVerifyModal();
    const url = pendingUnlockUrl;
    pendingUnlockUrl = null;
    if (url) openFilePreview(url);
  } else {
    alert('Incorrect PIN. Please try again.');
  }
}

// 13. RECORD RENDERING (TABLE & GRID)
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

    // Download button: ONLY shown if downloads are turned ON
    const showDownload = DOWNLOADS_ENABLED;

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

        <!-- Title -->
        <td class="py-3 px-4 font-semibold text-white">
          <div class="flex items-center gap-2">
            ${item.customColor ? `<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${item.customColor}"></span>` : ''}
            ${item.isLocked ? '<i class="fa-solid fa-lock text-amber-400 text-xs" title="PIN Protected"></i>' : ''}
            ${item.isHidden ? '<i class="fa-solid fa-eye-slash text-rose-400 text-xs" title="Hidden from members"></i>' : ''}
            ${item.isCustom ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/30">NEW</span>' : ''}
            <span 
              onclick="openFilePreview('${safeUrl}')"
              class="cursor-pointer hover:text-indigo-400 transition font-medium ${isTelugu ? 'font-telugu' : ''}"
            >
              ${item.title}
            </span>
          </div>
        </td>

        <!-- Topic -->
        <td class="py-3 px-4">
          <span class="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            ${item.group || 'General'}
          </span>
        </td>

        <!-- Module Badge -->
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${item.badge}">
            <span>${item.categoryIcon}</span>
            <span class="truncate">${item.categoryName}</span>
          </span>
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

            <!-- Download Button (STRICT PERMISSION) -->
            ${showDownload ? `
              <a 
                href="${item.url}" 
                download 
                target="_blank"
                class="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 transition text-[11px]"
                title="Download File"
              >
                <i class="fa-solid fa-download"></i>
              </a>
            ` : ''}

            <!-- External Tab -->
            <a 
              href="${item.url}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px] border border-slate-700"
              title="Open in new browser tab"
            >
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>

            <!-- QR Code -->
            <button 
              onclick="showSingleQR('${safeTitle}', '${safeUrl}')"
              class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px] border border-slate-700"
              title="Show QR Code"
            >
              <i class="fa-solid fa-qrcode"></i>
            </button>

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
    const showDownload = DOWNLOADS_ENABLED;

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
              <span class="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 truncate">
                ${item.group || 'General'}
              </span>
            </div>
            
            <div class="flex items-center gap-1">
              <button 
                onclick="showSingleQR('${safeTitle}', '${safeUrl}')"
                class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
                title="QR Code"
              >
                <i class="fa-solid fa-qrcode"></i>
              </button>
              <button 
                onclick="copyResourceUrl('${safeUrl}', '${safeTitle}', event)"
                class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
                title="Copy Link"
              >
                <i class="fa-regular fa-copy"></i>
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

          <div class="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <span>${item.categoryIcon}</span>
            <span class="truncate">${item.categoryName}</span>
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

          <a 
            href="${item.url}" 
            target="_blank" 
            rel="noopener noreferrer"
            class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-700"
          >
            <span>External</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// 14. ADD NEW RESOURCE WITH AUTO-TOPIC SELECTION
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
  if (select.value === '__NEW_TOPIC__') {
    showCustomTopicInput();
  } else {
    hideCustomTopicInput();
  }
}

function toggleCustomTopicInput() {
  const wrapper = document.getElementById('customTopicInputWrapper');
  if (wrapper.classList.contains('hidden')) {
    showCustomTopicInput();
  } else {
    hideCustomTopicInput();
  }
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
  
  // Save topic permanently if new
  const catObj = CATEGORIES.find(c => c.id === moduleId);
  if (catObj) {
    if (!catObj.groups) catObj.groups = [];
    if (!catObj.groups.includes(topic)) {
      catObj.groups.push(topic);
      if (!topicEdits[moduleId]) topicEdits[moduleId] = [];
      topicEdits[moduleId].push(topic);
      localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));
    }
  }

  // Convert preview URL
  let previewUrl = url;
  if (previewUrl.indexOf('docs.google.com/document/d/') !== -1) {
    previewUrl = previewUrl.split('/edit')[0] + '/preview';
  } else if (previewUrl.indexOf('drive.google.com/file/d/') !== -1) {
    previewUrl = previewUrl.split('/view')[0] + '/preview';
  }

  const newItem = {
    title,
    url,
    previewUrl,
    group: topic,
    tab: moduleId,
    categoryName: catObj ? catObj.name : moduleId,
    categoryIcon: catObj ? catObj.icon : '📄',
    badge: catObj ? catObj.badge : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    btn: catObj ? catObj.btn : 'bg-emerald-600 hover:bg-emerald-500',
    isCustom: true,
    id: 'custom_' + Date.now()
  };

  customItems.unshift(newItem);
  localStorage.setItem('wlh_custom_resources', JSON.stringify(customItems));

  closeAddResourceModal();
  refreshDataModel();
  updateTotalCounts();
  renderSidebarCategories();
  renderSubgroupTabs();
  renderRecords();
  showToast('✨ Resource added: ' + title);
  logActivity('Resource Add', 'Added ' + title + ' to ' + moduleId);
}

// 15. MODULE & TOPIC CUSTOMIZER (RENAME, EMOJI, EDIT TOPICS)
function openAddModuleModal() {
  document.getElementById('moduleModalTitle').textContent = 'Create New Module';
  document.getElementById('editModuleTargetId').value = '';
  document.getElementById('newModuleName').value = '';
  document.getElementById('newModuleIcon').value = '📁';
  document.getElementById('newModuleTopics').value = '';
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

  const delBtn = document.getElementById('deleteModuleBtn');
  if (catObj.isCustom) {
    delBtn.classList.remove('hidden');
  } else {
    delBtn.classList.add('hidden');
  }

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

  if (targetId) {
    // EDIT EXISTING MODULE
    moduleEdits[targetId] = { name, icon };
    localStorage.setItem('wlh_module_edits', JSON.stringify(moduleEdits));
    if (parsedTopics.length > 0) {
      topicEdits[targetId] = parsedTopics;
      localStorage.setItem('wlh_topic_edits', JSON.stringify(topicEdits));
    }
    showToast('Module "' + name + '" updated!');
    logActivity('Module Edit', 'Updated module ' + targetId);
  } else {
    // CREATE BRAND NEW CUSTOM MODULE
    const newId = 'mod_' + Date.now();
    const newModule = {
      id: newId,
      name,
      icon,
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      btn: 'bg-indigo-600 hover:bg-indigo-500',
      groups: parsedTopics.length > 0 ? parsedTopics : ['General'],
      isCustom: true
    };
    customModules.push(newModule);
    localStorage.setItem('wlh_custom_modules', JSON.stringify(customModules));
    showToast('Created module "' + name + '"!');
    logActivity('Module Create', 'Created new module ' + name);
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
  logActivity('Module Delete', 'Deleted custom module ' + targetId);
}

// 16. MOVE & COPY MODALS
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
  const catObj = CATEGORIES.find(c => c.id === targetMod);

  const urls = [...selectedItemUrls];
  if (activeMoveCopyAction === 'move') {
    urls.forEach(u => {
      const it = ALL_ITEMS.find(i => i.url === u);
      if (it) {
        it.tab = targetMod;
        it.group = targetTopic;
        it.categoryName = catObj ? catObj.name : targetMod;
        it.categoryIcon = catObj ? catObj.icon : '📄';
      }
    });
    showToast('Moved ' + urls.length + ' items to ' + targetMod);
  } else {
    // Copy
    urls.forEach(u => {
      const orig = ALL_ITEMS.find(i => i.url === u);
      if (orig) {
        const copyItem = {
          ...orig,
          id: 'copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          tab: targetMod,
          group: targetTopic,
          categoryName: catObj ? catObj.name : targetMod,
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

// 17. QR CODE GENERATOR
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

// 18. MERGE STUDY PACK
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
  const packTitle = document.getElementById('mergePackTitle').value.trim() || 'Worship Leader Study Pack';
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
          a:hover { text-decoration: underline; }
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

// 19. COLOR TAGGING
function openColorTagModal() {
  const palette = document.getElementById('colorTagPalette');
  palette.classList.remove('hidden');
  palette.style.top = (window.innerHeight - 120) + 'px';
  palette.style.left = (window.innerWidth / 2 - 120) + 'px';
}

function applyColorTag(color) {
  const urls = [...selectedItemUrls];
  urls.forEach(u => {
    if (!fileMetadata[u]) fileMetadata[u] = {};
    fileMetadata[u].color = color;
  });
  localStorage.setItem('wlh_file_metadata', JSON.stringify(fileMetadata));
  document.getElementById('colorTagPalette').classList.add('hidden');
  refreshDataModel();
  renderRecords();
  showToast('Color tag applied to ' + urls.length + ' files');
}

// 20. SETTINGS MODAL & TABS
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
  const tabs = ['profile', 'security', 'permissions', 'audit', 'suggestion'];
  tabs.forEach(t => {
    const btn = document.getElementById('stab-' + t);
    const content = document.getElementById('tabContent-' + t);
    if (t === tab) {
      btn.className = 'px-3 py-2 border-b-2 border-indigo-500 text-indigo-400 font-bold';
      content.classList.remove('hidden');
    } else {
      btn.className = 'px-3 py-2 border-b-2 border-transparent text-slate-400 hover:text-white';
      content.classList.add('hidden');
    }
  });

  if (tab === 'audit') renderAuditView();
  if (tab === 'permissions') renderUserAssignmentsView();
  if (tab === 'suggestion') renderSuggestionsView();
}

function loadSettingsFormData() {
  if (!CURRENT_USER) return;
  document.getElementById('settingFullName').value = CURRENT_USER.fullName || '';
  document.getElementById('settingZion').value = CURRENT_USER.zion || '';
  document.getElementById('settingArea').value = CURRENT_USER.area || '';
  document.getElementById('settingPhone').value = CURRENT_USER.phone || '';
  document.getElementById('settingEmail').value = CURRENT_USER.gmail || '';
}

function saveUserProfile(e) {
  e.preventDefault();
  CURRENT_USER.fullName = document.getElementById('settingFullName').value.trim();
  CURRENT_USER.zion = document.getElementById('settingZion').value.trim();
  CURRENT_USER.area = document.getElementById('settingArea').value.trim();
  CURRENT_USER.phone = document.getElementById('settingPhone').value.trim();
  CURRENT_USER.gmail = document.getElementById('settingEmail').value.trim();

  // Update in ALL_USERS list
  const idx = ALL_USERS.findIndex(u => u.userId === CURRENT_USER.userId);
  if (idx !== -1) ALL_USERS[idx] = CURRENT_USER;

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));

  updateUserUI();
  showToast('Profile & Zion details updated!');
  logActivity('Profile Update', 'Updated Zion to ' + CURRENT_USER.zion);
}

function saveSecurityCredentials(e) {
  e.preventDefault();
  const newPass = document.getElementById('settingNewPassword').value;
  const confPass = document.getElementById('settingConfirmPassword').value;
  const newPin = document.getElementById('settingNewPin').value.trim();

  if (newPass) {
    if (newPass !== confPass) {
      alert('New passwords do not match!');
      return;
    }
    CURRENT_USER.password = newPass;
  }

  if (newPin) {
    if (!/^\d{6}$/.test(newPin)) {
      alert('Personal PIN must be exactly 6 digits (numbers only)!');
      return;
    }
    CURRENT_USER.pin = newPin;
  }

  const idx = ALL_USERS.findIndex(u => u.userId === CURRENT_USER.userId);
  if (idx !== -1) ALL_USERS[idx] = CURRENT_USER;

  localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
  localStorage.setItem('wlh_current_user', JSON.stringify(CURRENT_USER));

  showToast('Password & 6-Digit PIN updated successfully!');
  logActivity('Security Update', 'Changed Password/PIN');
}

function renderAuditView() {
  // Online users
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

  // History table
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

function renderUserAssignmentsView() {
  const container = document.getElementById('userAssignmentsList');
  container.innerHTML = ALL_USERS.map(u => `
    <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
      <div>
        <div class="font-bold text-white">${u.fullName} (${u.userId})</div>
        <div class="text-[10px] text-slate-400">${u.zion} • Role: ${u.role}</div>
      </div>
      <div class="flex items-center gap-2">
        <select onchange="updateUserModuleAssignment('${u.userId}', this.value)" class="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2 py-1 rounded-lg outline-none">
          <option value="all" ${(u.assignedModules || []).includes('all') ? 'selected' : ''}>All Modules</option>
          ${CATEGORIES.map(c => `
            <option value="${c.id}" ${(u.assignedModules || []).includes(c.id) ? 'selected' : ''}>Only ${c.name}</option>
          `).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

function updateUserModuleAssignment(userId, val) {
  const user = ALL_USERS.find(u => u.userId === userId);
  if (user) {
    user.assignedModules = [val];
    localStorage.setItem('wlh_users', JSON.stringify(ALL_USERS));
    showToast('Module assignment updated for ' + user.fullName);
  }
}

// 21. ENQUIRIES & SUGGESTIONS
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

// 22. UTILITIES & TOAST
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
