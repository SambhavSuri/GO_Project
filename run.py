#!/usr/bin/env python3
"""
AI VRM Chat - Startup Script
A simple script to launch the AI VRM Chat application
"""

import os
import sys
import subprocess
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Error: Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python version: {sys.version.split()[0]}")

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import flask
        import flask_cors
        import flask_socketio
        import openai
        import dotenv
        import deepgram
        print("✅ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_env_file():
    """Check if .env file exists"""
    if not os.path.exists('.env'):
        print("⚠️  Warning: .env file not found")
        print("Creating .env file from template...")
        if os.path.exists('env.example'):
            import shutil
            shutil.copy('env.example', '.env')
            print("✅ Created .env file from template")
            print("Please edit .env file with your API keys")
        else:
            print("❌ env.example not found")
            return False
    else:
        print("✅ .env file found")
        
        # Check for required API keys
        from dotenv import load_dotenv
        load_dotenv()
        
        deepgram_key = os.getenv('DEEPGRAM_API_KEY')
        if not deepgram_key or deepgram_key == 'your_deepgram_api_key_here':
            print("⚠️  Warning: DEEPGRAM_API_KEY not configured")
            print("Please add your Deepgram API key to .env file")
        else:
            print("✅ Deepgram API key configured")
    
    return True

def create_directories():
    """Create necessary directories"""
    directories = [
        'static/audio',
        'static/models', 
        'static/animations',
        'data'
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    print("✅ Directories created")

def start_server():
    """Start the Flask server"""
    print("\n🚀 Starting AI VRM Chat Server...")
    print("📍 Server will be available at: http://localhost:5000")
    print("🥽 Looking Glass Go WebSocket: ws://localhost:5000")
    print("\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        subprocess.run([sys.executable, 'app.py'], check=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

def main():
    """Main function"""
    print("🤖 AI VRM Chat - Startup Script")
    print("=" * 40)
    
    # Check Python version
    check_python_version()
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check environment file
    if not check_env_file():
        sys.exit(1)
    
    # Create directories
    create_directories()
    
    # Start server
    start_server()

if __name__ == "__main__":
    main() 