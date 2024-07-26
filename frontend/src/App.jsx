import React, { useState, useEffect } from 'react';
import './App.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import io from 'socket.io-client';

const socket = io("wss://quiz-app-mtzp.onrender.com");

function App() {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [info, setInfo] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([]);
  const [answered, setAnswered] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const [scores, setScores] = useState([]);
  const [winner, setWinner] = useState(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [roomFull, setRoomFull] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && room) {
      setRoomFull(false);
      socket.emit('joinRoom', room, name);
      setInfo(true);
    }
  };

  useEffect(() => {
    socket.on('availableRooms', (availableRooms) => {
      setRooms(availableRooms);
    });

    socket.on('newQuestion', (data) => {
      setQuestion(data.question);
      setOptions(data.answers);
      setAnswered(false);
      setSeconds(10);
      setSelectedAnswerIndex(null);
      setCurrentQuestionIndex(prev => prev + 1);
    });

    socket.on('answerResult', (data) => {
      if (data.isCorrect) {
        toast(`Correct! ${data.playerName} got it right.`, {
          position: "bottom-center",
          autoClose: 2000,
          theme: "dark",
        });
      }
      setScores(data.scores);
    });

    socket.on('gameOver', (data) => {
      setWinner(data.winner);
    });

    socket.on('roomFull', (room) => {
      setRoomFull(true);
      toast.error(`Room ${room} is full. Please choose another room.`, {
        position: "bottom-center",
        autoClose: 2000,
        theme: "dark",
      });
    });

    return () => {
      socket.off('availableRooms');
      socket.off('newQuestion');
      socket.off('answerResult');
      socket.off('gameOver');
      socket.off('roomFull');
    };
  }, []);

  useEffect(() => {
    if (seconds === 0) {
      socket.emit('timeUp', room);
      return;
    }

    const timerInterval = setInterval(() => {
      setSeconds(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [seconds]);

  const handleAnswer = (answerIndex) => {
    if (!answered) {
      setSelectedAnswerIndex(answerIndex);
      socket.emit('submitAnswer', room, answerIndex);
      setAnswered(true);
    }
  };

  const createRoom = () => {
    const newRoom = `Room-${Math.floor(Math.random() * 1000)}`;
    setRoom(newRoom);
    socket.emit('createRoom', newRoom, name);
    socket.emit('getAvailableRooms'); // Fetch available rooms after creating a new one
  };

  const selectRoom = (selectedRoom) => {
    setRoom(selectedRoom);
    socket.emit('joinRoom', selectedRoom, name);
    setInfo(true);
  };

  if (winner) {
    return (
      <div>
        <h1>Winner is {winner}</h1>
        <h2>Final Scores:</h2>
        {scores.map((player, index) => (
          <p key={index}>{player.name}: {player.score}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="App">
      {!info ? (
        <div className='join-div'>
          <h1>Quiz App 🪐☄️⋆</h1>
          <form onSubmit={handleSubmit}>
            <input required placeholder='Enter your name' value={name} onChange={(e) => setName(e.target.value)} />
            <input required placeholder='Enter room no' value={room} onChange={(e) => setRoom(e.target.value)} />
            <button type='submit' className='join-btn'>JOIN</button>
            <button type='button' onClick={createRoom} className='create-btn'>CREATE ROOM</button>
          </form>
          <h2>Available Rooms:</h2>
          <div className="room-list-box">
            {rooms.length > 0 ? (
              <ul>
                {rooms.map((availableRoom, index) => (
                  <li key={index}>
                    <button onClick={() => selectRoom(availableRoom)} className="room-button">
                      {availableRoom}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No rooms available, please create a new room.</p>
            )}
          </div>
          {roomFull && <p className="error-message">The selected room is full. Please choose another room.</p>}
        </div>
      ) : (
        <div>
          <h1>QuizClash 💡</h1>
          <p className='room-id'>Room Id: {room}</p>
          <ToastContainer />
          {question ? (
            <div className='quiz-div'>
              Remaining Time: {seconds}
              <div className='question'>
                <p className='question-text'>{question}</p>
              </div>
              <ul>
                {options.map((answer, index) => (
                  <li key={index}>
                    <button className={`options ${selectedAnswerIndex === index ? 'selected' : ''}`} 
                      onClick={() => handleAnswer(index)} disabled={answered}>
                      {answer}
                    </button>
                  </li>
                ))}
              </ul>
              {scores.map((player, index) => (
                <p key={index}>{player.name}: {player.score}</p>
              ))}
            </div>
          ) : (
            <p>Loading question...</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
