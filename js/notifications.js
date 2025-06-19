// js/notifications.js

// Store pre-loaded audio objects for different alerts.
const sounds = {
    main: new Audio('assets/sounds/notification1.mp3'),
    twenty: new Audio('assets/sounds/notification2.mp3'),
    stand: new Audio('assets/sounds/notification2.mp3')
};

/**
 * Requests permission from the user to show notifications and prepares audio.
 * @returns {Promise<boolean>} - True if permission was granted.
 */
async function requestPermissions() {
    try {
        const permission = await Notification.requestPermission().then((result) => {console.log("Notification permission result:", result); return result;});
        // Unlock audio playback by playing and pausing after the user gesture.
        for (const key in sounds) {
            sounds[key].play().catch(() => {}); // Suppress initial play error
            sounds[key].pause();
            sounds[key].currentTime = 0;
        }
        return permission === 'granted';
    } catch (error) {
        console.error("Error requesting notification permission:", error);
        return false;
    }
}

/**
 * Shows a persistent browser notification that waits for user interaction.
 * @param {string} title - The title of the notification.
 * @param {string} soundType - The key for the sound to play ('main', 'twenty', 'stand').
 * @param {object} options - The options object for the Notification constructor (e.g., body).
 * @param {function} callback - The function to execute when the notification is clicked or closed.
 */
function showInteractiveNotification(title, soundType, options = {}, callback = () => {}) {
    if (Notification.permission !== 'granted') {
        console.warn("Notification permission not granted.");
        // As a fallback, execute the callback immediately if permissions are denied,
        // so the app doesn't get stuck.
        callback();
        return;
    }

    // Add requireInteraction to make the notification persistent.
    const persistentOptions = { ...options, requireInteraction: true };
    const notification = new Notification(title, persistentOptions);

    // Play the associated sound.
    if (sounds[soundType]) {
        sounds[soundType].play().catch(e => console.error("Error playing sound:", e));
    }

    // The callback is triggered whether the user clicks the notification body or the close button.
    notification.onclick = () => {
        callback();
        notification.close();
    };
    notification.onclose = () => {
        // The callback might have already been called by onclick, so we check.
        // This handles the case where the user clicks the 'x' button.
        if (typeof callback === 'function') {
            callback();
            // Set callback to null to prevent it from being called again.
            callback = null; 
        }
    };
}

/**
 * Plays a sound for testing purposes.
 * @param {string} soundType - The key for the sound to play ('main', 'twenty', 'stand').
 */
function playTestSound(soundType = 'main') {
    if (sounds[soundType]) {
        sounds[soundType].currentTime = 0;
        sounds[soundType].play().catch(e => {
            console.error("Error playing sound:", e);
            alert("Could not play sound. Please grant permissions and interact with the page first.");
        });
    }
}
