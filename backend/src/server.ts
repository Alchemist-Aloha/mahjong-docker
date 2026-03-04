import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { MahjongGame } from './MahjongGame';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 5000,
  pingInterval: 10000
});

interface Player {
  id: string;
  name: string;
  ready: boolean;
  isBot: boolean;
  totalScore: number;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  host: string;
  game?: MahjongGame;
}

const rooms: Record<string, Room> = {};

const getCleanRoom = (r: Room) => {
  const clean = { ...r };
  delete clean.game;
  return clean;
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', (roomId: string) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, players: {}, host: socket.id };
    }
    const room = rooms[roomId];

    if (room.game) {
      socket.emit('error', 'Game already started in this room.');
      return;
    }

    if (Object.keys(room.players).length >= 4) {
      socket.emit('error', 'Room is full.');
      return;
    }

    room.players[socket.id] = { 
      id: socket.id, 
      name: `玩家_${socket.id.substring(0, 4)}`, 
      ready: false, 
      isBot: false,
      totalScore: 0 
    };
    socket.join(roomId);

    io.to(roomId).emit('roomUpdate', getCleanRoom(room));
  });

  socket.on('updateName', (data: { roomId: string, name: string }) => {
    const room = rooms[data.roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].name = data.name.substring(0, 12); // Limit length
      io.to(data.roomId).emit('roomUpdate', getCleanRoom(room));
    }
  });

  socket.on('toggleReady', (roomId: string) => {
    const room = rooms[roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].ready = !room.players[socket.id].ready;
      io.to(roomId).emit('roomUpdate', getCleanRoom(room));
    }
  });

  socket.on('startGame', (roomId: string) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      for (const id in room.players) {
        if (room.players[id].isBot) delete room.players[id];
      }

      const humans = Object.values(room.players).filter(p => !p.isBot);
      const allReady = humans.every(p => p.ready);
      if (!allReady) {
        socket.emit('error', 'Not all players are ready.');
        return;
      }

      const neededBots = 4 - humans.length;
      for (let i = 0; i < neededBots; i++) {
        const botId = `bot-${Date.now()}-${i}`;
        room.players[botId] = { 
          id: botId, 
          name: `电脑_${i + 1}`, 
          ready: true, 
          isBot: true,
          totalScore: 0 
        };
      }

      io.to(roomId).emit('roomUpdate', getCleanRoom(room));
      io.to(roomId).emit('gameStarted');

      room.game = new MahjongGame(io, room);
      room.game.start();
    }
  });

  socket.on('discardTile', (data: { roomId: string, tileIndex: number }) => {
    const room = rooms[data.roomId];
    if (room && room.game) {
      room.game.handleDiscard(socket.id, data.tileIndex);
    }
  });

  socket.on('performAction', (data: { roomId: string, action: string | null }) => {
    const room = rooms[data.roomId];
    if (room && room.game) {
      room.game.performAction(socket.id, data.action);
    }
  });

  socket.on('nextRound', (roomId: string) => {
    const room = rooms[roomId];
    if (room && room.game) {
      room.game.playerReadyForNextRound(socket.id);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        const remainingHumans = Object.values(room.players).filter(p => !p.isBot);
        if (remainingHumans.length === 0) {
          if (room.game) room.game.stop();
          delete rooms[roomId];
        } else {
          if (room.host === socket.id) room.host = remainingHumans[0].id;
          io.to(roomId).emit('roomUpdate', getCleanRoom(room));
        }
      }
    }
  });
});

const PORT = process.env.PORT || 54321;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
