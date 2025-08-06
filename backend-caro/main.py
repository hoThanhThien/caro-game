from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uuid
import json
from pydantic import BaseModel
from auto import find_best_move


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
        rooms[room_id] = []
    rooms[room_id].append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)

                # Nếu là reset
                if parsed.get("reset") is True:
                    for ws in rooms[room_id]:
                        await ws.send_text(json.dumps({
                            "reset": True,
                            "firstTurn": parsed.get("firstTurn", True)
                        }))

                # Nếu là lượt chơi
                elif "squares" in parsed and "turn" in parsed:
                    for ws in rooms[room_id]:
                        await ws.send_text(json.dumps(parsed))

            except json.JSONDecodeError:
                # Gửi lại dữ liệu nếu không phải JSON (phòng hờ)
                for ws in rooms[room_id]:
                    if ws != websocket:
                        await ws.send_text(data)
    except WebSocketDisconnect:
        rooms[room_id].remove(websocket)
        if not rooms[room_id]:
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

