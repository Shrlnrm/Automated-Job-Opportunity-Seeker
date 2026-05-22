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
  const av       = initials(name);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <div class="company-cell">
        <div class="company-avatar">${av}</div>
        <span class="company-name" title="${name}">${name}</span>
      </div>
    </td>
    <td><span class="tag ${tagClass}">${industry}</span></td>
    <td>${address}</td>
    <td>
      ${website
        ? `<a href="${website}" target="_blank" rel="noopener noreferrer" class="external-link">
             Visit ↗
           </a>`
        : '<span style="color:var(--text-muted)">N/A</span>'}
    </td>
    <td class="contacts-cell"><span class="loader"></span></td>
    <td>
      <button class="draft-btn" onclick="generateDraft('${name.replace(/'/g,"\\'")}','${industry.replace(/'/g,"\\'")}')\" disabled>
        Draft email
      </button>
    </td>
  `;
  tbody.appendChild(tr);

  // Background scrape
  let contactsHTML = '';

  if (mapPhone) {
    contactsHTML += `<div class="contact-chip"><span class="chip-icon">📞</span>${mapPhone}</div>`;
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
        contactsHTML += `<div class="contact-chip"><span class="chip-icon">✉</span>${e}</div>`;
      });

      scrapeData.phones.filter(p => p !== mapPhone).forEach(p => {
        contactsHTML += `<div class="contact-chip"><span class="chip-icon">📞</span>${p}</div>`;
      });

      scrapeData.socials.forEach(s => {
        const host = new URL(s).hostname.replace('www.', '');
        contactsHTML += `<div class="contact-chip"><span class="chip-icon">↗</span><a href="${s}" target="_blank" rel="noopener noreferrer" class="social-link">${host}</a></div>`;
      });

    } catch (e) {
      console.error('Scrape failed for ' + website);
    }
  }

  if (!contactsHTML) {
    contactsHTML = '<span style="color:var(--text-muted);font-size:11px;">No contacts found</span>';
  }

  tr.querySelector('.contacts-cell').innerHTML = contactsHTML;
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
