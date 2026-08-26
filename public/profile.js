import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signOut, 
  onAuthStateChanged, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

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
const auth = getAuth(app);
const db = getFirestore(app);

// Toast Notification
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  
  toast.offsetHeight;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

// Authenticated Fetch Helper
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

// DOM Elements
const userEmailDisplay = document.getElementById('userEmailDisplay');
const profileSavedBadge = document.getElementById('profileSavedBadge');
const dropzone = document.getElementById('dropzone');
const resumeFileInput = document.getElementById('resumeFileInput');
const dropzoneText = document.getElementById('dropzoneText');
const rawResumeText = document.getElementById('rawResumeText');
const extractBtn = document.getElementById('extractBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');

const profileName = document.getElementById('profileName');
const profileEducation = document.getElementById('profileEducation');
const profileSkills = document.getElementById('profileSkills');
const profileProjects = document.getElementById('profileProjects');
const profileLinkedin = document.getElementById('profileLinkedin');
const profilePortfolio = document.getElementById('profilePortfolio');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');

const changePasswordForm = document.getElementById('changePasswordForm');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const updatePasswordBtn = document.getElementById('updatePasswordBtn');
const googleAuthNotice = document.getElementById('googleAuthNotice');

const themeToggleBtn = document.getElementById('themeToggleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const limitsShowcase = document.getElementById('limitsShowcase');
const limitLabel = document.getElementById('limitLabel');
const limitBarFill = document.getElementById('limitBarFill');

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      sessionStorage.clear();
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    }
  });
}

// Password Visibility Toggle Logic
function setupPasswordToggles() {
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const wrapper = btn.closest('.password-input-wrapper');
      const input = wrapper ? wrapper.querySelector('input') : null;
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

      const eyeIcon = btn.querySelector('.eye-icon');
      const eyeOffIcon = btn.querySelector('.eye-off-icon');
      if (eyeIcon && eyeOffIcon) {
        eyeIcon.style.display = isPassword ? 'none' : 'block';
        eyeOffIcon.style.display = isPassword ? 'block' : 'none';
      }
    });
  });
}
setupPasswordToggles();

// Populate Fields with Data
function populateProfileUI(p) {
  if (!p) return;
  if (profileName) profileName.value = p.fullName || '';
  if (profileEducation) profileEducation.value = p.education || '';
  if (profileSkills) profileSkills.value = Array.isArray(p.skills) ? p.skills.join(', ') : (p.skills || '');
  if (profileProjects) profileProjects.value = p.projects || '';
  if (profileLinkedin) profileLinkedin.value = p.linkedin || '';
  if (profilePortfolio) profilePortfolio.value = p.portfolio || '';
  if (profileEmail) profileEmail.value = p.email || (auth.currentUser ? auth.currentUser.email : '');
  if (profilePhone) profilePhone.value = p.phone || '';

  if (profileSavedBadge) {
    profileSavedBadge.style.display = 'inline-flex';
  }
}

// Read Stored Profile from Firestore
async function loadStoredProfile() {
  try {
    const res = await fetchWithAuth('/api/profile');
    const data = await res.json();
    if (data.success && data.profile) {
      populateProfileUI(data.profile);
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

// PDF Text Extraction using PDF.js
async function extractTextFromPDF(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF reader is loading, please try again.');
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText.trim();
}

// File Dropzone Handling
if (dropzone && resumeFileInput) {
  dropzone.addEventListener('click', () => resumeFileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  resumeFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });
}

async function handleFileSelected(file) {
  if (!file) return;
  dropzoneText.textContent = `Selected: ${file.name}`;
  showToast(`Reading ${file.name}...`);

  try {
    let extractedText = '';
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      extractedText = await extractTextFromPDF(file);
    } else {
      extractedText = await file.text();
    }

    if (extractedText && rawResumeText) {
      rawResumeText.value = extractedText;
      showToast('Resume loaded! Click "Extract Info with AI" to analyze.');
    }
  } catch (err) {
    console.error('File read error:', err);
    showToast('Failed to parse file. Please paste your resume text instead.');
  }
}

// Extract Info with AI Action
if (extractBtn) {
  extractBtn.addEventListener('click', async () => {
    const text = rawResumeText ? rawResumeText.value.trim() : '';
    if (!text || text.length < 30) {
      showToast('Please upload a resume file or paste your resume text (min 30 characters).');
      return;
    }

    const origText = extractBtn.innerHTML;
    extractBtn.disabled = true;
    extractBtn.innerHTML = `<span>Analyzing with Gemini AI...</span>`;

    try {
      const res = await fetchWithAuth('/api/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Extraction failed');
      }

      populateProfileUI(data.profile);
      showToast('Resume extracted and saved to your database successfully!');
    } catch (err) {
      console.error('AI Extraction error:', err);
      showToast(err.message || 'AI extraction failed. Please try again.');
    } finally {
      extractBtn.disabled = false;
      extractBtn.innerHTML = origText;
    }
  });
}

