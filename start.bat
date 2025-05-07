@echo off
echo Starting Django backend...
start cmd /k "python manage.py runserver"

echo Starting frontend (npm run dev)...
cd frontend
start cmd /k "npm run dev"

echo Both backend and frontend are starting in separate terminals.