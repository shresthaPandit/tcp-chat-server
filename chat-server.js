const net = require('net');

// Configuration
const PORT = process.env.PORT || 4000;
const IDLE_TIMEOUT = 60000; // 60 seconds in milliseconds

// Store connected clients
const clients = new Map(); // Map<socket, {username: string, lastActivity: timestamp}>

/**
 * Broadcast a message to all connected clients
 * @param {string} message - Message to broadcast
 * @param {net.Socket} excludeSocket - Optional socket to exclude from broadcast
 */
function broadcast(message, excludeSocket = null) {
    clients.forEach((clientInfo, socket) => {
        if (socket !== excludeSocket && clientInfo.username) {
            socket.write(message + '\n');
        }
    });
}

/**
 * Send a message to a specific client
 * @param {net.Socket} socket - Target socket
 * @param {string} message - Message to send
 */
function sendToClient(socket, message) {
    socket.write(message + '\n');
}

/**
 * Remove a client from the server
 * @param {net.Socket} socket - Socket to remove
 */
function removeClient(socket) {
    const clientInfo = clients.get(socket);
    if (clientInfo && clientInfo.username) {
        // Notify others about disconnection
        broadcast(`INFO ${clientInfo.username} disconnected`, socket);
        console.log(`User ${clientInfo.username} disconnected`);
    }
    clients.delete(socket);
}

/**
 * Check if username is already taken
 * @param {string} username - Username to check
 * @returns {boolean}
 */
function isUsernameTaken(username) {
    for (const clientInfo of clients.values()) {
        if (clientInfo.username === username) {
            return true;
        }
    }
    return false;
}

/**
 * Handle LOGIN command
 * @param {net.Socket} socket - Client socket
 * @param {string} username - Requested username
 */
function handleLogin(socket, username) {
    // Validate username
    if (!username || username.trim().length === 0) {
        sendToClient(socket, 'ERR invalid-username');
        return;
    }

    username = username.trim();

    // Check if username is taken
    if (isUsernameTaken(username)) {
        sendToClient(socket, 'ERR username-taken');
        return;
    }

    // Set username for this client
    const clientInfo = clients.get(socket);
    clientInfo.username = username;
    clientInfo.lastActivity = Date.now();

    sendToClient(socket, 'OK');
    console.log(`User ${username} logged in`);

    // Notify all other users
    broadcast(`INFO ${username} joined`, socket);
}

/**
 * Handle MSG command
 * @param {net.Socket} socket - Client socket
 * @param {string} message - Message text
 */
function handleMessage(socket, message) {
    const clientInfo = clients.get(socket);

    if (!clientInfo.username) {
        sendToClient(socket, 'ERR not-logged-in');
        return;
    }

    // Update last activity
    clientInfo.lastActivity = Date.now();

    // Broadcast message to all users
    const formattedMessage = `MSG ${clientInfo.username} ${message}`;
    broadcast(formattedMessage);
    console.log(formattedMessage);
}

/**
 * Handle WHO command (list all users)
 * @param {net.Socket} socket - Client socket
 */
function handleWho(socket) {
    const clientInfo = clients.get(socket);

    if (!clientInfo.username) {
        sendToClient(socket, 'ERR not-logged-in');
        return;
    }

    // Update last activity
    clientInfo.lastActivity = Date.now();

    // Send list of all users
    clients.forEach((info) => {
        if (info.username) {
            sendToClient(socket, `USER ${info.username}`);
        }
    });
}

/**
 * Handle DM command (direct message)
 * @param {net.Socket} socket - Client socket
 * @param {string} targetUsername - Target user
 * @param {string} message - Message text
 */
function handleDirectMessage(socket, targetUsername, message) {
    const senderInfo = clients.get(socket);

    if (!senderInfo.username) {
        sendToClient(socket, 'ERR not-logged-in');
        return;
    }

    // Update last activity
    senderInfo.lastActivity = Date.now();

    // Find target user
    let targetSocket = null;
    for (const [sock, info] of clients.entries()) {
        if (info.username === targetUsername) {
            targetSocket = sock;
            break;
        }
    }

    if (!targetSocket) {
        sendToClient(socket, `ERR user-not-found ${targetUsername}`);
        return;
    }

    // Send DM to target user
    sendToClient(targetSocket, `DM ${senderInfo.username} ${message}`);
    // Confirm to sender
    sendToClient(socket, `DM-SENT ${targetUsername}`);
}

/**
 * Handle PING command (heartbeat)
 * @param {net.Socket} socket - Client socket
 */
function handlePing(socket) {
    const clientInfo = clients.get(socket);
    if (clientInfo) {
        clientInfo.lastActivity = Date.now();
        sendToClient(socket, 'PONG');
    }
}

/**
 * Parse and handle incoming data from client
 * @param {net.Socket} socket - Client socket
 * @param {string} data - Raw data from client
 */
function handleData(socket, data) {
    // Split by newlines to handle multiple commands
    const lines = data.toString().trim().split('\n');

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        console.log(`Received: ${line}`);

        // Parse command
        const parts = line.split(' ');
        const command = parts[0].toUpperCase();

        switch (command) {
            case 'LOGIN':
                const username = parts.slice(1).join(' ');
                handleLogin(socket, username);
                break;

            case 'MSG':
                const message = parts.slice(1).join(' ');
                handleMessage(socket, message);
                break;

            case 'WHO':
                handleWho(socket);
                break;

            case 'DM':
                if (parts.length < 3) {
                    sendToClient(socket, 'ERR invalid-dm-format');
                    break;
                }
                const targetUser = parts[1];
                const dmMessage = parts.slice(2).join(' ');
                handleDirectMessage(socket, targetUser, dmMessage);
                break;

            case 'PING':
                handlePing(socket);
                break;

            default:
                sendToClient(socket, `ERR unknown-command ${command}`);
        }
    });
}

// Create TCP server
const server = net.createServer((socket) => {
    console.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);

    // Initialize client info
    clients.set(socket, {
        username: null,
        lastActivity: Date.now()
    });

    // Send welcome message
    sendToClient(socket, 'Welcome to the chat server! Please login with: LOGIN <username>');

    // Handle incoming data
    socket.on('data', (data) => {
        handleData(socket, data);
    });

    // Handle client disconnect
    socket.on('end', () => {
        console.log('Client disconnected (graceful)');
        removeClient(socket);
    });

    // Handle errors
    socket.on('error', (err) => {
        console.log(`Socket error: ${err.message}`);
        removeClient(socket);
    });

    // Handle connection close
    socket.on('close', () => {
        console.log('Connection closed');
        removeClient(socket);
    });
});

// Check for idle clients periodically
setInterval(() => {
    const now = Date.now();
    clients.forEach((clientInfo, socket) => {
        if (clientInfo.username && (now - clientInfo.lastActivity) > IDLE_TIMEOUT) {
            console.log(`Disconnecting idle user: ${clientInfo.username}`);
            sendToClient(socket, 'INFO Disconnected due to inactivity');
            socket.end();
        }
    });
}, 30000); // Check every 30 seconds

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Chat server is running on port ${PORT}`);
    console.log(`To connect, use: nc localhost ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    broadcast('INFO Server is shutting down');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});