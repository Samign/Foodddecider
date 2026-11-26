# FoodDecider

A self-hosted recipe manager with a clean editing experience and AI-powered recipe import — paste a URL from any recipe website and it extracts everything automatically.

![PHP](https://img.shields.io/badge/PHP-8.x-777BB4?style=flat-square&logo=php&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=flat-square&logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **Recipe editor** — create and edit recipes with a clean, intuitive interface
- **Sectioned ingredients & steps** — group ingredients and instructions under headings (e.g. *For the sauce*, *Marinate the chicken*)
- **AI recipe import** — paste any recipe URL and Claude extracts the title, ingredients, steps, times, servings, and tags automatically
- **Ingredient autocomplete** — smart suggestions as you type ingredient names
- **Rich metadata** — track prep time, cook time, servings, course type, and tags per recipe
- **Multi-language support** — AI extraction preserves the original language of the recipe

---

## Screenshots

<!-- Add screenshots here once you have them -->
> *Screenshots are coming when I'm happy on the design*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | PHP 8.x |
| Frontend | Vanilla JavaScript, HTML, CSS |
| Database | MySQL 8.x |
| AI Extraction | Python + Anthropic Claude API |

---

## Database Schema

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

## Getting Started

### Prerequisites

- PHP 8.x with PDO extension
- MySQL 8.x
- Python 3.10+ (for AI import feature)

---

## Contributing

Pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
