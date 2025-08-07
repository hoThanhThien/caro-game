import { useState, useEffect } from 'react';
import './App.css';

// --- Square Component ---
function Square({ value, onClick }) {
  return (
    <button
      className="caro-square"
      onClick={onClick}
      style={{
        color: value === 'X' ? '#e53935' : value === 'O' ? '#222' : undefined
      }}
    >
      {value}
    </button>
  );
}

// --- Offline Board Component ---
function Board({ onBack }) {
  const [firstTurn] = useState(() => Math.random() < 0.5);
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [isXTurn, setIsXTurn] = useState(firstTurn);
  const [isAITurn, setIsAITurn] = useState(!firstTurn);
  const winner = calculateWinner(squares);
  const isDraw = !winner && squares.every(s => s !== null);
  const [opponentLeftHandled, setOpponentLeftHandled] = useState(false);


  useEffect(() => {
    async function fetchAIMove() {
      if (!isAITurn || winner) return;

      try {
        const response = await fetch("http://localhost:8000/auto-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ squares, player: 'O' }),
        });
        const data = await response.json();
        if (data.index !== -1) {
          const newSquares = [...squares];
          newSquares[data.index] = 'O';
          setSquares(newSquares);
          setIsXTurn(true);
          setIsAITurn(false);
        }
      } catch (error) {
        console.error("Lỗi AI move:", error);
      }
    }

    fetchAIMove();
  }, [isAITurn, squares, winner]);

  function handleClick(index) {
    if (squares[index] || winner || isAITurn) return;
    const newSquares = [...squares];
    newSquares[index] = 'X';
    setSquares(newSquares);
    setIsXTurn(false);
    setIsAITurn(true);
  }

  function handleRestart() {
    const randomFirst = Math.random() < 0.5;
    setSquares(Array(9).fill(null));
    setIsXTurn(randomFirst);
    setIsAITurn(!randomFirst);
  }

  function renderSquare(i) {
    return <Square value={squares[i]} onClick={() => handleClick(i)} key={i} />;
  }

  return (
    <div className="caro-board-container">
      <h2 className="caro-status">
        {isDraw ? (
          <>🤝 Hòa rồi!</>
        ) : winner ? (
          <>🎉 Người thắng:
            {winner === 'X' ? (
              <span style={{ color: '#e53935', fontWeight: 'bold' }}> X</span>
            ) : (
              <span style={{ color: '#222', fontWeight: 'bold' }}> O</span>
            )}
            !
          </>
        ) : (
          <>
            Lượt chơi:
            {isXTurn ? (
              <span style={{ color: '#e53935', marginLeft: 6, fontWeight: 'bold' }}> X</span>
            ) : (
              <span style={{ color: '#222', marginLeft: 6, fontWeight: 'bold' }}> O</span>
            )}
          </>
        )}
      </h2>

      <div className="caro-board">
        {squares.map((_, i) => renderSquare(i))}
      </div>

      {(isDraw || winner) && (
  <div style={{ marginTop: 12 }}>
    <button className="caro-restart-btn" onClick={handleRestart}>Chơi lại</button>
    <button className="caro-restart-btn" style={{ marginLeft: 8 }} onClick={onBack}>⬅️ Quay lại</button>
  </div>
)}
{!(isDraw || winner) && (
  <div style={{ marginTop: 12 }}>
    <button className="caro-restart-btn" onClick={onBack}>⬅️ Quay lại</button>
  </div>
)}

      <div className="caro-guide">Hàng 3 ô liên tiếp để chiến thắng!</div>
    </div>
  );
}

