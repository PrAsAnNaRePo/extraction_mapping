import requests
import os
import json
import base64
from PIL import Image
import io
from pathlib import Path

# Configuration
BASE_URL = "http://0.0.0.0:3002"  # Update port if needed
TEST_IMAGE_PATH = "/home/prasanna/Downloads/table_sample.png"  # Update with your test image path
TEST_PDF_PATH = "/home/prasanna/Downloads/MH-2 PRESSURE REDUCING VALVE;S.NO.489.pdf"  # Update with your test PDF path

def test_extract_tables_endpoint():
    """Test the dedicated table extraction endpoint."""
    print("\n🔍 Testing Table Extraction Endpoint...")
    
    # Check if test file exists
    if not os.path.exists(TEST_IMAGE_PATH):
        print(f"❌ Test failed: Test image file not found at {TEST_IMAGE_PATH}")
        print(f"Please update TEST_IMAGE_PATH in the script to point to an image with tables.")
        return False
    
    try:
        # Prepare the file for upload
        with open(TEST_IMAGE_PATH, 'rb') as image_file:
            files = {'file': (os.path.basename(TEST_IMAGE_PATH), image_file, 'image/png')}
            data = {
                'file_name': os.path.basename(TEST_IMAGE_PATH),
                'page_num': 1
            }
            
            # Make request to /extract-tables endpoint
            response = requests.post(f"{BASE_URL}/extract-tables", files=files, data=data)
            
            # Check response
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Table extraction succeeded:")
                print(f"   - Number of tables detected: {result['num_tables']}")
                
                # Print detected table bounding boxes
                print(f"   - Table bounding boxes:")
                for i, bbox_data in enumerate(result['bbox_data']):
                    print(f"     Table {i+1}: Class ID: {bbox_data['class_id']}, XYXY: {bbox_data['xyxy']}")
                
                # Print HTML output for tables
                print(f"   - HTML Table output:")
                for i, table_html in enumerate(result['tables']):
                    print(f"\n     Table {i+1} HTML (first 300 chars):")
                    print(f"     {table_html[:300]}...")
                
                # Print token usage
                print(f"   - API usage:")
                print(f"     Input tokens: {result['usage']['input_tokens']}")
                print(f"     Output tokens: {result['usage']['output_tokens']}")
                
                return True
            else:
                print(f"❌ Test failed: Server returned status code {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def test_ocr_with_table_extraction():
    """Test the OCR endpoint with table extraction."""
    print("\n🔍 Testing OCR Endpoint with Table Extraction...")
    
    # Check if test file exists
    if not os.path.exists(TEST_IMAGE_PATH):
        print(f"❌ Test failed: Test image file not found at {TEST_IMAGE_PATH}")
        return False
    
    try:
        # Prepare the file for upload
        with open(TEST_IMAGE_PATH, 'rb') as image_file:
            files = {'file': (os.path.basename(TEST_IMAGE_PATH), image_file, 'image/png')}
            
            # Make request to /ocr endpoint
            response = requests.post(f"{BASE_URL}/ocr", files=files)
            
            # Check response
            if response.status_code == 200:
                result = response.json()
                print(f"✅ OCR with table extraction succeeded:")
                
                # Print OCR results
                ocr_results = result['results']
                total_text_lines = sum(len(data['text_lines']) for data in ocr_results)
                print(f"   - Total text lines detected: {total_text_lines}")
                
                # Print first few text lines as example
                if total_text_lines > 0:
                    print("   - Sample text lines:")
                    for i, line in enumerate(ocr_results[0]['text_lines'][:3]):
                        print(f"     {i+1}. {line['text']} (confidence: {line['confidence']:.2f})")
                
                # Print table information
                table_data = result['tables']['bbox_data']
                table_html = result['tables']['html']
                print(f"   - Number of tables detected: {len(table_data)}")
                
                # Print HTML output for tables
                if table_html:
                    print(f"   - HTML Table output:")
                    for i, html in enumerate(table_html):
                        print(f"\n     Table {i+1} HTML (first 300 chars):")
                        print(f"     {html[:300]}...")
                
                return True
            else:
                print(f"❌ Test failed: Server returned status code {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def test_process_pdf_with_tables():
    """Test the PDF processing endpoint with table extraction."""
    print("\n🔍 Testing PDF Processing Endpoint with Table Extraction...")
    
    # Check if test file exists
    if not os.path.exists(TEST_PDF_PATH):
        print(f"❌ Test failed: Test PDF file not found at {TEST_PDF_PATH}")
        return False
    
    try:
        # Prepare the file for upload
        with open(TEST_PDF_PATH, 'rb') as pdf_file:
            files = {'file': (os.path.basename(TEST_PDF_PATH), pdf_file, 'application/pdf')}
            data = {'page_selection': '1'}  # Process just the first page for speed
            
            # Make request to /process-pdf endpoint
            response = requests.post(f"{BASE_URL}/process-pdf", files=files, data=data)
            
            # Check response
            if response.status_code == 200:
                result = response.json()
                print(f"✅ PDF processing with table extraction succeeded:")
                print(f"   - Total pages in PDF: {result['total_pages']}")
                print(f"   - Processed pages: {len(result['processed_pages'])}")
                
                # Print details for each processed page
                for page_result in result['processed_pages']:
                    page_num = page_result['page']
                    ocr_data = page_result['ocr_data']
                    tables = page_result['tables']
                    
                    total_text_lines = sum(len(data['text_lines']) for data in ocr_data)
                    print(f"\n   Page {page_num}:")
                    print(f"   - Total text lines detected: {total_text_lines}")
                    
                    # Print first few text lines as example
                    if total_text_lines > 0:
                        print("   - Sample text lines:")
                        for i, line in enumerate(ocr_data[0]['text_lines'][:3]):
                            print(f"     {i+1}. {line['text']} (confidence: {line['confidence']:.2f})")
                    
                    # Print table information
                    table_data = tables['bbox_data']
                    table_html = tables['html']
                    print(f"   - Number of tables detected: {len(table_data)}")
                    
                    # Print table bounding boxes
                    for i, bbox in enumerate(table_data):
                        print(f"     Table {i+1}: Class ID: {bbox['class_id']}, XYXY: {bbox['xyxy']}")
                    
                    # Print HTML output for tables
                    if table_html:
                        print(f"   - HTML Table output:")
                        for i, html in enumerate(table_html):
                            print(f"\n     Table {i+1} HTML (first 300 chars):")
                            print(f"     {html[:300]}...")
                
                return True
            else:
                print(f"❌ Test failed: Server returned status code {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

def create_test_image_if_needed():
    """Create a simple test image with a table if the test file doesn't exist."""
    if os.path.exists(TEST_IMAGE_PATH):
        return
        
    print(f"\n🔍 Test image not found. You need to provide a test image with tables at {TEST_IMAGE_PATH}.")
    print(f"Please update TEST_IMAGE_PATH in the script to point to an image with tables.")

def main():
    """Run all tests."""
    print("🚀 Starting Table Extraction API Tests...")
    
    # Create test image if needed
    create_test_image_if_needed()
    
    # Track test results
    results = {
        "Extract Tables Endpoint": test_extract_tables_endpoint(),
        "OCR with Table Extraction": test_ocr_with_table_extraction(),
        "Process PDF with Tables": test_process_pdf_with_tables()
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