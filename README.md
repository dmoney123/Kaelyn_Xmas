# Inspiration Website

A simple, beautiful website that provides inspiration through food, music, and writing.

## Features

- **Splash Page**: Four clickable squares for different inspiration categories
- **Food**: Random recipes from TheMealDB
- **Music**: Music discovery suggestions (Last.fm integration ready)
- **Writing**: Random poetry or inspirational quotes
- **Surprise Me**: Randomly selects one of the categories

## Setup

1. Open `index.html` in a web browser
2. That's it! No build process needed.

## API Keys (Optional)

The website works completely without any API keys! All APIs used are either:
- Free and public (TheMealDB, PoetryDB)
- Use curated content (Music suggestions)

### Future Enhancement: Music API (Last.fm)
If you want to add real-time music recommendations:
1. Get a free API key from [Last.fm API](https://www.last.fm/api)
2. You can modify `fetchMusic()` in `script.js` to use the API

## Future Improvements

- Add genre selection for music
- Add recipe type/cuisine filters
- Add writing style preferences
- Save favorite inspirations
- Share functionality

## Technologies

- Vanilla HTML, CSS, and JavaScript
- TheMealDB API (food)
- PoetryDB API (writing)
- Last.fm API (music - optional)

