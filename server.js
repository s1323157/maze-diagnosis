const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http'); 
const { Server } = require("socket.io"); 
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static('public'));

const PROVIDER = 'openai'; 
const MODEL = 'gpt-4o-mini';

// ★重要: ここに授業で「口頭で伝えられたAPIキー」を入れてください
const API_KEY = "s1323157"; 

let promptTemplate;
try {
    promptTemplate = fs.readFileSync('prompt.md', 'utf8');
} catch (error) {
    promptTemplate = "プレイデータ: 時間=${time}, 衝突=${collisions}, 停止=${idle}。性格診断をしてJSONで返して。";
}

// プロキシサーバーのURL
const OPENAI_API_ENDPOINT = "https://openai-api-proxy-746164391621.us-west1.run.app";

app.post('/api/generate', async (req, res) => {
    try {
        const variables = req.body;
        let finalPrompt = promptTemplate;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
            finalPrompt = finalPrompt.replace(regex, value);
        }

        let result = await callOpenAI(finalPrompt);
        res.json(result); 

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// スマホ連携用
io.on('connection', (socket) => {
    console.log('ユーザー接続:', socket.id);

    socket.on('join', (room) => {
        socket.join(room);
    });

    socket.on('sensor', (data) => {
        io.to('game').emit('sensor', data);
    });
});

async function callOpenAI(prompt) {
    if (!API_KEY || API_KEY.includes("口頭で聞いた")) {
        throw new Error('API Keyが設定されていません。server.jsを確認してください。');
    }

    const response = await fetch(OPENAI_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'system', content: prompt }],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Proxy API error');
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});