import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";

// FIX: Resolved SyntaxError (unmatched braces and duplicate declarations) caused by previous edits. (2026-06-26)

const firebaseConfig = {
  apiKey: "AIzaSyBJnS3EYawuCHHnegronWe_WPRH7TPbO1A",
  authDomain: "ajos-544d6.firebaseapp.com",
  databaseURL: "https://ajos-544d6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ajos-544d6",
  storageBucket: "ajos-544d6.firebasestorage.app",
  messagingSenderId: "939741010944",
  appId: "1:939741010944:web:b2f5d91042165b53bd8ce5",
  measurementId: "G-SJWQNW9R99"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Error Handler for UI Debugging
window.addEventListener('error', (event) => {
  let errorBox = document.getElementById('debugErrorBox');
  if (!errorBox) {
    errorBox = document.createElement('div');
    errorBox.id = 'debugErrorBox';
    errorBox.style.position = 'fixed';
    errorBox.style.bottom = '10px';
    errorBox.style.right = '10px';
    errorBox.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
    errorBox.style.color = 'white';
    errorBox.style.padding = '15px';
    errorBox.style.borderRadius = '5px';
    errorBox.style.zIndex = '99999';
    errorBox.style.maxWidth = '400px';
    errorBox.style.fontFamily = 'monospace';
    errorBox.style.fontSize = '12px';
    errorBox.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    errorBox.innerHTML = '<strong>⚠️ JavaScript Error</strong><br><div id="debugErrorList" style="margin-top: 10px; max-height: 200px; overflow-y: auto;"></div><button onclick="this.parentElement.remove()" style="margin-top: 10px; background: white; color: red; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">Dismiss</button>';
    document.body.appendChild(errorBox);
  }
  const errorList = document.getElementById('debugErrorList');
  if (errorList) {
    const errorMsg = document.createElement('div');
    errorMsg.style.marginBottom = '8px';
    errorMsg.style.borderBottom = '1px solid rgba(255,255,255,0.3)';
    errorMsg.style.paddingBottom = '8px';
    errorMsg.textContent = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
    errorList.appendChild(errorMsg);
  }
});
window.addEventListener('unhandledrejection', (event) => {
  window.dispatchEvent(new ErrorEvent('error', {
    message: `Unhandled Promise Rejection: ${event.reason?.message || event.reason}`,
    filename: 'Promise',
    lineno: 0,
    colno: 0
  }));
});

// Authentication Guard
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('/login.html');
  } else {
    // FIX: Removed buggy fetchLimits() call that was overwriting snapshot listener and causing freezing (2026-06-26)

    // FIX: Switched to listening to the users document directly for search states to avoid Firestore security rules blocking user_temp_searches collection (2026-06-26)
    // We listen to the user's document for BOTH limits and temporary search data
    window.unsubscribeUserDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        userLimits = d;
        latestSnapshotData = d;
        renderLimitsShowcase();

        let tempSearchData = null;
        if (searchMode === 'companies' && d.companySearchTemp) {
          tempSearchData = d.companySearchTemp;
        } else if (searchMode === 'jobs' && d.jobSearchTemp) {
          tempSearchData = d.jobSearchTemp;
        }

        if (tempSearchData) {
          // Fallback if expiresAt is missing from older searches
          const expiresAtStr = tempSearchData.expiresAt;
          let expiresAt;
          if (expiresAtStr) {
            expiresAt = new Date(expiresAtStr);
          } else if (tempSearchData.createdAt && tempSearchData.createdAt.seconds) {
            expiresAt = new Date(tempSearchData.createdAt.seconds * 1000 + 2 * 60 * 60 * 1000);
          } else {
            expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // Default 2 hours if entirely missing
          }
          
          if (expiresAt > new Date()) {
            // Fresh data — enable the Reload button regardless of isViewingRecent
            if (restoreBtn) restoreBtn.disabled = false;
            updateRestoreTimer(expiresAt);
          } else {
            // Expired — disable but keep visible
            if (restoreBtn) restoreBtn.disabled = true;
            if (restoreTimer) restoreTimer.textContent = 'Expired';
            if (!isViewingRecent) {
              if (tableEmpty) tableEmpty.style.display = 'block';
              if (tbody) tbody.innerHTML = '';
            }
          }
        } else {
          // No temp search data — disable but keep visible
          if (restoreBtn) restoreBtn.disabled = true;
          if (restoreTimer) restoreTimer.textContent = 'No recent search';
          if (!isViewingRecent) {
            if (tableEmpty) tableEmpty.style.display = 'block';
            if (tbody) tbody.innerHTML = '';
          }
        }
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      alert("Failed to load search results: " + error.message);
    });
  }
});

  // Reset Functionality
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchMode) {
        sessionStorage.removeItem(`last_${searchMode}_Search`);
      } else {
        sessionStorage.clear();
      }
      window.location.reload();
    });
  }

// Logout Functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      sessionStorage.clear();
      await signOut(auth);
      // onAuthStateChanged will handle the redirect to login.html automatically
    } catch (error) {
      console.error("Error signing out:", error);
    }
  });
}

async function fetchWithAuth(url, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return fetch(url, options);
}

