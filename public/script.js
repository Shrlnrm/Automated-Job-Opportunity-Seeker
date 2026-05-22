let nextPageToken = '';
let currentIndustry = '';
let rowCount = 0;

const searchBtn   = document.getElementById('searchBtn');
const nextBtn     = document.getElementById('nextBtn');
const statusText  = document.getElementById('statusText');
const tbody       = document.querySelector('#resultsTable tbody');
const tableEmpty  = document.getElementById('tableEmpty');

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

// Search
async function performSearch(isNextPage = false) {
  const industryInput = document.getElementById('industry').value.trim();
  const locationInput = document.getElementById('location').value.trim();

  if (!industryInput || !locationInput) {
    alert('Please enter both Industry and Location.');
    return;
  }

  currentIndustry = industryInput;
  const query = `${industryInput} in ${locationInput}`;
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
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageToken: isNextPage ? nextPageToken : '' })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    let places = (data.places || []).slice(0, 20);

    if (places.length === 0) {
      setStatus('No more results.');
      if (!isNextPage) tableEmpty.style.display = 'block';
      setLoading(targetBtn, false, origText);
      return;
    }

    nextPageToken = data.nextPageToken || '';
    nextBtn.disabled = !nextPageToken;

    for (const place of places) {
      await addPlaceRow(place, currentIndustry);
    }

    setStatus(`${rowCount} companies`, false);

  } catch (error) {
    alert('Search Error: ' + error.message);
    setStatus('Error occurred.');
  } finally {
    setLoading(targetBtn, false, origText);
  }
}

async function addPlaceRow(place, defaultIndustry) {
  rowCount++;
  const name     = place.displayName?.text || 'Unknown';
  const industry = place.primaryTypeDisplayName?.text || defaultIndustry;
  const address  = place.formattedAddress || '';
  const website  = place.websiteUri || '';
  const mapPhone = place.nationalPhoneNumber || '';

  const tagClass = getTagClass(industry);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span class="company-name">${name}</span></td>
    <td><span class="tag ${tagClass}">${industry}</span></td>
    <td>${address}</td>
    <td>
      ${website
        ? `<a href="${website}" target="_blank" rel="noopener noreferrer" class="external-link">
             Visit
           </a>`
        : '<span style="color:var(--text-muted)">N/A</span>'}
    </td>
    <td class="contacts-cell"><span class="loader"></span></td>
    <td>
      <button class="draft-btn" onclick="generateDraft('${name.replace(/'/g,"\\'")}',' ${industry.replace(/'/g,"\\'")}'  )" disabled>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        Draft
      </button>
    </td>
  `;
  tbody.appendChild(tr);

  // SVG icons (Lucide-style, 12px)
  const iconPhone = `<svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const iconMail = `<svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  const iconLink = `<svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

  // Background scrape
  let contactsHTML = '';

  if (mapPhone) {
    contactsHTML += `<div class="contact-chip">${iconPhone}${mapPhone}</div>`;
  }

  if (website) {
    try {
      const scrapeRes  = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website })
      });
      const scrapeData = await scrapeRes.json();

      scrapeData.emails.forEach(e => {
        contactsHTML += `<div class="contact-chip">${iconMail}${e}</div>`;
      });

      scrapeData.phones.filter(p => p !== mapPhone).forEach(p => {
        contactsHTML += `<div class="contact-chip">${iconPhone}${p}</div>`;
      });

      scrapeData.socials.forEach(s => {
        const host = new URL(s).hostname.replace('www.', '');
        contactsHTML += `<div class="contact-chip">${iconLink}<a href="${s}" target="_blank" rel="noopener noreferrer" class="social-link">${host}</a></div>`;
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

// Email Draft
window.generateDraft = async function(companyName, industry) {
  modal.classList.add('show');
  modalSubtitle.textContent = `Generating draft for: ${companyName}`;
  draftTextarea.value = 'AI is drafting...\nThis usually takes 3-5 seconds.';
  copyBtn.disabled = true;

  try {
    const res  = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, industry })
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

closeBtn.addEventListener('click', () => modal.classList.remove('show'));
window.addEventListener('click', e => {
  if (e.target === modal) modal.classList.remove('show');
});

copyBtn.addEventListener('click', () => {
  draftTextarea.select();
  document.execCommand('copy');
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

  const tableRows = [];

  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 6) return;

    // Company
    const company = tds[0].querySelector('.company-name')?.textContent.trim() || '';

    // Industry (strip tag styling, just text)
    const industry = tds[1].querySelector('.tag')?.textContent.trim() || tds[1].textContent.trim();

    // Address
    const address = tds[2].textContent.trim();

    // Website
    const websiteEl = tds[3].querySelector('a.external-link');
    const website   = websiteEl ? websiteEl.href : '';

    // Contacts: strip SVGs, preserve links
    const chips = tds[4].querySelectorAll('.contact-chip');
    const contacts = [];
    chips.forEach(chip => {
      const clone = chip.cloneNode(true);
      clone.querySelectorAll('svg').forEach(s => s.remove());
      const link = chip.querySelector('a');
      const text = clone.textContent.trim();
      if (link) {
        contacts.push({ text: text || link.href, href: link.href });
      } else if (text) {
        contacts.push({ text, href: null });
      }
    });

    tableRows.push({ company, industry, address, website, contacts });
  });

  // Build contacts cell HTML (plain links, no chips)
  function contactsCellHTML(contacts) {
    if (!contacts.length) return '<span style="color:#999">—</span>';
    return contacts.map(c =>
      c.href
        ? `<a href="${c.href}" target="_blank">${c.text || c.href}</a>`
        : c.text
    ).join('<br>');
  }

  const rowsHTML = tableRows.map(r => `
    <tr>
      <td>${r.company}</td>
      <td>${r.industry}</td>
      <td>${r.address}</td>
      <td>${r.website ? `<a href="${r.website}" target="_blank">${r.website}</a>` : ''}</td>
      <td>${contactsCellHTML(r.contacts)}</td>
    </tr>`).join('');

  const exportedAt = new Date().toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AJOS Export</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #111;
      padding: 28px 32px;
    }
    .doc-header { margin-bottom: 18px; }
    .doc-header h1 { font-size: 15px; font-weight: 700; letter-spacing: -0.3px; }
    .doc-header p  { font-size: 10.5px; color: #666; margin-top: 3px; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    col.c-company  { width: 14%; }
    col.c-industry { width: 11%; }
    col.c-address  { width: 24%; }
    col.c-website  { width: 18%; }
    col.c-contacts { width: 33%; }
    th {
      background: #f2f2f2;
      border: 1px solid #ccc;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #333;
    }
    td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      font-size: 10.5px;
      vertical-align: top;
      line-height: 1.5;
      word-break: break-word;
    }
    tbody tr:nth-child(even) td { background: #fafafa; }
    a { color: #1a56db; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.2cm; size: A4 landscape; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>AJOS / Companies</h1>
    <p>Exported: ${exportedAt} &nbsp;|&nbsp; ${tableRows.length} companies</p>
  </div>
  <table>
    <colgroup>
      <col class="c-company">
      <col class="c-industry">
      <col class="c-address">
      <col class="c-website">
      <col class="c-contacts">
    </colgroup>
    <thead>
      <tr>
        <th>Company</th>
        <th>Industry</th>
        <th>Address</th>
        <th>Website</th>
        <th>Contacts</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocked. Please allow popups for this page and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Small delay so the content renders before print dialog opens
  setTimeout(() => win.print(), 600);
}

