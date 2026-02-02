import os
import sys
from fastapi import HTTPException
from pydantic import BaseModel

# Mock env BEFORE importing main
os.environ["ALLOWED_USERS"] = "test@example.com, admin@gym.com"

# Adjust path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.main import is_allowed, register, login, UserRegister, UserLogin

def test_is_allowed_logic():
    print("--- Testing is_allowed Logic ---")
    assert is_allowed("test@example.com") == True
    assert is_allowed("Test@Example.com") == True # Case insensitive
    assert is_allowed("admin@gym.com") == True
    assert is_allowed("hacker@bad.com") == False
    assert is_allowed("") == False
    print("Logic checks passed!")

def test_endpoints_block():
    print("\n--- Testing Endpoint Blocking ---")
    
    # Test Register Blocking
    try:
        register(UserRegister(name="Hacker", email="hacker@bad.com", password="pwd"))
        print("FAIL: Register should have raised HTTPException")
    except HTTPException as e:
        print(f"PASS: Register blocked with {e.status_code}")
        assert e.status_code == 403

    # Test Login Blocking
    try:
        login(UserLogin(email="hacker@bad.com", password="pwd"))
        print("FAIL: Login should have raised HTTPException")
    except HTTPException as e:
        print(f"PASS: Login blocked with {e.status_code}")
        assert e.status_code == 403

    # Test Allowed (Expected to fail at DB step, not 403)
    print("\n--- Testing Allowed User (Expect DB Error or Success, NOT 403) ---")
    try:
        # We expect this to fail with DB error or succeed. 
        # If it raises 403, that's a fail.
        register(UserRegister(name="Good", email="test@example.com", password="pwd"))
    except HTTPException as e:
        if e.status_code == 403:
            print("FAIL: Allowed user was blocked 403!")
        else:
            print(f"PASS: Allowed user passed allowlist check (fail reason: {e.detail})")
    except Exception as e:
        print(f"PASS: Allowed user passed allowlist check (fail reason: {type(e).__name__})")

if __name__ == "__main__":
    test_is_allowed_logic()
    test_endpoints_block()