let nextPageToken = '';
let currentIndustry = '';
let rowCount = 0;
let userLimits = null;

let currentSearchData = {
  mode: '',
  query: '',
  nextPageToken: '',
  currentIndustry: '',
  places: [], // For companies
  jobs: [] // For jobs
};

function saveToSessionStorage() {
  if (currentSearchData.mode) {
    sessionStorage.setItem(`last_${currentSearchData.mode}_Search`, JSON.stringify(currentSearchData));
  }
}

async function restoreFromSessionStorage() {
  const cachedData = sessionStorage.getItem(`last_${searchMode}_Search`);
  if (!cachedData) {
    if (restoreContainer) restoreContainer.style.display = 'flex';
    return false;
  }

  try {
    const parsed = JSON.parse(cachedData);
    if (parsed.mode !== searchMode) return false;
    
    if (restoreContainer) restoreContainer.style.display = 'none';

    // Restore input fields from session storage
    if (searchMode === 'companies' && parsed.inputs) {
      if (document.getElementById('companyName')) document.getElementById('companyName').value = parsed.inputs.companyName || '';
      if (document.getElementById('industry')) document.getElementById('industry').value = parsed.inputs.industry || '';
      if (document.getElementById('location')) document.getElementById('location').value = parsed.inputs.location || '';
    } else if (searchMode === 'jobs' && parsed.inputs) {
      if (document.getElementById('jobTitle')) document.getElementById('jobTitle').value = parsed.inputs.jobTitle || '';
      if (document.getElementById('jobLocation')) document.getElementById('jobLocation').value = parsed.inputs.jobLocation || '';
    }

    currentSearchData = parsed;
    lastQuery = parsed.query || '';
    nextPageToken = parsed.nextPageToken || '';
    currentIndustry = parsed.currentIndustry || '';

    if (searchMode === 'companies' && parsed.places && parsed.places.length > 0) {
      if (tbody) tbody.innerHTML = '';
      rowCount = 0;
      tagColorMap = {};
      if (tableEmpty) tableEmpty.style.display = 'none';
      
      for (let i = 0; i < parsed.places.length; i++) {
        await addCompanyRow(parsed.places[i], currentIndustry, i); // Pass index to update it later
      }
      if (nextBtn) {
        const showNext = !!nextPageToken;
        nextBtn.style.display = showNext ? 'inline-flex' : 'none';
        nextBtn.disabled = !showNext;
        if (searchBtn) {
          searchBtn.style.display = 'inline-flex';
          searchBtn.disabled = showNext;
        }
      }
      populateFilters();
      applyFilters();
      return true;
    } else if (searchMode === 'jobs' && parsed.jobs && parsed.jobs.length > 0) {
      if (tbody) tbody.innerHTML = '';
      rowCount = 0;
      tagColorMap = {};
      if (tableEmpty) tableEmpty.style.display = 'none';

      parsed.jobs.forEach(job => addJobRow(job));
      nextPageToken = '';
      if (nextBtn) nextBtn.style.display = 'none';
      populateFilters();
      applyFilters();
      return true;
    }
  } catch (e) {
    console.error('Error restoring local storage:', e);
  }
  return false;
}

let isViewingRecent = false;
let latestSnapshotData = null;
let restoreTimerInterval = null;
let isRestoring = false;     // FIX: prevents double-click / concurrent restore runs

const restoreContainer = document.getElementById('restoreContainer');
const restoreTimer = document.getElementById('restoreTimer');
const restoreBtn = document.getElementById('restoreBtn');

