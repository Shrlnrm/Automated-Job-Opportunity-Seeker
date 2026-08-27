import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence, sendEmailVerification } from "firebase/auth";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const errorMsg = document.getElementById('errorMsg');

function formatAuthError(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = error.code || '';
  const message = typeof error === 'string' ? error : (error.message || '');

  if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
    return 'Sign-in popup was blocked by your browser or an ad blocker. Please allow popups for this site to sign in with Google.';
  }
  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return 'Sign-in window was closed before finishing. Please try again.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'A sign-in window is already open. Please complete or close it first.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please log in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection failed. Please check your internet connection.';
  }

  // Clean raw Firebase string wrappers if any
  return message
    .replace(/^Firebase:\s*/i, '')
    .replace(/Error\s*\((.*?)\)\.?/i, '$1')
    .trim() || 'Authentication failed. Please try again.';
}

function showError(err) {
  if (errorMsg) {
    const formatted = typeof err === 'object' ? formatAuthError(err) : err;
    errorMsg.textContent = formatted;
    errorMsg.style.display = 'block';
  }
}
function hideError() {
  if (errorMsg) {
    errorMsg.style.display = 'none';
  }
}

// Global Toast System
window.showToast = function(message) {
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
  
  toast.offsetHeight; // Trigger reflow
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
};

// Check for pending toasts on load
document.addEventListener('DOMContentLoaded', () => {
  const pendingToast = sessionStorage.getItem('pendingToast');
  if (pendingToast) {
    window.showToast(pendingToast);
    sessionStorage.removeItem('pendingToast');
  }
});

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

// Helper to mark active session and avoid stale inactivity timeout
export function stampFreshActivity() {
  try {
    const now = Date.now().toString();
    localStorage.setItem('lastActivityTime', now);
    sessionStorage.setItem('freshLogin', 'true');
  } catch (e) {
    console.warn('[AJOS Auth] Storage stamp note:', e);
  }
}

// Helper to determine if user is verified (Google OAuth users are pre-verified)
export function isUserVerified(user) {
  if (!user) return false;
  if (user.emailVerified) return true;
  if (user.providerData && user.providerData.some(p => p.providerId === 'google.com')) return true;
  return false;
}

// Redirect already logged-in users to dashboard; block unverified emails (except Google users)
onAuthStateChanged(auth, (user) => {
  console.log('[AJOS Auth] onAuthStateChanged state:', user ? user.email : 'No user logged in');
  if (user) {
    stampFreshActivity();

    // Do NOT run redirect loops if user is already on verify-email or auth-action page
    const pathname = window.location.pathname;
    if (pathname.includes('verify-email') || pathname.includes('auth-action')) {
      return;
    }

    if (!isUserVerified(user)) {
      console.log('[AJOS Auth] User unverified -> /verify-email.html');
      window.location.replace('/verify-email.html');
      return;
    }

    // Fire-and-forget: provision Google user on backend (don't block redirect)
    const isGoogle = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
    if (isGoogle) {
      user.getIdToken().then(idToken => {
        initUserOnBackend('google_bypass', idToken).catch(err => {
          console.warn('[AJOS Auth] Background backend init note:', err);
        });
      }).catch(() => {});
    }

    console.log('[AJOS Auth] User verified & active -> navigating to /job-search.html');
    window.location.replace('/job-search.html');
  }
});

async function initUserOnBackend(turnstileToken, idToken) {
  try {
    const res = await fetch('/api/init-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken, idToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify');
    return true;
  } catch (err) {
    throw err;
  }
}

