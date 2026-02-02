import sys
import mediapipe
print(f"Python version: {sys.version}")
print(f"MediaPipe version: {mediapipe.__version__}")
print(f"MediaPipe file: {mediapipe.__file__}")
print(f"Dir(mediapipe): {dir(mediapipe)}")

try:
    import mediapipe.solutions
    print("Successfully imported mediapipe.solutions")
except ImportError as e:
    print(f"Failed to import mediapipe.solutions: {e}")

try:
    print(f"mp.solutions: {mediapipe.solutions}")
except AttributeError as e:
    print(f"AttributeError accessing solutions: {e}")