// --- OnlineCaro Component ---
function OnlineCaro({ onBack }) {
  const [roomId, setRoomId] = useState('');
  const [myRoom, setMyRoom] = useState('');
  const [ws, setWs] = useState(null);
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [isX, setIsX] = useState(true);
  const [myTurn, setMyTurn] = useState(false);

  const winner = calculateWinner(squares);
  const isDraw = !winner && squares.every(s => s !== null);

  async function createRoom() {
    const res = await fetch('http://localhost:8000/create-room');
    const data = await res.json();
    setRoomId(data.room_id);
    joinRoom(data.room_id, true);
  }

  function joinRoom(id, isCreator = false) {
    const playerX = isCreator;
    const socket = new WebSocket(`ws://localhost:8000/ws/${id}`);

    socket.onopen = () => {
      setMyRoom(id);
      setWs(socket);
      setIsX(playerX);
      setSquares(Array(9).fill(null));
      if (playerX) {
        const firstTurn = Math.random() < 0.5;
        socket.send(JSON.stringify({ reset: true, firstTurn }));
      }
    };

    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.opponent_left) {
         // Hiện thông báo
        alert("🎉 Đối thủ đã rời phòng. Bạn thắng!");

  // Khi người dùng nhấn OK, mới thực hiện thoát phòng
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        setMyRoom('');
        setWs(null);
        setSquares(Array(9).fill(null));
         // Quay về giao diện tạo phòng
        return;
      }

      if (data.reset) {
        setSquares(Array(9).fill(null));
        setMyTurn(playerX === data.firstTurn);
      } else if (Array.isArray(data.squares) && typeof data.turn === 'string') {
        setSquares(data.squares);
        setMyTurn((playerX && data.turn === 'X') || (!playerX && data.turn === 'O'));
      }
    };

    socket.onclose = () => {
       if (!opponentLeftHandled) {
          alert('Đối thủ đã rời phòng!');
          setMyRoom('');
          setWs(null);
          setSquares(Array(9).fill(null));
          onBack();
        }
    };
  }

  function handleClick(i) {
    if (!myTurn || squares[i] || winner) return;
    const newSquares = [...squares];
    newSquares[i] = isX ? 'X' : 'O';
    setSquares(newSquares);
    setMyTurn(false);
    const nextTurn = isX ? 'O' : 'X';
    ws.send(JSON.stringify({ squares: newSquares, turn: nextTurn }));
  }

  function handleRestart() {
    if (ws) {
      const firstTurn = Math.random() < 0.5;
      ws.send(JSON.stringify({ reset: true, firstTurn }));
      setSquares(Array(9).fill(null));
    }
  }

  function handleLeave() {
    if (ws) ws.close();
    setMyRoom('');
    setSquares(Array(9).fill(null));
    onBack();
  }

  return (
    <div className="caro-board-container">
      {!myRoom ? (
        <div style={{ marginBottom: 24 }}>
          <button className="caro-restart-btn" onClick={createRoom}>Tạo phòng mới</button>
          <div style={{ marginTop: 12 }}>
            <input
              placeholder="Nhập Room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
            />
            <button
              className="caro-restart-btn"
              style={{ marginLeft: 8 }}
              onClick={() => joinRoom(roomId, false)}
            >
              Vào phòng
            </button>
          </div>
          <button className="caro-restart-btn" style={{ marginTop: 12 }} onClick={onBack}>⬅️ Quay lại</button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
  <b style={{ color: '#000', fontWeight: 'bold' }}> Phòng:{myRoom}</b>
</div>
<div style={{ marginBottom: 10 }}>
  <b style={{ color: isX ? '#e53935' : '#222', fontWeight: 'bold' }}>
    <b style={{ color: '#000', fontWeight: 'bold' }}> Bạn là:</b>{isX ? '❌ X' : '⭕ O'}
  </b>
</div>
<div style={{ marginBottom: 10 }}>
   <b style={{ color: '#000', fontWeight: 'bold' }}>Lượt:{myTurn ? 'Bạn' : 'Đối thủ'}</b>
</div>


          <h2 className="caro-status">
            {isDraw ? (
              <>🤝 Hòa rồi!</>
            ) : winner ? (
              <>🎉 Người thắng: {winner === 'X' ? (
                <span style={{ color: '#e53935', fontWeight: 'bold' }}>❌ X</span>
              ) : (
                <span style={{ color: '#222', fontWeight: 'bold' }}>⭕ O</span>
              )}!</>
            ) : <>Đang chơi...</>}
          </h2>

          <div className="caro-board">
            {squares.map((v, i) => (
              <button
                key={i}
                className="caro-square"
                style={{ color: v === 'X' ? '#e53935' : v === 'O' ? '#222' : undefined }}
                onClick={() => handleClick(i)}
              >
                {v}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
  {(isDraw || winner) && (
    <button className="caro-restart-btn" onClick={handleRestart}>Chơi lại</button>
  )}
  <button className="caro-restart-btn" style={{ marginLeft: 8 }} onClick={handleLeave}>⬅️ Rời phòng</button>
</div>

        </>
      )}

      <div className="caro-guide">Hàng 3 ô liên tiếp để chiến thắng!</div>
    </div>
  );
}

// --- Utility function ---
function calculateWinner(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (let [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

// --- App Component ---
export default function App() {
  const [mode, setMode] = useState(null); // null | 'offline' | 'online'

  return (
    <div className="caro-app">
      <h1 className="caro-title">Cờ Caro 3x3</h1>

      {!mode ? (
        <div style={{ marginBottom: 24 }}>
          <button className="caro-restart-btn" onClick={() => setMode('offline')}>Chơi với máy</button>
          <button className="caro-restart-btn" style={{ marginLeft: 12 }} onClick={() => setMode('online')}>Chơi Online</button>
        </div>
      ) : mode === 'offline' ? (
        <Board onBack={() => setMode(null)} />
      ) : (
        <OnlineCaro onBack={() => setMode(null)} />
      )}
    </div>
  );
}