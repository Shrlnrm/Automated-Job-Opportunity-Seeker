let nextPageToken = '';
let currentIndustry = '';
const searchBtn = document.getElementById('searchBtn');
const nextBtn = document.getElementById('nextBtn');
const statusText = document.getElementById('statusText');
const tbody = document.querySelector('#resultsTable tbody');

// Modal Elements
const modal = document.getElementById('emailModal');
const closeBtn = document.querySelector('.close-btn');
const copyBtn = document.getElementById('copyBtn');
const draftTextarea = document.getElementById('draftTextarea');
const modalSubtitle = document.getElementById('modalSubtitle');

// Set Button Loading State
function setLoading(button, isLoading, originalText) {
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<span class="loader"></span>';
  } else {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

function updateStatus(text) {
  statusText.textContent = text;
}

// Search Function
async function performSearch(isNextPage = false) {
  const industryInput = document.getElementById('industry').value.trim();
  const locationInput = document.getElementById('location').value.trim();
  
  if (!industryInput || !locationInput) {
    alert("Please enter both Industry and Location.");
    return;
  }
  
  currentIndustry = industryInput;
  const query = `${industryInput} in ${locationInput}`;
  
  const targetBtn = isNextPage ? nextBtn : searchBtn;
  const originalText = isNextPage ? "Next 20" : "Search First 20";
  
  setLoading(targetBtn, true, originalText);
  updateStatus(isNextPage ? "Fetching next page..." : "Fetching companies...");
  
  if (!isNextPage) {
    tbody.innerHTML = '';
    nextPageToken = '';
  }

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageToken: isNextPage ? nextPageToken : '' })
    });
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);
    
    let places = data.places || [];
    places = places.slice(0, 20); // Hard cap
    
    if (places.length === 0) {
      updateStatus("No more results found.");
      setLoading(targetBtn, false, originalText);
      return;
    }

    nextPageToken = data.nextPageToken || '';
    nextBtn.disabled = !nextPageToken;

    for (const place of places) {
      await addPlaceRow(place, currentIndustry);
    }
    
    updateStatus(`Success! Showing results.`);
    
  } catch (error) {
    alert("Search Error: " + error.message);
    updateStatus("Error occurred.");
  } finally {
    setLoading(targetBtn, false, originalText);
  }
}

async function addPlaceRow(place, defaultIndustry) {
  const name = place.displayName ? place.displayName.text : "Unknown";
  const industry = place.primaryTypeDisplayName ? place.primaryTypeDisplayName.text : defaultIndustry;
  const address = place.formattedAddress || "";
  const website = place.websiteUri || "";
  let mapPhone = place.nationalPhoneNumber || "";
  
  const tr = document.createElement('tr');
  
  // Basic row without scraped data yet
  tr.innerHTML = `
    <td><div class="company-name">${name}</div></td>
    <td><span class="contact-chip">${industry}</span></td>
    <td><small>${address}</small></td>
    <td>${website ? `<a href="${website}" target="_blank" class="website-link">Visit Site</a>` : 'N/A'}</td>
    <td class="contacts-cell"><span class="loader" style="border-color: rgba(59,130,246,0.3); border-top-color: #3b82f6;"></span></td>
    <td>
      <button class="action-btn" onclick="generateDraft('${name.replace(/'/g, "\\'")}', '${industry.replace(/'/g, "\\'")}')" disabled>
        Draft Email
      </button>
    </td>
  `;
  tbody.appendChild(tr);

  // Background Scrape
  let contactsHTML = '';
  if (mapPhone) contactsHTML += `<div class="contact-chip">📞 ${mapPhone}</div>`;

  if (website) {
    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website })
      });
      const scrapeData = await scrapeRes.json();
      
      scrapeData.emails.forEach(e => contactsHTML += `<div class="contact-chip">✉️ ${e}</div>`);
      
      // Filter out duplicate map phone
      const newPhones = scrapeData.phones.filter(p => p !== mapPhone);
      newPhones.forEach(p => contactsHTML += `<div class="contact-chip">📞 ${p}</div>`);
      
      scrapeData.socials.forEach(s => contactsHTML += `<div class="contact-chip">🔗 ${new URL(s).hostname.replace('www.','')}</div>`);
      
    } catch (e) {
      console.error("Scrape failed for " + website);
    }
  }

  if (!contactsHTML) contactsHTML = '<small style="color:var(--text-muted)">No contacts found</small>';
  
  tr.querySelector('.contacts-cell').innerHTML = contactsHTML;
  tr.querySelector('.action-btn').disabled = false;
}

// Generate Email Draft
window.generateDraft = async function(companyName, industry) {
  modal.classList.add('show');
  modalSubtitle.textContent = `Generating draft for ${companyName}...`;
  draftTextarea.value = "AI is typing...\nPlease wait (takes about 3-5 seconds).";
  copyBtn.disabled = true;

  try {
    const res = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, industry })
    });
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    
    draftTextarea.value = data.draft;
    modalSubtitle.textContent = `Draft ready for ${companyName}`;
    copyBtn.disabled = false;
    
  } catch (error) {
    draftTextarea.value = "Failed to generate draft:\n\n" + error.message;
  }
};

// Event Listeners
searchBtn.addEventListener('click', () => performSearch(false));
nextBtn.addEventListener('click', () => performSearch(true));

closeBtn.addEventListener('click', () => modal.classList.remove('show'));
window.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('show');
});

copyBtn.addEventListener('click', () => {
  draftTextarea.select();
  document.execCommand('copy');
  const ogText = copyBtn.textContent;
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = ogText, 2000);
});
