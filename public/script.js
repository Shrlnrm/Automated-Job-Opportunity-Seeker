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

  // Validate email: reject IP-based domains, numeric-only domains, short/missing TLDs
  function isValidEmail(email) {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    if (!domain || domain.length < 3) return false;
    // Reject IP-address domains (all digits and dots)
    if (/^[\d.]+$/.test(domain)) return false;
    // Must have a TLD of at least 2 alpha chars
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
    // Basic format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    return true;
  }

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

      // Filter valid emails only
      scrapeData.emails.filter(isValidEmail).forEach(e => {
        contactsHTML += `<div class="contact-chip">${iconMail}${e}</div>`;
      });

      scrapeData.phones.filter(p => p !== mapPhone).forEach(p => {
        contactsHTML += `<div class="contact-chip">${iconPhone}${p}</div>`;
      });

      // Deduplicate socials by hostname (one per platform)
      const seenHosts = new Set();
      scrapeData.socials.forEach(s => {
        try {
          const host = new URL(s).hostname.replace('www.', '');
          if (seenHosts.has(host)) return;
          seenHosts.add(host);
          contactsHTML += `<div class="contact-chip">${iconLink}<a href="${s}" target="_blank" rel="noopener noreferrer" class="social-link">${host}</a></div>`;
        } catch (_) { /* skip malformed URLs */ }
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

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Collect table data
  // contactsData[i] = array of { text, href|null } for row i
  const tableData    = [];
  const websiteUrls  = [];
  const contactsData = [];

  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 6) return;

    const company  = tds[0].querySelector('.company-name')?.textContent.trim() || '';
    const industry = tds[1].querySelector('.tag')?.textContent.trim() || tds[1].textContent.trim();
    const address  = tds[2].textContent.trim();

    const websiteEl = tds[3].querySelector('a.external-link');
    const website   = websiteEl ? websiteEl.href : '';

    // Contacts: preserve {text, href} per chip
    const chips = tds[4].querySelectorAll('.contact-chip');
    const items = [];
    chips.forEach(chip => {
      const clone = chip.cloneNode(true);
      clone.querySelectorAll('svg').forEach(s => s.remove());
      const linkEl = chip.querySelector('a');
      const text   = clone.textContent.trim();
      if (text) items.push({ text, href: linkEl ? linkEl.href : null });
    });

    tableData.push([company, industry, address, website, items.map(i => i.text).join('\n')]);
    websiteUrls.push(website);
    contactsData.push(items);
  });

  // ── Document header ──────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('AJOS / Companies', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported: ${new Date().toLocaleString()}   |   ${tableData.length} companies`, 14, 19);
  doc.setTextColor(0, 0, 0);

  // Line height in mm for fontSize 8 with lineHeightFactor ~1.5
  // 8pt * 0.3528mm/pt * 1.5 ≈ 4.23mm per line
  const lineH   = 8 * 0.3528 * 1.5;
  const padTop  = 3; // matches cellPadding top

  // ── Table ────────────────────────────────────────────────
  doc.autoTable({
    startY: 24,
    head: [['Company', 'Industry', 'Address', 'Website', 'Contacts']],
    body: tableData,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: padTop, bottom: 3, left: 4, right: 4 },
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
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 28 },
      2: { cellWidth: 55 },
      3: { cellWidth: 45, textColor: [26, 86, 219] },
      4: { cellWidth: 'auto' },
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;

      // Website column - entire cell is one clickable link
      if (data.column.index === 3) {
        const url = websiteUrls[data.row.index];
        if (url) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
      }

      // Contacts column - add clickable links AND draw social lines in blue
      if (data.column.index === 4) {
        const items = contactsData[data.row.index] || [];
        items.forEach((item, lineIdx) => {
          const linkY = data.cell.y + padTop + lineIdx * lineH;
          if (linkY + lineH > data.cell.y + data.cell.height) return;

          if (item.href) {
            // Draw blue text over the default black text for social links
            doc.setFontSize(8);
            doc.setTextColor(26, 86, 219);
            doc.text(item.text, data.cell.x + 4, linkY + lineH * 0.7);
            doc.setTextColor(30, 30, 30); // reset

            doc.link(data.cell.x, linkY, data.cell.width, lineH, { url: item.href });
          }
        });
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Trigger download ─────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`AJOS_Export_${dateStr}.pdf`);
}
