"""
Production-grade Recipe Parser Service using Self-Hosted LLM
Supports multiple inference backends (vLLM, TGI, Ollama)
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Literal, Any
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
    MAX_TOKENS = 1500
    TEMPERATURE = 0.1 
    TOP_P = 0.9
    # The prompt alone (rules + two examples) is ~3,000 tokens, plus up to ~2,500 of page text
    # and 1,500 of output. At 4096 Ollama silently cut the start of the prompt (the rules).
    NUM_CTX = 8192
    LLM_TIMEOUT_S = 110          # keep below CURLOPT_TIMEOUT in import_recipe_url.php
    PAGE_TEXT_CHARS = 6000
    MAX_TAGS = 6
    PROMPT_TAG_LIST = 80         # how many existing tags the model gets to choose from


class Ingredient(BaseModel):
    ingredient: str
    amount: Optional[str] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    raw: Optional[str] = None            # "2 dl heavy cream, grated", what the user sees/edits


class IngredientSection(BaseModel):
    title: Optional[str] = None
    ingredients: List[Ingredient]


class StepSection(BaseModel):
    title: Optional[str] = None
    steps: List[str]


class Recipe(BaseModel):
    title: str
    description: Optional[str] = None
    servings: Optional[int] = None
    prep_time: Optional[int] = None      # minutes; None when the page only gives a total
    cook_time: Optional[int] = None      # minutes; holds the total when there is no prep (same as the add form)
    total_time: Optional[int] = None     # minutes
    ingredient_sections: List[IngredientSection]
    step_sections: List[StepSection]
    tags: List[str] = []
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
        self.client = httpx.AsyncClient(timeout=Config.LLM_TIMEOUT_S)
    
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



# ── Normalising what the model (or the page) gives us ────────────────────────

def slugify(text: str) -> str:
    """Same rule as slugify() in recipe_helper.php, so tags match the DB the same way."""
    return re.sub(r"[^a-z0-9]+", "-", (text or "").strip().lower()).strip("-")


_HOURS = r"(?:h|hr|hrs|hour|hours|tim|timme|timmar|std|stunde|stunden|heure|heures)"
_MINUTES = r"(?:m|min|mins|minute|minutes|minut|minuter|minuten|minuto|minutos)"


def parse_minutes(value: Any) -> Optional[int]:
    """'PT1H30M', '1 hour 30 minutes', '1,5 timmar', '45 min', 45 -> minutes. None if unknown.
    (The old version stripped non-digits, so '1 hour 30 minutes' became 130.)"""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return max(0, int(round(value)))
    text = str(value).strip().lower().replace(",", ".")

    iso = re.fullmatch(r"p(?:(\d+)d)?t?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:\d+(?:\.\d+)?s)?", text)
    if iso and any(iso.groups()):
        days, hours, mins = (float(g) if g else 0 for g in iso.groups())
        return int(round(days * 1440 + hours * 60 + mins))

    hours = re.search(rf"(\d+(?:\.\d+)?)\s*{_HOURS}\b", text)
    mins = re.search(rf"(\d+(?:\.\d+)?)\s*{_MINUTES}\b", text)
    if hours or mins:
        return int(round((float(hours.group(1)) * 60 if hours else 0) + (float(mins.group(1)) if mins else 0)))

    bare = re.search(r"\d+(?:\.\d+)?", text)          # "45" or "20-30" (takes the first)
    return int(round(float(bare.group(0)))) if bare else None


def parse_servings(value: Any) -> Optional[int]:
    if isinstance(value, list):                       # schema.org recipeYield is often ["4", "4 servings"]
        value = value[0] if value else None
    if value is None:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def build_raw(ing: dict) -> str:
    """The ingredient line as a person would write it; recipe_helper.php skips rows without one."""
    main = " ".join(str(p).strip() for p in (ing.get("amount"), ing.get("unit"), ing.get("ingredient")) if p)
    notes = (ing.get("notes") or "").strip()
    return f"{main}, {notes}" if notes else main


# Words models (and recipe sites) use for meals that aren't our course types
COURSE_SYNONYMS = {
    "main": "dinner", "main course": "dinner", "main dish": "dinner", "entree": "dinner",
    "supper": "dinner", "middag": "dinner", "side": "dinner", "side dish": "dinner",
    "appetizer": "snack", "starter": "snack", "förrätt": "snack", "tilltugg": "snack",
    "frukost": "breakfast", "lunch": "lunch", "efterrätt": "dessert", "dessert": "dessert",
    "baking": "dessert", "bakery": "dessert", "fika": "snack", "beverage": "drink", "dryck": "drink",
    "dressing": "sauce", "sås": "sauce", "condiment": "sauce",
}


def match_course(value: Any, course_types: dict) -> Optional[int]:
    """course_types: {"dinner": 4, ...} from the DB. Returns an id or None."""
    if isinstance(value, list):
        value = value[0] if value else None
    if value is None:
        return None
    if isinstance(value, int) or str(value).isdigit():
        return int(value) if int(value) in course_types.values() else None
    name = str(value).strip().lower()
    if name in course_types:
        return course_types[name]
    mapped = COURSE_SYNONYMS.get(name)
    return course_types.get(mapped) if mapped else None


def normalize_tags(model_tags: Any, existing: List[str], limit: int) -> List[str]:
    """Reuse the existing tag's spelling when it's the same tag (same slug as the DB uses),
    drop junk and duplicates, and cap the count. New tags are kept but tidied."""
    by_slug = {slugify(name): name for name in existing}
    out, seen = [], set()
    for tag in model_tags or []:
        if not isinstance(tag, str):
            continue
        tag = re.sub(r"\s+", " ", tag).strip(" #,.")
        slug = slugify(tag)
        if not slug or slug in seen or len(tag) > 30:
            continue
        seen.add(slug)
        out.append(by_slug.get(slug) or (tag[:1].upper() + tag[1:]))
        if len(out) >= limit:
            break
    return out


# Diet tags the model sometimes adds even though an ingredient rules them out (English + Swedish words)
_MEAT = r"chicken|beef|pork|bacon|ham|lamb|mince|sausage|turkey|duck|anchov|fish|salmon|tuna|shrimp|prawn|" \
        r"kyckling|nötkött|fläsk|bacon|skinka|lamm|färs|korv|kalkon|fisk|lax|tonfisk|räk"
_DAIRY = r"milk|cream|butter|cheese|yogh?urt|parmesan|feta|mozzarella|ghee|mjölk|grädde|smör|ost|yoghurt|crème|creme"
_EGG = r"\begg|\bägg"
_GLUTEN = r"flour|wheat|pasta|spaghetti|noodle|bread|breadcrumb|couscous|bulgur|barley|vetemjöl|mjöl|bröd|ströbröd|korn"
DIET_CONFLICTS = {
    "vegan": f"{_MEAT}|{_DAIRY}|{_EGG}|honey|honung",
    "vegetarian": _MEAT,
    "dairy-free": _DAIRY,
    "gluten-free": _GLUTEN,
}


def drop_impossible_diet_tags(tags: List[str], ingredient_sections: List[dict]) -> List[str]:
    names = " ".join(i["ingredient"].lower() for s in ingredient_sections for i in s["ingredients"])
    return [t for t in tags
            if not (slugify(t) in DIET_CONFLICTS and re.search(DIET_CONFLICTS[slugify(t)], names))]


def find_jsonld_recipe(soup: BeautifulSoup) -> Optional[dict]:
    """Most recipe sites embed schema.org Recipe data. It's far more reliable than page text."""
    def walk(node):
        if isinstance(node, list):
            for item in node:
                found = walk(item)
                if found:
                    return found
        elif isinstance(node, dict):
            kind = node.get("@type")
            kinds = kind if isinstance(kind, list) else [kind]
            if "Recipe" in kinds:
                return node
            for key in ("@graph", "mainEntity", "itemListElement"):
                if key in node:
                    found = walk(node[key])
                    if found:
                        return found
        return None

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or script.get_text() or "")
        except (json.JSONDecodeError, TypeError):
            try:
                data = json.loads(repair_json(script.get_text()))
            except Exception:
                continue
        found = walk(data)
        if found:
            return found
    return None


