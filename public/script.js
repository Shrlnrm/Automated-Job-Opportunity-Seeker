let nextPageToken = '';
let currentIndustry = '';
let rowCount = 0;

const searchBtn   = document.getElementById('searchBtn');
const nextBtn     = document.getElementById('nextBtn');
const statusText  = document.getElementById('statusText');
const tbody       = document.querySelector('#resultsTable tbody');
const tableEmpty  = document.getElementById('tableEmpty');
const emptyText   = document.getElementById('emptyText');

// Mode toggle elements
const modeToggle       = document.getElementById('modeToggle');
const fieldJobTitle    = document.getElementById('fieldJobTitle');
const fieldJobLocation = document.getElementById('fieldJobLocation');
const fieldIndustry    = document.getElementById('fieldIndustry');
const fieldLocation    = document.getElementById('fieldLocation');
let searchMode = 'jobs'; // 'jobs' or 'companies'

// Modal Elements
const modal         = document.getElementById('emailModal');
const closeBtn      = document.querySelector('.close-btn');
const copyBtn       = document.getElementById('copyBtn');
const draftTextarea = document.getElementById('draftTextarea');
const modalSubtitle = document.getElementById('modalSubtitle');

// Tag colour index cycles 0-4
const TAG_CLASSES = ['tag-0','tag-1','tag-2','tag-3','tag-4'];
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
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<span class="loader"></span>';
  } else {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

function setStatus(text, active = false) {
  statusText.textContent = text;
  statusText.classList.toggle('active', active);
}

// Mode toggle logic
modeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn || btn.classList.contains('active')) return;

  modeToggle.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  searchMode = btn.dataset.mode;

  const thead = document.querySelector('#resultsTable thead');

  if (searchMode === 'jobs') {
    fieldJobTitle.style.display = 'flex';
    fieldJobLocation.style.display = 'flex';
    fieldIndustry.style.display = 'none';
    fieldLocation.style.display = 'none';
    emptyText.innerHTML = '<img src="flag.png" alt="Malaysia" class="flag-icon" /> Enter a job title and city above to find opportunities in Malaysia.';
    document.querySelector('.page-name').textContent = 'Jobs (Malaysia Only)';
    thead.innerHTML = `
      <tr>
        <th class="col-company">Job Title</th>
        <th class="col-industry">Company</th>
        <th class="col-address">Location</th>
        <th class="col-website">Platform</th>
        <th class="col-contacts">Job Link</th>
        <th class="col-actions">AI Cover Letter</th>
      </tr>
    `;
  } else {
    fieldJobTitle.style.display = 'none';
    fieldJobLocation.style.display = 'none';
    fieldIndustry.style.display = 'flex';
    fieldLocation.style.display = 'flex';
    emptyText.textContent = 'Enter an industry and location above to find company leads.';
    document.querySelector('.page-name').textContent = 'Companies';
    thead.innerHTML = `
      <tr>
        <th class="col-company">Company</th>
        <th class="col-industry">Industry</th>
        <th class="col-address">Address</th>
        <th class="col-website">Website</th>
        <th class="col-contacts">Contacts</th>
        <th class="col-actions">Cold Email</th>
      </tr>
    `;
  }
  tbody.innerHTML = '';
});

// Search
async function performSearch(isNextPage = false) {
  let query;
  let endpoint = '/api/search';

  if (searchMode === 'jobs') {
    const jobTitleInput = document.getElementById('jobTitle').value.trim();
    const jobLocInput   = document.getElementById('jobLocation').value.trim();
    if (!jobTitleInput) {
      alert('Please enter a Job Title.');
      return;
    }
    currentIndustry = jobTitleInput;
    query = jobLocInput ? `"${jobTitleInput}" "${jobLocInput}"` : `"${jobTitleInput}"`;
    endpoint = '/api/search';
  } else {
    const industryInput = document.getElementById('industry').value.trim();
    const locationInput = document.getElementById('location').value.trim();
    if (!industryInput || !locationInput) {
      alert('Please enter both Industry and Location.');
      return;
    }
    currentIndustry = industryInput;
    query = `${industryInput} in ${locationInput}`;
    endpoint = '/api/search-companies';
  }

  const targetBtn  = isNextPage ? nextBtn : searchBtn;
  const origText   = isNextPage ? 'Load more' : 'Search';

  setLoading(targetBtn, true, origText);
  setStatus(isNextPage ? 'Fetching next page...' : 'Fetching...', true);

  if (!isNextPage) {
    tbody.innerHTML = '';
    nextPageToken = '';
    rowCount = 0;
    tagColorMap = {};
    tableEmpty.style.display = 'none';
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageToken: isNextPage ? nextPageToken : '' })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    if (searchMode === 'jobs') {
      let jobs = data.jobs || [];

      if (jobs.length === 0) {
        setStatus('No results found.');
        if (!isNextPage) tableEmpty.style.display = 'block';
        setLoading(targetBtn, false, origText);
        return;
      }

      nextPageToken = data.nextPageToken || '';
      nextBtn.disabled = !nextPageToken;

      for (const job of jobs) {
        addJobRow(job);
      }

      setStatus(`${rowCount} job listings`, false);
    } else {
      let places = (data.places || []).slice(0, 20);

      if (places.length === 0) {
        setStatus('No results found.');
        if (!isNextPage) tableEmpty.style.display = 'block';
        setLoading(targetBtn, false, origText);
        return;
      }

      nextPageToken = data.nextPageToken || '';
      nextBtn.disabled = !nextPageToken;

      for (const place of places) {
        await addCompanyRow(place, currentIndustry);
      }

      setStatus(`${rowCount} companies`, false);
    }

  } catch (error) {
    alert('Search Error: ' + error.message);
    setStatus('Error occurred.');
  } finally {
    setLoading(targetBtn, false, origText);
  }
}

