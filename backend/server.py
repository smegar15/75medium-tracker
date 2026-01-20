from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
from datetime import datetime, date
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import base64
from dotenv import load_dotenv
import uuid

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.hard75_tracker

# --- Models ---

class Challenge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    sub: str = ""
    icon: str = "CircleCheck" # Default Lucide icon name
    is_active: bool = True

class TaskUpdate(BaseModel):
    task_id: str
    completed: bool
class PhotoUpload(BaseModel):
    image_base64: str

class DailyLog(BaseModel):
    date: str  # YYYY-MM-DD
    tasks: Dict[str, bool]
    photo_base64: Optional[str] = None
    day_number: int
    is_completed: bool = False

class AppState(BaseModel):
    start_date: str
    current_day: int
    is_active: bool

# --- Helpers ---

DEFAULT_CHALLENGES = [
    {"id": "diet", "label": "Follow Diet", "sub": "No cheat meals", "icon": "Utensils", "is_active": True},
    {"id": "workout_1", "label": "Workout 1", "sub": "45 mins (Indoor/Outdoor)", "icon": "Dumbbell", "is_active": True},
    {"id": "workout_2", "label": "Workout 2", "sub": "45 mins (Must be different)", "icon": "Dumbbell", "is_active": True},
    {"id": "water", "label": "Drink Water", "sub": "1 Gallon", "icon": "Droplets", "is_active": True},
    {"id": "reading", "label": "Read 10 Pages", "sub": "Non-fiction only", "icon": "BookOpen", "is_active": True},
    {"id": "no_alcohol", "label": "No Alcohol", "sub": "Zero tolerance", "icon": "Ban", "is_active": True},
]

async def get_active_tasks_dict():
    """Returns a dict of task_id: False for all active challenges"""
    challenges = await db.challenges.find({"is_active": True}).to_list(length=100)
    
    # If no challenges exist yet, return defaults (and seed them if needed, but seeding happens in GET)
    if not challenges:
        return {c["id"]: False for c in DEFAULT_CHALLENGES} | {"photo_logged": False}
        
    tasks = {c["id"]: False for c in challenges}
    tasks["photo_logged"] = False
    return tasks

async def seed_challenges_if_empty():
    count = await db.challenges.count_documents({})
    if count == 0:
        await db.challenges.insert_many(DEFAULT_CHALLENGES)

# --- Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# CHALLENGE MANAGEMENT
@app.get("/api/challenges")
async def get_challenges():
    await seed_challenges_if_empty()
    challenges = await db.challenges.find({}, {"_id": 0}).to_list(length=100)
    return challenges

@app.post("/api/challenges")
async def create_challenge(challenge: Challenge):
    # Ensure ID is unique
    exists = await db.challenges.find_one({"id": challenge.id})
    if exists:
        raise HTTPException(status_code=400, detail="Challenge ID already exists")
    
    await db.challenges.insert_one(challenge.dict())
    return challenge

@app.put("/api/challenges/{challenge_id}")
async def update_challenge(challenge_id: str, update: Dict[str, Any]):
    await db.challenges.update_one(
        {"id": challenge_id},
        {"$set": update}
    )
    return {"status": "updated"}

