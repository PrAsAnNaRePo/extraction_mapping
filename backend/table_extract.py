from datetime import datetime
import json
import os
import re
import anthropic
import base64
from dotenv import load_dotenv
import cv2
import numpy as np

load_dotenv()

class TOCRAgent:
    def __init__(self, system_prompt) -> None:
        self.client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        self.system_prompt = system_prompt

    def extract_code(self, content):
        code_blocks = re.findall(r'<final>(.*?)</final>', content, re.DOTALL)
        if code_blocks:
            title = code_blocks[0].split('<title>')[1].split('</title>')[0]
            description = code_blocks[0].split('<description>')[1].split('</description>')[0]
            html = '<table>' + code_blocks[0].split('<table>')[1].split('</table>')[0].strip() + '</table>'
            return {
                'title': title,
                'description': description,
                'html': html
            }
        else:
            return None
    
    def extract_table(self, base64_image):
        # Handle both formats: raw base64 data or data URLs
        if base64_image.startswith('data:'):
            # Extract the base64 content from data URL
            content_type, base64_data = base64_image.split(',', 1)
        else:
            # Assume it's already raw base64 data
            base64_data = base64_image
            
        try:
            msg = []
            msg.append(
                {
                    'role': 'user',
                    'content': [
                        {
                            "type": "text",
                            "text": "Extract the table step by step."
                        },
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": base64_data,
                            },
                        }
                    ]
                }
            )
        
            response = self.client.messages.create(
                model="claude-3-7-sonnet-latest",
                messages=msg,
                max_tokens=16000,
                system=self.system_prompt,
                temperature=0,
            )
            
            print(response.content[0].text)
            extracted_code = self.extract_code(response.content[0].text)
            print(extracted_code)
            return extracted_code, response.usage
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error in table extraction: {str(e)}")
            # Return a basic fallback HTML 
            table_html = ["<table><tr><td>Error extracting table: {}</td></tr></table>".format(str(e))]
            return table_html, {"input_tokens": 0, "output_tokens": 0}
