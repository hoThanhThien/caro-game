# auto.py
from pydantic import BaseModel

class MoveRequest(BaseModel):
    squares: list
    player: str

def opponent(player):
    return "O" if player == "X" else "X"

def is_winner(board, player):
    win_lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],  # Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8],  # Cols
        [0, 4, 8], [2, 4, 6],             # Diagonals
    ]
    return any(all(board[i] == player for i in line) for line in win_lines)

def is_full(board):
    return all(cell is not None for cell in board)

def evaluate(board, player):
    if is_winner(board, player):
        return 1
    elif is_winner(board, opponent(player)):
        return -1
    else:
        return 0

def minimax(board, depth, alpha, beta, maximizing, player):
    if is_winner(board, player) or is_winner(board, opponent(player)) or is_full(board):
        return evaluate(board, player)

    if maximizing:
        max_eval = float("-inf")
        for i in range(len(board)):
            if board[i] is None:
                board[i] = player
                eval = minimax(board, depth + 1, alpha, beta, False, player)
                board[i] = None
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
        return max_eval
    else:
        min_eval = float("inf")
        for i in range(len(board)):
            if board[i] is None:
                board[i] = opponent(player)
                eval = minimax(board, depth + 1, alpha, beta, True, player)
                board[i] = None
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
        return min_eval

def find_best_move(board, player):
    best_score = float("-inf")
    best_move = -1
    for i in range(len(board)):
        if board[i] is None:
            board[i] = player
            score = minimax(board, 0, float("-inf"), float("inf"), False, player)
            board[i] = None
            if score > best_score:
                best_score = score
                best_move = i
    return best_move

# Endpoint FastAPI sử dụng ở main.py
def auto_move_endpoint(data: MoveRequest):
    best_index = find_best_move(data.squares, data.player)
    return {"index": best_index}
