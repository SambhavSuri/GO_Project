import os
import json
import time
import requests
from typing import List, Dict, Any

class RAGService:
    def __init__(self):
        self.rag_endpoint = os.getenv('RAG_ENDPOINT_URL')
        self.rag_api_key = os.getenv('RAG_API_KEY')
        self.conversation_history = []
        
        # Validate RAG endpoint configuration
        if not self.rag_endpoint:
            print("⚠️  Warning: RAG_ENDPOINT_URL not set. Using fallback responses.")
        else:
            print(f"✅ RAG endpoint configured: {self.rag_endpoint}")
    
    def process_query(self, query: str) -> str:
        """
        Process user query through external RAG endpoint
        """
        # Add to conversation history
        self.conversation_history.append({"role": "user", "content": query, "timestamp": time.time()})
        
        # Send to external RAG endpoint
        response = self._call_rag_endpoint(query)
        
        # Add response to conversation history
        self.conversation_history.append({"role": "assistant", "content": response, "timestamp": time.time()})
        
        return response
    
    def _call_rag_endpoint(self, query: str) -> str:
        """
        Call external RAG endpoint
        """
        if not self.rag_endpoint:
            return self._generate_fallback_response(query)
        
        try:
            # Prepare request payload
            payload = {
                "user_query": query,
                "history": self.conversation_history[-5:],  # Last 5 messages for context
                "response_mode": "summary",
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            # Prepare headers
            headers = {
                "Content-Type": "application/json"
            }
            
            # Add API key if provided
            if self.rag_api_key:
                headers["Authorization"] = f"Bearer {self.rag_api_key}"
            
            # Make request to RAG endpoint
            response = requests.post(
                self.rag_endpoint,
                json=payload,
                headers=headers,
                timeout=120  # 30 second timeout
            )
            
            # Check if request was successful
            if response.status_code == 200:
                try:
                    result = response.json()
                    
                    # Handle different response formats
                    if isinstance(result, dict):
                        # Try different possible response field names
                        if 'response' in result:
                            return result['response']
                        elif 'answer' in result:
                            return result['answer']
                        elif 'text' in result:
                            return result['text']
                        elif 'content' in result:
                            return result['content']
                        elif 'message' in result:
                            return result['message']
                        else:
                            # If no standard field, return the entire response as string
                            return str(result)
                    elif isinstance(result, str):
                        return result
                    else:
                        return str(result)
                        
                except json.JSONDecodeError:
                    # If response is not JSON, treat as plain text
                    return response.text
            else:
                print(f"❌ RAG endpoint error: {response.status_code} - {response.text}")
                return self._generate_fallback_response(query)
                
        except requests.exceptions.Timeout:
            print("❌ RAG endpoint timeout")
            return self._generate_fallback_response(query)
        except requests.exceptions.ConnectionError:
            print("❌ RAG endpoint connection error")
            return self._generate_fallback_response(query)
        except Exception as e:
            print(f"❌ RAG endpoint error: {e}")
            return self._generate_fallback_response(query)
    
    def _generate_fallback_response(self, query: str) -> str:
        """
        Generate fallback response when RAG endpoint is unavailable
        """
        fallback_responses = [
            f"I understand you're asking about '{query}'. Let me search my knowledge base for relevant information.",
            f"That's an interesting question about '{query}'. I'll need to look up more information about this topic.",
            f"I'm not sure I have specific information about '{query}' in my current knowledge base, but I'd be happy to help you find relevant resources.",
            f"Regarding '{query}', I don't have detailed information in my knowledge base yet, but I can help you explore this topic further.",
            f"I'm currently unable to access my knowledge base, but I'd be happy to help you with '{query}' based on my general knowledge."
        ]
        
        import random
        return random.choice(fallback_responses)
    
    def add_document(self, content: str, metadata: Dict[str, Any] = None) -> str:
        """
        Add a new document to the knowledge base via RAG endpoint
        """
        if not self.rag_endpoint:
            print("⚠️  Cannot add document: RAG endpoint not configured")
            return "error"
        
        try:
            # Prepare payload for document addition
            payload = {
                "action": "add_document",
                "content": content,
                "metadata": metadata or {"type": "user_added", "tags": []}
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            if self.rag_api_key:
                headers["Authorization"] = f"Bearer {self.rag_api_key}"
            
            response = requests.post(
                self.rag_endpoint,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                doc_id = result.get('document_id', 'unknown')
                print(f"✅ Document added successfully: {doc_id}")
                return doc_id
            else:
                print(f"❌ Failed to add document: {response.status_code}")
                return "error"
                
        except Exception as e:
            print(f"❌ Error adding document: {e}")
            return "error"
    
    def get_conversation_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent conversation history
        """
        return self.conversation_history[-limit:] if self.conversation_history else []
    
    def clear_conversation_history(self):
        """
        Clear conversation history
        """
        self.conversation_history = []
    
    def test_rag_endpoint(self) -> bool:
        """
        Test if RAG endpoint is working
        """
        if not self.rag_endpoint:
            return False
        
        try:
            test_payload = {
                "query": "test",
                "conversation_history": [],
                "max_tokens": 10,
                "temperature": 0.1
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            if self.rag_api_key:
                headers["Authorization"] = f"Bearer {self.rag_api_key}"
            
            response = requests.post(
                self.rag_endpoint,
                json=test_payload,
                headers=headers,
                timeout=10
            )
            
            return response.status_code == 200
            
        except Exception as e:
            print(f"❌ RAG endpoint test failed: {e}")
            return False 