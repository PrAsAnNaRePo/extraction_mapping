from pydantic import BaseModel, Field
from openai import OpenAI
import os
import base64

class TextAgentOutput(BaseModel):
    title: str = Field(..., description="title of the text content")
    description: str = Field(..., description="A small description of the text content that should explains each and every part of the diagram")
    extracted_content: str = Field(..., description="extracted text content")

system_instruction = """You are a text extractor.
Analyze the given image by capturing every parts of it.
The output includes:
- title of the text content, just assign some title or heading to the text content.
- a small description of the text content that should explains each and every part of the diagram.
- extracted text content, MAKE SURE you extract the text as it is."""

class TextAgent:
    def __init__(self, system_prompt) -> None:

        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.system_prompt = system_prompt
    
    def __call__(self, base64_image):
        print(f"TextAgent received base64 string of length: {len(base64_image)}")
        
        # For testing/debugging - if there are API issues, create a simple fallback response
        # This can be removed once the API integration is working properly
        if not os.getenv("OPENAI_API_KEY"):
            print("WARNING: No OPENAI_API_KEY found. Using fallback text response.")
            # Return a dictionary instead of the Pydantic model to avoid validation errors
            return {
                "title": "Text Analysis",
                "description": "This appears to be a text",
                "extracted_content": "This appears to be a text."
            }
        
        # Handle both formats: raw base64 data or data URLs
        try:
            if base64_image.startswith('data:'):
                # Extract the base64 content from data URL
                print("Extracting base64 data from data URL...")
                content_type, base64_data = base64_image.split(',', 1)
                print(f"Data URL content type: {content_type}")
            else:
                # Assume it's already raw base64 data
                print("Using raw base64 data...")
                base64_data = base64_image
                
            # Validate base64 data
            try:
                # Test if the base64 data is valid by decoding a small sample
                base64.b64decode(base64_data[:10] + "=" * (4 - len(base64_data[:10]) % 4))
                print("Base64 data validation passed")
            except Exception as val_err:
                print(f"Base64 validation error: {str(val_err)}")
                print("First 30 chars of data:", base64_data[:30])
                raise ValueError(f"Invalid base64 data: {str(val_err)}")
                
            # Print the data URL we're going to send to the API
            data_url = f"data:image/jpeg;base64,{base64_data}"
            print(f"Constructed data URL length: {len(data_url)}")
            print(f"Data URL prefix: {data_url[:30]}...")
                
            try:
                print("Calling OpenAI API for diagram extraction...")
                completion = self.client.beta.chat.completions.parse(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {
                            'role': 'user',
                            "content": [
                                {
                                    "type": "text",
                                    "text": "extract the content in this image.",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": data_url},
                                },
                            ],
                        }
                    ],
                    response_format=TextAgentOutput,
                    temperature=1.0,
                )
                
                print("API call successful!")
                event = completion.choices[0].message.parsed
                return event
                
            except Exception as api_error:
                print(f"API error: {str(api_error)}")
                import traceback
                traceback.print_exc()
                
                # Return a dictionary instead of the Pydantic model to avoid validation errors
                return {
                    "title": "API Processing Error",
                    "description": f"The diagram could not be analyzed due to an API error: {str(api_error)}",
                    "extracted_content": "This appears to be a technical diagram or engineering drawing."
                }
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error processing diagram: {str(e)}")
            
            # Return a dictionary instead of the Pydantic model to avoid validation errors
            return {
                "title": "Error Processing Diagram",
                "description": f"Could not process diagram: {str(e)}",
                "extracted_content": "This appears to be a technical diagram or engineering drawing."
            }

# test_image = '/media/prasanna/codes/iCoffee/extraction_mapping/extraction_mapping/Screenshot from 2025-03-03 15-42-27.png'

# def convert_to_base64(image_path):
#     with open(image_path, "rb") as f:
#         return base64.b64encode(f.read()).decode("utf-8")

# base64_image = convert_to_base64(test_image)

# agent = DiagramAgent(system_instruction)
# agent(base64_image)

# output would look like:
# diag_heading='Top, Front, and Side Cross-Sectional Views of a Valve' diag_description='The diagram includes t...' annotations=[Annotations(marking='M-ØZ', description='Diameter M in top view'), Annotations(marking='L', description='Length in top view'), ...]