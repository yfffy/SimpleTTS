import secrets
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from config import settings

security = HTTPBasic()

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)):
    """Verify basic authentication credentials"""
    correct_username = secrets.compare_digest(credentials.username, settings.auth_username)
    correct_password = secrets.compare_digest(credentials.password, settings.auth_password)
    
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Optional authentication dependency (for endpoints that can work with or without auth)
def optional_auth(credentials: HTTPBasicCredentials = Depends(security)):
    """Optional authentication - returns username if authenticated, None otherwise"""
    try:
        return verify_credentials(credentials)
    except HTTPException:
        return None 