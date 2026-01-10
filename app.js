// State management with localStorage
const state = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error writing to localStorage:', e);
            return false;
        }
    }
};

// App initialization
document.addEventListener('DOMContentLoaded', () => {
    initCounter();
    initNotes();
    initOnlineStatus();
    registerServiceWorker();
    initInstallPrompt();
});

// Counter functionality
function initCounter() {
    const countEl = document.getElementById('visit-count');
    const incrementBtn = document.getElementById('increment-btn');
    const resetBtn = document.getElementById('reset-btn');

    // Increment visit count on load
    let count = state.get('visitCount', 0);
    count++;
    state.set('visitCount', count);
    countEl.textContent = count;

    incrementBtn.addEventListener('click', () => {
        count++;
        state.set('visitCount', count);
        countEl.textContent = count;
    });

    resetBtn.addEventListener('click', () => {
        count = 0;
        state.set('visitCount', count);
        countEl.textContent = count;
    });
}

// Notes functionality with auto-save
function initNotes() {
    const notesEl = document.getElementById('notes');

    // Load saved notes
    notesEl.value = state.get('notes', '');

    // Auto-save on input with debounce
    let saveTimeout;
    notesEl.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            state.set('notes', notesEl.value);
        }, 300);
    });
}

// Online/offline status
function initOnlineStatus() {
    const statusEl = document.getElementById('online-status');

    function updateStatus() {
        statusEl.textContent = navigator.onLine ? 'Online' : 'Offline (cached)';
        statusEl.className = navigator.onLine ? 'online' : 'offline';
    }

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
}

// Service Worker registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }
}

// Install prompt handling (for Android/desktop Chrome)
let deferredPrompt;

function initInstallPrompt() {
    const installPrompt = document.getElementById('install-prompt');
    const installBtn = document.getElementById('install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installPrompt.style.display = 'block';
    });

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('Install prompt outcome:', outcome);
        deferredPrompt = null;
        installPrompt.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        console.log('App installed');
        installPrompt.style.display = 'none';
    });
}
