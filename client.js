// Get references to all our HTML elements
const joinScreen = document.getElementById('join-screen');
const buzzerScreen = document.getElementById('buzzer-screen');

const roomCodeInput = document.getElementById('room-code-input');
const nameInput = document.getElementById('name-input');
// Re-added pfp elements
const pfpInput = document.getElementById('pfp-input');
const pfpPreview = document.getElementById('pfp-preview');

const joinButton = document.getElementById('join-button');
const errorMessage = document.getElementById('error-message');

const buzzerButton = document.getElementById('buzzer-button');
const playerNameDisplay = document.getElementById('player-name-display');

let ws; // This will hold our WebSocket connection
let playerName = '';

// --- IMPORTANT ---
// For local testing, use your server's local address.
// When you deploy, change this to your Render.com URL.
const SERVER_URL = "ws://localhost:8080"; 

// --- Profile Picture Handling ---
pfpInput.addEventListener('change', () => {
    const file = pfpInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            pfpPreview.src = e.target.result;
            pfpPreview.style.display = 'block'; // Make it visible
        };
        reader.readAsDataURL(file);
    } else {
        pfpPreview.src = '';
        pfpPreview.style.display = 'none';
    }
});


// --- Join Button Logic ---
joinButton.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.toUpperCase();
    playerName = nameInput.value;

    if (!roomCode || !playerName) {
        errorMessage.textContent = "Please fill out all fields.";
        return;
    }
    
    // --- MODIFIED: Request a larger image (256x256) for better quality ---
    resizeImage(pfpPreview.src, 256, 256, (base64Data) => {
        connect(roomCode, playerName, base64Data);
    });
});

// --- WebSocket Connection ---
function connect(roomCode, name, picture) { // Picture parameter re-added
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
        console.log('Connected to server.');
        // Send the join message with picture data
        ws.send(JSON.stringify({
            type: 'join_room',
            code: roomCode,
            name: name,
            picture: picture // Send the resized Base64 string
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = () => {
        console.log('Disconnected from server.');
        showJoinScreen("Lost connection to server.");
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        errorMessage.textContent = "Could not connect to server.";
    };
}

// --- Message Handling ---
function handleMessage(data) {
    switch (data.type) {
        case 'error':
            errorMessage.textContent = data.message;
            ws.close();
            break;
        case 'game_started':
            showBuzzerScreen();
            break;
        case 'next_turn':
            buzzerButton.disabled = false;
            break;
        case 'room_closed':
            showJoinScreen("The game host has disconnected.");
            break;
    }
}

// --- View Switching ---
function showBuzzerScreen() {
    playerNameDisplay.textContent = playerName;
    joinScreen.classList.remove('active');
    buzzerScreen.classList.add('active');
}

function showJoinScreen(message) {
    if (message) {
        errorMessage.textContent = message;
    }
    roomCodeInput.value = '';
    nameInput.value = '';
    
    // Reset pfp input and preview
    pfpPreview.src = '';
    pfpPreview.style.display = 'none';
    pfpInput.value = null; // Clear the file input

    buzzerScreen.classList.remove('active');
    joinScreen.classList.add('active');
}

// --- Buzzer Logic ---
buzzerButton.addEventListener('click', () => {
    buzzerButton.disabled = true;
    ws.send(JSON.stringify({ type: 'buzz', name: playerName }));
});

// --- MODIFIED: This function now resizes to a larger size and uses higher quality JPEG compression ---
function resizeImage(base64Str, maxWidth = 256, maxHeight = 256, callback) {
    if (!base64Str || base64Str === pfpPreview.src && pfpPreview.style.display === 'none') {
        // No valid image to process, or preview is empty, send null
        callback(null); 
        return;
    }

    let img = new Image();
    img.src = base64Str;
    img.onload = () => {
        let canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // --- MODIFIED: Increased compression quality from 0.7 to 0.85 ---
        callback(canvas.toDataURL('image/jpeg', 0.85)); 
    };
    img.onerror = () => {
        // If there's an error loading the image (e.g., base64Str was empty/invalid)
        console.error("Error loading image for resize. Sending null for picture.");
        callback(null);
    };
}
