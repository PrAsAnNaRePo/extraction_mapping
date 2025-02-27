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
        code_blocks = re.findall(r'<final>\n<table(.*?)</final>', content, re.DOTALL)
        if code_blocks:
            # Add proper table tags and ensure </table> tag is included
            processed_blocks = []
            for block in code_blocks:
                # Check if the block already ends with </table>
                if block.strip().endswith('</table>'):
                    processed_blocks.append('<table' + block)
                else:
                    processed_blocks.append('<table' + block + '</table>')
            code_blocks = processed_blocks
            
        print(f"Extracted table HTML blocks: {code_blocks}")
        return code_blocks
    
    def extract_table(self, base64_image, file_name, page_num):
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
                        "data": base64_image,
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
        return self.extract_code(response.content[0].text), response.usage