@app.delete("/api/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str):
    # Prevent deleting defaults? For now let's allow it, user owns their journey.
    await db.challenges.delete_one({"id": challenge_id})
    return {"status": "deleted"}


# DAILY LOGGING
@app.get("/api/today")
async def get_today_log():
    today_str = date.today().isoformat()
    
    # Ensure challenges are seeded so we know what tasks to track
    await seed_challenges_if_empty()
    
    # Get global state
    state = await db.state.find_one({})
    if not state:
        state = {
            "start_date": today_str,
            "current_day": 1,
            "is_active": True
        }
        await db.state.insert_one(state)

    log = await db.daily_logs.find_one({"date": today_str})
    
    # Get currently active tasks configuration
    active_tasks_template = await get_active_tasks_dict()
    
    if not log:
        # Create new log
        new_log = {
            "date": today_str,
            "tasks": active_tasks_template,
            "photo_base64": None,
            "day_number": state["current_day"],
            "is_completed": False
        }
        await db.daily_logs.insert_one(new_log)
        log = new_log
    else:
        # SYNC: If new challenges were added since the log was created, 
        # we need to make sure they exist in the log's tasks dict.
        # However, we should preserve the existing boolean values.
        current_tasks = log.get("tasks", {})
        merged_tasks = active_tasks_template.copy() # Start with current definition
        
        # Overwrite with existing values where they exist
        for k, v in current_tasks.items():
            if k in merged_tasks:
                merged_tasks[k] = v
            # If a task was deleted/disabled, it effectively disappears from the UI 
            # because the UI iterates over `challenges`, but we keep the data here safely or drop it.
            # Let's keep it clean: The UI drives the keys.
            
        # Update DB if keys changed
        if set(merged_tasks.keys()) != set(current_tasks.keys()):
            await db.daily_logs.update_one(
                {"date": today_str},
                {"$set": {"tasks": merged_tasks}}
            )
            log["tasks"] = merged_tasks
    
    if "_id" in log:
        del log["_id"]
        
    return log

@app.put("/api/log/task")
async def update_task(update: TaskUpdate):
    today_str = date.today().isoformat()
    
    # Update the specific task
    result = await db.daily_logs.update_one(
        {"date": today_str},
        {"$set": {f"tasks.{update.task_id}": update.completed}}
    )
    
    if result.modified_count == 0:
        # Create if missing
        await get_today_log()
        await db.daily_logs.update_one(
            {"date": today_str},
            {"$set": {f"tasks.{update.task_id}": update.completed}}
        )
            
    return {"status": "updated"}

@app.post("/api/log/photo")
async def upload_photo(upload: PhotoUpload):
    today_str = date.today().isoformat()
    if not upload.image_base64:
        raise HTTPException(status_code=400, detail="No image data")

    await db.daily_logs.update_one(
        {"date": today_str},
        {
            "$set": {
                "photo_base64": upload.image_base64,
                "tasks.photo_logged": True
            }
        }
    )
    return {"status": "photo_saved"}

@app.post("/api/complete_day")
async def complete_day():
    today_str = date.today().isoformat()
    log = await db.daily_logs.find_one({"date": today_str})
    
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    # Verify all active tasks are done
    # We fetch active challenges to know what MUST be true
    active_challenges = await db.challenges.find({"is_active": True}).to_list(length=100)
    required_keys = [c["id"] for c in active_challenges] + ["photo_logged"]
    
    tasks = log.get("tasks", {})
    all_done = True
    for key in required_keys:
        if not tasks.get(key, False):
            all_done = False
            break
            
    if not all_done:
        raise HTTPException(status_code=400, detail="Not all active tasks are completed")
        
    if log.get("is_completed"):
        return {"status": "already_completed"}

    await db.daily_logs.update_one(
        {"date": today_str},
        {"$set": {"is_completed": True}}
    )
    
    await db.state.update_one(
        {},
        {"$inc": {"current_day": 1}}
    )
    
    return {"status": "day_completed", "next_day": log["day_number"] + 1}

@app.post("/api/reset")
async def reset_progress():
    today_str = date.today().isoformat()
    
    new_state = {
        "start_date": today_str,
        "current_day": 1,
        "is_active": True
    }
    await db.state.delete_many({})
    await db.state.insert_one(new_state)
    
    # Get fresh tasks
    active_tasks = await get_active_tasks_dict()
    
    await db.daily_logs.update_one(
        {"date": today_str},
        {
            "$set": {
                "day_number": 1, 
                "is_completed": False,
                "tasks": active_tasks,
                "photo_base64": None
            }
        }
    )
    
    return {"status": "reset_successful", "current_day": 1}

# --- VISUALIZATION ENDPOINTS ---

@app.get("/api/history")
async def get_history():
    cursor = db.daily_logs.find({}, {"_id": 0, "photo_base64": 0}).sort("date", 1)
    logs = await cursor.to_list(length=365)
    return logs

@app.get("/api/photos")
async def get_photos():
    cursor = db.daily_logs.find(
        {"photo_base64": {"$ne": None}}, 
        {"_id": 0, "day_number": 1, "photo_base64": 1, "date": 1}
    ).sort("day_number", 1)
    photos = await cursor.to_list(length=365)
    return photos
