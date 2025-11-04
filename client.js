// --- Element References ---
const joinScreen = document.getElementById('join-screen');
const boardScreen = document.getElementById('board-screen');
const buzzerOverlay = document.getElementById('buzzer-overlay');

const roomCodeInput = document.getElementById('room-code-input');
const nameInput = document.getElementById('name-input');
const pfpInput = document.getElementById('pfp-input');
const pfpPreview = document.getElementById('pfp-preview');

const joinButton = document.getElementById('join-button');
const errorMessage = document.getElementById('error-message');

const buzzerButton = document.getElementById('buzzer-button');
const playerNameDisplay = document.getElementById('player-name-display'); // Note: This is no longer used, can be removed

// New board screen elements
const playerPfp = document.getElementById('player-pfp');
const playerScore = document.getElementById('player-score');
const categoryContainer = document.getElementById('category-container');
const gridContainer = document.getElementById('grid-container');

let ws;
let playerName = '';
let playerPicture = null; // Store our picture data

const SERVER_URL = "wss://relay-mgcs.onrender.com";
// const SERVER_URL = "ws://localhost:8080"; // For local testing

// --- Profile Picture Handling (Unchanged) ---
pfpInput.addEventListener('change', () => {
    const file = pfpInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            pfpPreview.src = e.target.result;
            pfpPreview.style.display = 'block';
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
    
    resizeImage(pfpPreview.src, 128, 128, (base64Data) => {
        playerPicture = base64Data; // Store our picture for later use
        connect(roomCode, playerName, playerPicture);
    });
});

// --- WebSocket Connection (Unchanged) ---
function connect(roomCode, name, picture) {
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
        console.log('Connected to server.');
        ws.send(JSON.stringify({
            type: 'join_room',
            code: roomCode,
            name: name,
            picture: picture
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

// --- NEW Message Handling Logic ---
function handleMessage(data) {
    console.log('Received message:', data);
    switch (data.type) {
        case 'error':
            errorMessage.textContent = data.message;
            ws.close();
            break;
        case 'game_started': // Still used for initial start
            showBoardScreen();
            break;
        case 'sync_board_state': // For rejoining players
            showBoardScreen();
            buildGameBoard(data.board);
            playerScore.textContent = data.score; // Update score
            break;
        case 'board_update': // A word was chosen
            const buttonId = `word-${data.categoryIndex}-${data.wordIndex}`;
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
            }
            // Update score if it was this player who answered
            if (data.playerIndex === myPlayerIndex) { // We need to know our index
                 playerScore.textContent = data.newScore;
            }
            break;
        case 'next_turn': // Show the buzzer
            buzzerButton.disabled = false;
            buzzerOverlay.classList.remove('hidden');
            break;
        case 'buzzer_lock': // Hide the buzzer
            buzzerOverlay.classList.add('hidden');
            break;
        case 'room_closed':
            showJoinScreen("The game host has disconnected.");
            break;
    }
}

// --- View Switching ---
function showBoardScreen() {
    // Set our own profile picture on the board screen
    if (playerPicture) {
        playerPfp.src = playerPicture;
    } else {
        // You could set a default local image here if you want
        playerPfp.style.display = 'none'; 
    }
    
    joinScreen.classList.remove('active');
    boardScreen.classList.add('active');
}

function showJoinScreen(message) {
    if (message) {
        errorMessage.textContent = message;
    }
    roomCodeInput.value = '';
    nameInput.value = '';
    pfpPreview.src = '';
    pfpPreview.style.display = 'none';
    pfpInput.value = null;

    boardScreen.classList.remove('active');
    joinScreen.classList.add('active');
}

// --- NEW: Function to dynamically build the game board ---
function buildGameBoard(boardData) {
    // Clear existing board
    categoryContainer.innerHTML = '';
    gridContainer.innerHTML = '';

    // Set grid columns
    const numCategories = boardData.Categories.length;
    categoryContainer.style.gridTemplateColumns = `repeat(${numCategories}, 1fr)`;
    gridContainer.style.gridTemplateColumns = `repeat(${numCategories}, 1fr)`;

    // Create category labels
    boardData.Categories.forEach(cat => {
        const label = document.createElement('div');
        label.className = 'category-label';
        label.textContent = cat.Name;
        categoryContainer.appendChild(label);
    });

    // Create word buttons in column-major order
    const numWords = boardData.Categories[0].Words.length;
    for (let wordIndex = 0; wordIndex < numWords; wordIndex++) {
        for (let catIndex = 0; catIndex < numCategories; catIndex++) {
            const word = boardData.Categories[catIndex].Words[wordIndex];
            const button = document.createElement('button');
            button.className = 'word-button';
            button.id = `word-${catIndex}-${wordIndex}`;
            button.textContent = word.Points;
            button.disabled = boardData.DisabledButtons.some(
                d => d.CategoryIndex === catIndex && d.WordIndex === wordIndex
            );
            gridContainer.appendChild(button);
        }
    }
}


// --- Buzzer Logic (Unchanged) ---
buzzerButton.addEventListener('click', () => {
    buzzerButton.disabled = true;
    ws.send(JSON.stringify({ type: 'buzz', name: playerName }));
});

// --- Image Resizing Helper (Unchanged) ---
function resizeImage(base64Str, maxWidth = 128, maxHeight = 128, callback) {
    if (!base64Str || base64Str === pfpPreview.src && pfpPreview.style.display === 'none') {
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
            if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
            if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.7)); 
    };
    img.onerror = () => {
        console.error("Error loading image for resize.");
        callback(null);
    };
}
