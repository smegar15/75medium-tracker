from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from datetime import datetime, date
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import base64
from dotenv import load_dotenv

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

# Models
class TaskUpdate(BaseModel):
    task_id: str
    completed: bool

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

# Initial State Helpers
async def get_or_create_state():
    state = await db.state.find_one({})
    if not state:
        new_state = {
            "start_date": date.today().isoformat(),
            "current_day": 1,
            "is_active": True
        }
        await db.state.insert_one(new_state)
        return new_state
    return state

def get_default_tasks():
    return {
        "diet": False,
        "workout_1": False,
        "workout_2": False,
        "water": False,
        "reading": False,
        "no_alcohol": False,
        "photo_logged": False
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/today")
async def get_today_log():
    today_str = date.today().isoformat()
    state = await get_or_create_state()
    
    log = await db.daily_logs.find_one({"date": today_str})
    
    if not log:
        # Create new log for today
        new_log = {
            "date": today_str,
            "tasks": get_default_tasks(),
            "photo_base64": None,
            "day_number": state["current_day"],
            "is_completed": False
        }
        await db.daily_logs.insert_one(new_log)
        log = new_log
    
    # Remove _id for JSON response
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
        # Try to find if log exists, if not create it (edge case)
        log = await db.daily_logs.find_one({"date": today_str})
        if not log:
            await get_today_log() # Create it
            await db.daily_logs.update_one(
                {"date": today_str},
                {"$set": {f"tasks.{update.task_id}": update.completed}}
            )
            
    return {"status": "updated"}

class PhotoUpload(BaseModel):
    image_base64: str

@app.post("/api/log/photo")
async def upload_photo(upload: PhotoUpload):
    today_str = date.today().isoformat()
    
    # Validate base64 (basic check)
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
    
    # Verify all tasks are done
    all_tasks_done = all(log["tasks"].values())
    if not all_tasks_done:
        raise HTTPException(status_code=400, detail="Not all tasks are completed yet")
        
    if log.get("is_completed"):
        return {"status": "already_completed"}

    # Mark as completed
    await db.daily_logs.update_one(
        {"date": today_str},
        {"$set": {"is_completed": True}}
    )
    
    # Increment global day count
    await db.state.update_one(
        {},
        {"$inc": {"current_day": 1}}
    )
    
    return {"status": "day_completed", "next_day": log["day_number"] + 1}

@app.post("/api/reset")
async def reset_progress():
    today_str = date.today().isoformat()
    
    # Reset State
    new_state = {
        "start_date": today_str,
        "current_day": 1,
        "is_active": True
    }
    # Delete old state and insert new
    await db.state.delete_many({})
    await db.state.insert_one(new_state)
    
    # Reset today's log tasks and status
    await db.daily_logs.update_one(
        {"date": today_str},
        {
            "$set": {
                "day_number": 1, 
                "is_completed": False,
                "tasks": get_default_tasks(),
                "photo_base64": None
            }
        }
    )
    
    return {"status": "reset_successful", "current_day": 1}

# --- NEW ENDPOINTS FOR VISUALIZATION LAYERS ---

@app.get("/api/history")
async def get_history():
    # Return all logs sorted by date to build the calendar
    # Exclude photo_base64 to keep response light
    cursor = db.daily_logs.find({}, {"_id": 0, "photo_base64": 0}).sort("date", 1)
    logs = await cursor.to_list(length=365)
    return logs

@app.get("/api/photos")
async def get_photos():
    # Return logs that have photos, sorted by day number
    cursor = db.daily_logs.find(
        {"photo_base64": {"$ne": None}}, 
        {"_id": 0, "day_number": 1, "photo_base64": 1, "date": 1}
    ).sort("day_number", 1)
    photos = await cursor.to_list(length=365)
    return photos
