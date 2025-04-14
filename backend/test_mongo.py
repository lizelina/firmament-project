import logging
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection string
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv:///')
DB_NAME = os.getenv('DB_NAME', 'firmament')

def test_connection():
    """Test MongoDB connection and list all users in the collection"""
    try:
        # Connect to MongoDB
        logger.info(f"Connecting to MongoDB: {MONGO_URI}")
        client = MongoClient(MONGO_URI)
        
        # Test connection with ping
        logger.info("Testing connection with ping command...")
        client.admin.command('ping')
        logger.info("✅ MongoDB connection successful!")
        
        # Get database and collection
        db = client[DB_NAME]
        logger.info(f"Database names: {client.list_database_names()}")
        
        # Check if users collection exists
        collection_names = db.list_collection_names()
        logger.info(f"Collections in {DB_NAME}: {collection_names}")
        
        if 'users' in collection_names:
            users = list(db.users.find())
            logger.info(f"Found {len(users)} users in the collection.")
            
            # Print each user (but hide passwords)
            for i, user in enumerate(users):
                user_id = user.get('_id')
                email = user.get('email', 'No email')
                first_name = user.get('firstName', 'No first name')
                last_name = user.get('lastName', 'No last name')
                
                logger.info(f"User {i+1}: ID={user_id}, Email={email}, Name={first_name} {last_name}")
        else:
            logger.warning(f"'users' collection not found in {DB_NAME} database.")
            
            # Create a test user
            logger.info("Creating a test user...")
            users = db.users
            result = users.insert_one({
                "firstName": "John",
                "lastName": "Doe",
                "email": "john.doe@example.com",
                "password": "123456"
            })
            logger.info(f"Created test user with ID: {result.inserted_id}")
    
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")

if __name__ == "__main__":
    test_connection() 