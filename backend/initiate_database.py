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
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'firmament')


def create_test_users(db):
    """Create test users in the database"""
    logger.info("Creating test users...")

    # look for user with email "a@firmament" in db.users
    users = db.users
    
    # Define test users
    test_users = [
        # used for display
        {
            "firstName": "Alice",
            "lastName": "Firmament",
            "email": "a@firmament",
            "password": "123456"
        },
        # used for internal testing
        {
            "firstName": "Test",
            "lastName": "Account1",
            "email": "test1@xyz",
            "password": "123456"
        },
        {
            "firstName": "Test",
            "lastName": "Account2",
            "email": "test2@xyz",
            "password": "123456"
        }
    ]
    
    # Check and create each test user
    for user in test_users:
        existing_user = users.find_one({"email": user["email"]})
        if existing_user:
            logger.info(f"User with email {user['email']} already exists. Skipping...")
        else:
            result = users.insert_one(user)
            if result.inserted_id:
                logger.info(f"Created test user: {user['firstName']} ({user['email']})")
            else:
                logger.error(f"Failed to create test user: {user['email']}")


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

        db = client[DB_NAME]
        logger.info(f"Connected to database: {DB_NAME}")
        
        # Check if users collection exists and print all users
        if "users" in db.list_collection_names():
            logger.info("Listing all users in database:")
            users = list(db.users.find({}))
            if users:
                for user in users:
                    logger.info(f"User: {user['firstName']} {user['lastName']} ({user['email']})")
            else:
                logger.info("No users found in database.")
        else:
            logger.info("Users collection does not exist.")
    
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")


if __name__ == "__main__":
    try:
        # Connect to MongoDB
        logger.info(f"Connecting to MongoDB: {MONGO_URI}")
        client = MongoClient(MONGO_URI)
        
        # Test connection with ping
        logger.info("Testing connection with ping command...")
        client.admin.command('ping')
        logger.info("✅ MongoDB connection successful!")

        db = client[DB_NAME]
        logger.info(f"Connected to database: {DB_NAME}")

        create_test_users(db)

        test_connection()
        
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")