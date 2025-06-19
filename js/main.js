// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered.', reg))
            .catch(err => console.error('Service Worker registration failed:', err));
    }

    // --- DOM Element References (same as before) ---
    const permissionPrompt = document.getElementById('permission-prompt');
    const grantPermissionBtn = document.getElementById('grant-permission-btn');
    const appContainer = document.getElementById('app-container');
    const timerTypeSelect = document.getElementById('timer-type');
    const timerDisplay = document.getElementById('timer-display');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const twentyRuleCheckbox = document.getElementById('twenty-rule-checkbox');
    const standingDeskCheckbox = document.getElementById('standing-desk-checkbox');
    const standingDeskInputs = document.getElementById('standing-desk-inputs');
    const sitDurationInput = document.getElementById('sit-duration');
    const standDurationInput = document.getElementById('stand-duration');
    const waterCheckbox = document.getElementById('water-checkbox');
    const waterInputs = document.getElementById('water-inputs');
    const waterAmountInput = document.getElementById('water-amount');
    const testNotificationBtn = document.getElementById('test-notification-btn');
    const testSoundBtn = document.getElementById('test-sound-btn');

    // --- State Management ---
    let mainTimerInterval = null;
    let twentyRuleTimeout = null; // Switched from interval to timeout
    let standingDeskTimeout = null;
    let lastNotificationTime = null;
    let isMainTimerRunning = false;
    let currentMainTime = 0;
    let isBreak = false;
    let isStanding = false;

    const timerSettings = {
        pomodoro: { work: 25 * 60, break: 5 * 60 },
        focus: { work: 50 * 60, break: 10 * 60 },
    };

    // --- Event Listeners (same as before, but with updated function names) ---
    grantPermissionBtn.addEventListener('click', handlePermissionGrant);
    startBtn.addEventListener('click', toggleMainTimer);
    resetBtn.addEventListener('click', resetAll);
    timerTypeSelect.addEventListener('change', resetMainTimerDisplay);
    twentyRuleCheckbox.addEventListener('change', setupTwentyRuleTimer);
    standingDeskCheckbox.addEventListener('change', setupStandingDeskTimer);
    waterCheckbox.addEventListener('change', () => waterInputs.classList.toggle('hidden', !waterCheckbox.checked));
    standingDeskCheckbox.addEventListener('change', () => standingDeskInputs.classList.toggle('hidden', !standingDeskCheckbox.checked));
    testNotificationBtn.addEventListener('click', () => showInteractiveNotification('Test Notification', 'main', { body: 'If you see this, notifications are working!' }));
    testSoundBtn.addEventListener('click', () => playTestSound('main'));

    // --- Core Functions (Updated Logic) ---

    async function handlePermissionGrant() {
        const granted = await requestPermissions();
        if (granted) {
            permissionPrompt.classList.add('hidden');
            appContainer.classList.remove('hidden');
            lastNotificationTime = Date.now();
        } else {
            alert("Permissions are required for reminders to work. Please check your OS and browser settings (e.g., Focus Assist on Windows or Do Not Disturb on macOS).");
        }
    }

    function toggleMainTimer() {
        if (timerTypeSelect.value === 'none') return;
        isMainTimerRunning = !isMainTimerRunning;
        if (isMainTimerRunning) {
            startBtn.textContent = 'Pause';
            startMainTimer();
        } else {
            startBtn.textContent = 'Resume';
            clearInterval(mainTimerInterval);
        }
    }

    function startMainTimer() {
        if (mainTimerInterval) clearInterval(mainTimerInterval);
        mainTimerInterval = setInterval(() => {
            currentMainTime--;
            updateDisplay();
            if (currentMainTime <= 0) {
                clearInterval(mainTimerInterval);
                isMainTimerRunning = false; // Pause the timer state
                startBtn.textContent = 'Start';
                handleMainTimerEnd();
            }
        }, 1000);
    }

    function handleMainTimerEnd() {
        const type = timerTypeSelect.value;
        const waterHint = getWaterHint();
        isBreak = !isBreak;

        let title, body, nextPhaseCallback;

        if (isBreak) {
            const breakDuration = timerSettings[type].break;
            title = "Work session over!";
            body = `Click here to start your ${breakDuration / 60}-minute break. ${waterHint}`;
            nextPhaseCallback = () => {
                currentMainTime = breakDuration;
                updateDisplay();
                toggleMainTimer(); // This will start the timer again
            };
        } else {
            const workDuration = timerSettings[type].work;
            title = "Break's over!";
            body = `Click here to start your next ${workDuration / 60}-minute work session. ${waterHint}`;
            nextPhaseCallback = () => {
                currentMainTime = workDuration;
                updateDisplay();
                toggleMainTimer();
            };
        }
        
        // Show the notification and pass the logic for the next phase as a callback.
        // The app is now paused until the user interacts with the notification.
        showInteractiveNotification(title, 'main', { body }, nextPhaseCallback);
    }

    function setupTwentyRuleTimer() {
        clearTimeout(twentyRuleTimeout);
        twentyRuleTimeout = null;
        if (twentyRuleCheckbox.checked) {
            const twentyMinutes = 20 * 60 * 1000;
            twentyRuleTimeout = setTimeout(showTwentyRuleNotification, twentyMinutes);
        }
    }

    function showTwentyRuleNotification() {
        if (!twentyRuleCheckbox.checked) return; // Double-check in case it was disabled
        const waterHint = getWaterHint();
        showInteractiveNotification(
            "20-20-20 Rule",
            'twenty',
            { body: `Look at something 20 feet away for 20 seconds. ${waterHint}` },
            () => setupTwentyRuleTimer() // Schedule the next one after interaction
        );
    }

    function setupStandingDeskTimer() {
        clearTimeout(standingDeskTimeout);
        standingDeskTimeout = null;
        isStanding = false; // Always start with sitting
        if (standingDeskCheckbox.checked) {
            const sitMins = parseInt(sitDurationInput.value, 10);
            standingDeskTimeout = setTimeout(showStandingDeskNotification, sitMins * 60 * 1000);
        }
    }

    function showStandingDeskNotification() {
        if (!standingDeskCheckbox.checked) return;

        const sitMins = parseInt(sitDurationInput.value, 10);
        const standMins = parseInt(standDurationInput.value, 10);
        const waterHint = getWaterHint();
        isStanding = !isStanding; // Toggle state for the next phase

        let title, body, nextInterval;

        if (isStanding) {
            title = "Time to Stand!";
            body = `Time to stand for ${standMins} minutes. ${waterHint}`;
            nextInterval = standMins * 60 * 1000;
        } else {
            title = "Time to Sit";
            body = `Time to sit for ${sitMins} minutes. ${waterHint}`;
            nextInterval = sitMins * 60 * 1000;
        }

        const nextPhaseCallback = () => {
            if (standingDeskCheckbox.checked) {
                standingDeskTimeout = setTimeout(showStandingDeskNotification, nextInterval);
            }
        };

        showInteractiveNotification(title, 'stand', { body }, nextPhaseCallback);
    }

    function getWaterHint() {
        if (!waterCheckbox.checked || !lastNotificationTime) return "";
        const now = Date.now();
        const elapsedHours = (now - lastNotificationTime) / (1000 * 60 * 60);
        const waterPerHour = parseInt(waterAmountInput.value, 10);
        const waterToDrink = Math.round(elapsedHours * waterPerHour);
        lastNotificationTime = now;
        return waterToDrink > 10 ? `Time to hydrate! Drink ~${waterToDrink}ml of water.` : "";
    }

    function resetAll() {
        // Stop all timers
        clearInterval(mainTimerInterval);
        clearTimeout(twentyRuleTimeout);
        clearTimeout(standingDeskTimeout);
        mainTimerInterval = null;
        twentyRuleTimeout = null;
        standingDeskTimeout = null;

        // Reset state
        isMainTimerRunning = false;
        isStanding = false;
        startBtn.textContent = 'Start';
        lastNotificationTime = Date.now();

        // Reset UI and re-initialize background timers if checked
        resetMainTimerDisplay();
        setupTwentyRuleTimer();
        setupStandingDeskTimer();
        
        alert("Timers and settings have been reset.");
    }

    // --- Unchanged Helper Functions ---
    function resetMainTimerDisplay() {
        const type = timerTypeSelect.value;
        isBreak = false;
        if (type !== 'none') {
            currentMainTime = timerSettings[type].work;
            timerDisplay.classList.remove('hidden');
            startBtn.classList.remove('hidden');
            resetBtn.classList.remove('hidden');
        } else {
            currentMainTime = 0;
            timerDisplay.classList.add('hidden');
            startBtn.classList.add('hidden');
            resetBtn.classList.add('hidden');
        }
        updateDisplay();
    }

    function updateDisplay() {
        const minutes = Math.floor(currentMainTime / 60);
        const seconds = currentMainTime % 60;
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.title = `${timerDisplay.textContent} - Productivity Timer`;
    }

    function initialize() {
        if (Notification.permission === 'granted') {
            permissionPrompt.classList.add('hidden');
            appContainer.classList.remove('hidden');
            lastNotificationTime = Date.now();
        }
        resetMainTimerDisplay();
    }

    initialize();
});

// Service Worker

self.addEventListener('install', (event) => {
    // Skip waiting to ensure the new service worker activates immediately.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Take control of all clients as soon as the service worker activates.
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
    // Close the notification when clicked.
    event.notification.close();

    // Focus the client window that opened the notification.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
