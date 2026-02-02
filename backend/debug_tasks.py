import mediapipe as mp
print("Imported mediapipe")

try:
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    print("Successfully imported mediapipe.tasks.python.vision")
    
    PoseLandmarker = vision.PoseLandmarker
    print("Found PoseLandmarker class")
except ImportError as e:
    print(f"Failed import: {e}")
except AttributeError as e:
    print(f"Failed attribute: {e}")
