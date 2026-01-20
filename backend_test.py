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
            # The issue: since we're on the same calendar date, the day_number doesn't increment
            # This is a design issue - the API should either:
            # 1. Update the existing log's day_number when state increments, OR
            # 2. Use a different mechanism for tracking challenge days vs calendar days
            
            if data.get('day_number') == 2:
                results.log_pass("Verify next day (Day 2)")
                return True
            elif data.get('day_number') == 1 and data.get('is_completed') == True:
                # This is the actual behavior - same calendar day, so day_number stays 1
                results.log_fail("Verify next day", "Backend design issue: day_number not updated after completion on same calendar date")
                return False
            else:
                results.log_fail("Verify next day", f"Unexpected state: day {data.get('day_number')}, completed: {data.get('is_completed')}")
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
                        
                        # Check if tasks are reset (this might fail due to backend bug)
                        all_tasks_false = all(not task for task in today_data['tasks'].values())
                        if all_tasks_false:
                            results.log_pass("Verify tasks reset to false")
                        else:
                            results.log_fail("Verify tasks reset to false", "Tasks not reset - backend bug: reset should clear all tasks")
                        
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

def test_history_endpoint():
    """Test GET /api/history endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/history", timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Verify it's a list
            if not isinstance(data, list):
                results.log_fail("GET /history", f"Expected list, got {type(data)}")
                return False
            
            results.log_pass(f"GET /history - returned {len(data)} logs")
            
            # If we have logs, verify structure
            if len(data) > 0:
                first_log = data[0]
                required_fields = ['date', 'tasks', 'day_number', 'is_completed']
                for field in required_fields:
                    if field not in first_log:
                        results.log_fail("GET /history structure", f"Missing field: {field}")
                        return False
                
                # Verify photo_base64 is excluded
                if 'photo_base64' in first_log:
                    results.log_fail("GET /history structure", "photo_base64 should be excluded")
                    return False
                
                results.log_pass("GET /history - structure correct")
            
            return True
        else:
            results.log_fail("GET /history", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /history", f"Error: {str(e)}")
        return False

def test_photos_endpoint():
    """Test GET /api/photos endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/photos", timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Verify it's a list
            if not isinstance(data, list):
                results.log_fail("GET /photos", f"Expected list, got {type(data)}")
                return False
            
            results.log_pass(f"GET /photos - returned {len(data)} photos")
            
            # If we have photos, verify structure
            if len(data) > 0:
                first_photo = data[0]
                required_fields = ['day_number', 'photo_base64', 'date']
                for field in required_fields:
                    if field not in first_photo:
                        results.log_fail("GET /photos structure", f"Missing field: {field}")
                        return False
                
                # Verify photo_base64 is present and not None
                if first_photo.get('photo_base64') is None:
                    results.log_fail("GET /photos structure", "photo_base64 should not be None")
                    return False
                
                results.log_pass("GET /photos - structure correct")
            
            return True
        else:
            results.log_fail("GET /photos", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /photos", f"Error: {str(e)}")
        return False

def test_calendar_ui_support():
    """Test calendar date generation and status logic support"""
    try:
        # Get history data that calendar uses
        response = requests.get(f"{BASE_URL}/history", timeout=10)
        if response.status_code != 200:
            results.log_fail("Calendar UI Support - History", f"Status code: {response.status_code}")
            return False
        
        history_data = response.json()
        
        # Verify calendar can determine day status from history data
        if len(history_data) > 0:
            log = history_data[0]
            
            # Calendar needs these fields to determine status
            status_fields = ['is_completed', 'tasks', 'date']
            for field in status_fields:
                if field not in log:
                    results.log_fail("Calendar UI Support - Status Logic", f"Missing field for status: {field}")
                    return False
            
            # Calendar needs to check all tasks completion
            if not isinstance(log['tasks'], dict):
                results.log_fail("Calendar UI Support - Status Logic", "Tasks must be dict for status checking")
                return False
            
            results.log_pass("Calendar UI Support - Status Logic")
        else:
            results.log_pass("Calendar UI Support - Status Logic (no data)")
        
        return True
    except Exception as e:
        results.log_fail("Calendar UI Support", f"Error: {str(e)}")
        return False

def test_modal_content_support():
    """Test modal content rendering support"""
    try:
        # Get history data that modal uses
        response = requests.get(f"{BASE_URL}/history", timeout=10)
        if response.status_code != 200:
            results.log_fail("Modal Content Support - History", f"Status code: {response.status_code}")
            return False
        
        history_data = response.json()
        
        if len(history_data) > 0:
            log = history_data[0]
            
            # Modal needs these fields for content rendering
            modal_fields = ['date', 'tasks', 'is_completed', 'day_number']
            for field in modal_fields:
                if field not in log:
                    results.log_fail("Modal Content Support", f"Missing field for modal: {field}")
                    return False
            
            # Modal needs individual task status for rendering
            expected_tasks = ['diet', 'workout_1', 'workout_2', 'water', 'reading', 'no_alcohol', 'photo_logged']
            for task in expected_tasks:
                if task not in log['tasks']:
                    results.log_fail("Modal Content Support", f"Missing task for modal: {task}")
                    return False
            
            results.log_pass("Modal Content Support")
        else:
            results.log_pass("Modal Content Support (no data)")
        
        return True
    except Exception as e:
        results.log_fail("Modal Content Support", f"Error: {str(e)}")
        return False

def test_challenge_management_api():
    """Test the complete Challenge Management API workflow"""
    print("🧪 Testing Challenge Management API")
    print("=" * 50)
    
    # Test 1: GET /api/challenges (should return default challenges)
    print("\n1️⃣ Testing GET /api/challenges (default challenges)")
    try:
        response = requests.get(f"{BASE_URL}/challenges", timeout=10)
        if response.status_code == 200:
            challenges = response.json()
            results.log_pass(f"GET /challenges - Found {len(challenges)} default challenges")
            
            # Verify default challenges structure
            expected_defaults = ["diet", "workout_1", "workout_2", "water", "reading", "no_alcohol"]
            found_ids = [c.get("id") for c in challenges]
            
            missing_defaults = []
            for expected_id in expected_defaults:
                if expected_id not in found_ids:
                    missing_defaults.append(expected_id)
            
            if missing_defaults:
                results.log_fail("GET /challenges - Default challenges", f"Missing: {missing_defaults}")
                return False
        else:
            results.log_fail("GET /challenges", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /challenges", f"Error: {str(e)}")
        return False
    
    # Test 2: POST /api/challenges (create new challenge)
    print("\n2️⃣ Testing POST /api/challenges (create new challenge)")
    new_challenge = {
        "id": "run_1_mile",
        "label": "Run 1 Mile", 
        "sub": "Daily cardio challenge",
        "icon": "Activity",
        "is_active": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/challenges", json=new_challenge, timeout=10)
        if response.status_code == 200:
            results.log_pass("POST /challenges - Create new challenge")
        else:
            results.log_fail("POST /challenges", f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        results.log_fail("POST /challenges", f"Error: {str(e)}")
        return False
    
    # Test 3: Verify new challenge appears in GET /api/challenges
    print("\n3️⃣ Testing GET /api/challenges (verify new challenge appears)")
    try:
        response = requests.get(f"{BASE_URL}/challenges", timeout=10)
        if response.status_code == 200:
            challenges = response.json()
            found_new_challenge = any(c.get("id") == "run_1_mile" for c in challenges)
            
            if found_new_challenge:
                results.log_pass("GET /challenges - New challenge appears")
            else:
                results.log_fail("GET /challenges - New challenge", "New challenge 'run_1_mile' not found")
                return False
        else:
            results.log_fail("GET /challenges verification", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /challenges verification", f"Error: {str(e)}")
        return False
    
    # Test 4: GET /api/today and verify new challenge is in tasks dictionary
    print("\n4️⃣ Testing GET /api/today (verify new challenge in tasks)")
    try:
        response = requests.get(f"{BASE_URL}/today", timeout=10)
        if response.status_code == 200:
            today_log = response.json()
            tasks = today_log.get("tasks", {})
            
            if "run_1_mile" in tasks:
                results.log_pass("GET /today - New challenge in tasks")
            else:
                results.log_fail("GET /today - New challenge", f"New challenge not in tasks. Available: {list(tasks.keys())}")
                return False
        else:
            results.log_fail("GET /today verification", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /today verification", f"Error: {str(e)}")
        return False
    
    # Test 5: PUT /api/challenges/{id} to toggle is_active=false
    print("\n5️⃣ Testing PUT /api/challenges/run_1_mile (set is_active=false)")
    try:
        update_data = {"is_active": False}
        response = requests.put(f"{BASE_URL}/challenges/run_1_mile", json=update_data, timeout=10)
        if response.status_code == 200:
            results.log_pass("PUT /challenges - Toggle inactive")
        else:
            results.log_fail("PUT /challenges", f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        results.log_fail("PUT /challenges", f"Error: {str(e)}")
        return False
    
    # Test 6: Verify GET /api/challenges shows it as inactive
    print("\n6️⃣ Testing GET /api/challenges (verify challenge is inactive)")
    try:
        response = requests.get(f"{BASE_URL}/challenges", timeout=10)
        if response.status_code == 200:
            challenges = response.json()
            inactive_challenge = next((c for c in challenges if c.get("id") == "run_1_mile"), None)
            
            if inactive_challenge and inactive_challenge.get("is_active") == False:
                results.log_pass("GET /challenges - Challenge marked inactive")
            else:
                results.log_fail("GET /challenges - Inactive status", "Challenge not marked as inactive")
                return False
        else:
            results.log_fail("GET /challenges inactive check", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /challenges inactive check", f"Error: {str(e)}")
        return False
    
    # Test 7: GET /api/today again - verify how it handles inactive tasks
    print("\n7️⃣ Testing GET /api/today (verify inactive task handling)")
    try:
        response = requests.get(f"{BASE_URL}/today", timeout=10)
        if response.status_code == 200:
            today_log = response.json()
            tasks = today_log.get("tasks", {})
            
            # Check if inactive challenge is still in tasks or removed
            if "run_1_mile" in tasks:
                results.log_pass("GET /today - Inactive task handling (kept in DB)")
                print("   ℹ️  Note: Backend keeps inactive tasks in DB, frontend should filter them")
            else:
                results.log_pass("GET /today - Inactive task handling (removed from tasks)")
        else:
            results.log_fail("GET /today inactive handling", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /today inactive handling", f"Error: {str(e)}")
        return False
    
    # Test 8: DELETE /api/challenges/{id}
    print("\n8️⃣ Testing DELETE /api/challenges/run_1_mile")
    try:
        response = requests.delete(f"{BASE_URL}/challenges/run_1_mile", timeout=10)
        if response.status_code == 200:
            results.log_pass("DELETE /challenges - Challenge deleted")
        else:
            results.log_fail("DELETE /challenges", f"Status code: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        results.log_fail("DELETE /challenges", f"Error: {str(e)}")
        return False
    
    # Test 9: Verify it's gone from GET /api/challenges
    print("\n9️⃣ Testing GET /api/challenges (verify challenge is deleted)")
    try:
        response = requests.get(f"{BASE_URL}/challenges", timeout=10)
        if response.status_code == 200:
            challenges = response.json()
            deleted_challenge = any(c.get("id") == "run_1_mile" for c in challenges)
            
            if not deleted_challenge:
                results.log_pass("GET /challenges - Challenge successfully deleted")
            else:
                results.log_fail("GET /challenges - Delete verification", "Challenge still exists after deletion")
                return False
        else:
            results.log_fail("GET /challenges delete verification", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        results.log_fail("GET /challenges delete verification", f"Error: {str(e)}")
        return False
    
    print("\n🎉 All Challenge Management API tests completed successfully!")
    return True

def test_ui_functionality_support():
    """Test UI functionality support as requested in review"""
    print("🚀 Testing UI Functionality Backend Support")
    print(f"Testing against: {BASE_URL}")
    print("="*50)
    
    # Test basic connectivity first
    if not test_health_check():
        print("❌ Health check failed - aborting tests")
        return False
    
    # Ensure we have some data by initializing today
    initial_data = test_get_today_initial()
    if not initial_data:
        print("❌ Failed to initialize day - aborting tests")
        return False
    
    # Add some task data to ensure we have content to test
    test_toggle_tasks()
    test_complete_all_tasks()  # This includes photo upload
    
    print("\n📱 Testing UI Backend Support:")
    
    # 1. Verify GET /api/history is being called correctly
    print("\n1️⃣ Testing GET /api/history API call support...")
    if not test_history_endpoint():
        print("❌ History endpoint test failed")
        return False
    
    # 2. Verify calendar date generation and status logic support
    print("\n2️⃣ Testing calendar date generation and status logic support...")
    if not test_calendar_ui_support():
        print("❌ Calendar UI support test failed")
        return False
    
    # 3. Check modal content rendering support (data availability)
    print("\n3️⃣ Testing modal content rendering support...")
    if not test_modal_content_support():
        print("❌ Modal content support test failed")
        return False
    
    # 4. Verify today endpoint still works (for current day data)
    print("\n4️⃣ Testing current day data support...")
    if not test_get_today_initial():
        print("❌ Today endpoint test failed")
        return False
    
    return True

def run_visualization_tests():
    """Run tests for the new visualization endpoints"""
    print("🚀 Testing New Visualization Endpoints")
    print(f"Testing against: {BASE_URL}")
    print("="*50)
    
    # Test basic connectivity first
    if not test_health_check():
        print("❌ Health check failed - aborting tests")
        return False
    
    # Ensure we have some data by initializing today
    initial_data = test_get_today_initial()
    if not initial_data:
        print("❌ Failed to initialize day - aborting tests")
        return False
    
    # Add some task data and photo to ensure we have content to test
    test_toggle_tasks()
    test_complete_all_tasks()  # This includes photo upload
    
    # Now test the visualization endpoints
    print("\n📊 Testing Visualization Endpoints:")
    
    # 1. Test GET /api/history
    if not test_history_endpoint():
        print("❌ History endpoint test failed")
        return False
    
    # 2. Test GET /api/photos  
    if not test_photos_endpoint():
        print("❌ Photos endpoint test failed")
        return False
    
    # 3. Verify GET /api/today still works
    if not test_get_today_initial():
        print("❌ Today endpoint test failed")
        return False
    
    return True

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
    
    # Run Challenge Management API tests as requested in review
    success = test_challenge_management_api()
    
    # Print final summary
    all_passed = results.summary()
    
    if all_passed:
        print("\n🎉 All Challenge Management API tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some Challenge Management API tests failed. Check the errors above.")
        sys.exit(1)