import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId

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
    
    # Test the connection
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Error connecting to MongoDB: {e}", exc_info=True)
    # Still create the client, but it will fail when used
    client = None
    db = None
    users_collection = None

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