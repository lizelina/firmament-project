import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv
import datetime

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# MongoDB connection string
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.getenv('DB_NAME', 'firmament')

def migrate_to_notebooks():
    """Migrate all data from userdata collection to notebooks collection"""
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        userdata_collection = db['userdata']
        notebooks_collection = db['notebooks']
        
        # Get total count of documents in userdata
        total_docs = userdata_collection.count_documents({})
        logger.info(f"Found {total_docs} documents in userdata collection")
        
        if total_docs == 0:
            logger.info("No documents to migrate")
            return
        
        # Get all documents from userdata
        userdata_docs = list(userdata_collection.find({}))
        migrated_count = 0
        skipped_count = 0
        
        for doc in userdata_docs:
            # Check if document already exists in notebooks collection
            existing_doc = notebooks_collection.find_one({'_id': doc['_id']})
            
            if existing_doc:
                logger.info(f"Document {doc['_id']} already exists in notebooks collection - skipping")
                skipped_count += 1
                continue
            
            # Insert document into notebooks collection
            doc['migratedAt'] = datetime.datetime.utcnow()
            doc['migratedFrom'] = 'userdata'
            
            # Insert the document
            try:
                result = notebooks_collection.insert_one(doc)
                if result.inserted_id:
                    logger.info(f"Migrated document {doc['_id']} to notebooks collection")
                    migrated_count += 1
                else:
                    logger.error(f"Failed to migrate document {doc['_id']}")
            except Exception as e:
                logger.error(f"Error migrating document {doc['_id']}: {e}")
        
        logger.info(f"Migration complete: {migrated_count} documents migrated, {skipped_count} skipped")
        
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")

if __name__ == "__main__":
    logger.info("Starting migration from userdata to notebooks collection")
    migrate_to_notebooks()
    logger.info("Migration process completed") 