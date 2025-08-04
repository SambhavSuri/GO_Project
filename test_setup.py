#!/usr/bin/env python3
"""
AI VRM Chat - Setup Test Script
Tests the application setup and verifies all components are working
"""

import os
import sys
import requests
import json
from pathlib import Path

def test_python_version():
    """Test Python version"""
    print("🐍 Testing Python version...")
    if sys.version_info >= (3, 8):
        print(f"✅ Python {sys.version.split()[0]} - Compatible")
        return True
    else:
        print(f"❌ Python {sys.version.split()[0]} - Requires 3.8+")
        return False

def test_dependencies():
    """Test all dependencies"""
    print("\n📦 Testing dependencies...")
    dependencies = [
        ('flask', 'Flask'),
        ('flask_cors', 'Flask-CORS'),
        ('flask_socketio', 'Flask-SocketIO'),
        ('openai', 'OpenAI'),
        ('boto3', 'Boto3'),
        ('dotenv', 'python-dotenv'),
        ('requests', 'Requests')
    ]
    
    all_good = True
    for module, name in dependencies:
        try:
            __import__(module)
            print(f"✅ {name}")
        except ImportError:
            print(f"❌ {name} - Missing")
            all_good = False
    
    return all_good

def test_env_file():
    """Test environment file"""
    print("\n🔧 Testing environment file...")
    if os.path.exists('.env'):
        print("✅ .env file exists")
        
        # Check for required variables
        from dotenv import load_dotenv
        load_dotenv()
        
        required_vars = ['SECRET_KEY', 'PORT']
        optional_vars = ['OPENAI_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
        rag_vars = ['RAG_ENDPOINT_URL', 'RAG_API_KEY']
        
        missing_required = []
        for var in required_vars:
            if not os.getenv(var):
                missing_required.append(var)
        
        if missing_required:
            print(f"❌ Missing required variables: {', '.join(missing_required)}")
            return False
        
        print("✅ Required environment variables set")
        
        # Check optional variables
        missing_optional = []
        for var in optional_vars:
            if not os.getenv(var):
                missing_optional.append(var)
        
        if missing_optional:
            print(f"⚠️  Missing optional variables: {', '.join(missing_optional)}")
            print("   (These are needed for full functionality)")
        
        # Check RAG variables
        rag_configured = True
        for var in rag_vars:
            if not os.getenv(var):
                rag_configured = False
        
        if rag_configured:
            print("✅ RAG endpoint configured")
        else:
            print("⚠️  RAG endpoint not configured - will use fallback responses")
        
        return True
    else:
        print("❌ .env file not found")
        return False

def test_directories():
    """Test required directories"""
    print("\n📁 Testing directories...")
    directories = [
        'static/audio',
        'static/models',
        'static/animations',
        'data',
        'templates',
        'services'
    ]
    
    all_good = True
    for directory in directories:
        if os.path.exists(directory):
            print(f"✅ {directory}/")
        else:
            print(f"❌ {directory}/ - Missing")
            all_good = False
    
    return all_good

def test_files():
    """Test required files"""
    print("\n📄 Testing files...")
    files = [
        'app.py',
        'requirements.txt',
        'templates/index.html',
        'static/app.js',
        'static/styles.css',
        'services/whisper_service.py',
        'services/rag_service.py'
    ]
    
    all_good = True
    for file in files:
        if os.path.exists(file):
            print(f"✅ {file}")
        else:
            print(f"❌ {file} - Missing")
            all_good = False
    
    return all_good

def test_rag_endpoint():
    """Test RAG endpoint connectivity"""
    print("\n🔗 Testing RAG endpoint...")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    rag_url = os.getenv('RAG_ENDPOINT_URL')
    if not rag_url:
        print("⚠️  RAG_ENDPOINT_URL not configured")
        return True  # Not a failure, just not configured
    
    try:
        # Import and test RAG service
        from services.rag_service import RAGService
        rag_service = RAGService()
        
        if rag_service.test_rag_endpoint():
            print("✅ RAG endpoint is accessible")
            return True
        else:
            print("❌ RAG endpoint is not accessible")
            return False
            
    except Exception as e:
        print(f"❌ Error testing RAG endpoint: {e}")
        return False

def test_server():
    """Test if server can start"""
    print("\n🚀 Testing server startup...")
    try:
        import subprocess
        import time
        
        # Start server in background
        process = subprocess.Popen([sys.executable, 'app.py'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        
        # Wait a bit for server to start
        time.sleep(3)
        
        # Test health endpoint
        try:
            response = requests.get('http://localhost:5000/api/health', timeout=5)
            if response.status_code == 200:
                print("✅ Server started successfully")
                health_data = response.json()
                print(f"✅ Health endpoint: {health_data['status']}")
                
                # Check RAG endpoint status in health response
                if 'rag_endpoint' in health_data:
                    rag_status = health_data['rag_endpoint']['status']
                    rag_url = health_data['rag_endpoint']['url']
                    print(f"✅ RAG endpoint status: {rag_status}")
                    if rag_url != 'Not configured':
                        print(f"✅ RAG endpoint URL: {rag_url}")
                
                # Test RAG endpoint via API
                try:
                    rag_response = requests.get('http://localhost:5000/api/test-rag', timeout=5)
                    if rag_response.status_code == 200:
                        print("✅ RAG endpoint API test passed")
                    else:
                        print(f"⚠️  RAG endpoint API test failed: {rag_response.status_code}")
                except Exception as e:
                    print(f"⚠️  RAG endpoint API test error: {e}")
                
                # Stop server
                process.terminate()
                process.wait()
                return True
            else:
                print(f"❌ Health endpoint returned status {response.status_code}")
                process.terminate()
                process.wait()
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Could not connect to server: {e}")
            process.terminate()
            process.wait()
            return False
            
    except Exception as e:
        print(f"❌ Error testing server: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 AI VRM Chat - Setup Test")
    print("=" * 40)
    
    tests = [
        ("Python Version", test_python_version),
        ("Dependencies", test_dependencies),
        ("Environment File", test_env_file),
        ("Directories", test_directories),
        ("Files", test_files),
        ("RAG Endpoint", test_rag_endpoint),
        ("Server", test_server)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Error in {test_name}: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 40)
    print("📊 TEST SUMMARY")
    print("=" * 40)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your setup is ready.")
        print("\nTo start the application:")
        print("  python run.py")
        print("  # or")
        print("  python app.py")
    else:
        print("⚠️  Some tests failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("  1. Install dependencies: pip install -r requirements.txt")
        print("  2. Create .env file: cp env.example .env")
        print("  3. Add API keys to .env file")
        print("  4. Configure RAG endpoint URL and API key")
        print("  5. Create missing directories")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 