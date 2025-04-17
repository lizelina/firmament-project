import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId
import datetime

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# MongoDB connection string
# Original MongoDB Atlas connection
# MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://root:123qweasd@fimament-a.p9kidca.mongodb.net/')
# DB_NAME = os.getenv('DB_NAME', 'firmament')

# Local MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'firmament')

# Initialize MongoDB client
try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    users_collection = db['users']
    userdata_collection = db['userdata']
    notebooks_collection = db['notebooks']  # Add new notebooks collection
    transcriptions_collection = db['transcriptions'] # LEGACY
    
    # Test the connection
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Error connecting to MongoDB: {e}", exc_info=True)
    # Still create the client, but it will fail when used
    client = None
    db = None
    users_collection = None
    userdata_collection = None
    notebooks_collection = None
    transcriptions_collection = None

def authenticate_user(email, password):
    """
    Authenticate a user by email and password
    Returns user document if authenticated, None otherwise
    """
    if users_collection is None:
        logger.error("MongoDB connection not available")
        return None
    
    try:
        # Find user by email and password
        user = users_collection.find_one({
            'email': email,
            'password': password  # Note: In production, use hashed passwords!
        })
        
        if user:
            # Convert ObjectId to string for JSON serialization
            user['_id'] = str(user['_id'])
            return user
        return None
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        return None

def get_user_by_id(user_id):
    """
    Get a user by their ID
    """
    if users_collection is None:
        logger.error("MongoDB connection not available")
        return None
    
    try:
        # Convert string ID to ObjectId
        object_id = ObjectId(user_id)
        user = users_collection.find_one({'_id': object_id})
        
        if user:
            # Convert ObjectId to string for JSON serialization
            user['_id'] = str(user['_id'])
            return user
        return None
    except Exception as e:
        logger.error(f"Error getting user by ID: {e}")
        return None

def get_all_users():
    """
    Get all users (for testing purposes)
    """
    if users_collection is None:
        logger.error("MongoDB connection not available")
        return []
    
    try:
        users = list(users_collection.find({}))
        # Convert ObjectId to string for each user
        for user in users:
            user['_id'] = str(user['_id'])
        return users
    except Exception as e:
        logger.error(f"Error getting all users: {e}")
        return []

def create_user(user_data):
    """
    Create a new user in the database
    """
    if users_collection is None:
        logger.error("MongoDB connection not available")
        return None
    
    try:
        # Check if user with this email already exists
        existing_user = users_collection.find_one({'email': user_data['email']})
        if existing_user:
            return {'success': False, 'message': 'Email already registered'}
        
        # Insert the new user
        result = users_collection.insert_one(user_data)
        
        if result.inserted_id:
            # Get the newly created user
            new_user = users_collection.find_one({'_id': result.inserted_id})
            if new_user:
                # Convert ObjectId to string for JSON serialization
                new_user['_id'] = str(new_user['_id'])
                return {'success': True, 'user': new_user}
        
        return {'success': False, 'message': 'Failed to create user'}
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return {'success': False, 'message': f'Database error: {str(e)}'}
    
def insert_or_update_note(data, collection_name='notebooks'):
    """
    Insert or update a note trinary (noteText, curTranscript, curSummary) to the specified collection.
    Default is notebooks_collection (= db['notebooks']).
    Replace legacy save_transcript function.

    *data* format:
    {
        "userId": "64f7a6cfa623d0a1b2c3d4e5",
        "noteId": "67fdec6213ff7fa9dc716b82, or None",
        "title": "Note April 13, 2023 08:30 AM",
        "noteText": "User writes...",
        "curTranscript": "#@!@#",
        "curSummary": "The voice says...",
    }

    """

    # Get the appropriate collection
    if collection_name == 'notebooks':
        target_collection = notebooks_collection
    else:
        target_collection = userdata_collection
    
    if target_collection is None:
        logger.error(f"MongoDB connection not available for collection {collection_name}")
        return {'success': False, 'message': 'Database not available'}
    
    try:
        # Create a copy of the data to avoid modifying the original
        data_to_save = data.copy()
        
        # Add timestamps
        now = datetime.datetime.utcnow()
        data_to_save['updatedAt'] = now
        
        # Convert userId string to ObjectId if provided
        if 'userId' in data_to_save and data_to_save['userId']:
            try:
                data_to_save['userId'] = ObjectId(data_to_save['userId'])
            except Exception as e:
                logger.warning(f"Invalid userId format: {e}")
                # Keep as string if conversion fails

        # Decide whether the note is a new one
        if 'noteId' in data_to_save and data_to_save['noteId']:
            # Update existing note
            note_id = data_to_save.pop('noteId', None)
            try:
                note_object_id = ObjectId(note_id)
            except Exception as e:
                logger.warning(f"Invalid noteId format: {e}")
                return {'success': False, 'message': 'Invalid noteId'}
            
            result = target_collection.update_one(
                {'_id': note_object_id},
                {'$set': data_to_save}
            )
            if result.matched_count > 0:
                return {
                    'success': True, 
                    'noteId': note_id,
                    'message': 'Note updated successfully'
                }
            else:
                return {'success': False, 'message': 'Note not found'}
        
        # Else, insert new note
        del data_to_save['noteId']
        data_to_save['createdAt'] = now  # Add createdAt timestamp

        result = target_collection.insert_one(data_to_save)
        if result.inserted_id:
            # Return success with the ID (converted to string for JSON serialization)
            return {
                'success': True, 
                'noteId': str(result.inserted_id),
                'message': 'Note inserted successfully'
            }
        else:
            return {'success': False, 'message': 'Failed to insert note'}
        
    except Exception as e:
        logger.error(f"Error saving note: {e}")
        return {'success': False, 'message': f'Database error: {str(e)}'}
    
