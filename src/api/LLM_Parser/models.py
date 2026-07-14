"""
Database models for recipe storage
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class Recipe(Base):
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Info
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    source_url = Column(String(2048), nullable=False, unique=True, index=True)
    source_domain = Column(String(255), nullable=True, index=True)
    author = Column(String(255), nullable=True)
    language = Column(String(10), nullable=True, index=True)
    
    # Time Information
    prep_time = Column(String(100), nullable=True)
    cook_time = Column(String(100), nullable=True)
    total_time = Column(String(100), nullable=True)
    
    # Serving Info
    servings = Column(String(50), nullable=True)
    
    # Recipe Content (stored as JSON for flexibility)
    ingredients = Column(JSON, nullable=False)  # List of ingredient objects
    instructions = Column(JSON, nullable=False)  # List of instruction strings
    
    # Metadata
    tags = Column(JSON, nullable=True)  # List of tags
    cuisine = Column(String(100), nullable=True, index=True)
    difficulty = Column(String(50), nullable=True, index=True)
    
    # Quality Metrics
    confidence_score = Column(Float, nullable=True)
    parsing_version = Column(String(50), nullable=True)  # Track which model/version parsed it
    
    # Status
    is_verified = Column(Boolean, default=False)  # Manual verification flag
    is_public = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_parsed_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    parse_attempts = relationship("ParseAttempt", back_populates="recipe", cascade="all, delete-orphan")
    user_saves = relationship("UserRecipeSave", back_populates="recipe", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Recipe(id={self.id}, title='{self.title}')>"


class ParseAttempt(Base):
    __tablename__ = "parse_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)
    
    # Request Info
    source_url = Column(String(2048), nullable=False, index=True)
    language_hint = Column(String(10), nullable=True)
    
    # Status
    status = Column(String(50), nullable=False, index=True)  # success, failed, pending
    error_message = Column(Text, nullable=True)
    
    # Performance Metrics
    processing_time_ms = Column(Integer, nullable=True)
    llm_backend = Column(String(50), nullable=True)
    model_name = Column(String(100), nullable=True)
    
    # Raw Response (for debugging)
    raw_llm_response = Column(Text, nullable=True)
    
    # Timestamps
    attempted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    recipe = relationship("Recipe", back_populates="parse_attempts")
    
    def __repr__(self):
        return f"<ParseAttempt(id={self.id}, status='{self.status}', url='{self.source_url[:50]}...')>"


class UserRecipeSave(Base):
    __tablename__ = "user_recipe_saves"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # Your user system ID
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    
    # User's custom notes/modifications
    custom_notes = Column(Text, nullable=True)
    custom_tags = Column(JSON, nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5 stars
    
    # Timestamps
    saved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_accessed_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    recipe = relationship("Recipe", back_populates="user_saves")
    
    def __repr__(self):
        return f"<UserRecipeSave(user_id={self.user_id}, recipe_id={self.recipe_id})>"


class ParsingStats(Base):
    """Aggregate statistics for monitoring"""
    __tablename__ = "parsing_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Counters
    total_attempts = Column(Integer, default=0)
    successful_parses = Column(Integer, default=0)
    failed_parses = Column(Integer, default=0)
    
    # Performance
    avg_processing_time_ms = Column(Float, nullable=True)
    median_confidence_score = Column(Float, nullable=True)
    
    # Most common
    top_domains = Column(JSON, nullable=True)  # {"domain": count}
    top_languages = Column(JSON, nullable=True)
    top_cuisines = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<ParsingStats(date={self.date}, attempts={self.total_attempts})>"
