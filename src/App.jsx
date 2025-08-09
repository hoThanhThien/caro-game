// App.jsx

import { useState, useEffect, useRef } from 'react';
import './App.css';
import { API_BASE_URL, WS_BASE_URL } from './config.js';



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

  




  useEffect(() => {
    async function fetchAIMove() {
      if (!isAITurn || winner) return;

      try {
        const response = await fetch(`${API_BASE_URL}/auto-move`, {
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
  const TURN_TIME = 20; // chỉnh thời gian mỗi lượt ở đây

  const [roomId, setRoomId] = useState('');
  const [myRoom, setMyRoom] = useState('');
  const [ws, setWs] = useState(null);
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [myTurn, setMyTurn] = useState(false);
  const [myRole, setMyRole] = useState(null);

  const winner = calculateWinner(squares);
  const isDraw = !winner && squares.every(s => s !== null);

  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const timerRef = useRef(null);

  // Chat + Emote
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [flyEmotes, setFlyEmotes] = useState([]);
  const EMOJIS = ["😀","😂","😮","😢","😡","❤️","👍","👏","🎉"];
  const msgsRef = useRef(null);

  useEffect(() => {
    if (!msgsRef.current) return;
    msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!myTurn || winner || isDraw) {
      clearInterval(timerRef.current);
      return;
    }
    setTimeLeft(TURN_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          alert("⏱️ Hết thời gian! Bạn đã thua.");
          if (ws && ws.readyState === WebSocket.OPEN) ws.close();
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
      const res = await fetch(`${API_BASE_URL}/create-room`);
      const data = await res.json();
      setRoomId(data.room_id);
      joinRoom(data.room_id);
    } catch (e) {
      console.error(e);
      alert("Không thể tạo phòng. Kiểm tra server.");
    }
  }

  function joinRoom(id) {
    if (!id) { alert("Vui lòng nhập Room ID."); return; }
    const socket = new WebSocket(`${WS_BASE_URL}/ws/${id}`);
    let localRole = null;

    socket.onopen = () => {
      setMyRoom(id);
      setWs(socket);
      setSquares(Array(9).fill(null));
    };

    socket.onmessage = (ev) => {
      let data; try { data = JSON.parse(ev.data); } catch { return; }

      if (data.error) { alert(`Lỗi: ${data.error}`); setMyRoom(''); setWs(null); return; }

      if (data.role === 'X' || data.role === 'O') { setMyRole(data.role); localRole = data.role; return; }

      if (data.opponent_left) {
        alert("🎉 Đối thủ đã rời phòng. Bạn thắng!");
        if (socket.readyState === WebSocket.OPEN) socket.close();
        setMyRoom(''); setWs(null); setSquares(Array(9).fill(null)); onBack(); return;
      }

      if (data.reset) {
        setSquares(Array(9).fill(null));
        setMyTurn(localRole === data.firstTurn);
      } else if (Array.isArray(data.squares) && typeof data.turn === 'string') {
        setSquares(data.squares);
        setMyTurn(localRole === data.turn);
      } else if (data.type === "chat" && typeof data.text === "string") {
        setMessages(prev => [...prev, { sender: data.sender, text: data.text, ts: Date.now() }]);
      } else if (data.type === "emote" && data.emoji) {
        setMessages(prev => [...prev, { sender: data.sender, text: data.emoji, ts: Date.now() }]);
        const id = Math.random().toString(36).slice(2);
        setFlyEmotes(prev => [...prev, { id, emoji: data.emoji }]);
        setTimeout(() => setFlyEmotes(prev => prev.filter(e => e.id !== id)), 1200);
      }
    };

    socket.onclose = () => { setMyRoom(''); setWs(null); setSquares(Array(9).fill(null)); };
    socket.onerror = () => { alert("Không thể kết nối phòng. Kiểm tra Room ID/server."); setMyRoom(''); setWs(null); };
  }

  function handleClick(i) {
    if (!myTurn || squares[i] || winner || isDraw) return;
    const newSquares = [...squares];
    newSquares[i] = myRole;
    setSquares(newSquares);
    setMyTurn(false);
    const nextTurn = myRole === 'X' ? 'O' : 'X';
    ws.send(JSON.stringify({ squares: newSquares, turn: nextTurn }));
  }

  function handleRestart() { if (ws) ws.send(JSON.stringify({ reset: true })); }
  function handleLeave()   { if (ws) ws.close(); setMyRoom(''); setSquares(Array(9).fill(null)); onBack(); }

  function sendChat() {
    if (!ws || !chatInput.trim()) return;
    ws.send(JSON.stringify({ type: "chat", text: chatInput.trim() }));
    setChatInput("");
  }
  function sendEmote(emoji) { if (ws) ws.send(JSON.stringify({ type: "emote", emoji })); }

  return (
    <div className="caro-board-container">
      {!myRoom ? (
        <div style={{ marginBottom: 24 }}>
          <button className="caro-restart-btn" onClick={createRoom}>Tạo phòng mới</button>
          <div style={{ marginTop: 12 }}>
            <input placeholder="Nhập Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} />
            <button className="caro-restart-btn" style={{ marginLeft: 8 }} onClick={() => joinRoom(roomId)}>Vào phòng</button>
          </div>
          <button className="caro-restart-btn" style={{ marginTop: 12 }} onClick={onBack}>⬅️ Quay lại</button>
        </div>
      ) : (
        <>
          {/* TOPBAR: Phòng + Rời phòng (góc phải) */}
          <div className="topbar">
            <div className="room-info"><b>Phòng: {myRoom}</b></div>
            <button className="btn-primary btn-small" onClick={handleLeave}>⬅️ Rời phòng</button>

          </div>

          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#000', fontWeight: 'bold' }}> Bạn là: </b>
            <b style={{ color: myRole === 'X' ? '#e53935' : '#222' }}>{myRole === 'X' ? '❌ ' : '⭕ '}</b>
          </div>
          <div style={{ marginBottom: 10 }}>
            <b style={{ color: '#000', fontWeight: 'bold' }}>Lượt: {myTurn ? 'Bạn' : 'Đối thủ'}</b>
          </div>

          <h2 className="caro-status">
            {isDraw ? (
              <>🤝 Hòa rồi!</>
            ) : winner ? (
              <>🎉 Người thắng: {winner === 'X'
                ? <span style={{ color: '#e53935', fontWeight: 'bold' }}>❌ </span>
                : <span style={{ color: '#222', fontWeight: 'bold' }}>⭕ </span>}!</>
            ) : (ws && myRole) ? 'Đang chơi...' : 'Đang chờ đối thủ...'}

            {myTurn && !winner && !isDraw && (
              <span style={{ fontSize: '1.1rem', color: '#d32f2f', marginLeft: 8 }}>⏳ {timeLeft}s</span>
            )}
          </h2>

          {!winner && !isDraw && (
            <div className="turn-timer">
              <div className="turn-timer__bar" style={{ width: `${(timeLeft / TURN_TIME) * 100}%` }} />
            </div>
          )}

          <div className="caro-online-wrap">
            {/* Cột trái: board + overlay */}
            <div className="caro-board-wrap">
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

              {/* Emoji overlay */}
              <div className="emote-overlay">
                {flyEmotes.map(e => (<span key={e.id} className="emote-fly">{e.emoji}</span>))}
              </div>

              {/* Nút Chơi lại (nhóm dưới board, cách board thoáng bằng CSS .caro-actions) */}
              <div className="caro-actions">
                {(isDraw || winner) && (
                  <button className="caro-restart-btn" onClick={handleRestart}>Chơi lại</button>
                )}
              </div>
            </div>

            {/* Cột phải: Chat */}
            <div className="caro-chat">
              <div className="caro-chat-header">🗨️ Trò chuyện</div>

              <div className="caro-chat-messages" ref={msgsRef}>
                {messages.map((m, idx) => (
                  <div key={idx} className={`chat-msg ${m.sender === myRole ? 'me' : 'op'}`}>
                    <b style={{ marginRight: 6 }}>{m.sender === 'X' ? '❌' : '⭕'}</b>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>

              <div className="caro-emoji-bar">
                {EMOJIS.map(e => (
                  <button key={e} className="emoji-btn" onClick={() => sendEmote(e)}>{e}</button>
                ))}
              </div>

              <div className="caro-chat-input">
                <input
                  placeholder="Nhập tin nhắn..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => (e.key === 'Enter' ? sendChat() : null)}
                />
                <button 
                  onClick={sendChat}
                  disabled={!chatInput.trim()}
                  className={`btn-primary btn-small ${!chatInput.trim() ? 'disabled' : ''}`}
                >
                  Gửi
                </button>
              </div>
            </div>
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