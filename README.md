# TCP Chat Server

A simple real-time chat server built with Node.js using raw TCP sockets. 
Supports multiple concurrent clients with username-based authentication.

## Features

- Multi-client support (5-10 concurrent users)
- Real-time message broadcasting
- Unique username validation
- Private messaging (DM)
- User directory (WHO command)
- Idle timeout (60 seconds)
- Heartbeat system (PING/PONG)
- Graceful disconnect handling

## Quick Start

# Clone and run
git clone 
cd tcp-chat-server
node chat-server.js

## Commands

LOGIN <username>  - Login with unique username
MSG <text>        - Send message to all users
WHO               - List all active users
DM <user> <text>  - Send private message
PING              - Keep connection alive

## Tech Stack

- Node.js (v14+)
- TCP sockets (net module)
- Event-driven architecture
- No external dependencies

