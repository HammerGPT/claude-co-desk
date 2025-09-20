#!/usr/bin/env python3
"""
Claude Code SessionStart Hook Script
Monitors session events and maps them to internal task IDs
"""

import json
import sys
import requests
import logging
from datetime import datetime
from pathlib import Path

# Configure logging
log_file = Path(__file__).parent / "claude_hook.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
API_BASE_URL = "http://localhost:3005"
API_ENDPOINT = f"{API_BASE_URL}/api/session-mapping"

def send_session_mapping(session_data):
    """Send session mapping data to our API"""
    try:
        response = requests.post(
            API_ENDPOINT,
            json=session_data,
            timeout=5,
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code == 200:
            logger.info(f"Successfully sent session mapping: {session_data['session_id']}")
            return True
        else:
            logger.error(f"API returned status {response.status_code}: {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to send session mapping: {e}")
        return False

def handle_session_start(input_data):
    """Process SessionStart hook event"""
    session_id = input_data.get('session_id')
    source = input_data.get('source')
    transcript_path = input_data.get('transcript_path')
    hook_event_name = input_data.get('hook_event_name')

    logger.info(f"SessionStart hook triggered: session_id={session_id}, source={source}")

    # Prepare data for our API
    mapping_data = {
        'session_id': session_id,
        'source': source,
        'transcript_path': transcript_path,
        'hook_event_name': hook_event_name,
        'timestamp': datetime.now().isoformat()
    }

    # Send to our API for processing
    success = send_session_mapping(mapping_data)

    # Return hook output (optional additional context)
    hook_output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "processed": success,
            "sessionId": session_id,
            "source": source
        }
    }

    return hook_output

def main():
    """Main hook entry point"""
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        logger.info(f"Hook received input: {input_data}")

        # Process the session start event
        output = handle_session_start(input_data)

        # Output hook response
        print(json.dumps(output))

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON input: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Hook execution failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()