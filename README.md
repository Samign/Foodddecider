# 🍽️ FoodDecider

A self-hosted recipe manager with a clean editing experience and AI-powered recipe import — paste a URL from any recipe website and it extracts everything automatically.

![PHP](https://img.shields.io/badge/PHP-8.x-777BB4?style=flat-square&logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## ✨ Features

- **Recipe editor** — create and edit recipes with a clean, intuitive interface
- **Sectioned ingredients & steps** — group ingredients and instructions under headings (e.g. *For the sauce*, *Marinate the chicken*)
- **AI recipe import** — paste any recipe URL and Claude extracts the title, ingredients, steps, times, servings, and tags automatically
- **Ingredient autocomplete** — smart suggestions as you type ingredient names
- **Rich metadata** — track prep time, cook time, servings, course type, and tags per recipe
- **Multi-language support** — AI extraction preserves the original language of the recipe

---

## 📸 Screenshots

<!-- Add screenshots here once you have them -->
> *Screenshots coming soon*

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | PHP 8.x |
| Frontend | Vanilla JavaScript, HTML, CSS |
| Database | MySQL 8.x |
| AI Extraction | Python + Anthropic Claude API |

---

## 🗄️ Database Schema

Recipes use a sectioned structure so ingredients and steps can be grouped under headings. A recipe with no sections simply has one section with a `null` title.

```
recipes
├── id
├── title
├── description
├── image_url
├── servings
├── prep_time, cook_time, total_time
├── course_type
└── tags

ingredient_sections            step_sections
├── id                         ├── id
├── recipe_id (FK)             ├── recipe_id (FK)
├── title (nullable)           ├── title (nullable)
└── sort_order                 └── sort_order

ingredients                    steps
├── id                         ├── id
├── section_id (FK)            ├── section_id (FK)
├── ingredient                 ├── instruction
├── amount                     └── sort_order
├── unit
├── notes
└── sort_order
```

---

## 🚀 Getting Started

### Prerequisites

- PHP 8.x with PDO extension
- MySQL 8.x
- Python 3.10+ (for AI import feature)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/recipebook.git
   cd Fooddecider
   ```

2. **Set up the database**
   ```bash
   mysql -u root -p < schema.sql
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and fill in your database credentials and Anthropic API key:
   ```env
   DB_HOST=localhost
   DB_NAME=recipebook
   DB_USER=your_user
   DB_PASS=your_password
   ```

4. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Serve the app**
   ```bash
   php -S localhost:8000
   ```
   Then open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 🤖 AI Recipe Import

The import feature scrapes a recipe URL and sends the page content to Claude, which extracts and normalizes:

- Title, description, and image
- Prep time, cook time, total time, and servings
- Ingredients split by section — with amounts, units, and notes parsed separately
- Steps split by section
- Tags and course type

Units are normalized automatically across languages (`msk` → `tbsp`, `dl` → `dl`, etc.), so recipes imported from Swedish, German, French, and other sites come out consistent.

To import a recipe, paste a URL into the import field on the new recipe page.

---

## 📁 Project Structure

```
recipebook/
├── index.php               # Recipe list / home
├── recipe.php              # Single recipe view
├── edit.php                # Recipe editor
├── import/
│   └── extract.py          # AI extraction script
├── api/
│   └── ingredients.php     # Autocomplete endpoint
├── assets/
│   ├── css/
│   └── js/
│       └── editor.js       # Dynamic step/ingredient editor
├── schema.sql
├── .env.example
└── requirements.txt
```

---

## 🤝 Contributing

Pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

---

## 📄 License

[MIT](LICENSE)
