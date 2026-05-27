#!/bin/bash
echo "Installing dependencies..."
pip install -r requirements.txt --break-system-packages -q

echo "Starting Poultry Analytics server..."
cd backend
python app.py