// FIX (Bug 1 & Bug 2): Extracted restore logic into a reusable function so it can be
// called both from the button click AND automatically on page load when Firestore has
// valid temp data. Adds loading state and prevents concurrent/duplicate runs.
async function triggerRestore() {
  if (!latestSnapshotData || isRestoring) return;
  isRestoring = true;
  isViewingRecent = true;

  if (restoreBtn) {
    restoreBtn.disabled = true;
    restoreBtn.textContent = 'Loading...';
  }

  try {
    if (searchMode === 'companies' && latestSnapshotData.companySearchTemp) {
      const temp = latestSnapshotData.companySearchTemp;
      currentIndustry = temp.query || 'Unknown';
      if (tbody) tbody.innerHTML = '';
      rowCount = 0;
      tagColorMap = {};
      
      const hasPlaces = temp.places && temp.places.length > 0;
      if (tableEmpty) tableEmpty.style.display = hasPlaces ? 'none' : 'block';
      if (!hasPlaces) {
        if (document.getElementById('emptyText')) {
          document.getElementById('emptyText').textContent = 'No results found for this recent search.';
        }
      }
      nextPageToken = temp.nextPageToken || '';
      
      if (restoreContainer) restoreContainer.style.display = 'none';

      // Restore inputs into DOM
      if (temp.inputs) {
        if (document.getElementById('companyName')) document.getElementById('companyName').value = temp.inputs.companyName || '';
        if (document.getElementById('industry')) document.getElementById('industry').value = temp.inputs.industry || '';
        if (document.getElementById('location')) document.getElementById('location').value = temp.inputs.location || '';
      }

      currentSearchData.mode = searchMode;
      currentSearchData.query = temp.query || '';
      currentSearchData.currentIndustry = currentIndustry;
      currentSearchData.nextPageToken = nextPageToken;
      currentSearchData.places = temp.places || [];
      currentSearchData.jobs = [];
      currentSearchData.inputs = temp.inputs || {};
      saveToSessionStorage();
      for (const place of (temp.places || [])) {
        addCompanyRow(place, currentIndustry);
      }
      // Show "Search More" if the stored search had a next page
      if (nextBtn) {
        const showNext = !!nextPageToken;
        nextBtn.style.display = showNext ? 'inline-flex' : 'none';
        nextBtn.disabled = !showNext;
        if (searchBtn) {
          searchBtn.style.display = 'inline-flex';
          searchBtn.disabled = showNext;
        }
      }
    } else if (searchMode === 'jobs' && latestSnapshotData.jobSearchTemp) {
      const temp = latestSnapshotData.jobSearchTemp;
      if (tbody) tbody.innerHTML = '';
      rowCount = 0;
      tagColorMap = {};
      if (tableEmpty) tableEmpty.style.display = 'none';
      nextPageToken = temp.nextPageToken || '';

      if (restoreContainer) restoreContainer.style.display = 'none';

      // Restore inputs into DOM
      if (temp.inputs) {
        if (document.getElementById('jobTitle')) document.getElementById('jobTitle').value = temp.inputs.jobTitle || '';
        if (document.getElementById('jobLocation')) document.getElementById('jobLocation').value = temp.inputs.jobLocation || '';
      }

      currentSearchData.mode = searchMode;
      currentSearchData.query = temp.query || '';
      currentSearchData.currentIndustry = '';
      currentSearchData.nextPageToken = nextPageToken;
      currentSearchData.places = [];
      currentSearchData.jobs = temp.jobs || [];
      currentSearchData.inputs = temp.inputs || {};
      saveToSessionStorage();
      for (const job of (temp.jobs || [])) {
        addJobRow(job);
      }
    }
    populateFilters();
    applyFilters();
  } catch (err) {
    console.error('Restore error:', err);
    isViewingRecent = false; // allow snapshot to re-manage table state if restore failed
  } finally {
    isRestoring = false;
    if (restoreBtn) {
      restoreBtn.disabled = false;
      restoreBtn.textContent = 'Reload Recent Search';
    }
  }
}

if (restoreBtn) {
  restoreBtn.addEventListener('click', () => triggerRestore());
}

