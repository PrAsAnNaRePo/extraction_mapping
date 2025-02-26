import os
import io
import cv2
import numpy as np
import onnxruntime
import base64
from typing_extensions import List
from PIL import Image, ImageDraw
import json

class TableDetector: 
    def __init__(self, model_path, class_labels=None):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model path not found: {model_path}")
        
        try:
            self.session = onnxruntime.InferenceSession(model_path, providers=["CPUExecutionProvider"])
            print(f"Successfully loaded ONNX model from {model_path}")
        except Exception as e:
            raise RuntimeError(f"Failed to load the ONNX model: {e}")
        
        model_inputs = self.session.get_inputs()
        print("Model Inputs:", model_inputs)
        
        self.input_name = model_inputs[0].name
        self.input_shape = model_inputs[0].shape  # [batch_size, channels, height, width]
        self.input_height = self.input_shape[2]
        self.input_width = self.input_shape[3]

        self.classes = class_labels if class_labels else {0: 'tables', 1: 'tilted', 2: 'empty'}

    def preprocess(self, image):
        resized = cv2.resize(image, (self.input_width, self.input_height))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        normalized = rgb.astype(np.float32) / 255.0
        transposed = normalized.transpose(2, 0, 1)  # CHW format
        batched = np.expand_dims(transposed, axis=0)  # Add batch dimension
        return batched

    def detect_bbox(self, image1, confidence_threshold=0.35, iou_threshold=0.45):
        # Convert PIL Image to OpenCV format
        frame = cv2.cvtColor(np.array(image1), cv2.COLOR_RGB2BGR)
        original_height, original_width = frame.shape[:2]
        
        img2 = frame.copy()
        target_height, target_width = original_height, original_width
        scale_factor_x = scale_factor_y = 1
        
        preprocessed = self.preprocess(frame)
        print(f"Preprocessed shape: {preprocessed.shape}")
        
        outputs = self.session.run(None, {self.input_name: preprocessed})
        print(f"Model outputs: {outputs}") 
        
        # Postprocess the outputs to get bounding boxes
        obb_data = self.postprocess(outputs, img2, confidence_threshold, iou_threshold, scale_factor_x, scale_factor_y)

        _, buffer = cv2.imencode('.png', img2)
        base_img_string = base64.b64encode(buffer).decode('utf-8')

        response = {
            "bbox_data": obb_data,
            "actual_image": base_img_string,
            "height": int(img2.shape[0]),
            "width": int(img2.shape[1]),
            "num_tables": int(len(obb_data)),
        }
        return response

    def get_cropped_images(self, image: Image.Image, high_res_image: Image.Image) -> List[Image.Image]:
        # Perform inference on the input image to get the bounding boxes
        bbox_result = self.detect_bbox(image)
        bbox_data = bbox_result["bbox_data"]
        cropped_images = []

        # Get the dimensions of the input image and the high-resolution image
        input_width, input_height = image.size
        high_res_width, high_res_height = high_res_image.size

        # Calculate the scaling factors for width and height
        scale_x = high_res_width / input_width
        scale_y = high_res_height / input_height

        rotate_flag = False

        for bbox in bbox_data:
            # Get the bounding box coordinates
            x1, y1, x2, y2 = bbox["xyxy"]

            # Scale the bounding box coordinates to match the high-resolution image
            x1_scaled = int(x1 * scale_x)
            y1_scaled = int(y1 * scale_y)
            x2_scaled = int(x2 * scale_x)
            y2_scaled = int(y2 * scale_y)

            # Crop the high-resolution image using the scaled bounding box coordinates
            cropped_image = high_res_image.crop((x1_scaled-25, y1_scaled-25, x2_scaled+25, y2_scaled+25))

            # If the table is tilted, rotate the cropped image
            if bbox['class_id'] == 1:
                rotate_flag = True
                cropped_image = cropped_image.rotate(270, expand=True)

            # Append the cropped image to the list
            cropped_images.append(cropped_image)

        return cropped_images, rotate_flag

    def postprocess(self, outputs, img2, confidence_threshold, iou_threshold, scale_factor_x, scale_factor_y):
        img_height, img_width = img2.shape[:2]
        output_array = np.squeeze(outputs[0])

        if output_array.shape[0] < output_array.shape[1]:
            output_array = output_array.transpose()

        num_detections = output_array.shape[0]
        print(f"Number of detections before NMS: {num_detections}")  

        boxes = []
        scores = []
        class_ids = []

        # scaled based on model input size to img2
        x_factor = img_width / self.input_width
        y_factor = img_height / self.input_height

        for i in range(num_detections):
            row = output_array[i]
            objectness = row[4]
            class_scores = row[5:]
            class_id = int(np.argmax(class_scores)) 
            confidence = float(class_scores[class_id]) 

            if confidence >= confidence_threshold:
                x, y, width, height = row[0], row[1], row[2], row[3]
                x1 = int((x - width / 2) * x_factor)
                y1 = int((y - height / 2) * y_factor)
                w = int(width * x_factor)
                h = int(height * y_factor)
                
                boxes.append([x1, y1, w, h])
                scores.append(float(confidence))
                class_ids.append(int(class_id))
                
                print(f"Initial bbox {i}: Class ID={class_id}, Confidence={confidence}, Box={x1, y1, w, h}")  

        indices = cv2.dnn.NMSBoxes(boxes, scores, confidence_threshold, iou_threshold)
        print(f"Indices after NMS: {indices}")  

        obb_data = []

        if len(indices) > 0:
            if isinstance(indices[0], (list, tuple, np.ndarray)):
                indices = [i[0] for i in indices]
            else:
                indices = list(indices)
            
            for idx in indices:
                box = boxes[idx]
                class_id = class_ids[idx]
                confidence = scores[idx]
                
                x1, y1, w, h = box
                x2 = x1 + w
                y2 = y1 + h
                #if bbox coordinates -out of img boundary
                # x1 = max(0, x1)
                # y1 = max(0, y1)
                # x2 = min(x2, img_width)
                # y2 = min(y2, img_height)
    
                x = x1 + w / 2
                y = y1 + h / 2

                obb_data.append({
                    "class_id": class_id,
                    "xyxy": [x1, y1, x2, y2],
                    "xywh": [x, y, w, h]
                })

                
                # self.draw_detections(img2, box, confidence, class_id)
                print(f"Final bbox: class_id={class_id}, confidence={confidence}, bbox={x1, y1, x2, y2}")  
        else:
            print("No detections after NMS.")

        print(f"Number of detections after NMS: {len(obb_data)}")
        return obb_data

    def create_table_hidden_image(self, image: Image.Image) -> Image.Image:
        """Create a copy of the image with white rectangles over detected tables."""
        # Convert PIL Image to OpenCV format for detection
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Get table locations
        bbox_result = self.detect_bbox(image)
        bbox_data = bbox_result["bbox_data"]
        
        # Create a copy of the original PIL image
        img_copy = image.copy()
        draw = ImageDraw.Draw(img_copy)
        
        # Draw white rectangles over each table
        for bbox in bbox_data:
            x1, y1, x2, y2 = bbox["xyxy"]
            draw.rectangle([x1, y1, x2, y2], fill='white')
        
        return img_copy



























































































# module = TableDetector('dynamic_quantized_21.onnx')

# img = Image.open("cropped_image_1.png")

# cropped_images = module.get_cropped_images(img)
# print(cropped_images)

# # save all the cropped images
# for i, cropped_image in enumerate(cropped_images):
#     cropped_image.save(f"cropped_image_{i}.png")
