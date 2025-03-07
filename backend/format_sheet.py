from pydantic import BaseModel, Field
from typing import Dict, Any, List, Literal, Union
from openai import OpenAI
from datetime import datetime

client = OpenAI()

class FieldRequest(BaseModel):
    content: str
    fields: Dict[str, str]

class FieldResult(BaseModel):
    value: Union[str, int, float, datetime, List[str]]
    confidence: float

class FieldExtractionResponse(BaseModel):
    fields: Dict[str, str]
    metadata: Dict[str, Any]

system_prompt = """
You are an expert in extracting and formatting data from engineering drawings and technical documents.
Your task is to extract specific fields from the provided content based on field descriptions and types.

For each field:
1. Extract the most relevant information based on the field description
2. Format the output according to the field type:
   - text: Extract as a descriptive text
   - number: Extract numerical values, including units if present (e.g., "150mm", "2.5kg")
   - date: Extract and standardize dates in ISO format (YYYY-MM-DD)
   - list: Extract as a comma-separated list of items
3. Provide a confidence score (0.0 to 1.0) for each extraction

Output format for each field:
{field_name}: {extracted_value} (Confidence: {score})

Confidence score guidelines:
- 0.9-1.0: Perfect match with high confidence
- 0.7-0.9: Good match with some context
- 0.5-0.7: Partial match or requires inference
- <0.5: Low confidence or uncertain match

If a field cannot be confidently extracted:
- Still provide the best possible match
- Include a low confidence score
- The extracted value should still match the required type

Focus on accuracy and maintaining proper data types.
"""

def extract_fields(content: str, fields: Dict[str, str]) -> Dict[str, str]:
    """Extract specified fields from content using GPT-4.
    
    Args:
        content: The text content to extract fields from
        fields: Dictionary mapping field names to their descriptions with type info
        
    Returns:
        Dictionary mapping field names to their extracted values with confidence
    """
    """Extract specified fields from content using GPT-4.
    
    Args:
        content: The text content to extract fields from
        fields: Dictionary mapping field names to their descriptions
        
    Returns:
        Dictionary mapping field names to their extracted values
    """
    try:
        # Format fields for prompt
        field_descriptions = '\n'.join(f"- {name}: {desc}" for name, desc in fields.items())
        
        # Extract field type from description
        field_types = {}
        for name, desc in fields.items():
            if '(Type: ' in desc:
                field_type = desc.split('(Type: ')[1].split(')')[0]
                field_types[name] = field_type
            else:
                field_types[name] = 'text'

        # Create extraction prompt
        prompt = f"""Please extract the following fields from the given content:

{field_descriptions}

Content:
{content}

For each field, provide the extracted value formatted according to its type.
"""

        # Call GPT-4
        response = client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )

        # Process response
        extracted_text = response.choices[0].message.content
        extracted_fields = {}

        # Parse the response into fields
        for line in extracted_text.split('\n'):
            line = line.strip()
            if not line or ':' not in line:
                continue

            # Try to match field and extract confidence
            for field_name in fields.keys():
                if line.startswith(f"{field_name}:"):
                    # Extract value and confidence
                    value_part = line.split(':', 1)[1].strip()
                    
                    # Extract confidence if present
                    confidence = 0.5  # Default confidence
                    if '(Confidence:' in value_part:
                        try:
                            confidence_str = value_part.split('(Confidence:', 1)[1].split(')')[0].strip()
                            confidence = float(confidence_str)
                            value_part = value_part.split('(Confidence:', 1)[0].strip()
                        except:
                            pass

                    # Get field type
                    field_type = field_types.get(field_name, 'text')
                    
                    # Format value based on type
                    try:
                        if field_type == 'number':
                            # Extract first number with optional unit
                            match = re.search(r'([\d,.]+)\s*([a-zA-Z°]*)', value_part)
                            if match:
                                num, unit = match.groups()
                                num = float(num.replace(',', ''))
                                value_part = f"{num:,.2f}{unit}"
                        elif field_type == 'date':
                            # Try to parse and format date
                            try:
                                date_formats = ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%B %d, %Y']
                                for fmt in date_formats:
                                    try:
                                        date_obj = datetime.strptime(value_part, fmt)
                                        value_part = date_obj.strftime('%Y-%m-%d')
                                        break
                                    except:
                                        continue
                            except:
                                pass
                        elif field_type == 'list':
                            # Ensure proper list formatting
                            items = [item.strip() for item in value_part.split(',')]
                            value_part = ', '.join(filter(None, items))
                    except:
                        pass  # Keep original value if formatting fails

                    # Store the formatted value with type and confidence
                    extracted_fields[field_name] = f"{value_part} (Type: {field_type}, Confidence: {confidence:.2f})"

        return extracted_fields

    except Exception as e:
        print(f"Error extracting fields: {str(e)}")
        return {}