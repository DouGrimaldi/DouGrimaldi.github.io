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

// New board screen elements
const playerPfp = document.getElementById('player-pfp');
const playerScore = document.getElementById('player-score');
const categoryContainer = document.getElementById('category-container');
const gridContainer = document.getElementById('grid-container');

let ws;
let playerName = '';
let playerPicture = null; // Store our picture data

// const SERVER_URL = "ws://localhost:8080"; // For local testing
const SERVER_URL = "wss://relay-mgcs.onrender.com";

// --- Profile Picture Handling ---
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

// --- WebSocket Connection ---
function connect(roomCode, name, picture) {
    console.log(`Attempting to connect to ${SERVER_URL} with code ${roomCode}`);
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
        console.log('Connection successful. Sending join_room message.');
        // Send the join message with picture data
        ws.send(JSON.stringify({
            type: 'join_room',
            code: roomCode,
            name: name,
            picture: picture // Send the resized Base64 string
        }));
    };

    ws.onmessage = (event) => {
        // --- DEBUGGING: Log every single message from the server ---
        console.log('<<< MESSAGE RECEIVED:', event.data);
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error("Error parsing or handling message:", error);
        }
    };

    ws.onclose = () => {
        console.warn('Connection closed.'); // Use warn for better visibility
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
            console.error("Server error:", data.message);
            errorMessage.textContent = data.message;
            ws.close();
            break;
        case 'game_started': // Still used for initial start
            console.log("Game is starting, showing board screen.");
            showBoardScreen();
            break;
        case 'sync_board_state': // For rejoining players
            console.log("Syncing board state for rejoin.");
            showBoardScreen();
            buildGameBoard(data.board);
            playerScore.textContent = data.score;
            break;
        case 'board_update': // A word was chosen
            console.log(`Disabling button: cat ${data.categoryIndex}, word ${data.wordIndex}`);
            const buttonId = `word-${data.categoryIndex}-${data.wordIndex}`;
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
            }
            break;
        case 'scores_updated': // --- NEW: Handle the score update broadcast
            console.log("Scores have been updated.", data.players);
            const myData = data.players.find(p => p.Name.toUpperCase() === playerName.toUpperCase());
            if (myData) {
                playerScore.textContent = myData.Score;
            }
            break;
        case 'next_turn': // Show the buzzer
            console.log("Buzzer is now active.");
            buzzerButton.disabled = false;
            buzzerOverlay.classList.remove('hidden');
            break;
        case 'buzzer_lock': // Hide the buzzer
            console.log("Buzzers are now locked.");
            buzzerOverlay.classList.add('hidden');
            break;
        case 'room_closed':
            console.warn("Host closed the room.");
            showJoinScreen("The game host has disconnected.");
            break;
    }
}

// --- View Switching ---
function showBoardScreen() {
    // Set our own profile picture on the board screen
    if (playerPicture) {
        playerPfp.src = playerPicture;
        playerPfp.style.display = 'block';
    } else {
        // Hide the pfp element if there is no picture
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

// --- Function to dynamically build the game board ---
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

// --- Buzzer Logic ---
buzzerButton.addEventListener('click', () => {
    buzzerButton.disabled = true;
    // --- DEBUGGING: Log the message we are sending ---
    console.log('>>> SENDING MESSAGE: buzz');
    ws.send(JSON.stringify({ type: 'buzz', name: playerName }));
});

// --- Image Resizing Helper ---
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
        callback(canvas.toDataURL('image/jpeg', 0.7)); 
    };
    img.onerror = () => {
        console.error("Error loading image for resize. Sending null for picture.");
        callback(null);
    };
}
