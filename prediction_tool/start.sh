#!/bin/bash
echo "Installing dependencies..."
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "Starting Poultry Analytics server..."
cd backend
python app.py