function updateRestoreTimer(expiresAtDate) {
  if (restoreTimerInterval) clearInterval(restoreTimerInterval);
  const tick = () => {
    const now = new Date();
    const diff = expiresAtDate - now;
    if (diff <= 0) {
      if (restoreTimer) restoreTimer.textContent = 'Expired';
      if (restoreBtn) restoreBtn.disabled = true;
      clearInterval(restoreTimerInterval);
      // Delete stale temp data from Firestore so it doesn't persist forever
      const user = auth.currentUser;
      if (user) {
        const field = searchMode === 'companies' ? 'companySearchTemp' : 'jobSearchTemp';
        updateDoc(doc(db, 'users', user.uid), { [field]: deleteField() })
          .catch(e => console.error('Failed to clear expired search data:', e));
      }
      return;
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    if (restoreTimer) restoreTimer.textContent = `Expires in ${mins}m ${secs}s`;
    if (restoreBtn) restoreBtn.disabled = false;
  };
  tick();
  restoreTimerInterval = setInterval(tick, 1000);
}

async function fetchLimits() {
  try {
    const res = await fetchWithAuth('/api/user-limits');
    if (res.ok) {
      userLimits = await res.json();
      renderLimitsShowcase();
    }
  } catch (err) {
    console.error('Error fetching limits:', err);
  }
}

function renderLimitsShowcase() {
  const showcase = document.getElementById('limitsShowcase');
  const label = document.getElementById('limitLabel');
  const barFill = document.getElementById('limitBarFill');

  if (!showcase || !label || !barFill || !userLimits) return;

  showcase.style.display = 'flex';

  if (userLimits.role === 'owner') {
    label.textContent = 'Unlimited (Owner)';
    barFill.style.width = '100%';
    barFill.style.backgroundColor = 'var(--accent)';
    return;
  }

  if (searchMode === 'jobs') {
    const remain = userLimits.jobSearchesRemaining;
    label.textContent = `Jobs: ${remain}/10 left`;
    const pct = Math.max(0, Math.min(100, (remain / 10) * 100));
    barFill.style.width = `${pct}%`;
    barFill.style.backgroundColor = remain <= 2 ? '#ef4444' : 'var(--accent)';
  } else {
    const remain = userLimits.companyLoadsRemaining;
    label.textContent = `Leads: ${remain}/3000 left`;
    const pct = Math.max(0, Math.min(100, (remain / 3000) * 100));
    barFill.style.width = `${pct}%`;
    barFill.style.backgroundColor = remain <= 500 ? '#ef4444' : 'var(--accent)';
  }
}

const printBtn = document.getElementById('printBtn');
const searchBtn = document.getElementById('searchBtn');
const nextBtn = document.getElementById('nextBtn');
const tbody = document.querySelector('#resultsTable tbody');
const tableEmpty = document.getElementById('tableEmpty');
const emptyText = document.getElementById('emptyText');

const sortAlphabetDropdown = document.getElementById('sortAlphabetDropdown');
const sortContactsDropdown = document.getElementById('sortContactsDropdown');
const filterPlatformDropdown = document.getElementById('filterPlatformDropdown');
const filterPlatformMenu = document.getElementById('filterPlatformMenu');
const filterIndustryDropdown = document.getElementById('filterIndustryDropdown');
const filterIndustryMenu = document.getElementById('filterIndustryMenu');

// Mode toggle elements
const modeToggle = document.getElementById('modeToggle');
const fieldJobTitle = document.getElementById('fieldJobTitle');
const fieldJobLocation = document.getElementById('fieldJobLocation');
const fieldIndustry = document.getElementById('fieldIndustry');
const fieldLocation = document.getElementById('fieldLocation');
const fieldCompanyName = document.getElementById('fieldCompanyName');
// Use the data-mode attribute set on <html> in each page — immune to URL/pathname edge cases
let searchMode = document.documentElement.dataset.mode || 'jobs';
let lastQuery = '';

// Modal Elements
const modal = document.getElementById('emailModal');
const closeBtn = document.querySelector('.close-btn');
const copyBtn = document.getElementById('copyBtn');
const draftTextarea = document.getElementById('draftTextarea');
const modalSubtitle = document.getElementById('modalSubtitle');

// Tag colour index cycles 0-4
const TAG_CLASSES = ['tag-0', 'tag-1', 'tag-2', 'tag-3', 'tag-4'];
let tagColorMap = {};

function getTagClass(label) {
  if (!tagColorMap[label]) {
    const keys = Object.keys(tagColorMap).length;
    tagColorMap[label] = TAG_CLASSES[keys % TAG_CLASSES.length];
  }
  return tagColorMap[label];
}

// HTML-escape to prevent XSS when injecting dynamic text via innerHTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function setLoading(button, isLoading, originalText) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = `
      <svg class="lucide lucide-loader-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite; margin-right: 6px;">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      ${originalText}
    `;
    // Add CSS for spinning if not already present
    if (!document.getElementById('spinnerStyle')) {
      const style = document.createElement('style');
      style.id = 'spinnerStyle';
      style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  } else {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

function setStatus(text, active = false) {
  // no-op since status badge was removed
}

// Search
async function performSearch(isNextPage = false) {
  let query;
  let endpoint = '/api/search';
  let searchInputs = {};

  if (searchMode === 'jobs') {
    const jobTitleEl = document.getElementById('jobTitle');
    const jobLocEl = document.getElementById('jobLocation');
    const jobTitleInput = jobTitleEl ? jobTitleEl.value.trim() : '';
    const jobLocInput = jobLocEl ? jobLocEl.value.trim() : '';

    if (!jobTitleInput) {
      alert('Please enter a Job Title.');
      return;
    }
    currentIndustry = jobTitleInput;
    query = jobLocInput ? `"${jobTitleInput}" "${jobLocInput}"` : `"${jobTitleInput}"`;
    endpoint = '/api/search';
    searchInputs = { jobTitle: jobTitleInput, jobLocation: jobLocInput };
  } else {
    const companyInput = document.getElementById('companyName')?.value.trim() || '';
    const industryInput = document.getElementById('industry')?.value.trim() || '';
    const locationInput = document.getElementById('location')?.value.trim() || '';

    if (!companyInput && !industryInput && !locationInput) {
      alert('Please enter at least one of: Company Name, Industry, or Location.');
      return;
    }
    currentIndustry = industryInput || companyInput || 'Unknown';

    const parts = [];
    if (companyInput) parts.push(companyInput);
    if (industryInput) parts.push(industryInput);
    if (locationInput) {
      if (parts.length > 0) parts.push(`in ${locationInput}`);
      else parts.push(locationInput);
    }

    query = parts.join(' ');
    searchInputs = { companyName: companyInput, industry: industryInput, location: locationInput };
    endpoint = '/api/search-companies';
  }

  const origText = searchBtn ? searchBtn.textContent : 'Search';
  const targetBtn = isNextPage ? nextBtn : searchBtn;

  setLoading(targetBtn, true, searchMode === 'companies' ? (isNextPage ? 'Searching More...' : 'Searching...') : 'Searching...');
  setStatus(isNextPage ? 'Fetching next page...' : 'Fetching...', true);

  if (!isNextPage) {
    if (restoreContainer) restoreContainer.style.display = 'none';
  }

  if (!isNextPage && tbody) {
    tbody.innerHTML = '';
    nextPageToken = '';
    rowCount = 0;
    tagColorMap = {};
    if (tableEmpty) tableEmpty.style.display = 'none';
    currentSearchData.places = [];
    currentSearchData.jobs = [];
    currentSearchData.inputs = searchInputs;
  }
  
  currentSearchData.mode = searchMode;
  currentSearchData.query = query;
  currentSearchData.currentIndustry = currentIndustry;

  // Set isViewingRecent BEFORE the await so onSnapshot never wipes a live search
  isViewingRecent = true;

  try {
    const response = await fetchWithAuth(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, inputs: searchInputs, pageToken: isNextPage ? nextPageToken : '' })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    if (searchMode === 'jobs') {
      let jobs = data.jobs || [];

      // Deduplicate jobs against existing currentSearchData.jobs
      if (isNextPage && currentSearchData.jobs && currentSearchData.jobs.length > 0) {
        const existingSignatures = new Set(currentSearchData.jobs.map(j => (j.title + '|' + j.company_name)));
        jobs = jobs.filter(j => !existingSignatures.has(j.title + '|' + j.company_name));
      }

      if (jobs.length === 0 && (!isNextPage || currentSearchData.jobs.length === 0)) {
        setStatus('No results found.');
        if (!isNextPage && tableEmpty) tableEmpty.style.display = 'block';
        nextPageToken = '';
        return;
      }

      nextPageToken = data.nextPageToken || '';
      currentSearchData.nextPageToken = nextPageToken;
      currentSearchData.jobs = isNextPage ? currentSearchData.jobs.concat(jobs) : jobs;
      saveToSessionStorage();

      for (const job of jobs) {
        addJobRow(job);
      }

      setStatus(`${rowCount} job listings`, false);
    } else {
      let places = (data.places || []).slice(0, 20);

      // Deduplicate companies against existing currentSearchData.places
      if (isNextPage && currentSearchData.places && currentSearchData.places.length > 0) {
        const existingNames = new Set(currentSearchData.places.map(p => p.displayName?.text || 'Unknown'));
        places = places.filter(p => !existingNames.has(p.displayName?.text || 'Unknown'));
      }

      if (places.length === 0 && (!isNextPage || currentSearchData.places.length === 0)) {
        setStatus('No results found.');
        if (!isNextPage && tableEmpty) tableEmpty.style.display = 'block';
        nextPageToken = '';
        return;
      }

      nextPageToken = data.nextPageToken || '';
      currentSearchData.nextPageToken = nextPageToken;
      
      const startIndex = isNextPage ? currentSearchData.places.length : 0;
      currentSearchData.places = isNextPage ? currentSearchData.places.concat(places) : places;
      saveToSessionStorage();

      for (let i = 0; i < places.length; i++) {
        addCompanyRow(places[i], currentIndustry, startIndex + i);
      }

      setStatus(`${rowCount} companies`, false);
    }

  } catch (error) {
    console.error('Search error:', error);
    isViewingRecent = false; // let snapshot manage empty state after a failed search
    alert(error.message);
    if (searchBtn) setLoading(searchBtn, false, origText);
  } finally {
    setStatus('Ready');
    if (searchBtn) setLoading(searchBtn, false, 'Search');
    if (nextBtn) {
      setLoading(nextBtn, false, 'Search More');
      const showNext = !!(searchMode === 'companies' && nextPageToken);
      nextBtn.style.display = showNext ? 'inline-flex' : 'none';
      nextBtn.disabled = !showNext;
      // Only disable searchBtn when "Search More" mode is active (there's a next page to load)
      if (searchBtn) {
        searchBtn.style.display = 'inline-flex';
        searchBtn.disabled = showNext; // disabled only when user should be using "Search More" instead
      }
    }
    populateFilters();
    applyFilters();
  }
}

function addJobRow(job) {
  rowCount++;
  const title       = job.title || 'Unknown Title';
  const companyName = job.companyName || 'Unknown Company';
  const location    = job.location || 'Malaysia';
  const site        = job.site || 'Other';
  const link        = job.link || '#';
  // 'via' is the platform label from Google Jobs (e.g. "Indeed", "LinkedIn", "JobStreet")
  // Fall back to site if via not available
  const platform    = job.via || site;

  const tagClass = getTagClass(platform);

  const safeTitle    = escapeHtml(title);
  const safeCompany  = escapeHtml(companyName);
  const safeLoc      = escapeHtml(location);
  const safePlatform = escapeHtml(platform);
  const safeLink     = escapeHtml(link);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <span class="job-title company-name">${safeTitle}</span>
    </td>
    <td>${safeCompany}</td>
    <td>${safeLoc}</td>
    <td>
      <span class="tag ${tagClass}">${safePlatform}</span>
    </td>
    <td>
      <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="external-link">
        View Job
      </a>
    </td>
    <td>
      <button class="draft-btn" data-company="${safeCompany}" data-title="${safeTitle}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        Draft
      </button>
    </td>
  `;


  const draftBtn = tr.querySelector('.draft-btn');
  draftBtn.addEventListener('click', () => {
    generateDraft(companyName, title);
  });
  if (tbody) tbody.appendChild(tr);
}