def jsonld_instructions(value: Any) -> List[dict]:
    """recipeInstructions -> [{"title": ..., "steps": [...]}], keeping HowToSection headings."""
    sections, loose = [], []

    def text_of(step):
        if isinstance(step, str):
            return BeautifulSoup(step, "html.parser").get_text(" ").strip()
        if isinstance(step, dict):
            return BeautifulSoup(str(step.get("text") or step.get("name") or ""), "html.parser").get_text(" ").strip()
        return ""

    for item in value if isinstance(value, list) else [value]:
        if isinstance(item, dict) and item.get("@type") == "HowToSection":
            steps = [t for t in (text_of(s) for s in item.get("itemListElement", [])) if t]
            if steps:
                sections.append({"title": item.get("name"), "steps": steps})
        else:
            t = text_of(item)
            if t:
                loose.append(t)
    if loose:
        sections.insert(0, {"title": None, "steps": loose})
    return sections


def jsonld_list(value: Any) -> List[str]:
    """keywords / recipeCategory / recipeCuisine: a string 'a, b' or a list."""
    if not value:
        return []
    items = value if isinstance(value, list) else str(value).split(",")
    return [str(i).strip() for i in items if str(i).strip()]


def jsonld_image(value: Any) -> Optional[str]:
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, dict):
        value = value.get("url")
    return value if isinstance(value, str) and value.startswith("http") else None


