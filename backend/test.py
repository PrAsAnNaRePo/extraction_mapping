import requests
import os
from pathlib import Path

# Configuration
BASE_URL = "http://0.0.0.0:3002"  # Update port if needed
TEST_PDF_PATH = "/home/prasanna/Downloads/MH-2 PRESSURE REDUCING VALVE;S.NO.489.pdf"  # Update with your test PDF path

def test_pdf_info():
    """Test the PDF info endpoint."""
    print("\n🔍 Testing PDF Info Endpoint...")
    
    # Check if test file exists
    if not os.path.exists(TEST_PDF_PATH):
        print(f"❌ Test failed: Test PDF file not found at {TEST_PDF_PATH}")
        return False
    
    try:
        # Prepare the file for upload
        with open(TEST_PDF_PATH, 'rb') as pdf_file:
            files = {'file': (TEST_PDF_PATH, pdf_file, 'application/pdf')}
            
            # Make request to /pdf-info endpoint
            response = requests.post(f"{BASE_URL}/pdf-info", files=files)
            
            # Check response
            if response.status_code == 200:
                result = response.json()
                print(f"✅ PDF Info retrieved successfully:")
                print(f"   - Total pages: {result['total_pages']}")
                print(f"   - File name: {result['file_name']}")
                return True
            else:
                print(f"❌ Test failed: Server returned status code {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def test_process_pdf(page_selection="1-3"):
    """Test the PDF processing endpoint."""
    print(f"\n🔍 Testing PDF Processing Endpoint (pages: {page_selection})...")
    
    # Check if test file exists
    if not os.path.exists(TEST_PDF_PATH):
        print(f"❌ Test failed: Test PDF file not found at {TEST_PDF_PATH}")
        return False
    
    try:
        # Prepare the file and form data for upload
        with open(TEST_PDF_PATH, 'rb') as pdf_file:
            files = {'file': (TEST_PDF_PATH, pdf_file, 'application/pdf')}
            data = {'page_selection': page_selection}
            
            # Make request to /process-pdf endpoint
            response = requests.post(f"{BASE_URL}/process-pdf", files=files, data=data)
            
            # Check response
            if response.status_code == 200:
                result = response.json()
                print(f"✅ PDF processed successfully:")
                print(f"   - Total pages in PDF: {result['total_pages']}")
                print(f"   - Processed pages: {len(result['processed_pages'])}")
                
                # Print details for each processed page
                for page_result in result['processed_pages']:
                    page_num = page_result['page']
                    ocr_data = page_result['ocr_data']
                    total_text_lines = sum(len(data['text_lines']) for data in ocr_data)
                    print(f"\n   Page {page_num}:")
                    print(f"   - Total text lines detected: {total_text_lines}")
                    
                    # Print first few text lines as example
                    if total_text_lines > 0:
                        print("   - Sample text lines:")
                        for i, line in enumerate(ocr_data[0]['text_lines'][:3]):
                            print(f"     {i+1}. {line['text']} (confidence: {line['confidence']:.2f})")
                return True
            else:
                print(f"❌ Test failed: Server returned status code {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def test_invalid_page_selection():
    """Test the PDF processing endpoint with invalid page selections."""
    print("\n🔍 Testing Invalid Page Selections...")
    
    test_cases = [
        "",  # Empty
        "0",  # Invalid page number
        "1,2,999999",  # Page number out of range
        "abc",  # Invalid format
        "1-3-5",  # Invalid range format
    ]
    
    success = True
    for test_case in test_cases:
        print(f"\nTesting page selection: '{test_case}'")
        try:
            with open(TEST_PDF_PATH, 'rb') as pdf_file:
                files = {'file': (TEST_PDF_PATH, pdf_file, 'application/pdf')}
                data = {'page_selection': test_case}
                
                response = requests.post(f"{BASE_URL}/process-pdf", files=files, data=data)
                
                if response.status_code == 400:
                    print(f"✅ Correctly rejected invalid input")
                    print(f"   Error: {response.json()['detail']}")
                else:
                    print(f"❌ Test failed: Expected 400 status code, got {response.status_code}")
                    success = False
                    
        except Exception as e:
            print(f"❌ Test failed with error: {str(e)}")
            success = False
    
    return success

def main():
    """Run all tests."""
    print("🚀 Starting PDF Processing API Tests...")
    
    # Track test results
    results = {
        # "PDF Info": test_pdf_info(),
        "Process PDF (Range)": test_process_pdf("1-3"),
        "Process PDF (Single)": test_process_pdf("1"),
        "Process PDF (Multiple)": test_process_pdf("1,3,5"),
        # "Process PDF (All)": test_process_pdf("all"),
        "Invalid Page Selections": test_invalid_page_selection()
    }
    
    # Print summary
    print("\n📊 Test Summary:")
    for test_name, passed in results.items():
        status = "✅ Passed" if passed else "❌ Failed"
        print(f"{status} - {test_name}")
    
    # Overall result
    if all(results.values()):
        print("\n✨ All tests passed successfully!")
        return 0
    else:
        print("\n❌ Some tests failed. Please check the logs above.")
        return 1

if __name__ == "__main__":
    exit(main())