// Register Form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Get Turnstile response
    let turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
    
    if (password !== confirmPassword) return showError("Passwords do not match");
    if (!turnstileToken) return showError("Please complete the bot verification");

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const actionCodeSettings = { url: window.location.origin + '/login.html' };
      await sendEmailVerification(userCred.user, actionCodeSettings);
      const idToken = await userCred.user.getIdToken();
      await initUserOnBackend(turnstileToken, idToken);
      window.location.href = '/verify-email.html';
    } catch (error) {
      // If backend init failed, sign them out locally so they aren't stuck in limbo
      if (auth.currentUser) await auth.signOut();
      
      if (error.code === 'auth/too-many-requests') {
        showError("Too many attempts. Please try again later.");
      } else {
        // Display the specific backend error (e.g., limit reached) if available, otherwise generic
        showError(error.message || "Registration failed. Please try again.");
      }
      turnstile.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked ?? true;

    if (!turnstileToken) return showError("Please complete the bot verification");

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      if (!isUserVerified(userCred.user)) {
        window.location.href = '/verify-email.html';
      } else {
        stampFreshActivity();
        window.location.href = '/job-search.html';
      }
    } catch (error) {
      if (error.code === 'auth/too-many-requests') {
        showError("Too many attempts. Please try again later.");
      } else {
        showError("Invalid email or password");
      }
      turnstile.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log in';
    }
  });
}

// Forgot Password Form
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('email').value;
    const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;

    if (!turnstileToken) return showError("Please complete the bot verification");

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const actionCodeSettings = { url: window.location.origin + '/login.html' };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      document.getElementById('mainContainer').style.display = 'none';
      document.getElementById('successContainer').style.display = 'block';
    } catch (error) {
      showError(error.message.replace('Firebase: ', ''));
      turnstile.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send reset link';
    }
  });
}

// Handle Google OAuth Redirect Result (Universal across PC & Mobile)
getRedirectResult(auth)
  .then((userCred) => {
    console.log('[AJOS Auth] getRedirectResult check:', userCred ? userCred.user?.email : 'No pending redirect');
    if (userCred && userCred.user) {
      stampFreshActivity();
      // Fire-and-forget backend init
      userCred.user.getIdToken().then(idToken => {
        initUserOnBackend('google_bypass', idToken).catch(err => {
          console.warn('[AJOS Auth] Background backend init (redirect):', err);
        });
      }).catch(() => {});
      console.log('[AJOS Auth] Redirect result success -> /job-search.html');
      window.location.replace('/job-search.html');
    }
  })
  .catch((error) => {
    console.error('[AJOS Auth Error] getRedirectResult:', error);
    if (error && error.code && error.code !== 'auth/null-user') {
      showError(error);
    }
  });

// Google Auth (Login & Register - Resilient Popup with Mobile Redirect Fallback)
const googleBtn = document.getElementById('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    hideError();
    googleBtn.disabled = true;
    googleBtn.style.opacity = '0.7';

    try {
      console.log('[AJOS Auth] Opening Google sign-in popup...');
      const userCred = await signInWithPopup(auth, googleProvider);
      
      if (userCred && userCred.user) {
        console.log('[AJOS Auth] Google popup success:', userCred.user.email);
        stampFreshActivity();

        // Initialize user in backend and check for registration capacity
        const idToken = await userCred.user.getIdToken();
        try {
          await initUserOnBackend('google_bypass', idToken);
        } catch (initErr) {
          if (auth.currentUser) await auth.signOut();
          showError(initErr.message || 'Registration closed: Maximum user capacity (20/20) reached.');
          return;
        }

        console.log('[AJOS Auth] Navigating to /job-search.html');
        window.location.replace('/job-search.html');
      }
    } catch (error) {
      console.warn('[AJOS Auth Error] Google popup:', error);
      // Fall back to redirect if popup is blocked on mobile browsers / strict privacy settings
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        console.log('[AJOS Auth] Popup blocked or cancelled. Falling back to signInWithRedirect...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error('[AJOS Auth] Redirect fallback failed:', redirectErr);
          showError(redirectErr);
        }
      } else if (error.code !== 'auth/popup-closed-by-user') {
        showError(error);
      }
    } finally {
      googleBtn.disabled = false;
      googleBtn.style.opacity = '1';
    }
  });
}

// Global Auth Back Button Logic
const authBackBtn = document.getElementById('authBackBtn');
if (authBackBtn) {
  authBackBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // Use document.referrer if it exists and originates from our own site
    if (document.referrer && document.referrer.includes(window.location.host)) {
      window.location.href = document.referrer;
    } else {
      window.location.href = 'index.html';
    }
  });
}

export { auth };
