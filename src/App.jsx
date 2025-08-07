// App.jsx

import { useState, useEffect, useRef } from 'react';
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

// --- Offline Board Component (Không thay đổi) ---
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
  // isX bị loại bỏ, vì vai trò X/O được quyết định bởi server
  const [myTurn, setMyTurn] = useState(false);
  const [myRole, setMyRole] = useState(null);
  // <<< SỬA ĐỔI: Xóa myRoleRef vì chúng ta sẽ dùng biến cục bộ để thay thế
  
  const winner = calculateWinner(squares);
  const isDraw = !winner && squares.every(s => s !== null);
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef(null);

  // <<< SỬA ĐỔI: Xóa useEffect cho myRoleRef

  useEffect(() => {
    if (!myTurn || winner || isDraw) {
      clearInterval(timerRef.current);
      return;
    }
  
    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          alert("⏱️ Hết thời gian! Bạn đã thua.");
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          setMyRoom('');
          setSquares(Array(9).fill(null));
          setWs(null);
          onBack(); 
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  
    return () => clearInterval(timerRef.current);
  }, [myTurn, winner, isDraw, ws, onBack]);

  async function createRoom() {
    try {
        const res = await fetch('http://localhost:8000/create-room');
        const data = await res.json();
        setRoomId(data.room_id);
        joinRoom(data.room_id); // Không cần isCreator nữa
    } catch(error) {
        console.error("Failed to create room:", error);
        alert("Không thể tạo phòng. Vui lòng kiểm tra lại server.");
    }
  }

  function joinRoom(id) {
    if (!id) {
        alert("Vui lòng nhập Room ID.");
        return;
    }
    const socket = new WebSocket(`ws://localhost:8000/ws/${id}`);

    // <<< SỬA ĐỔI: Khai báo một biến cục bộ để lưu vai trò một cách đáng tin cậy
    let localRole = null;

    socket.onopen = () => {
      setMyRoom(id);
      setWs(socket);
      setSquares(Array(9).fill(null));
      // --- REMOVED: Không gửi reset từ client nữa ---
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.error) {
        alert(`Lỗi: ${data.error}`);
        setMyRoom('');
        setWs(null);
        return;
      }
      
      // Xử lý tin nhắn gán vai trò
      if (data.role === 'X' || data.role === 'O') {
        setMyRole(data.role);
        localRole = data.role; // <<< SỬA ĐỔI: Cập nhật vai trò vào biến cục bộ
        return; // Kết thúc xử lý cho tin nhắn này
      }

      if (data.opponent_left) {
        alert("🎉 Đối thủ đã rời phòng. Bạn thắng!");
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        setMyRoom('');
        setWs(null);
        setSquares(Array(9).fill(null));
        onBack(); // Quay về màn hình chính
        return;
      }

      // Xử lý tin nhắn bắt đầu/chơi lại game
      if (data.reset) {
        setSquares(Array(9).fill(null));
        // <<< SỬA ĐỔI: Dùng biến cục bộ `localRole` thay vì `myRoleRef.current`
        const isMyTurn = localRole === data.firstTurn;
        setMyTurn(isMyTurn);
      } 
      // Xử lý tin nhắn nước đi
      else if (Array.isArray(data.squares) && typeof data.turn === 'string') {
        setSquares(data.squares);
        // <<< SỬA ĐỔI: Dùng biến cục bộ `localRole` cho nhất quán
        const isMyTurn = localRole === data.turn;
        setMyTurn(isMyTurn);
      }
    };

    socket.onclose = () => {
      setMyRoom('');
      setWs(null);
      setSquares(Array(9).fill(null));
      // Không tự động back(), chỉ khi đối thủ rời hoặc tự mình rời
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        alert("Không thể kết nối tới phòng. Vui lòng kiểm tra Room ID và server.");
        setMyRoom('');
        setWs(null);
    }
  }

  function handleClick(i) {
    // <<< SỬA ĐỔI: Dùng state `myRole` ở đây là an toàn vì đây là hành động của người dùng, state đã ổn định
    if (!myTurn || squares[i] || winner || isDraw) return;
    
    const newSquares = [...squares];
    newSquares[i] = myRole; // Dùng role của mình để đánh cờ
    setSquares(newSquares);
    setMyTurn(false);
    
    const nextTurn = myRole === 'X' ? 'O' : 'X';
    ws.send(JSON.stringify({ squares: newSquares, turn: nextTurn }));
  }

  function handleRestart() {
    if (ws) {
      ws.send(JSON.stringify({ reset: true }));
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
              onClick={() => joinRoom(roomId)}
            >
              Vào phòng
            </button>
          </div>
          <button className="caro-restart-btn" style={{ marginTop: 12 }} onClick={onBack}>⬅️ Quay lại</button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#000', fontWeight: 'bold' }}> Phòng: {myRoom}</b>
          </div>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#000', fontWeight: 'bold' }}> Bạn là: </b>
            <b style={{ color: myRole === 'X' ? '#e53935' : '#222' }}>
              {myRole === 'X' ? '❌ X' : '⭕ O'}
            </b>
          </div>
          <div style={{ marginBottom: 10 }}>
             <b style={{ color: '#000', fontWeight: 'bold' }}>Lượt: {myTurn ? 'Bạn' : 'Đối thủ'}</b>
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
            ) : (ws && myRole) ? 'Đang chơi...' : 'Đang chờ đối thủ...'}
            {myTurn && !winner && !isDraw && (
              <div style={{ fontSize: '1.1rem', color: '#d32f2f', margin: '10px 0' }}>
                ⏳ Thời gian còn lại: <b>{timeLeft}s</b>
              </div>
            )}
          </h2>

          <div className="caro-board">
            {squares.map((v, i) => (
              <button
                key={i}
                className={`caro-square ${myTurn && !v ? 'my-turn' : ''}`}
                style={{ color: v === 'X' ? '#e53935' : v === 'O' ? '#222' : undefined }}
                onClick={() => handleClick(i)}
                disabled={!myTurn || !!v}
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

// --- Utility function (Không thay đổi) ---
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

// --- App Component (Không thay đổi) ---
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