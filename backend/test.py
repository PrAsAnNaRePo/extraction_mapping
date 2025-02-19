import requests

url = "http://localhost:3002/ocr"

with open("/home/prasanna/Downloads/Screenshot 2025-02-19 092221.jpg", "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)
    print("Status code:", response.status_code)
    try:
        print("Response:", response.json())
    except Exception as e:
        print("Failed to parse JSON:", e)
        print("Response text:", response.text)
