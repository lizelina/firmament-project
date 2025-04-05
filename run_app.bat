@echo off
echo Starting Flask backend and Socket.IO servers...

REM Start Flask app in a new window
start cmd /k "cd backend && python app.py"

REM Start Socket.IO server in a new window
start cmd /k "cd backend && python app_socketio.py"

REM Wait for backend to initialize
timeout /t 3

REM Start the React frontend
cd frontend\dev && npm start 