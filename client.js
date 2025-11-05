// --- Element References ---
const joinScreen = document.getElementById('join-screen');
const boardScreen = document.getElementById('board-screen');
const buzzerOverlay = document.getElementById('buzzer-overlay');
const gameOverScreen = document.getElementById('game-over-screen'); // --- NEW ---

const roomCodeInput = document.getElementById('room-code-input');
const nameInput = document.getElementById('name-input');
const pfpInput = document.getElementById('pfp-input');
const pfpPreview = document.getElementById('pfp-preview');

const joinButton = document.getElementById('join-button');
const errorMessage = document.getElementById('error-message');
const buzzerButton = document.getElementById('buzzer-button');
const playAgainButton = document.getElementById('play-again-button'); // --- NEW ---

const playerNameBoard = document.getElementById('player-name-board');
const playerPfp = document.getElementById('player-pfp');
const playerScore = document.getElementById('player-score');
const categoryContainer = document.getElementById('category-container');
const gridContainer = document.getElementById('grid-container');
const gameOverMessage = document.getElementById('game-over-message'); // --- NEW ---

let ws;
let playerName = '';
let playerPicture = null;

// const SERVER_URL = "ws://localhost:8080";
const SERVER_URL = "wss://relay-fnoq.onrender.com";

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

// --- Join & Play Again Button Logic ---
joinButton.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.toUpperCase();
    playerName = nameInput.value;

    if (!roomCode || !playerName) {
        errorMessage.textContent = "Please fill out all fields.";
        return;
    }
    
    joinButton.disabled = true;
    joinButton.textContent = 'WAITING FOR HOST...';
    errorMessage.textContent = '';

    resizeImage(pfpPreview.src, 128, 128, (base64Data) => {
        playerPicture = base64Data;
        connect(roomCode, playerName, playerPicture);
    });
});

// --- NEW: Event listener for the play again button ---
playAgainButton.addEventListener('click', () => {
    showJoinScreen();
});


// --- WebSocket Connection ---
function connect(roomCode, name, picture) {
    console.log(`Attempting to connect to ${SERVER_URL} with code ${roomCode}`);
    ws = new WebSocket(SERVER_URL);

    ws.onopen = () => {
        console.log('Connection successful. Sending join_room message.');
        ws.send(JSON.stringify({
            type: 'join_room',
            code: roomCode,
            name: name,
            picture: picture
        }));
    };

    ws.onmessage = (event) => {
        console.log('<<< MESSAGE RECEIVED:', event.data);
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (error) {
            console.error("Error parsing or handling message:", error);
        }
    };

    ws.onclose = () => {
        console.warn('Connection closed.');
        showJoinScreen("Lost connection to server.");
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        showJoinScreen("Could not connect to server.");
    };
}

// --- Message Handling ---
function handleMessage(data) {
    switch (data.type) {
        case 'error':
            console.error("Server error:", data.message);
            showJoinScreen(data.message);
            break;
        case 'sync_board_state':
            console.log("Syncing board state.");
            showBoardScreen();
            buildGameBoard(data.board);
            playerScore.textContent = data.score;
            break;
        case 'board_update':
            console.log(`Disabling button: cat ${data.categoryIndex}, word ${data.wordIndex}`);
            const buttonId = `word-${data.categoryIndex}-${data.wordIndex}`;
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
            }
            break;
        case 'scores_updated':
            console.log("Scores have been updated.", data.players);
            const myData = data.players.find(p => p.Name.toUpperCase() === playerName.toUpperCase());
            if (myData) {
                playerScore.textContent = myData.Score;
            }
            break;
        case 'next_turn':
            console.log("Buzzer is now active.");
            buzzerButton.disabled = false;
            buzzerOverlay.classList.remove('hidden');
            break;
        case 'buzzer_lock':
            console.log("Buzzers are now locked.");
            buzzerOverlay.classList.add('hidden');
            break;
        case 'room_closed':
            console.warn("Host closed the room.");
            showJoinScreen("The game host has disconnected.");
            break;
        // --- NEW: Handle the game over message ---
        case 'game_over':
            console.log("Game over. Winner:", data.winnerName);
            // Check if this client is the winner
            if (data.winnerName && data.winnerName.toUpperCase() === playerName.toUpperCase()) {
                gameOverMessage.textContent = 'YOU WIN!';
                gameOverMessage.className = 'win';
            } else {
                gameOverMessage.textContent = 'YOU LOSE!';
                gameOverMessage.className = 'lose';
            }
            showGameOverScreen();
            break;
    }
}

// --- View Switching ---
function showBoardScreen() {
    playerNameBoard.textContent = playerName;
    if (playerPicture) {
        playerPfp.src = playerPicture;
        playerPfp.style.display = 'block';
    } else {
        playerPfp.style.display = 'none'; 
    }
    joinScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    boardScreen.classList.add('active');
}

function showJoinScreen(message) {
    if (message) {
        errorMessage.textContent = message;
    } else {
        errorMessage.textContent = ''; // Clear error on normal reset
    }
    // Don't clear inputs, user might want to rejoin
    boardScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    joinScreen.classList.add('active');

    joinButton.disabled = false;
    joinButton.textContent = 'PLAY';
}

// --- NEW: Function to show the game over screen ---
function showGameOverScreen() {
    boardScreen.classList.remove('active');
    joinScreen.classList.remove('active');
    gameOverScreen.classList.add('active');
}

// --- Function to dynamically build the game board ---
function buildGameBoard(boardData) {
    categoryContainer.innerHTML = '';
    gridContainer.innerHTML = '';
    const numCategories = boardData.Categories.length;
    categoryContainer.style.gridTemplateColumns = `repeat(${numCategories}, 1fr)`;
    gridContainer.style.gridTemplateColumns = `repeat(${numCategories}, 1fr)`;

    boardData.Categories.forEach(cat => {
        const label = document.createElement('div');
        label.className = 'category-label';
        label.textContent = cat.Name;
        categoryContainer.appendChild(label);
    });

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
        console.error("Error loading image for resize. Sending null for picture.");
        callback(null);
    };
}
