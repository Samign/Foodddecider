"""
Production-grade Recipe Parser Service using Self-Hosted LLM
Supports multiple inference backends (vLLM, TGI, Ollama)
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Literal
import httpx
import json
from datetime import datetime
import hashlib
import logging
import asyncpg
from enum import Enum
import os
import re 
from bs4 import BeautifulSoup
from json_repair import repair_json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Recipe Parser API", version="1.0.0")


class InferenceBackend(str, Enum):
    VLLM = "vllm"
    TGI = "tgi"
    OLLAMA = "ollama"


class Config:
    """Configuration for LLM inference backend"""
    
    # Choose your backend
    BACKEND: InferenceBackend = InferenceBackend.OLLAMA
    
    # Use environment variables if they exist, otherwise fallback to localhost (for local dev)
    OLLAMA_URL = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434/api/generate")
    VLLM_URL = os.getenv("VLLM_ENDPOINT", "http://localhost:8000/v1/completions")
    TGI_URL = os.getenv("TGI_ENDPOINT", "http://localhost:8080/generate")

    ENDPOINTS = {
        InferenceBackend.VLLM: VLLM_URL,
        InferenceBackend.TGI: TGI_URL,
        InferenceBackend.OLLAMA: OLLAMA_URL
    }
    
    # Model configurations
    MODELS = {
        InferenceBackend.VLLM: "meta-llama/Llama-3.1-8B-Instruct",
        InferenceBackend.TGI: "Qwen/Qwen2.5-7B-Instruct",
        InferenceBackend.OLLAMA: "llama3.1:8b-instruct-q4_0"
    }
    
    # Generation parameters
    MAX_TOKENS = 1200
    TEMPERATURE = 0.1 
    TOP_P = 0.9
    NUM_CTX = 4096


class Ingredient(BaseModel):
    ingredient: str
    amount: Optional[str] = None
    unit: Optional[str] = None
    notes: Optional[str] = None

class Recipe(BaseModel):
    title: str
    description: Optional[str] = None
    servings: Optional[str] = None
    prep_time: Optional[str] = None
    cook_time: Optional[str] = None
    total_time: Optional[str] = None
    ingredients: List[Ingredient]
    steps: List[str]
    tags: Optional[List[str]] = None
    course_type: Optional[int] = None
    difficulty: Optional[str] = None
    source_url: Optional[str] = None
    author: Optional[str] = None
    language: Optional[str] = None
    image_url: Optional[str] = None


class ParseRequest(BaseModel):
    url: HttpUrl
    language_hint: Optional[str] = Field(None, description="ISO 639-1 language code (e.g., 'en', 'sv', 'es')")


class ParseResponse(BaseModel):
    recipe: Recipe
    confidence_score: Optional[float] = None
    processing_time_ms: int
    cached: bool = False


class LLMClient:
    """Unified client for different LLM inference backends"""
    
    def __init__(self, backend: InferenceBackend):
        self.backend = backend
        self.endpoint = Config.ENDPOINTS[backend]
        self.model = Config.MODELS[backend]
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def generate(self, prompt: str) -> str:
        """Generate response from LLM based on backend type"""
        
        if self.backend == InferenceBackend.OLLAMA:
            return await self._generate_ollama(prompt)
        elif self.backend == InferenceBackend.VLLM:
            return await self._generate_vllm(prompt)
        elif self.backend == InferenceBackend.TGI:
            return await self._generate_tgi(prompt)
    
    async def _generate_ollama(self, prompt: str) -> str:
        """Generate using Ollama API"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": Config.TEMPERATURE,
                "top_p": Config.TOP_P,
                "num_predict": Config.MAX_TOKENS,
                "num_ctx": Config.NUM_CTX
            }
        }
        
        response = await self.client.post(self.endpoint, json=payload)
        response.raise_for_status()
        return response.json()["response"]
    
    async def _generate_vllm(self, prompt: str) -> str:
        """Generate using vLLM OpenAI-compatible API"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "max_tokens": Config.MAX_TOKENS,
            "temperature": Config.TEMPERATURE,
            "top_p": Config.TOP_P
        }
        
        response = await self.client.post(self.endpoint, json=payload)
        response.raise_for_status()
        return response.json()["choices"][0]["text"]
    
    async def _generate_tgi(self, prompt: str) -> str:
        """Generate using Text Generation Inference"""
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": Config.MAX_TOKENS,
                "temperature": Config.TEMPERATURE,
                "top_p": Config.TOP_P,
                "do_sample": True
            }
        }
        
        response = await self.client.post(self.endpoint, json=payload)
        response.raise_for_status()
        return response.json()["generated_text"]
    
    async def close(self):
        await self.client.aclose()


class RecipeParser:
    """Core recipe parsing logic"""
    
    def __init__(self):
        self.llm_client = LLMClient(Config.BACKEND)
    
    def sanitize_recipe(self, data: dict) -> dict:
        # Fix instructions with null content
        if "instructions" in data:
            data["instructions"] = [
                step for step in data["instructions"]
                if isinstance(step.get("content"), str) and step["content"].strip()
            ]

        # Strip prep_time, cook_time, servings for integers
        if "prep_time" in data and data["prep_time"] is not None:
            data["prep_time"] = re.sub(r'\D', '', data["prep_time"])
        if "cook_time" in data and data["cook_time"] is not None:
            data["cook_time"] = re.sub(r'\D', '', data["cook_time"])
        if "servings" in data and data["servings"] is not None:
            data["servings"] = re.sub(r'\D', '', data["servings"])
        return data
    
    def build_prompt(self, webpage_content: str, language_hint: Optional[str] = None) -> str:
        """Build optimized prompt for recipe extraction"""

        lang_instruction = ""
        if language_hint:
            lang_instruction = f"\nThe recipe is likely in {language_hint} language."

        content = webpage_content[:8000]
        if len(webpage_content) > 8000:
            content += "\n[Content truncated]"
        
        prompt = f"""You are a precise recipe extraction system. Extract the recipe from the webpage content provided and return ONLY a valid JSON object, no markdown, no explanations, no text before or after the JSON.
        {lang_instruction}

        OUTPUT SCHEMA:
        {{
          "title": string,
          "description": string | null,
          "image_url": string | null,
          "servings": string | null,
          "prep_time": string | null,
          "cook_time": string | null,
          "total_time": string | null,
          "ingredient_sections": [
            {{
              "title": string | null,
              "ingredients": [
                {{
                  "ingredient": string,
                  "amount": string | null,
                  "unit": string | null,
                  "notes": string | null
                }}
              ]
            }}
          ],
          "step_sections": [
            {{
              "title": string | null,
              "steps": [string]
            }}
          ],
          "tags": [string] | null,
          "course_type": string | null (e.g. "dinner", "lunch", "dessert" - never a number)
        }}
        
        AMOUNT AND UNIT RULES (critical — follow exactly):
        - "amount" = the numeric part ONLY. Examples: "2", "1/2", "200", "1.5"
        - "unit" = the unit string ONLY. Examples: "kg", "tbsp", "dl", "cup", "ml"
        - NEVER put both in the same field. "1 kg" in amount is wrong.
        - If the ingredient has no unit (e.g. "2 eggs", "3 garlic cloves"): amount = "2", unit = null
        - If you can see a number but no unit: amount = the number, unit = null. Do NOT invent a unit.
        - Fractions like "½" → amount = "0.5", or keep as "1/2" — be consistent.

        UNIT NORMALIZATION (always normalize to these):
        | Source text                        | Normalize to |
        |------------------------------------|--------------|
        | tablespoon, msk, EL, c. à s., cda  | tbsp         |
        | teaspoon, tsk, TL, c. à c., cdta   | tsp          |
        | dl, deciliter                      | dl           |
        | milliliter, ml                     | ml           |
        | liter, litre, l, L                 | l            |
        | gram, g, gr                        | g            |
        | kilogram, kg, kilo                 | kg           |
        | ounce, oz                          | oz           |
        | pound, lb                          | lb           |
        | cup, cups                          | cup          |
        | fluid ounce, fl oz                 | fl oz        |
        | pieces, st, stk, pcs (Swedish/DE)  | null unit, number in amount |

        FIELD RULES:
        1. Preserve original language in title, description, ingredients, and steps.
        2. course_type must be an English meal category word: "breakfast", "lunch", "dinner", "dessert", "snack", "appetizer", "side", "drink". Never a number. Infer from context if not labeled.
        3. servings: extract the number as a string ("4"). May appear near plate/person icons or as "serves 4", "4 portioner", "pour 4 personnes".
        4. prep_time / cook_time / total_time: may appear as bare numbers next to clock icons with no label.
           Convention: first = prep_time, second = cook_time. Sum them for total_time if not given.
           If only one unlabeled time exists, treat it as total_time.
        5. description: often the introductory paragraph under the title. Extract it even if not labeled.
        6. tags: extract from the page if available. If none, generate 3 to 5 relevant tags from title, cuisine, course type, and main ingredients.
        7. steps: plain strings in order, no numbering prefix (not "1. Boil water" — just "Boil water").
        8. Use null only when the information truly cannot be found or inferred. Do not guess wildly.
        9. ingredient_sections / step_sections: always use these instead of flat arrays.
           - If the recipe has no section headings, return a single section with title: null.
           - If headings exist (e.g. "For the sauce", "To serve"), split into separate sections.
           - Never duplicate items across sections.
           - Section titles should be extracted verbatim from the page, in the original language.
           - A section must have at least one item — never emit an empty section.

        ---
        EXAMPLES:

        === EXAMPLE 1: No sections ===

        Input:
        Spaghetti and Meatballs
        A comforting Italian classic.
        
        Prep: 10 min | Cook: 20 min | Serves: 4
        
        Ingredients:
        - 500 g ground beef
        - 400 g spaghetti
        - 1 dl marinara sauce
        - 2 garlic cloves
        - ½ tsp black pepper
        
        Instructions:
        1. Shape ground beef into meatballs.
        2. Cook spaghetti according to package instructions.
        3. Simmer meatballs in marinara sauce for 20 minutes.
        
        Output:
        {{
          "title": "Spaghetti and Meatballs",
          "description": "A comforting Italian classic.",
          "image_url": null,
          "servings": "4",
          "prep_time": "10 minutes",
          "cook_time": "20 minutes",
          "total_time": "30 minutes",
          "ingredient_sections": [
            {{
              "title": null,
              "ingredients": [
                {{"ingredient": "Ground beef", "amount": "500", "unit": "g", "notes": null}},
                {{"ingredient": "Spaghetti", "amount": "400", "unit": "g", "notes": null}},
                {{"ingredient": "Marinara sauce", "amount": "1", "unit": "dl", "notes": null}},
                {{"ingredient": "Garlic cloves", "amount": "2", "unit": null, "notes": null}},
                {{"ingredient": "Black pepper", "amount": "0.5", "unit": "tsp", "notes": null}}
              ]
            }}
          ],
          "step_sections": [
            {{
              "title": null,
              "steps": [
                "Shape ground beef into meatballs.",
                "Cook spaghetti according to package instructions.",
                "Simmer meatballs in marinara sauce for 20 minutes."
              ]
            }}
          ],
          "tags": ["Italian", "Pasta", "Dinner", "Comfort food"],
          "course_type": "dinner"
        }}

        === EXAMPLE 2: Multiple sections ===

        Input:
        Chicken Tikka Masala
        A rich and aromatic Indian-inspired curry with tender marinated chicken in a creamy tomato sauce.

        Prep: 20 min | Cook: 40 min | Serves: 4

        Ingredients:

        For the marinade:
        - 600 g chicken breast
        - 150 g plain yogurt
        - 2 tsp garam masala
        - 1 tsp turmeric
        - 1 tsp chili powder

        For the sauce:
        - 2 tbsp vegetable oil
        - 1 onion
        - 3 garlic cloves
        - 1 tbsp fresh ginger, grated
        - 400 g canned tomatoes
        - 2 dl heavy cream
        - 1 tsp sugar
        - salt to taste

        To serve:
        - 300 g basmati rice
        - fresh cilantro

        Instructions:

        Marinate the chicken:
        1. Cut chicken into bite-sized pieces.
        2. Mix yogurt, garam masala, turmeric, and chili powder into a marinade.
        3. Coat the chicken and marinate for at least 1 hour.

        Cook the sauce:
        4. Heat oil in a pan and fry onion until soft.
        5. Add garlic and ginger and cook for 2 minutes.
        6. Stir in canned tomatoes and simmer for 15 minutes.
        7. Blend the sauce until smooth, then return to pan.
        8. Stir in cream and sugar, season with salt.

        Finish and serve:
        9. Grill or pan-fry the marinated chicken until charred.
        10. Add chicken to the sauce and simmer for 10 minutes.
        11. Serve over basmati rice and garnish with fresh cilantro.

        Output:
        {{
          "title": "Chicken Tikka Masala",
          "description": "A rich and aromatic Indian-inspired curry with tender marinated chicken in a creamy tomato sauce.",
          "image_url": null,
          "servings": "4",
          "prep_time": "20 minutes",
          "cook_time": "40 minutes",
          "total_time": "60 minutes",
          "ingredient_sections": [
            {{
              "title": "For the marinade",
              "ingredients": [
                {{"ingredient": "Chicken breast", "amount": "600", "unit": "g", "notes": null}},
                {{"ingredient": "Plain yogurt", "amount": "150", "unit": "g", "notes": null}},
                {{"ingredient": "Garam masala", "amount": "2", "unit": "tsp", "notes": null}},
                {{"ingredient": "Turmeric", "amount": "1", "unit": "tsp", "notes": null}},
                {{"ingredient": "Chili powder", "amount": "1", "unit": "tsp", "notes": null}}
              ]
            }},
            {{
              "title": "For the sauce",
              "ingredients": [
                {{"ingredient": "Vegetable oil", "amount": "2", "unit": "tbsp", "notes": null}},
                {{"ingredient": "Onion", "amount": "1", "unit": null, "notes": null}},
                {{"ingredient": "Garlic cloves", "amount": "3", "unit": null, "notes": null}},
                {{"ingredient": "Fresh ginger", "amount": "1", "unit": "tbsp", "notes": "grated"}},
                {{"ingredient": "Canned tomatoes", "amount": "400", "unit": "g", "notes": null}},
                {{"ingredient": "Heavy cream", "amount": "2", "unit": "dl", "notes": null}},
                {{"ingredient": "Sugar", "amount": "1", "unit": "tsp", "notes": null}},
                {{"ingredient": "Salt", "amount": null, "unit": null, "notes": "to taste"}}
              ]
            }},
            {{
              "title": "To serve",
              "ingredients": [
                {{"ingredient": "Basmati rice", "amount": "300", "unit": "g", "notes": null}},
                {{"ingredient": "Fresh cilantro", "amount": null, "unit": null, "notes": null}}
              ]
            }}
          ],
          "step_sections": [
            {{
              "title": "Marinate the chicken",
              "steps": [
                "Cut chicken into bite-sized pieces.",
                "Mix yogurt, garam masala, turmeric, and chili powder into a marinade.",
                "Coat the chicken and marinate for at least 1 hour."
              ]
            }},
            {{
              "title": "Cook the sauce",
              "steps": [
                "Heat oil in a pan and fry onion until soft.",
                "Add garlic and ginger and cook for 2 minutes.",
                "Stir in canned tomatoes and simmer for 15 minutes.",
                "Blend the sauce until smooth, then return to pan.",
                "Stir in cream and sugar, season with salt."
              ]
            }},
            {{
              "title": "Finish and serve",
              "steps": [
                "Grill or pan-fry the marinated chicken until charred.",
                "Add chicken to the sauce and simmer for 10 minutes.",
                "Serve over basmati rice and garnish with fresh cilantro."
              ]
            }}
          ],
          "tags": ["Indian", "Curry", "Chicken", "Dinner", "Creamy"],
          "course_type": "dinner"
        }}

        ---
        Webpage content:
        {content}
        
        JSON output:"""

        return prompt
    
    async def fetch_webpage(self, url: str) -> str:
        """Fetch and extract text content from webpage"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    str(url),
                    headers={
                        "User-Agent": "Mozilla/5.0 (compatible; RecipeParser/1.0)",
                        "Accept": "text/html,application/xhtml+xml"
                    },
                    follow_redirects=True
                )
                response.raise_for_status()
                
                html_content = response.text
                
                return await self.extract_recipe_content(html_content)
                
            except Exception as e:
                logger.error(f"Error fetching webpage: {e}")
                raise HTTPException(status_code=400, detail=f"Failed to fetch webpage: {str(e)}")
    
    async def extract_recipe_content(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")

        # Pull meta tags first
        meta = {}
        for tag in soup.find_all("meta"):
            name = tag.get("name") or tag.get("property", "")
            content = tag.get("content", "")
            if name and content:
                meta[name] = content

        # Build a clean header the model can easily read
        meta_block = ""
        if meta.get("description"):
            meta_block += f"Description: {meta['description']}\n"
        if meta.get("og:image"):
            meta_block += f"Image: {meta['og:image']}\n"

        # Then strip HTML for the body
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        body_text = re.sub(r'\s+', ' ', soup.get_text()).strip()

        return f"{meta_block}\n{body_text}"[:5000]

    async def parse_recipe(self, url: str, language_hint: Optional[str] = None) -> Recipe:
        """Main parsing pipeline"""
        
        # Fetch webpage content
        webpage_content = await self.fetch_webpage(url)
        
        # Build prompt
        prompt = self.build_prompt(webpage_content, language_hint)
        
        # Generate with LLM
        raw_response = await self.llm_client.generate(prompt)
        
        # Parse JSON response
        try:
            
            # Clean up response
            json_str = repair_json(raw_response.strip())
            
            recipe_data = json.loads(json_str)

            recipe_data = self.sanitize_recipe(recipe_data)

            recipe_data["source_url"] = url

            DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432")
            conn = await asyncpg.connect(DATABASE_URL)
            course_types = await conn.fetch(""" SELECT id, name FROM course_types """)
            course_types = {
                row["name"]: row["id"] for row in course_types
            }
            await conn.close()

            recipe_data["course_type"] = course_types.get(recipe_data.get("course_type", "").lower(), None)



            return Recipe(**recipe_data)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}\nResponse: {raw_response}")
            raise HTTPException(status_code=500, detail="Failed to parse recipe from LLM response")
        except Exception as e:
            logger.error(f"Error creating Recipe object: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to validate recipe data: {str(e)}")