async function addCompanyRow(place, defaultIndustry, placeIndex = -1) {
  rowCount++;
  const name     = place.displayName?.text || 'Unknown';
  const industry = place.primaryTypeDisplayName?.text || defaultIndustry;
  const address  = place.formattedAddress || '';
  const website  = place.websiteUri || '';
  const mapPhone = place.nationalPhoneNumber || '';

  const tagClass = getTagClass(industry);

  const safeName     = escapeHtml(name);
  const safeIndustry = escapeHtml(industry);
  const safeAddress  = escapeHtml(address);
  const safeWebsite  = escapeHtml(website);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="company-name">${safeName}</span></td>
    <td><span class="tag ${tagClass}">${safeIndustry}</span></td>
    <td>
      ${safeAddress 
        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer" class="address-link">
             ${safeAddress}
           </a>` 
        : '<span style="color:var(--text-muted)">N/A</span>'}
    </td>
    <td>
      ${website
        ? `<a href="${safeWebsite}" target="_blank" rel="noopener noreferrer" class="external-link">
             Visit
           </a>`
        : '<span style="color:var(--text-muted)">N/A</span>'}
    </td>
    <td class="contacts-cell">
      ${place.scrapedContactsHTML ? `<div class="contacts-inner">${place.scrapedContactsHTML}</div>` : '<span class="loader"></span>'}
    </td>
    <td>
      <button class="draft-btn" data-company="${safeName}" data-industry="${safeIndustry}" ${!place.scrapedContactsHTML ? 'disabled' : ''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        Draft
      </button>
    </td>
  `;

  const draftBtn = tr.querySelector('.draft-btn');
  draftBtn.addEventListener('click', () => {
    generateDraft(name, industry);
  });
  if (tbody) tbody.appendChild(tr);

  // If already scraped, skip the scraping process
  if (place.scrapedContactsHTML) {
    return;
  }

  // SVG icons (Lucide-style, 12px)
  const iconPhone = `<svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const iconMail = `<svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  const iconLink = `<svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

  let contactsHTML = '';

  function isValidEmail(email) {
    const e = email.toLowerCase().trim();
    const parts = e.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!domain || domain.length < 3) return false;
    if (/^[\d.]+$/.test(domain)) return false;
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
    const junkDomains = ['example.com','example.org','test.com','sentry.io',
      'sentry.wixpress.com','wixpress.com','localhost','email.com'];
    if (junkDomains.some(j => domain === j || domain.endsWith('.' + j))) return false;
    if (domain.startsWith('sentry')) return false;
    const junkLocals = ['email','test','user','admin','example','name',
      'your','info@example','noreply','no-reply'];
    if (junkLocals.includes(local)) return false;
    return true;
  }

  if (mapPhone) {
    contactsHTML += `<div class="contact-chip">${iconPhone}${escapeHtml(mapPhone)}</div>`;
  }

  if (website) {
    try {
      const scrapeRes  = await fetchWithAuth('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website })
      });
      const scrapeData = await scrapeRes.json();

      scrapeData.emails.filter(isValidEmail).forEach(e => {
        contactsHTML += `<div class="contact-chip">${iconMail}${escapeHtml(e)}</div>`;
      });

      scrapeData.phones.filter(p => p !== mapPhone).forEach(p => {
        contactsHTML += `<div class="contact-chip">${iconPhone}${escapeHtml(p)}</div>`;
      });

      const seenHosts = new Set();
      scrapeData.socials.forEach(s => {
        try {
          const host = new URL(s).hostname.replace('www.', '');
          if (seenHosts.has(host)) return;
          seenHosts.add(host);
          contactsHTML += `<div class="contact-chip">${iconLink}<a href="${escapeHtml(s)}" target="_blank" rel="noopener noreferrer" class="social-link">${escapeHtml(host)}</a></div>`;
        } catch (_) {}
      });

    } catch (e) {
      console.error('Scrape failed for ' + website);
    }
  }

  if (!contactsHTML) {
    contactsHTML = '<span style="color:var(--text-muted);font-size:11px;">No contacts found</span>';
  }

  tr.querySelector('.contacts-cell').innerHTML = `<div class="contacts-inner">${contactsHTML}</div>`;
  tr.querySelector('.draft-btn').disabled = false;
  
  // Save scraped result to sessionStorage and sync to Firestore
  if (placeIndex >= 0 && currentSearchData.places && currentSearchData.places[placeIndex]) {
    currentSearchData.places[placeIndex].scrapedContactsHTML = contactsHTML;
    saveToSessionStorage();
    
    // Sync to Firestore so the 'Reload' button pulls fully scraped data for other devices
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          'companySearchTemp.places': currentSearchData.places
        });
      }
    } catch (e) {
      console.error('Failed to sync scraped contacts to Firestore:', e);
    }
  }
}


// Email / Cover Letter Draft
window.generateDraft = async function (companyName, jobTitleOrIndustry) {
  modal.classList.add('show');
  const isCompanyMode = searchMode === 'companies';
  modalSubtitle.textContent = isCompanyMode
    ? `Generating cold email for: ${companyName}`
    : `Generating cover letter for: ${companyName}`;
  draftTextarea.value = 'AI is drafting...\nThis usually takes 3-5 seconds.';
  copyBtn.disabled = true;

  try {
    const res = await fetchWithAuth('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        jobTitle: isCompanyMode ? undefined : jobTitleOrIndustry,
        industry: isCompanyMode ? jobTitleOrIndustry : undefined,
        mode: searchMode
      })
    });
    if (res.ok) {
      fetchLimits(); // refresh limits after search
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    draftTextarea.value = data.draft;
    modalSubtitle.textContent = `Ready | ${companyName}`;
    copyBtn.disabled = false;

  } catch (error) {
    draftTextarea.value = 'Failed to generate draft:\n\n' + error.message;
  }
};

// ── Sorting and Filtering ──────────────────────────────
function sortTable(type, isAsc) {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  if (type === 'alphabet') {
    rows.sort((a, b) => {
      const aVal = a.querySelector('td').textContent.trim().toLowerCase();
      const bVal = b.querySelector('td').textContent.trim().toLowerCase();
      return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  } else if (type === 'contacts') {
    rows.sort((a, b) => {
      const aContacts = a.querySelectorAll('td')[4]?.querySelectorAll('.contact-chip').length || 0;
      const bContacts = b.querySelectorAll('td')[4]?.querySelectorAll('.contact-chip').length || 0;
      return isAsc ? aContacts - bContacts : bContacts - aContacts;
    });
  }

  tbody.innerHTML = '';
  rows.forEach(row => tbody.appendChild(row));
}

let currentPlatformFilter = 'all';
let currentIndustryFilter = 'all';

function updateActiveDropdownItem(menu, activeItem) {
  if (!menu) return;
  menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
  if (activeItem) activeItem.classList.add('active');
}

function populateFilters() {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  if (searchMode === 'jobs' && filterPlatformMenu) {
    const platforms = new Set();
    rows.forEach(row => {
      const platform = row.querySelectorAll('td')[3]?.querySelector('.tag')?.textContent.trim() || row.querySelectorAll('td')[3]?.textContent.trim();
      if (platform) platforms.add(platform);
    });
    
    filterPlatformMenu.innerHTML = `<div class="dropdown-item ${currentPlatformFilter === 'all' ? 'active' : ''}" data-value="all">All Platforms</div>`;
    Array.from(platforms).sort().forEach(p => {
      const div = document.createElement('div');
      div.className = `dropdown-item ${currentPlatformFilter === p ? 'active' : ''}`;
      div.setAttribute('data-value', p);
      div.textContent = p;
      filterPlatformMenu.appendChild(div);
    });
  } else if (searchMode === 'companies' && filterIndustryMenu) {
    const industries = new Set();
    rows.forEach(row => {
      const industry = row.querySelectorAll('td')[1]?.querySelector('.tag')?.textContent.trim() || row.querySelectorAll('td')[1]?.textContent.trim();
      if (industry) industries.add(industry);
    });

    filterIndustryMenu.innerHTML = `<div class="dropdown-item ${currentIndustryFilter === 'all' ? 'active' : ''}" data-value="all">All Industries</div>`;
    Array.from(industries).sort().forEach(i => {
      const div = document.createElement('div');
      div.className = `dropdown-item ${currentIndustryFilter === i ? 'active' : ''}`;
      div.setAttribute('data-value', i);
      div.textContent = i;
      filterIndustryMenu.appendChild(div);
    });
  }
}

function applyFilters() {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (searchMode === 'jobs') {
    rows.forEach(row => {
      const platform = row.querySelectorAll('td')[3]?.querySelector('.tag')?.textContent.trim() || row.querySelectorAll('td')[3]?.textContent.trim();
      row.style.display = (currentPlatformFilter === 'all' || platform === currentPlatformFilter) ? '' : 'none';
    });
  } else if (searchMode === 'companies') {
    rows.forEach(row => {
      const industry = row.querySelectorAll('td')[1]?.querySelector('.tag')?.textContent.trim() || row.querySelectorAll('td')[1]?.textContent.trim();
      row.style.display = (currentIndustryFilter === 'all' || industry === currentIndustryFilter) ? '' : 'none';
    });
  }
}

// Delegate click on dynamically added filter items and sorting items
document.addEventListener('click', (e) => {
  if (e.target.matches('.dropdown-item[data-action^="sort-"]')) {
    const action = e.target.getAttribute('data-action');
    if (action.includes('alphabet')) {
      sortTable('alphabet', action.endsWith('asc'));
    } else if (action.includes('contacts')) {
      sortTable('contacts', action.endsWith('asc'));
    }
    // Update active state in menu
    updateActiveDropdownItem(e.target.closest('.dropdown-menu'), e.target);
    
    // Update label text
    const label = e.target.closest('.custom-dropdown').querySelector('.dropdown-label');
    if (label) {
      if (action.includes('alphabet')) {
        label.textContent = action.endsWith('asc') ? 'Alphabet (A-Z)' : 'Alphabet (Z-A)';
      } else if (action.includes('contacts')) {
        label.textContent = action.endsWith('asc') ? 'Contacts (Asc)' : 'Contacts (Desc)';
      }
    }
  } else if (e.target.matches('#filterPlatformMenu .dropdown-item')) {
    currentPlatformFilter = e.target.getAttribute('data-value');
    updateActiveDropdownItem(filterPlatformMenu, e.target);
    const label = document.querySelector('#filterPlatformDropdown .dropdown-label');
    if (label) label.textContent = currentPlatformFilter === 'all' ? 'Filter by Platform' : currentPlatformFilter;
    applyFilters();
  } else if (e.target.matches('#filterIndustryMenu .dropdown-item')) {
    currentIndustryFilter = e.target.getAttribute('data-value');
    updateActiveDropdownItem(filterIndustryMenu, e.target);
    const label = document.querySelector('#filterIndustryDropdown .dropdown-label');
    if (label) label.textContent = currentIndustryFilter === 'all' ? 'Filter by Industry' : currentIndustryFilter;
    applyFilters();
  }
});

if (searchBtn) {
  searchBtn.addEventListener('click', () => performSearch(false));
}
if (nextBtn) {
  nextBtn.addEventListener('click', () => performSearch(true));
}

// Enter key triggers search in all input fields
['jobTitle', 'jobLocation', 'companyName', 'industry', 'location'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });
  }
});

closeBtn.addEventListener('click', () => modal.classList.remove('show'));
window.addEventListener('click', e => {
  if (e.target === modal) modal.classList.remove('show');
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(draftTextarea.value);
  } catch {
    // Fallback for older browsers or non-HTTPS contexts
    draftTextarea.select();
    document.execCommand('copy');
  }
  const orig = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = orig, 2000);
});

// Export PDF
document.getElementById('printBtn').addEventListener('click', printTable);

function printTable() {
  const rows = tbody.querySelectorAll('tr');
  if (rows.length === 0) {
    alert('No results to export. Please search first.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Collect table data
  const tableData = [];
  const urls = [];
  const isJobs = searchMode === 'jobs';

  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 6) return;

    if (isJobs) {
      const jobTitle = tds[0].querySelector('.job-title')?.textContent.trim() || tds[0].textContent.trim();
      const company = tds[1].textContent.trim();
      const location = tds[2].textContent.trim();
      const platform = tds[3].querySelector('.tag')?.textContent.trim() || tds[3].textContent.trim();
      const linkEl = tds[4].querySelector('a');
      const jobLink = linkEl ? linkEl.href : '';

      tableData.push([jobTitle, company, location, platform, jobLink]);
      urls.push(jobLink);
    } else {
      const company = tds[0].querySelector('.company-name')?.textContent.trim() || tds[0].textContent.trim();
      const industry = tds[1].querySelector('.tag')?.textContent.trim() || tds[1].textContent.trim();
      const address = tds[2].textContent.trim();
      const websiteEl = tds[3].querySelector('a.external-link');
      const website = websiteEl ? websiteEl.href : '';

      const chips = tds[4].querySelectorAll('.contact-chip');
      const contacts = [];
      chips.forEach(chip => {
        const clone = chip.cloneNode(true);
        clone.querySelectorAll('svg').forEach(s => s.remove());
        const txt = clone.textContent.trim();
        if (txt) contacts.push(txt);
      });

      tableData.push([company, industry, address, website, contacts.join('\n')]);
      urls.push(website);
    }
  });

  // ── Document header ──────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(isJobs ? 'AJOS / Malaysia Job Listings' : 'AJOS / Company Leads', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported: ${new Date().toLocaleString()}   |   ${tableData.length} ${isJobs ? 'listings' : 'companies'}`, 14, 19);
  doc.setTextColor(0, 0, 0);

  // ── Table ────────────────────────────────────────────────
  doc.autoTable({
    startY: 24,
    head: isJobs
      ? [['Job Title', 'Company', 'Location', 'Platform', 'Job Link']]
      : [['Company', 'Industry', 'Address', 'Website', 'Contacts']],
    body: tableData,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      valign: 'top',
      overflow: 'linebreak',
      textColor: [30, 30, 30],
      lineColor: [210, 210, 210],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: isJobs
      ? {
        0: { cellWidth: 60 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto', textColor: [26, 86, 219] },
      }
      : {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 60 },
        3: { cellWidth: 50, textColor: [26, 86, 219] },
        4: { cellWidth: 'auto', textColor: [26, 86, 219] },
      },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;

      if (isJobs && data.column.index === 4) {
        const url = urls[data.row.index];
        if (url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
      } else if (!isJobs && data.column.index === 3) {
        const url = urls[data.row.index];
        if (url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Trigger download ─────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(isJobs ? `AJOS_Jobs_Export_${dateStr}.pdf` : `AJOS_Companies_Export_${dateStr}.pdf`);
}

// ── Theme Toggle & Persistence ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Theme is locked to Dark Mode for now
  /*
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const storedTheme = localStorage.getItem('theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  // Resolve active theme: explicit preference or system default
  const activeTheme = storedTheme || (prefersLight ? 'light' : 'dark');

  if (activeTheme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
  }
  */


  // Restore active search mode tab
  const savedSearchMode = localStorage.getItem('searchMode');
  if (savedSearchMode && savedSearchMode !== 'jobs') {
    const btnToClick = document.querySelector(`.mode-btn[data-mode="${savedSearchMode}"]`);
    if (btnToClick) {
      document.querySelector('.mode-btn.active').classList.remove('active');
      btnToClick.click();
    }
  }

  // ponytail: duplicate logout listener removed — the module-level one at the top handles logout correctly

  // Attempt to restore from session storage on load
  restoreFromSessionStorage().then(restored => {
    if (restored) {
      isViewingRecent = true;
      const restoreContainer = document.getElementById('restoreContainer');
      if (restoreContainer) restoreContainer.style.display = 'none';
    }
  });
});