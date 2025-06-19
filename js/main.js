// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('js/sw.js')
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
    const startBtnText = startBtn.querySelector('.btn-text');
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
    const twentyRuleTimerDisplay = document.getElementById('twenty-rule-timer-display');
    const standingDeskTimerDisplay = document.getElementById('standing-desk-timer-display');
    const waterDebtDisplay = document.getElementById('water-debt-display');
    const drinkWaterBtn = document.getElementById('drink-water-btn');

    // --- State Management ---
    let mainTimerInterval = null;
    let twentyRuleTimeout = null; // Switched from interval to timeout
    let standingDeskTimeout = null;
    let waterInterval = null;
    let twentyRuleDisplayInterval = null;
    let standingDeskDisplayInterval = null;
    let waterDebt = 0;
    let twentyRuleTimeLeft = 0;
    let standingDeskTimeLeft = 0;
    let lastWaterCheckTime = null;
    let isMainTimerRunning = false;
    let currentMainTime = 0;
    let isBreak = false;
    let isStanding = false;

    const timerSettings = {
        pomodoro: { work: 25 * 60, break: 5 * 60 },
        focus: { work: 50 * 60, break: 10 * 60 },
        intense: {work: 90 * 60, break: 15 * 60 },
    };

    // --- Event Listeners (same as before, but with updated function names) ---
    grantPermissionBtn.addEventListener('click', handlePermissionGrant);
    startBtn.addEventListener('click', toggleMainTimer);
    resetBtn.addEventListener('click', resetAll);
    timerTypeSelect.addEventListener('change', resetMainTimerDisplay);
    twentyRuleCheckbox.addEventListener('change', setupTwentyRuleTimer);
    standingDeskCheckbox.addEventListener('change', setupStandingDeskTimer);
    waterCheckbox.addEventListener('change', setupWaterReminder);
    standingDeskCheckbox.addEventListener('change', () => standingDeskInputs.classList.toggle('hidden', !standingDeskCheckbox.checked));
    testNotificationBtn.addEventListener('click', () => showInteractiveNotification('Test Notification', 'main', { body: 'If you see this, notifications are working!' }));
    testSoundBtn.addEventListener('click', () => playTestSound('main'));
    drinkWaterBtn.addEventListener('click', () => {
        waterDebt = 0;
        updateWaterDebtDisplay();
    });

    // --- Core Functions (Updated Logic) ---
    async function handlePermissionGrant() {
        const granted = await requestPermissions();
        if (granted) {
            permissionPrompt.classList.add('hidden');
            appContainer.classList.remove('hidden');
        } else {
            alert("Permissions are required for reminders to work. Please check your OS and browser settings (e.g., Focus Assist on Windows or Do Not Disturb on macOS).");
        }
    }

    function toggleMainTimer() {
        if (timerTypeSelect.value === 'none') return;
        isMainTimerRunning = !isMainTimerRunning;
        const icon = startBtn.querySelector('i');
        if (isMainTimerRunning) {
            startBtnText.textContent = 'Pause';
            icon.classList.replace('fa-play', 'fa-pause');
            startMainTimer();
        } else {
            startBtnText.textContent = 'Resume';
            icon.classList.replace('fa-pause', 'fa-play');
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
                startBtnText.textContent = 'Start';
                startBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
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
        clearInterval(twentyRuleDisplayInterval);
        twentyRuleTimeout = null;
        twentyRuleDisplayInterval = null;
        twentyRuleTimerDisplay.textContent = '';

        if (twentyRuleCheckbox.checked) {
            const twentyMinutes = 20 * 60 * 1000;
            twentyRuleTimeLeft = 20 * 60;
            twentyRuleTimerDisplay.textContent = `(${formatTime(twentyRuleTimeLeft)})`;
            twentyRuleTimeout = setTimeout(showTwentyRuleNotification, twentyMinutes);
            twentyRuleDisplayInterval = setInterval(updateTwentyRuleDisplay, 1000);
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
        clearInterval(standingDeskDisplayInterval);
        standingDeskTimeout = null;
        standingDeskDisplayInterval = null;
        standingDeskTimerDisplay.textContent = '';
        isStanding = false; // Always start with sitting
        if (standingDeskCheckbox.checked) {
            const sitMins = parseInt(sitDurationInput.value, 10);
            standingDeskTimeLeft = sitMins * 60;
            standingDeskTimerDisplay.textContent = `(Sit: ${formatTime(standingDeskTimeLeft)})`;
            standingDeskTimeout = setTimeout(showStandingDeskNotification, sitMins * 60 * 1000);
            standingDeskDisplayInterval = setInterval(updateStandingDeskDisplay, 1000);
        }
    }

    function showStandingDeskNotification() {
        if (!standingDeskCheckbox.checked) return;

        const sitMins = parseInt(sitDurationInput.value, 10);
        const standMins = parseInt(standDurationInput.value, 10);
        const waterHint = getWaterHint();
        isStanding = !isStanding; // Toggle state for the next phase

        let title, body, nextInterval, nextIntervalSeconds;

        if (isStanding) {
            title = "Time to Stand!";
            body = `Time to stand for ${standMins} minutes. ${waterHint}`;
            nextInterval = standMins * 60 * 1000;
            nextIntervalSeconds = standMins * 60;
        } else {
            title = "Time to Sit";
            body = `Time to sit for ${sitMins} minutes. ${waterHint}`;
            nextInterval = sitMins * 60 * 1000;
            nextIntervalSeconds = sitMins * 60;
        }

        const nextPhaseCallback = () => {
            if (standingDeskCheckbox.checked) {
                clearInterval(standingDeskDisplayInterval);
                standingDeskTimeLeft = nextIntervalSeconds;
                const phaseText = isStanding ? 'Stand' : 'Sit';
                standingDeskTimerDisplay.textContent = `(${phaseText}: ${formatTime(standingDeskTimeLeft)})`;
                standingDeskDisplayInterval = setInterval(updateStandingDeskDisplay, 1000);
                standingDeskTimeout = setTimeout(showStandingDeskNotification, nextInterval);
            }
        };

        showInteractiveNotification(title, 'stand', { body }, nextPhaseCallback);
    }

    function setupWaterReminder() {
        clearInterval(waterInterval);
        waterInterval = null;
        waterInputs.classList.toggle('hidden', !waterCheckbox.checked);

        if (waterCheckbox.checked) {
            lastWaterCheckTime = Date.now();
            // Run every 1s
            waterInterval = setInterval(updateWaterAccumulation, 60 * 10);
        } else {
            waterDebt = 0; // Reset debt when disabled
            updateWaterDebtDisplay();
        }
    }

    function updateWaterAccumulation() {
        if (!waterCheckbox.checked || !lastWaterCheckTime) return;

        const now = Date.now();
        const elapsedMinutes = (now - lastWaterCheckTime) / (1000 * 60);
        const waterPerHour = parseInt(waterAmountInput.value, 10) || 250;
        const waterPerMinute = waterPerHour / 60;
        
        const waterToAccumulate = elapsedMinutes * waterPerMinute;

        if (waterToAccumulate > 0) {
            waterDebt += waterToAccumulate;
            updateWaterDebtDisplay();
            lastWaterCheckTime = now; // Reset the check time
        }
    }

    function getWaterHint() {
        if (!waterCheckbox.checked || waterDebt < 100) { // Only show hint if debt is over 100ml
            return "";
        }
        return `Time to hydrate! You've accumulated ~${Math.round(waterDebt)}ml to drink.`;
    }

    function resetAll() {
        // Stop all timers
        clearInterval(mainTimerInterval);
        clearTimeout(twentyRuleTimeout);
        clearTimeout(standingDeskTimeout);
        clearInterval(waterInterval);
        clearInterval(twentyRuleDisplayInterval);
        clearInterval(standingDeskDisplayInterval);
        mainTimerInterval = null;
        twentyRuleTimeout = null;
        standingDeskTimeout = null;
        waterInterval = null;
        twentyRuleDisplayInterval = null;
        standingDeskDisplayInterval = null;

        // Reset state
        isMainTimerRunning = false;
        isStanding = false;
        startBtnText.textContent = 'Start';
        startBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
        waterDebt = 0;
        updateWaterDebtDisplay();

        // Reset UI and re-initialize background timers if checked
        resetMainTimerDisplay();
        setupTwentyRuleTimer();
        setupStandingDeskTimer();
        setupWaterReminder();
        
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

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateWaterDebtDisplay() {
        waterDebtDisplay.textContent = Math.round(waterDebt);
    }

    function updateTwentyRuleDisplay() {
        if (twentyRuleTimeLeft > 0) {
            twentyRuleTimeLeft--;
            twentyRuleTimerDisplay.textContent = `(${formatTime(twentyRuleTimeLeft)})`;
        }
    }

    function updateStandingDeskDisplay() {
        if (standingDeskTimeLeft > 0) {
            standingDeskTimeLeft--;
            const phaseText = isStanding ? 'Stand' : 'Sit';
            standingDeskTimerDisplay.textContent = `(${phaseText}: ${formatTime(standingDeskTimeLeft)})`;
        }
    }

    function initialize() {
        if (Notification.permission === 'granted') {
            permissionPrompt.classList.add('hidden');
            appContainer.classList.remove('hidden');
        }
        // Set initial state of hidden sections based on checkboxes
        waterInputs.classList.toggle('hidden', !waterCheckbox.checked);
        standingDeskInputs.classList.toggle('hidden', !standingDeskCheckbox.checked);

        resetMainTimerDisplay();
        updateWaterDebtDisplay();
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