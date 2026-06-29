import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";

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
const googleProvider = new GoogleAuthProvider();

// Theme logic
function applyTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}
applyTheme();

const errorMsg = document.getElementById('errorMsg');
function showError(msg) {
  if (errorMsg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }
}
function hideError() {
  if (errorMsg) {
    errorMsg.style.display = 'none';
  }
}

// Redirect logged-in users to dashboard; block unverified emails
onAuthStateChanged(auth, (user) => {
  if (user) {
    const path = window.location.pathname;
    if (path.includes('login') || path.includes('register') || path.includes('forgot-password')) {
      if (!user.emailVerified) {
        // au4: signed in but unverified — send to verify page
        auth.signOut();
        window.location.href = '/verify-email.html';
        return;
      }
      window.location.href = '/job-search.html';
    }
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
      const idToken = await userCred.user.getIdToken();
      await initUserOnBackend(turnstileToken, idToken);
      window.location.href = '/job-search.html';
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
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = '/job-search.html';
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
      await sendPasswordResetEmail(auth, email);
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

// Google Auth (Login & Register)
const googleBtn = document.getElementById('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    hideError();
    const rememberMe = document.getElementById('rememberMe')?.checked ?? true;
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCred = await signInWithPopup(auth, googleProvider);
      
      // We still need to initialize the user in the backend if they are new.
      // Since Google Sign-In bypasses Turnstile widget, we can pass a special flag or 
      // rely on a robust backend logic. For now, since they authenticated via Google, 
      // we consider them human. We will pass a dummy turnstile token that the backend 
      // should ideally bypass for Google providers, OR we update our backend to check 
      // providerData. 
      // Wait, the backend requires Turnstile to be valid. 
      // If we use Google Auth, we still need to initialize the user limits in Firestore.
      // We will need to make the backend accept Google users without Turnstile, or 
      // we can just silently render Turnstile and verify it? 
      // Let's pass 'google_bypass' and handle it securely in backend.
      
      const idToken = await userCred.user.getIdToken();
      
      // Just call init-user, if backend fails Turnstile it might throw. 
      // We will catch it.
      try {
        await initUserOnBackend('google_bypass', idToken);
      } catch (err) {
        // If backend init failed (e.g. 21 user limit reached), sign them out locally
        if (auth.currentUser) await auth.signOut();
        showError(err.message || "Login failed.");
        return; // Do not redirect to job-search
      }
      
      window.location.href = '/job-search.html';
    } catch (error) {
      showError(error.message.replace('Firebase: ', ''));
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