def get_userdata(user_id, collection_name='notebooks'):
    """
    Get all user notes by userId from the specified collection.
    Default is notebooks_collection (= db['notebooks']).
    Replace legacy get_user_transcripts function.
    """

    # Get the appropriate collection
    if collection_name == 'notebooks':
        target_collection = notebooks_collection
    else:
        target_collection = userdata_collection

    if target_collection is None:
        logger.error(f"MongoDB connection not available for collection {collection_name}")
        return {'success': False, 'message': 'Database not available'}
    
    try:
        # Convert string ID to ObjectId
        object_id = ObjectId(user_id)
        
        # Find all notes for this user, sorted by date (newest first)
        notes = list(target_collection.find(
            {'userId': object_id}
        ).sort('updatedAt', -1))
        
        # Convert ObjectId to string for each note
        for note in notes:
            # Convert _id to string
            if '_id' in note:
                note['_id'] = str(note['_id'])
            
            # Convert userId to string if it's an ObjectId
            if 'userId' in note and isinstance(note['userId'], ObjectId):
                note['userId'] = str(note['userId'])
                
            # Convert createdAt and updatedAt to ISO strings
            if 'createdAt' in note and note['createdAt']:
                note['createdAt'] = note['createdAt'].isoformat()
            if 'updatedAt' in note and note['updatedAt']:
                note['updatedAt'] = note['updatedAt'].isoformat()
            
            # Ensure any other potential ObjectId fields are converted to strings
            for key, value in note.items():
                if isinstance(value, ObjectId):
                    note[key] = str(value)
        
        return {'success': True, 'notes': notes}
    
    except Exception as e:
        logger.error(f"Error getting user notes: {e}")
        return {'success': False, 'message': f'Database error: {str(e)}'}
    

# LEGACY
def save_transcript(transcript_data):
    """
    Save a transcript to the database
    
    Expected format:
    {
        "userId": "64f7a6cfa623d0a1b2c3d4e5",
        "title": "Note April 13, 2023 08:30 AM",
        "originalText": "Good morning team...",
        "date": "2023-04-13T08:30:00", (ISO string)
        "duration": 450 (in seconds)
    }
    """
    if transcriptions_collection is None:
        logger.error("MongoDB connection not available")
        return {'success': False, 'message': 'Database not available'}
    
    try:
        # Create a copy of the data to avoid modifying the original
        data_to_save = transcript_data.copy()
        
        # Add timestamps
        now = datetime.datetime.utcnow()
        data_to_save['createdAt'] = now
        data_to_save['updatedAt'] = now
        
        # Convert userId string to ObjectId if provided
        if 'userId' in data_to_save and data_to_save['userId']:
            try:
                data_to_save['userId'] = ObjectId(data_to_save['userId'])
            except Exception as e:
                logger.warning(f"Invalid userId format: {e}")
                # Keep as string if conversion fails
        
        # Insert the transcript
        result = transcriptions_collection.insert_one(data_to_save)
        
        if result.inserted_id:
            # Return success with the ID (converted to string for JSON serialization)
            return {
                'success': True, 
                'transcriptId': str(result.inserted_id),
                'message': 'Transcript saved successfully'
            }
        else:
            return {'success': False, 'message': 'Failed to save transcript'}
    except Exception as e:
        logger.error(f"Error saving transcript: {e}")
        return {'success': False, 'message': f'Database error: {str(e)}'}

def get_user_transcripts(user_id):
    """
    Get all transcripts for a specific user
    """
    if transcriptions_collection is None:
        logger.error("MongoDB connection not available")
        return {'success': False, 'message': 'Database not available'}
    
    try:
        # Convert string ID to ObjectId
        object_id = ObjectId(user_id)
        
        # Find all transcripts for this user, sorted by date (newest first)
        transcripts = list(transcriptions_collection.find(
            {'userId': object_id}
        ).sort('createdAt', -1))
        
        # Convert ObjectId to string for each transcript
        for transcript in transcripts:
            # Convert _id to string
            if '_id' in transcript:
                transcript['_id'] = str(transcript['_id'])
            
            # Convert userId to string if it's an ObjectId
            if 'userId' in transcript and isinstance(transcript['userId'], ObjectId):
                transcript['userId'] = str(transcript['userId'])
                
            # Convert createdAt and updatedAt to ISO strings
            if 'createdAt' in transcript and transcript['createdAt']:
                transcript['createdAt'] = transcript['createdAt'].isoformat()
            if 'updatedAt' in transcript and transcript['updatedAt']:
                transcript['updatedAt'] = transcript['updatedAt'].isoformat()
            
            # Ensure any other potential ObjectId fields are converted to strings
            for key, value in transcript.items():
                if isinstance(value, ObjectId):
                    transcript[key] = str(value)
        
        return {'success': True, 'transcripts': transcripts}
    except Exception as e:
        logger.error(f"Error getting user transcripts: {e}")
        return {'success': False, 'message': f'Database error: {str(e)}'} 