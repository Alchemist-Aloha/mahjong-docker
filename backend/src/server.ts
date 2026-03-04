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
  }
});

interface Room {
  id: string;
  players: Record<string, { id: string; ready: boolean; isBot: boolean }>;
  host: string;
  game?: MahjongGame;
}

const rooms: Record<string, Room> = {};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', (roomId: string) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, players: {}, host: socket.id };
    }
    const room = rooms[roomId];
    
    // Prevent joining if game already started
    if (room.game) {
      socket.emit('error', 'Game already started in this room.');
      return;
    }
    
    // Prevent more than 4 human players
    if (Object.keys(room.players).length >= 4) {
      socket.emit('error', 'Room is full.');
      return;
    }

    room.players[socket.id] = { id: socket.id, ready: false, isBot: false };
    socket.join(roomId);
    
    io.to(roomId).emit('roomUpdate', room);
    console.log(`Player ${socket.id} joined room ${roomId}`);
  });

  socket.on('toggleReady', (roomId: string) => {
    const room = rooms[roomId];
    if (room && room.players[socket.id]) {
      room.players[socket.id].ready = !room.players[socket.id].ready;
      io.to(roomId).emit('roomUpdate', room);
    }
  });

  socket.on('startGame', (roomId: string) => {
    const room = rooms[roomId];
    if (room && room.host === socket.id) {
      const humans = Object.values(room.players).filter(p => !p.isBot);
      
      // Ensure all humans are ready
      const allReady = humans.every(p => p.ready);
      if (!allReady) {
        socket.emit('error', 'Not all players are ready.');
        return;
      }

      // Add AI bots to fill the room to 4 players
      const neededBots = 4 - humans.length;
      for (let i = 0; i < neededBots; i++) {
        const botId = `bot-${Date.now()}-${i}`;
        room.players[botId] = { id: botId, ready: true, isBot: true };
      }

      io.to(roomId).emit('roomUpdate', room);
      io.to(roomId).emit('gameStarted');
      
      // Initialize Mahjong Game state machine
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

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        
        // If room empty, destroy room
        const remainingHumans = Object.values(room.players).filter(p => !p.isBot);
        if (remainingHumans.length === 0) {
          if (room.game) room.game.stop();
          delete rooms[roomId];
        } else {
          // Reassign host if necessary
          if (room.host === socket.id) {
            room.host = remainingHumans[0].id;
          }
          io.to(roomId).emit('roomUpdate', room);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
