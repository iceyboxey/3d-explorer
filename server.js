const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = process.env.PORT || 10000;

const players = new Map();

const server = http.createServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, {
            "Content-Type": "text/plain"
        });

        res.end("OK");
        return;
    }

    if (req.url === "/" || req.url === "/index.html") {
        const file = path.join(__dirname, "index.html");

        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end("Could not load game.");
                return;
            }

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8"
            });

            res.end(data);
        });

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocket.Server({
    server,
    path: "/ws"
});

wss.on("connection", (ws) => {
    const id = crypto.randomUUID();

    const player = {
        id,
        name: "Player",
        x: 0,
        y: 1.7,
        z: 8,
        yaw: 0,
        ws
    };

    players.set(id, player);

    ws.send(JSON.stringify({
        type: "welcome",
        id
    }));

    ws.on("message", (raw) => {
        try {
            const message = JSON.parse(raw.toString());

            if (message.type === "join") {
                player.name =
                    String(message.name || "Player")
                    .substring(0, 16);
            }

            if (message.type === "move") {
                player.x = Number(message.x) || 0;
                player.y = Number(message.y) || 1.7;
                player.z = Number(message.z) || 0;
                player.yaw = Number(message.yaw) || 0;
            }

        } catch (error) {
            console.log("Invalid message");
        }
    });

    ws.on("close", () => {
        players.delete(id);
    });

    ws.on("error", () => {
        players.delete(id);
    });
});


// Send the current players to everyone 20 times per second.

setInterval(() => {

    const snapshot = {
        type: "snapshot",

        players: [...players.values()].map(player => ({
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw
        }))
    };

    const data = JSON.stringify(snapshot);

    for (const player of players.values()) {

        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(data);
        }

    }

}, 50);


// Keep WebSocket connections alive.

setInterval(() => {

    for (const ws of wss.clients) {

        if (ws.isAlive === false) {
            ws.terminate();
            continue;
        }

        ws.isAlive = false;
        ws.ping();

    }

}, 30000);

wss.on("connection", ws => {

    ws.isAlive = true;

    ws.on("pong", () => {
        ws.isAlive = true;
    });

});


server.listen(PORT, "0.0.0.0", () => {
    console.log(`3D Explorer server running on port ${PORT}`);
});
