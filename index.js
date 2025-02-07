const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/database');
const authRouter = require('./routes/authRouter');
const cors = require('cors');
const logger = require('morgan');
const { getHorrorMovies } = require('./controllers/movies');
const auth = require('./middleware/middleware');

const app = express();
const server = createServer(app);


const syncDatabase = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log('Database tables created!');
  } catch (error) {
    console.error('Database sync error:', error);
  }
};

app.use(express.json());
app.use(logger('dev'));
app.use(cors());
app.use('/auth', authRouter);
app.get('/movies', getHorrorMovies);



app.get('/', (req, res) => {
  res.send('Horror Movie API Running!');
});

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend URL
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
});

const users = new Map(); // Active users: socket.id -> user data
const messageHistory = new Map(); // Message history for rooms
const MAX_MESSAGES_PER_ROOM = 50;

const addMessageToHistory = (room, message) => {
  if (!messageHistory.has(room)) {
    messageHistory.set(room, []);
  }

  const messages = messageHistory.get(room);
  messages.push(message);

  if (messages.length > MAX_MESSAGES_PER_ROOM) {
    messages.shift();
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle initial join with authenticated user
  socket.on('join', (userData) => {
    // Store user data
    users.set(socket.id, {
      id: socket.id,
      username: userData.username,
      room: 'general' // Default room
    });

    // Join default room
    socket.join('general');

    // Send message history
    const roomHistory = messageHistory.get('general') || [];
    socket.emit('message_history', roomHistory);

    // Notify room of new user
    io.to('general').emit('userJoined', {
      user: userData.username,
      message: `${userData.username} has joined the chat`,
      timestamp: new Date().toISOString()
    });

    // Send updated users list
    io.emit('usersList', Array.from(users.values()));
  });

  // Handle room change
  socket.on('join_room', (newRoom) => {
    const user = users.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;

    socket.leave(oldRoom);
    io.to(oldRoom).emit('userLeft', {
      user: user.username,
      message: `${user.username} has left the room`,
      timestamp: new Date().toISOString()
    });

    socket.join(newRoom);
    user.room = newRoom;
    users.set(socket.id, user);

    const roomHistory = messageHistory.get(newRoom) || [];
    socket.emit('message_history', roomHistory);

    io.to(newRoom).emit('userJoined', {
      user: user.username,
      message: `${user.username} has joined the room`,
      timestamp: new Date().toISOString()
    });

    io.emit('usersList', Array.from(users.values()));
  });

  // Handle chat messages
  socket.on('sendMessage', ({ message, room }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageData = {
      id: Date.now().toString(),
      user: user.username,
      message: message.trim(),
      room: room,
      timestamp: new Date().toISOString()
    };

    addMessageToHistory(room, messageData);
    io.to(room).emit('message', messageData);
  });

  // Handle typing status
  socket.on('typing', ({ room, isTyping }) => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(room).emit('userTyping', {
      user: user.username,
      isTyping
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);

      io.to(user.room).emit('userLeft', {
        user: user.username,
        message: `${user.username} has left the chat`,
        timestamp: new Date().toISOString()
      });

      io.emit('usersList', Array.from(users.values()));
    }
  });
});


const startServer = async () => {
  await syncDatabase();
  
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io ready for connections`);
  });
};

startServer();