class RecipeParser:
    """Core recipe parsing logic"""
    
    def __init__(self):
        self.llm_client = LLMClient(Config.BACKEND)
    
    def sanitize_recipe(self, data: dict, page: dict, db: dict) -> dict:
        """Turn the model's JSON into something Recipe() and the PHP side accept.
        page: facts read straight from the page (JSON-LD / meta), they win over the model.
        db:   {"course_types": {...}, "tags": [...]}"""
        ld = page.get("jsonld") or {}

        # Sections: drop empty ones, accept the old flat shape if the model falls back to it
        ingredient_sections = data.get("ingredient_sections")
        if not ingredient_sections and isinstance(data.get("ingredients"), list):
            ingredient_sections = [{"title": None, "ingredients": data["ingredients"]}]
        clean_ing = []
        for section in ingredient_sections or []:
            if not isinstance(section, dict):
                continue
            items = []
            for ing in section.get("ingredients") or []:
                if isinstance(ing, str):
                    ing = {"ingredient": ing}
                if not isinstance(ing, dict) or not str(ing.get("ingredient") or "").strip():
                    continue
                ing = {k: (str(v).strip() if v is not None else None) for k, v in ing.items()
                       if k in ("ingredient", "amount", "unit", "notes")}
                ing["raw"] = build_raw(ing)
                items.append(ing)
            if items:
                clean_ing.append({"title": section.get("title") or None, "ingredients": items})
        data["ingredient_sections"] = clean_ing

        step_sections = data.get("step_sections")
        if not step_sections and isinstance(data.get("steps"), list):
            step_sections = [{"title": None, "steps": data["steps"]}]
        clean_steps = []
        for section in step_sections or []:
            if not isinstance(section, dict):
                continue
            steps = [re.sub(r"^\s*\d+[.)]\s*", "", s).strip() for s in section.get("steps") or [] if isinstance(s, str)]
            steps = [s for s in steps if s]
            if steps:
                clean_steps.append({"title": section.get("title") or None, "steps": steps})
        # The model sometimes loses steps on long pages; the page's own list is complete
        ld_steps = jsonld_instructions(ld.get("recipeInstructions")) if ld else []
        if ld_steps and sum(len(s["steps"]) for s in ld_steps) > sum(len(s["steps"]) for s in clean_steps):
            clean_steps = ld_steps
        data["step_sections"] = clean_steps

        # Times and servings: the page's structured data first, then the model
        prep = parse_minutes(ld.get("prepTime")) if ld.get("prepTime") else parse_minutes(data.get("prep_time"))
        cook = parse_minutes(ld.get("cookTime")) if ld.get("cookTime") else parse_minutes(data.get("cook_time"))
        total = parse_minutes(ld.get("totalTime")) if ld.get("totalTime") else parse_minutes(data.get("total_time"))
        if total and not cook:
            cook = max(0, total - (prep or 0)) or None   # same model as the add form: total only -> cook, no prep
            if not prep:
                prep = None
        data["prep_time"] = prep or None
        data["cook_time"] = cook
        data["total_time"] = total or ((prep or 0) + (cook or 0)) or None
        data["servings"] = parse_servings(ld.get("recipeYield")) or parse_servings(data.get("servings"))

        data["course_type"] = (match_course(data.get("course_type"), db["course_types"])
                               or match_course(jsonld_list(ld.get("recipeCategory")), db["course_types"]))
        data["tags"] = drop_impossible_diet_tags(
            normalize_tags(data.get("tags"), db["tags"], Config.MAX_TAGS), data["ingredient_sections"])
        data["image_url"] = page.get("image") or data.get("image_url")
        if not data.get("description") and ld.get("description"):
            data["description"] = BeautifulSoup(str(ld["description"]), "html.parser").get_text(" ").strip()
        if not data.get("title") and ld.get("name"):
            data["title"] = ld["name"]
        return data

    async def load_db_context(self) -> dict:
        """Course types and the tags the model should prefer (featured, then most used)."""
        conn = await asyncpg.connect(os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432"))
        try:
            courses = await conn.fetch("SELECT id, name FROM course_types ORDER BY display_order")
            tags = await conn.fetch("""
                SELECT t.name
                FROM tags t
                LEFT JOIN recipe_tags rt ON rt.tag_id = t.id
                GROUP BY t.id
                ORDER BY t.is_featured DESC, COUNT(rt.recipe_id) DESC, t.name
                LIMIT $1
            """, Config.PROMPT_TAG_LIST)
        finally:
            await conn.close()
        return {
            "course_types": {row["name"].lower(): row["id"] for row in courses},
            "tags": [row["name"] for row in tags],
        }
    
    def build_prompt(self, webpage_content: str, language_hint: Optional[str] = None,
                     existing_tags: Optional[List[str]] = None, course_names: Optional[List[str]] = None,
                     site_tags: Optional[List[str]] = None) -> str:
        """Build optimized prompt for recipe extraction"""

        lang_instruction = ""
        if language_hint:
            lang_instruction = f"\nThe recipe is likely in {language_hint} language."

        content = webpage_content

        courses = ", ".join(f'"{c}"' for c in (course_names or ["breakfast", "lunch", "dinner", "dessert", "snack", "drink"]))
        tag_list = ", ".join(existing_tags or []) or "(none yet)"
        site_tag_line = f"\nTAGS THE WEBSITE ITSELF USES: {', '.join(site_tags)}" if site_tags else ""
        
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
          "tags": [string],
          "course_type": string | null (one of: {courses})
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
        2. course_type must be exactly one of: {courses}. Never a number. Infer from context if not labeled
           (a starter or side dish -> "snack" or "dinner", a cake or cookies -> "dessert", a dressing -> "sauce" if listed).
        3. servings: extract the number as a string ("4"). May appear near plate/person icons or as "serves 4", "4 portioner", "pour 4 personnes".
        4. prep_time / cook_time / total_time: may appear as bare numbers next to clock icons with no label.
           Convention: first = prep_time, second = cook_time. Sum them for total_time if not given.
           If only one unlabeled time exists, treat it as total_time.
        5. description: often the introductory paragraph under the title. Extract it even if not labeled.
        6. tags: 3 to {Config.MAX_TAGS} tags that help someone decide to cook this: cuisine, diet (Vegetarian, Vegan,
           Gluten-Free...), main ingredient, cooking style or occasion (Quick, One-pot, Comfort food...).
           - EXISTING TAGS (prefer these, copy the spelling exactly): {tag_list}
           - Use the website's own tags when they fit, but rewrite them as an existing tag if one means the same.
           - Only invent a new tag when no existing tag covers something clearly true about the recipe.
             New tags: English, 1-2 words, Title Case (e.g. "Thai", "Air Fryer").
           - Only add a diet tag (Vegetarian, Vegan, Gluten-Free, Dairy-Free) if every ingredient allows it.
           - Do not use the course type as a tag (no "Dinner", "Lunch").
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
          "tags": ["Italian", "Pasta", "Comfort Food"],
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
          "tags": ["Indian", "Curry", "Chicken", "Creamy"],
          "course_type": "dinner"
        }}

        ---{site_tag_line}
        Webpage content:
        {content}
        
        JSON output:"""

        return prompt
    
    async def fetch_webpage(self, url: str) -> dict:
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
    
    async def extract_recipe_content(self, html: str) -> dict:
        """Returns {"text": what the model reads, "jsonld": schema.org Recipe or None,
        "image": best image url, "site_tags": the site's own keywords/categories}."""
        soup = BeautifulSoup(html, "html.parser")

        # Read structured data BEFORE scripts are stripped below (it lives in <script> tags)
        ld = find_jsonld_recipe(soup)

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

        site_tags = []
        if ld:
            site_tags = (jsonld_list(ld.get("keywords")) + jsonld_list(ld.get("recipeCuisine"))
                         + [d.replace("Diet", "").split("/")[-1] for d in jsonld_list(ld.get("suitableForDiet"))])
            structured = {k: ld.get(k) for k in ("name", "description", "recipeYield", "prepTime", "cookTime",
                                                 "totalTime", "recipeCategory", "recipeIngredient")
                          if ld.get(k)}
            structured["recipeInstructions"] = jsonld_instructions(ld.get("recipeInstructions"))
            meta_block += "STRUCTURED RECIPE DATA FROM THE PAGE (trust this over the page text):\n"
            meta_block += json.dumps(structured, ensure_ascii=False)[:4000] + "\n"

        # Then strip HTML for the body
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
            tag.decompose()
        body_text = re.sub(r'\s+', ' ', soup.get_text()).strip()

        return {
            "text": f"{meta_block}\nPAGE TEXT:\n{body_text}"[:Config.PAGE_TEXT_CHARS + 4000],
            "jsonld": ld,
            "image": (jsonld_image(ld.get("image")) if ld else None) or meta.get("og:image"),
            "site_tags": list({slugify(t): t for t in reversed(site_tags) if slugify(t)}.values())[::-1][:15],
        }

    async def parse_recipe(self, url: str, language_hint: Optional[str] = None) -> Recipe:
        """Main parsing pipeline"""
        
        # Fetch webpage content, and what we can trust in it without the model
        page = await self.fetch_webpage(url)
        db = await self.load_db_context()

        # Build prompt
        prompt = self.build_prompt(page["text"], language_hint,
                                   existing_tags=db["tags"],
                                   course_names=list(db["course_types"].keys()),
                                   site_tags=page["site_tags"])
        
        # Generate with LLM
        raw_response = await self.llm_client.generate(prompt)
        
        # Parse JSON response
        try:
            
            # Clean up response
            json_str = repair_json(raw_response.strip())
            
            recipe_data = json.loads(json_str)

            if isinstance(recipe_data, list):           # model wrapped it in an array
                recipe_data = recipe_data[0] if recipe_data else {}

            recipe_data = self.sanitize_recipe(recipe_data, page, db)
            recipe_data["source_url"] = url

            if not recipe_data["ingredient_sections"] or not recipe_data["step_sections"]:
                raise ValueError("no ingredients or steps found on the page")

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
