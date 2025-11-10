const net = require('net');
const readline = require('readline');

// Configuration
const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 4000;

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

// Connect to server
const client = new net.Socket();

console.log(`🔌 Connecting to chat server at ${HOST}:${PORT}...`);

client.connect(PORT, HOST, () => {
    console.log('✅ Connected to server!\n');
    console.log('📝 Available commands:');
    console.log('   LOGIN <username>  - Login with a username');
    console.log('   MSG <text>        - Send a message to everyone');
    console.log('   WHO               - List all active users');
    console.log('   DM <user> <text>  - Send private message');
    console.log('   PING              - Check connection');
    console.log('   EXIT              - Disconnect\n');
    rl.prompt();
});

// Handle incoming data from server
client.on('data', (data) => {
    const messages = data.toString().trim().split('\n');
    messages.forEach(message => {
        // Clear current line and print message
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(`📨 ${message}`);
        rl.prompt();
    });
});

// Handle user input
rl.on('line', (line) => {
    const input = line.trim();
    
    if (!input) {
        rl.prompt();
        return;
    }

    // Handle local commands
    if (input.toUpperCase() === 'EXIT') {
        console.log('👋 Disconnecting...');
        client.end();
        process.exit(0);
    }

    // Send command to server
    client.write(input + '\n');
    rl.prompt();
});

// Handle connection close
client.on('close', () => {
    console.log('\n🔌 Connection closed');
    process.exit(0);
});

// Handle errors
client.on('error', (err) => {
    console.error(`❌ Connection error: ${err.message}`);
    process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    client.end();
    process.exit(0);
});