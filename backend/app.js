const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173","https://quiz-app-manual-dep.netlify.app/"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = "mongodb+srv://abishek1071996:QDPGf4bbZcwUBwEg@cluster0.mtbzjg0.mongodb.net/quizDB"; 
const client = new MongoClient(MONGODB_URI);

let questions = [];
const rooms = {};


async function fetchQuestions() {
  try {
    await client.connect();
    const database = client.db("quizDB"); 
    const questionsCollection = database.collection("questions");
    questions = await questionsCollection.find({}).toArray();
  } catch (error) {
    console.error("Error fetching questions:", error);
  }
}

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("joinRoom", (room, name) => {
    if (!rooms[room]) {
      rooms[room] = {
        players: [],
        currentQuestion: null,
        correctAnswer: null,
        questionTimeout: null,
        scores: {},
        questionCount: 0,
      };
    }

    if (rooms[room].players.length < 2) {
      rooms[room].players.push({ id: socket.id, name, score: 0 });
      rooms[room].scores[name] = 0;
      socket.join(room);
      io.to(room).emit("message", `${name} has joined the game!`);
      io.to(room).emit("availableRooms", Object.keys(rooms));

      if (rooms[room].players.length === 1) {
        askNewQuestion(room);
      }
    } else {
      socket.emit("roomFull", room);
    }
  });

  socket.on('getAvailableRooms', () => {
    socket.emit('availableRooms', Object.keys(rooms));
  });

  socket.on("submitAnswer", (room, answerIndex) => {
    const currentPlayer = rooms[room].players.find(
      (player) => player.id === socket.id
    );

    if (currentPlayer) {
      const correctAnswer = rooms[room].correctAnswer;
      const isCorrect = correctAnswer !== null && correctAnswer === answerIndex;
      currentPlayer.score += isCorrect ? 10 : 0;

      clearTimeout(rooms[room].questionTimeout);

      io.to(room).emit("answerResult", {
        playerName: currentPlayer.name,
        isCorrect,
        correctAnswer,
        scores: rooms[room].players.map((player) => ({
          name: player.name,
          score: player.score,
        })),
      });

      rooms[room].questionCount += 1;

      if (rooms[room].questionCount >= 5) {
        const winner = rooms[room].players.reduce((prev, current) => {
          return (prev.score > current.score) ? prev : current;
        });

        io.to(room).emit("gameOver", { winner: winner.name });
        delete rooms[room];
      } else {
        askNewQuestion(room);
      }
    }
  });

  socket.on("disconnect", () => {
    for (const room in rooms) {
      rooms[room].players = rooms[room].players.filter(
        (player) => player.id !== socket.id
      );

      if (rooms[room].players.length === 0) {
        delete rooms[room];
      }
    }
    console.log("A user disconnected");
  });
});

function askNewQuestion(room) {
  if (rooms[room].players.length === 0) {
    clearTimeout(rooms[room].questionTimeout);
    delete rooms[room];
    return;
  }

  const randomIndex = Math.floor(Math.random() * questions.length);
  const question = questions[randomIndex];
  rooms[room].currentQuestion = question;
  rooms[room].correctAnswer = question.answers.findIndex(
    (answer) => answer.correct
  );

  io.to(room).emit("newQuestion", {
    question: question.question,
    answers: question.answers.map((answer) => answer.text),
    timer: 10,
  });

  rooms[room].questionTimeout = setTimeout(() => {
    io.to(room).emit("answerResult", {
      playerName: "No one",
      isCorrect: false,
      correctAnswer: rooms[room].correctAnswer,
      scores: rooms[room].players.map((player) => ({
        name: player.name,
        score: player.score,
      })),
    });

    rooms[room].questionCount += 1;

    if (rooms[room].questionCount >= 5) {
      const winner = rooms[room].players.reduce((prev, current) => {
        return (prev.score > current.score) ? prev : current;
      });

      io.to(room).emit("gameOver", { winner: winner.name });
      delete rooms[room];
    } else {
      askNewQuestion(room);
    }
  }, 10000);
}


fetchQuestions().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => console.error("Failed to fetch questions:", err));
