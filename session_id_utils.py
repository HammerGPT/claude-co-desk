"""
SessionId detection utilities - extracted from mobile_task_handler for reuse
"""
import re
import json
import logging

logger = logging.getLogger(__name__)

class SessionIdExtractor:
    """Common utility class for extracting sessionId from Claude CLI output"""

    @staticmethod
    def extract_session_from_json(json_response: dict) -> str:
        """Extract session ID from JSON response"""
        try:
            # Try to extract from session_id field
            if 'session_id' in json_response:
                return json_response['session_id']

            # Try to extract from data.session_id field
            data = json_response.get('data', {})
            if isinstance(data, dict) and 'session_id' in data:
                return data['session_id']

        except Exception as e:
            logger.debug(f"Failed to extract session from JSON: {e}")

        return None

    @staticmethod
    def extract_session_id(text: str) -> str:
        """Extract session ID from text output using regex patterns"""
        try:
            # Pattern 1: Session started with ID: session_id
            session_match = re.search(r'Session started with ID:\s*([a-f0-9\-]{36})', text, re.IGNORECASE)
            if session_match:
                return session_match.group(1)

            # Pattern 2: session_id format in various contexts
            session_match = re.search(r'(?:session[_\s]*id|session)[\s:=]*([a-f0-9\-]{36})', text, re.IGNORECASE)
            if session_match:
                return session_match.group(1)

            # Pattern 3: UUID format (36 characters with hyphens)
            uuid_match = re.search(r'\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b', text)
            if uuid_match:
                return uuid_match.group(1)

        except Exception as e:
            logger.debug(f"Failed to extract session ID from text: {e}")

        return None

    @staticmethod
    def extract_session_from_output(output_text: str) -> str:
        """Extract session ID from Claude CLI output - tries both JSON and text patterns"""
        try:
            # First try to parse as JSON
            lines = output_text.strip().split('\n')
            for line in lines:
                if line.strip().startswith('{'):
                    try:
                        json_response = json.loads(line.strip())
                        session_id = SessionIdExtractor.extract_session_from_json(json_response)
                        if session_id:
                            return session_id
                    except json.JSONDecodeError:
                        continue

            # If JSON extraction fails, try text patterns
            session_id = SessionIdExtractor.extract_session_id(output_text)
            if session_id:
                return session_id

        except Exception as e:
            logger.debug(f"Failed to extract session from output: {e}")

        return None