function addJobRow(job) {
  rowCount++;
  const title       = job.title || 'Unknown Title';
  const companyName = job.companyName || 'Unknown Company';
  const location    = job.location || 'Malaysia';
  const site        = job.site || 'Other';
  const link        = job.link || '#';

  const tagClass = getTagClass(site);

  const safeTitle   = escapeHtml(title);
  const safeCompany = escapeHtml(companyName);
  const safeLoc     = escapeHtml(location);
  const safeSite    = escapeHtml(site);
  const safeLink    = escapeHtml(link);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="job-title company-name">${safeTitle}</span></td>
    <td>${safeCompany}</td>
    <td>${safeLoc}</td>
    <td><span class="tag ${tagClass}">${safeSite}</span></td>
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
  tbody.appendChild(tr);
}

async function addCompanyRow(place, defaultIndustry) {
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
    <td>${safeAddress}</td>
    <td>
      ${website
        ? `<a href="${safeWebsite}" target="_blank" rel="noopener noreferrer" class="external-link">
             Visit
           </a>`
        : '<span style="color:var(--text-muted)">N/A</span>'}
    </td>
    <td class="contacts-cell"><span class="loader"></span></td>
    <td>
      <button class="draft-btn" data-company="${safeName}" data-industry="${safeIndustry}" disabled>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        Draft
      </button>
    </td>
  `;

  const draftBtn = tr.querySelector('.draft-btn');
  draftBtn.addEventListener('click', () => {
    generateDraft(name, industry);
  });
  tbody.appendChild(tr);

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
      const scrapeRes  = await fetch('/api/scrape', {
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
}

// Email / Cover Letter Draft
window.generateDraft = async function(companyName, jobTitleOrIndustry) {
  modal.classList.add('show');
  const isCompanyMode = searchMode === 'companies';
  modalSubtitle.textContent = isCompanyMode
    ? `Generating cold email for: ${companyName}`
    : `Generating cover letter for: ${companyName}`;
  draftTextarea.value = 'AI is drafting...\nThis usually takes 3-5 seconds.';
  copyBtn.disabled = true;

  try {
    const res  = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        jobTitle: isCompanyMode ? undefined : jobTitleOrIndustry,
        industry: isCompanyMode ? jobTitleOrIndustry : undefined,
        mode: searchMode
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    draftTextarea.value = data.draft;
    modalSubtitle.textContent = `Ready | ${companyName}`;
    copyBtn.disabled = false;

  } catch (error) {
    draftTextarea.value = 'Failed to generate draft:\n\n' + error.message;
  }
};

// Event Listeners
searchBtn.addEventListener('click', () => performSearch(false));
nextBtn.addEventListener('click',   () => performSearch(true));

// Enter key triggers search in all input fields
['jobTitle', 'jobLocation', 'industry', 'location'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch(false);
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
  const urls      = [];
  const isJobs    = searchMode === 'jobs';

  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 6) return;

    if (isJobs) {
      const jobTitle = tds[0].querySelector('.job-title')?.textContent.trim() || tds[0].textContent.trim();
      const company  = tds[1].textContent.trim();
      const location = tds[2].textContent.trim();
      const platform = tds[3].querySelector('.tag')?.textContent.trim() || tds[3].textContent.trim();
      const linkEl   = tds[4].querySelector('a');
      const jobLink  = linkEl ? linkEl.href : '';

      tableData.push([jobTitle, company, location, platform, jobLink]);
      urls.push(jobLink);
    } else {
      const company  = tds[0].querySelector('.company-name')?.textContent.trim() || tds[0].textContent.trim();
      const industry = tds[1].querySelector('.tag')?.textContent.trim() || tds[1].textContent.trim();
      const address  = tds[2].textContent.trim();
      const websiteEl = tds[3].querySelector('a.external-link');
      const website   = websiteEl ? websiteEl.href : '';

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

  themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
});

