from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pharmacy Management System"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./pharma_db.sqlite"
    
    # Adding security settings for the future
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
