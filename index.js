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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173"
  }
});

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
app.get('/movies', auth, getHorrorMovies);

app.get('/', (req, res) => {
  res.send('Horror Movie API Running!');
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send-message', (messageData) => {
    io.to(messageData.room).emit('receive-message', messageData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});





const startServer = async () => {
  await syncDatabase();
  
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io ready for connections`);
  });
};

startServer();