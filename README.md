# JIN MultiAI Chat

Local web app for chatting with multiple AI models simultaneously via 9Router.

## Features

- Ask one question → all selected AIs answer in parallel
- Per-model memory — each AI gets its own conversation context preserved
- Session management — multiple named conversations
- System prompt per session
- Streaming responses in real-time
- Clean dark UI

## Requirements

- Node.js 18+
- [9Router](../9router) running on `localhost:20128`

## Usage

1. Start 9Router (`../9router/start.bat`)
2. Run `start.bat`
3. Open `http://localhost:3099`

## Stack

- Backend: Node.js + Express
- Frontend: Vanilla HTML/CSS/JS
- Storage: JSON file (`data/memory.json`)
- AI: OpenAI-compatible API via 9Router
