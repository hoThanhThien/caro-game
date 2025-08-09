# Dockerfile for FastAPI backend
FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements-simple.txt requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
