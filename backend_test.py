#!/usr/bin/env python3
"""
75 Hard Tracker API Testing Script
Tests all the core functionality of the 75 Hard Challenge tracker backend.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend .env
BASE_URL = "https://challenge75-1.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def log_pass(self, test_name):
        print(f"✅ PASS: {test_name}")
        self.passed += 1
    
    def log_fail(self, test_name, error):
        print(f"❌ FAIL: {test_name} - {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*50}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.errors:
            print("\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*50}")
        return self.failed == 0

def test_health_check():
    """Test basic health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            results.log_pass("Health check")
            return True
        else:
            results.log_fail("Health check", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("Health check", f"Connection error: {str(e)}")
        return False

def test_get_today_initial():
    """Test GET /api/today to initialize the day"""
    try:
        response = requests.get(f"{BASE_URL}/today", timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Verify structure
            required_fields = ['date', 'tasks', 'day_number', 'is_completed']
            for field in required_fields:
                if field not in data:
                    results.log_fail("GET /today structure", f"Missing field: {field}")
                    return None
            
            # Verify tasks structure
            expected_tasks = ['diet', 'workout_1', 'workout_2', 'water', 'reading', 'no_alcohol', 'photo_logged']
            for task in expected_tasks:
                if task not in data['tasks']:
                    results.log_fail("GET /today tasks", f"Missing task: {task}")
                    return None
            
            results.log_pass("GET /today - Initialize day")
            return data
        else:
            results.log_fail("GET /today", f"Status code: {response.status_code}")
            return None
    except Exception as e:
        results.log_fail("GET /today", f"Error: {str(e)}")
        return None

def test_toggle_tasks():
    """Test PUT /api/log/task to toggle tasks"""
    tasks_to_toggle = [
        {"task_id": "diet", "completed": True},
        {"task_id": "water", "completed": True},
        {"task_id": "reading", "completed": True}
    ]
    
    for task_update in tasks_to_toggle:
        try:
            response = requests.put(
                f"{BASE_URL}/log/task",
                json=task_update,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code == 200:
                results.log_pass(f"Toggle task {task_update['task_id']}")
            else:
                results.log_fail(f"Toggle task {task_update['task_id']}", f"Status code: {response.status_code}")
                return False
        except Exception as e:
            results.log_fail(f"Toggle task {task_update['task_id']}", f"Error: {str(e)}")
            return False
    
    return True

def test_verify_log_updated():
    """Verify the log is updated after toggling tasks"""
    try:
        response = requests.get(f"{BASE_URL}/today", timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Check if the tasks we toggled are now True
            expected_true_tasks = ['diet', 'water', 'reading']
            for task in expected_true_tasks:
                if not data['tasks'].get(task, False):
                    results.log_fail("Verify log updated", f"Task {task} not updated to True")
                    return False
            
            results.log_pass("Verify log updated")
            return True
        else:
            results.log_fail("Verify log updated", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("Verify log updated", f"Error: {str(e)}")
        return False

def test_complete_day_should_fail():
    """Test POST /api/complete_day (should fail because not all tasks done)"""
    try:
        response = requests.post(f"{BASE_URL}/complete_day", timeout=10)
        if response.status_code == 400:
            results.log_pass("Complete day (should fail)")
            return True
        else:
            results.log_fail("Complete day (should fail)", f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("Complete day (should fail)", f"Error: {str(e)}")
        return False

def test_complete_all_tasks():
    """Complete all remaining tasks and upload photo"""
    # First, complete remaining tasks
    remaining_tasks = [
        {"task_id": "workout_1", "completed": True},
        {"task_id": "workout_2", "completed": True},
        {"task_id": "no_alcohol", "completed": True}
    ]
    
    for task_update in remaining_tasks:
        try:
            response = requests.put(
                f"{BASE_URL}/log/task",
                json=task_update,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            if response.status_code != 200:
                results.log_fail(f"Complete task {task_update['task_id']}", f"Status code: {response.status_code}")
                return False
        except Exception as e:
            results.log_fail(f"Complete task {task_update['task_id']}", f"Error: {str(e)}")
            return False
    
    # Upload dummy photo
    try:
        photo_data = {"image_base64": "dummy"}
        response = requests.post(
            f"{BASE_URL}/log/photo",
            json=photo_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if response.status_code == 200:
            results.log_pass("Upload dummy photo")
            return True
        else:
            results.log_fail("Upload dummy photo", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("Upload dummy photo", f"Error: {str(e)}")
        return False

def test_complete_day_should_succeed():
    """Test POST /api/complete_day (should succeed now)"""
    try:
        response = requests.post(f"{BASE_URL}/complete_day", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'day_completed':
                results.log_pass("Complete day (should succeed)")
                return data
            else:
                results.log_fail("Complete day (should succeed)", f"Unexpected response: {data}")
                return None
        else:
            results.log_fail("Complete day (should succeed)", f"Status code: {response.status_code}")
            return None
    except Exception as e:
        results.log_fail("Complete day (should succeed)", f"Error: {str(e)}")
        return None

def test_verify_next_day():
    """Verify GET /api/today shows next day or completion status"""
    try:
        response = requests.get(f"{BASE_URL}/today", timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Should be day 2 now
            if data.get('day_number') == 2:
                results.log_pass("Verify next day (Day 2)")
                return True
            else:
                results.log_fail("Verify next day", f"Expected day 2, got day {data.get('day_number')}")
                return False
        else:
            results.log_fail("Verify next day", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("Verify next day", f"Error: {str(e)}")
        return False

def test_reset_progress():
    """Test POST /api/reset and verify back to Day 1"""
    try:
        # Reset progress
        response = requests.post(f"{BASE_URL}/reset", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'reset_successful' and data.get('current_day') == 1:
                results.log_pass("Reset progress")
                
                # Verify we're back to Day 1
                response = requests.get(f"{BASE_URL}/today", timeout=10)
                if response.status_code == 200:
                    today_data = response.json()
                    if today_data.get('day_number') == 1:
                        results.log_pass("Verify reset to Day 1")
                        return True
                    else:
                        results.log_fail("Verify reset to Day 1", f"Expected day 1, got day {today_data.get('day_number')}")
                        return False
                else:
                    results.log_fail("Verify reset to Day 1", f"Status code: {response.status_code}")
                    return False
            else:
                results.log_fail("Reset progress", f"Unexpected response: {data}")
                return False
        else:
            results.log_fail("Reset progress", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("Reset progress", f"Error: {str(e)}")
        return False

def run_all_tests():
    """Run all tests in sequence"""
    print("🚀 Starting 75 Hard Tracker API Tests")
    print(f"Testing against: {BASE_URL}")
    print("="*50)
    
    # Test sequence as requested
    if not test_health_check():
        print("❌ Health check failed - aborting tests")
        return False
    
    # 1. Initialize the day
    initial_data = test_get_today_initial()
    if not initial_data:
        print("❌ Failed to initialize day - aborting tests")
        return False
    
    # 2. Toggle a few tasks
    if not test_toggle_tasks():
        print("❌ Failed to toggle tasks - aborting tests")
        return False
    
    # 3. Verify the log is updated
    if not test_verify_log_updated():
        print("❌ Failed to verify log updates - aborting tests")
        return False
    
    # 4. Try to complete day (should fail)
    if not test_complete_day_should_fail():
        print("❌ Complete day test failed - aborting tests")
        return False
    
    # 5. Complete all tasks and upload photo
    if not test_complete_all_tasks():
        print("❌ Failed to complete all tasks - aborting tests")
        return False
    
    # 6. Complete day (should succeed)
    complete_data = test_complete_day_should_succeed()
    if not complete_data:
        print("❌ Failed to complete day - aborting tests")
        return False
    
    # 7. Verify next day
    if not test_verify_next_day():
        print("❌ Failed to verify next day - aborting tests")
        return False
    
    # 8. Reset and verify back to Day 1
    if not test_reset_progress():
        print("❌ Failed to reset progress - aborting tests")
        return False
    
    return True

if __name__ == "__main__":
    results = TestResults()
    
    success = run_all_tests()
    
    # Print final summary
    all_passed = results.summary()
    
    if all_passed:
        print("\n🎉 All tests passed! 75 Hard Tracker API is working correctly.")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed. Check the errors above.")
        sys.exit(1)