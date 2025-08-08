# main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uuid
import json
from pydantic import BaseModel
from auto import find_best_move
import random


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms = {}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = {
            "players": [],
        }

    room = rooms[room_id]

    if len(room["players"]) >= 2:
        await websocket.send_text(json.dumps({"error": "Room is full"}))
        await websocket.close()
        return

    # Gán vai trò
    role = 'X' if len(room["players"]) == 0 else 'O'
    player_info = { "socket": websocket, "role": role }
    room["players"].append(player_info)

    # Gửi vai trò cho người chơi vừa kết nối
    await websocket.send_text(json.dumps({
        "role": role
    }))

    # --- CHANGED START: Server chủ động bắt đầu game khi đủ 2 người ---
    if len(room["players"]) == 2:
        first_turn = random.choice(['X', 'O'])
        start_game_payload = json.dumps({
            "reset": True,
            "firstTurn": first_turn
        })
        for player in room["players"]:
            await player["socket"].send_text(start_game_payload)
    # --- CHANGED END ---

    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)

            # --- CHANGED START: Server quyết định lượt đi đầu cho ván mới ---
            if parsed.get("reset") is True:
                # Client yêu cầu chơi lại, server quyết định ai đi trước
                first_turn = random.choice(['X', 'O'])
                reset_payload = json.dumps({
                    "reset": True,
                    "firstTurn": first_turn,
                })
                for player in room["players"]:
                    await player["socket"].send_text(reset_payload)
            # --- CHANGED END ---

            elif "squares" in parsed and "turn" in parsed:
                # Chuyển tiếp nước đi cho người chơi còn lại
                broadcast_payload = json.dumps(parsed)
                for player in room["players"]:
                    if player["socket"] != websocket:
                         await player["socket"].send_text(broadcast_payload)
            # main.py (bổ sung trong websocket_endpoint)
            elif parsed.get("type") in ("chat", "emote"):
            # Gói lại kèm role người gửi (X/O) để client hiển thị
                msg = {
                    "type": parsed["type"],
                    "text": parsed.get("text"),
                    "emoji": parsed.get("emoji"),
                    "sender": role,  # 'X' hoặc 'O'
                }
                payload = json.dumps(msg)
                for player in room["players"]:
            # broadcast cho cả hai (kể cả người gửi, để đồng bộ UI)
                    await player["socket"].send_text(payload)


    except (WebSocketDisconnect, json.JSONDecodeError):
        room["players"] = [p for p in room["players"] if p["socket"] != websocket]
        if room["players"]:
            # Thông báo cho người chơi còn lại
            opponent_left_payload = json.dumps({"opponent_left": True})
            for player in room["players"]:
                await player["socket"].send_text(opponent_left_payload)
        else:
            # Nếu không còn ai, xóa phòng
            if room_id in rooms:
                del rooms[room_id]
      

@app.get("/create-room")
def create_room():
    room_id = str(uuid.uuid4())[:8]
    return {"room_id": room_id}

class MoveRequest(BaseModel):
    squares: list
    player: str

@app.post("/auto-move")
def auto_move(data: MoveRequest):
    best_index = find_best_move(data.squares, data.player)
    return {"index": best_index}