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
  id: string; // This will be the persistent userId
  socketId: string;
  name: string;
  ready: boolean;
  isBot: boolean;
  totalScore: number;
  isOnline: boolean;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  host: string;
  game?: MahjongGame;
}

const rooms: Record<string, Room> = {};

// Helper to map socketId to roomId and userId
const socketToUser: Record<string, { roomId: string, userId: string }> = {};

const getCleanRoom = (r: Room) => {
  const clean = { ...r };
  delete clean.game;
  return clean;
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', (data: { roomId: string, userId: string, name?: string }) => {
    const { roomId, userId } = data;
    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, players: {}, host: userId };
    }
    const room = rooms[roomId];

    // Check if player is already in this room (reconnecting)
    if (room.players[userId]) {
      room.players[userId].socketId = socket.id;
      room.players[userId].isOnline = true;
      socket.join(roomId);
      socketToUser[socket.id] = { roomId, userId };
      
      console.log(`Player ${userId} reconnected to room ${roomId}`);
      io.to(roomId).emit('roomUpdate', getCleanRoom(room));
      
      if (room.game) {
        room.game.broadcastState(); // Sync game state for reconnected player
      }
      return;
    }

    if (room.game) {
      socket.emit('error', 'Game already started in this room.');
      return;
    }

    if (Object.keys(room.players).length >= 4) {
      socket.emit('error', 'Room is full.');
      return;
    }

    const name = data.name || `玩家_${userId.substring(0, 4)}`;
    room.players[userId] = { 
      id: userId,
      socketId: socket.id,
      name: name.substring(0, 12), 
      ready: false, 
      isBot: false,
      totalScore: 0,
      isOnline: true
    };
    socket.join(roomId);
    socketToUser[socket.id] = { roomId, userId };

    io.to(roomId).emit('roomUpdate', getCleanRoom(room));
  });

  socket.on('updateName', (data: { roomId: string, name: string }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomId];
    if (room && room.players[mapping.userId]) {
      room.players[mapping.userId].name = data.name.substring(0, 12);
      io.to(mapping.roomId).emit('roomUpdate', getCleanRoom(room));
    }
  });

  socket.on('toggleReady', (roomId: string) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomId];
    if (room && room.players[mapping.userId]) {
      room.players[mapping.userId].ready = !room.players[mapping.userId].ready;
      io.to(mapping.roomId).emit('roomUpdate', getCleanRoom(room));
    }
  });

  socket.on('startGame', (roomId: string) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomId];
    if (room && room.host === mapping.userId) {
      // Remove any existing bots if humans are ready to start
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
          socketId: 'bot',
          name: `电脑_${i + 1}`, 
          ready: true, 
          isBot: true,
          totalScore: 0,
          isOnline: true
        };
      }

      io.to(roomId).emit('roomUpdate', getCleanRoom(room));
      io.to(roomId).emit('gameStarted');

      room.game = new MahjongGame(io, room);
      room.game.start();
    }
  });

  socket.on('discardTile', (data: { roomId: string, tileIndex: number }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomId];
    if (room && room.game) {
      room.game.handleDiscard(mapping.userId, data.tileIndex);
    }
  });

  socket.on('performAction', (data: { roomId: string, action: string | null }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomId];
    if (room && room.game) {
      room.game.performAction(mapping.userId, data.action);
    }
  });

  socket.on('nextRound', (roomId: string) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomId];
    if (room && room.game) {
      room.game.playerReadyForNextRound(mapping.userId);
    }
  });

  socket.on('disconnect', () => {
    const mapping = socketToUser[socket.id];
    if (mapping) {
      const { roomId, userId } = mapping;
      const room = rooms[roomId];
      if (room && room.players[userId]) {
        room.players[userId].isOnline = false;
        console.log(`Player ${userId} disconnected from room ${roomId}`);
        
        // Check if all humans are offline
        const remainingOnlineHumans = Object.values(room.players).filter(p => !p.isBot && p.isOnline);
        if (remainingOnlineHumans.length === 0) {
          // If everyone left, we give some time before destroying the room
          setTimeout(() => {
             const currentRoom = rooms[roomId];
             if (currentRoom) {
               const stillOffline = Object.values(currentRoom.players).filter(p => !p.isBot && p.isOnline).length === 0;
               if (stillOffline) {
                 console.log(`Destroying room ${roomId} due to inactivity`);
                 if (currentRoom.game) currentRoom.game.stop();
                 delete rooms[roomId];
               }
             }
          }, 60000); // 1 minute grace period
        } else {
          // If the host left, reassign host to the first online human
          if (room.host === userId) {
            room.host = remainingOnlineHumans[0].id;
          }
          io.to(roomId).emit('roomUpdate', getCleanRoom(room));
        }
      }
      delete socketToUser[socket.id];
    }
  });
});

const PORT = process.env.PORT || 54321;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