# Initialize parser
parser = RecipeParser()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await parser.llm_client.close()


@app.get("/")
async def root():
    """API health check"""
    return {
        "service": "Recipe Parser API",
        "status": "running",
        "backend": Config.BACKEND.value,
        "model": Config.MODELS[Config.BACKEND]
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    try:
        # Quick test to LLM backend
        test_response = await parser.llm_client.generate("Reply with OK")
        llm_healthy = "ok" in test_response.lower()
    except:
        llm_healthy = False
    
    return {
        "api": "healthy",
        "llm_backend": "healthy" if llm_healthy else "unhealthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/parse", response_model=ParseResponse)
async def parse_recipe_endpoint(request: ParseRequest):
    """
    Parse a recipe from a given URL
    
    - **url**: The URL of the recipe webpage
    - **language_hint**: Optional ISO 639-1 language code to help with parsing
    """
    start_time = datetime.utcnow()
    
    try:
        recipe = await parser.parse_recipe(str(request.url), request.language_hint)
        
        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        return ParseResponse(
            recipe=recipe,
            processing_time_ms=processing_time,
            cached=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error parsing recipe: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/parse/batch")
async def parse_batch(urls: List[HttpUrl], background_tasks: BackgroundTasks):
    """
    Parse multiple recipes asynchronously
    Returns immediately with job IDs
    """
    job_ids = []
    
    for url in urls:
        # Generate job ID
        job_id = hashlib.md5(f"{url}{datetime.utcnow()}".encode()).hexdigest()
        job_ids.append(job_id)
        
        # Add to background tasks (in production, use Celery instead)
        background_tasks.add_task(parse_and_store, str(url), job_id)
    
    return {
        "status": "processing",
        "job_ids": job_ids,
        "message": "Check /jobs/{job_id} for status"
    }


async def parse_and_store(url: str, job_id: str):
    """Background task to parse and store recipe"""
    try:
        recipe = await parser.parse_recipe(url)
        # Store in database (implement your storage logic here)
        logger.info(f"Successfully parsed recipe from {url} (job: {job_id})")
    except Exception as e:
        logger.error(f"Failed to parse recipe from {url} (job: {job_id}): {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
