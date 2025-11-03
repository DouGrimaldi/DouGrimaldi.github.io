// --- CONFIG ---
// Use your live Render server URL here
const SERVER_URL = "wss://relay-mgcs.onrender.com";
// --- END CONFIG ---

// --- DOM Elements ---
const joinScreen = document.getElementById('join-screen');
const buzzerScreen = document.getElementById('buzzer-screen');
const joinButton = document.getElementById('join-button');
const roomCodeInput = document.getElementById('room-code-input');
const nameInput = document.getElementById('name-input');
const pfpInput = document.getElementById('pfp-input');
const pfpPreview = document.getElementById('pfp-preview');
const errorMessage = document.getElementById('error-message');
const buzzerButton = document.getElementById('buzzer-button');
const playerNameDisplay = document.getElementById('player-name-display');

// --- State ---
let ws;
let playerData = {
    type: "join",
    code: "",
    name: "",
    picture: "" // Base64 string of the image
};

// --- Event Listeners ---
joinButton.addEventListener('click', joinGame);
buzzerButton.addEventListener('click', buzzIn);

// Handle profile picture selection
pfpInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        resizeImage(file, 256, (base64String) => {
            playerData.picture = base64String;
            pfpPreview.src = base64String;
            pfpPreview.style.display = 'block'; // Show the circular preview
        });
    }
});

// --- Functions ---
function joinGame() {
    const roomCode = roomCodeInput.value.toUpperCase();
    const name = nameInput.value;

    if (!roomCode || roomCode.length !== 4) {
        showError("Please enter a 4-letter room code.");
        return;
    }
    if (!name) {
        showError("Please enter your name.");
        return;
    }

    playerData.code = roomCode;
    playerData.name = name;
    playerNameDisplay.textContent = name; // Set name on buzzer screen

    showError("Connecting...");

    try {
        ws = new WebSocket(SERVER_URL);

        ws.onopen = () => {
            console.log("Connected to relay server.");
            // Send the complete player data object
            ws.send(JSON.stringify(playerData));
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("Message from server:", msg);

            if (msg.type === "join_success") {
                showScreen('buzzer');
            } else if (msg.type === "start_game") {
                showScreen('buzzer');
            } else if (msg.type === "next_turn") {
                enableBuzzer(true);
            } else if (msg.type === "error") {
                showError(msg.message);
                ws.close();
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            showError("Could not connect to the server.");
        };

        ws.onclose = () => {
            console.log("Disconnected from server.");
            // Only show join screen if we're not already there
            if (!joinScreen.classList.contains('active')) {
                showScreen('join');
                showError("Connection lost. Please rejoin.");
            }
        };

    } catch (err) {
        console.error("Failed to create WebSocket:", err);
        showError("Failed to connect. Is the URL correct?");
    }
}

function buzzIn() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "buzz" }));
        enableBuzzer(false);
    }
}

function enableBuzzer(enabled) {
    if (enabled) {
        buzzerButton.disabled = false;
        buzzerButton.querySelector('span').textContent = "BUZZ IN!";
        buzzerButton.classList.remove('disabled');
    } else {
        buzzerButton.disabled = true;
        buzzerButton.querySelector('span').textContent = "BUZZED!";
        buzzerButton.classList.add('disabled');
    }
}

function showScreen(screenName) {
    joinScreen.classList.remove('active');
    buzzerScreen.classList.remove('active');

    if (screenName === 'join') {
        joinScreen.classList.add('active');
    } else if (screenName === 'buzzer') {
        buzzerScreen.classList.add('active');
    }
    showError(""); // Clear errors on screen change
}

function showError(message) {
    errorMessage.textContent = message;
}

// --- Image Utility Function ---
function resizeImage(file, maxSize, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get the resized image as a Base64 string
            callback(canvas.toDataURL('image/jpeg', 0.9)); // Use JPEG for better compression
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

