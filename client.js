// --- NEW: Wait for the entire HTML document to be ready before running any script ---
document.addEventListener('DOMContentLoaded', () => {

    // Get references to all our HTML elements
    const joinScreen = document.getElementById('join-screen');
    const buzzerScreen = document.getElementById('buzzer-screen');

    const roomCodeInput = document.getElementById('room-code-input');
    const nameInput = document.getElementById('name-input');
    const pfpInput = document.getElementById('pfp-input');
    const pfpPreview = document.getElementById('pfp-preview');

    const joinButton = document.getElementById('join-button');
    const errorMessage = document.getElementById('error-message');

    const buzzerButton = document.getElementById('buzzer-button');
    const playerNameDisplay = document.getElementById('player-name-display');

    let ws; // This will hold our WebSocket connection
    let playerName = '';

    // --- MODIFIED: Changed the URL to your live Render.com server ---
    // Use wss:// for a secure connection, which is required by GitHub Pages (https)
    const SERVER_URL = "wss://relay-fnoq.onrender.com"; 

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
        
        // Request a larger image (256x256) for better quality
        resizeImage(pfpPreview.src, 256, 256, (base64Data) => {
            connect(roomCode, playerName, base64Data);
        });
    });

    // --- WebSocket Connection ---
    function connect(roomCode, name, picture) {
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

    // This function resizes to a larger size and uses higher quality JPEG compression
    function resizeImage(base64Str, maxWidth = 256, maxHeight = 256, callback) {
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
            
            // Increased compression quality from 0.7 to 0.85
            callback(canvas.toDataURL('image/jpeg', 0.85)); 
        };
        img.onerror = () => {
            console.error("Error loading image for resize. Sending null for picture.");
            callback(null);
        };
    }

// --- NEW: Close the DOMContentLoaded listener ---
});
