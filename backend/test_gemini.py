import os
from dotenv import load_dotenv
import httpx
import asyncio

load_dotenv()
api_key = os.getenv("API_Key")

async def main():
    payload = {
        "contents": [{
            "parts": [
                {"text": "Hello, this is a test."}
            ]
        }],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json=payload,
        )
        print(response.status_code)

if __name__ == "__main__":
    asyncio.run(main())