// Save Profile Action
if (saveProfileBtn) {
  saveProfileBtn.addEventListener('click', async () => {
    const origText = saveProfileBtn.textContent;
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = 'Saving...';

    const payload = {
      fullName: profileName?.value.trim() || '',
      education: profileEducation?.value.trim() || '',
      skills: profileSkills?.value.trim() || '',
      projects: profileProjects?.value.trim() || '',
      linkedin: profileLinkedin?.value.trim() || '',
      portfolio: profilePortfolio?.value.trim() || '',
      email: profileEmail?.value.trim() || '',
      phone: profilePhone?.value.trim() || ''
    };

    try {
      const res = await fetchWithAuth('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save profile');
      }

      if (profileSavedBadge) profileSavedBadge.style.display = 'inline-flex';
      showToast('Profile updated and saved to database!');
    } catch (err) {
      console.error('Profile save error:', err);
      showToast(err.message || 'Failed to save profile.');
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.textContent = origText;
    }
  });
}

// Password Change Handler
if (changePasswordForm) {
  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = currentPasswordInput?.value || '';
    const newPass = newPasswordInput?.value || '';
    const confirmPass = confirmPasswordInput?.value || '';

    if (!currentPass) {
      showToast('Please enter your current password.');
      return;
    }

    if (newPass.length < 6) {
      showToast('New password must be at least 6 characters.');
      return;
    }

    if (newPass !== confirmPass) {
      showToast('New passwords do not match.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      window.location.href = '/login.html';
      return;
    }

    updatePasswordBtn.disabled = true;
    updatePasswordBtn.textContent = 'Updating...';

    try {
      // Reauthenticate with current password
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPass);
      showToast('Password updated successfully!');
      changePasswordForm.reset();
    } catch (err) {
      console.error('Password update error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showToast('Current password incorrect.');
      } else if (err.code === 'auth/too-many-requests') {
        showToast('Too many attempts. Please try again later.');
      } else if (err.code === 'auth/requires-recent-login') {
        showToast('Session expired. Please log in again to change password.');
      } else {
        showToast(err.message || 'Failed to update password.');
      }
    } finally {
      updatePasswordBtn.disabled = false;
      updatePasswordBtn.textContent = 'Update Password';
    }
  });
}

// Authentication State Listener
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login.html';
    return;
  }

  const isGoogleUser = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
  if (!user.emailVerified && !isGoogleUser) {
    window.location.href = '/verify-email.html';
    return;
  }

  if (userEmailDisplay) {
    userEmailDisplay.textContent = `Signed in as ${user.email}`;
  }
  if (profileEmail && !profileEmail.value) {
    profileEmail.value = user.email;
  }

  // Handle Google OAuth users
  if (isGoogleUser) {
    if (googleAuthNotice) googleAuthNotice.style.display = 'block';
    if (changePasswordForm) changePasswordForm.style.display = 'none';
  } else {
    if (googleAuthNotice) googleAuthNotice.style.display = 'none';
    if (changePasswordForm) changePasswordForm.style.display = 'flex';
  }

  // Load existing profile from database
  loadStoredProfile();
});
