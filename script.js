// Category selection handler
document.querySelectorAll('.square').forEach(square => {
    square.addEventListener('click', () => {
        const category = square.dataset.category;
        showResults(category);
    });
});

// Back button handler
document.getElementById('back-button').addEventListener('click', () => {
    showSplash();
});

function showSplash() {
    document.getElementById('splash-page').classList.add('active');
    document.getElementById('results-page').classList.remove('active');
}

function showResults(category) {
    // Handle "surprise me" - randomly pick a category
    if (category === 'surprise') {
        const categories = ['food', 'music', 'writing'];
        category = categories[Math.floor(Math.random() * categories.length)];
    }
    
    document.getElementById('splash-page').classList.remove('active');
    document.getElementById('results-page').classList.add('active');
    
    const resultsContent = document.getElementById('results-content');
    
    // Show filter options for food category
    if (category === 'food') {
        showFoodFilters(resultsContent);
    } else {
        resultsContent.innerHTML = '<div class="loading">Loading inspiration...</div>';
        // Fetch content based on category
        fetchContent(category).then(data => {
            displayResults(category, data);
        }).catch(error => {
            resultsContent.innerHTML = `
                <div style="text-align: center; color: #e74c3c;">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">Oops! Something went wrong.</p>
                    <p>${error.message}</p>
                    <button onclick="showSplash()" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
                </div>
            `;
        });
    }
}

async function fetchContent(category, options = {}) {
    switch(category) {
        case 'food':
            return await fetchFood(options.cuisine, options.category, options.ingredient);
        case 'music':
            return await fetchMusic();
        case 'writing':
            return await fetchWriting();
        default:
            throw new Error('Unknown category');
    }
}

// Food API - Using TheMealDB (free, no API key needed)
async function fetchFood(cuisine = null, category = null, ingredient = null) {
    try {
        let meal;
        
        // If all filters are null/empty, get completely random meal
        if (!cuisine && !category && !ingredient) {
            const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
            const data = await response.json();
            meal = data.meals[0];
        } else {
            // Use filter endpoint - returns basic info, need to lookup full details
            let filterUrl = 'https://www.themealdb.com/api/json/v1/1/filter.php?';
            
            if (cuisine && cuisine !== 'random') {
                filterUrl += `a=${encodeURIComponent(cuisine)}`;
            } else if (category && category !== 'random') {
                filterUrl += `c=${encodeURIComponent(category)}`;
            } else if (ingredient && ingredient !== 'random') {
                filterUrl += `i=${encodeURIComponent(ingredient)}`;
            }
            
            const filterResponse = await fetch(filterUrl);
            const filterData = await filterResponse.json();
            
            if (!filterData.meals || filterData.meals.length === 0) {
                throw new Error('No recipes found with those filters. Try a different selection.');
            }
            
            // Pick a random meal from filtered results
            const randomMeal = filterData.meals[Math.floor(Math.random() * filterData.meals.length)];
            
            // Get full details using lookup
            const lookupResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${randomMeal.idMeal}`);
            const lookupData = await lookupResponse.json();
            meal = lookupData.meals[0];
        }
        
        return {
            title: meal.strMeal,
            description: meal.strInstructions,
            image: meal.strMealThumb,
            category: meal.strCategory,
            area: meal.strArea,
            youtube: meal.strYoutube,
            source: meal.strSource
        };
    } catch (error) {
        throw new Error(error.message || 'Failed to fetch recipe. Please try again.');
    }
}

// Fetch lists for dropdowns
async function fetchCategories() {
    try {
        const response = await fetch('https://www.themealdb.com/api/json/v1/1/list.php?c=list');
        const data = await response.json();
        return data.meals.map(item => item.strCategory).sort();
    } catch (error) {
        return [];
    }
}

async function fetchAreas() {
    try {
        const response = await fetch('https://www.themealdb.com/api/json/v1/1/list.php?a=list');
        const data = await response.json();
        return data.meals.map(item => item.strArea).sort();
    } catch (error) {
        return [];
    }
}

async function fetchIngredients() {
    try {
        const response = await fetch('https://www.themealdb.com/api/json/v1/1/list.php?i=list');
        const data = await response.json();
        return data.meals.map(item => item.strIngredient).sort();
    } catch (error) {
        return [];
    }
}

// Show food filter selection UI
async function showFoodFilters(resultsContent) {
    resultsContent.innerHTML = '<div class="loading">Loading options...</div>';
    
    try {
        const [categories, areas, ingredients] = await Promise.all([
            fetchCategories(),
            fetchAreas(),
            fetchIngredients()
        ]);
        
        const html = `
            <div class="food-filters">
                <h2 style="color: #667eea; margin-bottom: 2rem; font-size: 2rem;">Choose Your Recipe Filter</h2>
                <p style="color: #666; margin-bottom: 2rem;">Select one option below, or choose "Random" for a surprise!</p>
                
                <div class="filter-group">
                    <label for="cuisine-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Cuisine:</label>
                    <select id="cuisine-select" class="filter-select">
                        <option value="random">Random</option>
                        ${areas.map(area => `<option value="${area}">${area}</option>`).join('')}
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="category-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Category:</label>
                    <select id="category-select" class="filter-select">
                        <option value="random">Random</option>
                        ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="ingredient-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Main Ingredient:</label>
                    <input type="text" id="ingredient-input" class="filter-input" placeholder="Type an ingredient (e.g., chicken, pasta, tomatoes) or leave empty for random">
                    <p style="font-size: 0.85rem; color: #999; margin-top: 0.5rem;">Leave empty for random selection</p>
                </div>
                
                <button onclick="applyFoodFilter()" class="filter-button">Get Recipe!</button>
            </div>
        `;
        
        resultsContent.innerHTML = html;
    } catch (error) {
        resultsContent.innerHTML = `
            <div style="text-align: center; color: #e74c3c;">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Oops! Something went wrong.</p>
                <p>${error.message}</p>
                <button onclick="showSplash()" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Go Back</button>
            </div>
        `;
    }
}

// Apply food filter and fetch recipe
async function applyFoodFilter() {
    const cuisine = document.getElementById('cuisine-select').value;
    const category = document.getElementById('category-select').value;
    const ingredientInput = document.getElementById('ingredient-input');
    const ingredient = ingredientInput ? ingredientInput.value.trim() : '';
    
    // Determine which filter to use (priority: cuisine > category > ingredient)
    // If all are "random" or empty, we'll pass all nulls for completely random
    let selectedFilter = null;
    let filterType = null;
    
    if (cuisine && cuisine !== 'random') {
        selectedFilter = cuisine;
        filterType = 'cuisine';
    } else if (category && category !== 'random') {
        selectedFilter = category;
        filterType = 'category';
    } else if (ingredient && ingredient !== '') {
        // Use the text input value (case-insensitive, API handles it)
        selectedFilter = ingredient;
        filterType = 'ingredient';
    }
    // If all are "random" or empty, selectedFilter and filterType remain null
    
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '<div class="loading">Finding your perfect recipe...</div>';
    
    try {
        const options = {
            cuisine: filterType === 'cuisine' ? selectedFilter : null,
            category: filterType === 'category' ? selectedFilter : null,
            ingredient: filterType === 'ingredient' ? selectedFilter : null
        };
        
        const data = await fetchContent('food', options);
        displayResults('food', data);
    } catch (error) {
        resultsContent.innerHTML = `
            <div style="text-align: center; color: #e74c3c;">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Oops! Something went wrong.</p>
                <p>${error.message}</p>
                <button onclick="showResults('food')" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
            </div>
        `;
    }
}

// Music API - Curated suggestions (can be enhanced with Last.fm API)
async function fetchMusic() {
    // Curated list of music discovery suggestions
    const suggestions = [
        {
            title: 'Explore Indie Pop',
            artist: 'Discover artists like Clairo, Rex Orange County, or Boy Pablo',
            description: 'Dive into the world of indie pop - perfect for a chill afternoon or evening vibe.',
            genres: ['Indie Pop', 'Bedroom Pop', 'Alternative']
        },
        {
            title: 'Jazz Classics',
            artist: 'Listen to Miles Davis, John Coltrane, or Billie Holiday',
            description: 'Take a journey through timeless jazz classics that never go out of style.',
            genres: ['Jazz', 'Bebop', 'Cool Jazz']
        },
        {
            title: 'Electronic Vibes',
            artist: 'Check out Daft Punk, ODESZA, or Flume',
            description: 'Get lost in electronic soundscapes perfect for focus or dancing.',
            genres: ['Electronic', 'House', 'Ambient']
        },
        {
            title: 'Folk & Acoustic',
            artist: 'Discover Bon Iver, Fleet Foxes, or Iron & Wine',
            description: 'Soothing acoustic melodies and heartfelt lyrics for a peaceful moment.',
            genres: ['Folk', 'Indie Folk', 'Acoustic']
        },
        {
            title: 'Hip-Hop Essentials',
            artist: 'Explore Kendrick Lamar, J. Cole, or Tyler, The Creator',
            description: 'Thought-provoking lyrics and innovative beats in modern hip-hop.',
            genres: ['Hip-Hop', 'Rap', 'Alternative Hip-Hop']
        }
    ];
    
    // Return a random suggestion
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    
    return {
        title: randomSuggestion.title,
        artist: randomSuggestion.artist,
        description: randomSuggestion.description,
        genres: randomSuggestion.genres
    };
}

// Writing API - Using PoetryDB (free, no API key needed)
async function fetchWriting() {
    try {
        const response = await fetch('https://poetrydb.org/random');
        const poems = await response.json();
        const poem = poems[0];
        
        return {
            title: poem.title,
            author: poem.author,
            lines: poem.lines,
            linecount: poem.linecount
        };
    } catch (error) {
        // Fallback: use a quotes API
        try {
            const quoteResponse = await fetch('https://api.quotable.io/random');
            const quote = await quoteResponse.json();
            return {
                title: 'Inspirational Quote',
                author: quote.author,
                content: quote.content,
                tags: quote.tags
            };
        } catch (quoteError) {
            throw new Error('Failed to fetch writing inspiration. Please try again.');
        }
    }
}

function displayResults(category, data) {
    const resultsContent = document.getElementById('results-content');
    let html = '';
    
    if (category === 'food') {
        html = `
            <div class="result-item">
                <h2 class="result-title">${data.title}</h2>
                <div class="result-meta">${data.category} • ${data.area}</div>
                ${data.image ? `<img src="${data.image}" alt="${data.title}" style="max-width: 100%; border-radius: 10px; margin: 1rem 0;">` : ''}
                <div class="result-description">${data.description.substring(0, 500)}${data.description.length > 500 ? '...' : ''}</div>
                ${data.youtube ? `<a href="${data.youtube}" target="_blank" class="result-link">Watch on YouTube →</a>` : ''}
                ${data.source ? `<a href="${data.source}" target="_blank" class="result-link">View Full Recipe →</a>` : ''}
            </div>
        `;
    } else if (category === 'music') {
        html = `
            <div class="result-item">
                <h2 class="result-title">${data.title}</h2>
                <div class="result-meta">${data.artist}</div>
                <div class="result-description">${data.description}</div>
                <div style="margin-top: 1.5rem;">
                    <p style="margin-bottom: 0.5rem; font-weight: 600; color: #667eea;">Genres to explore:</p>
                    ${data.genres.map(genre => `<span style="display: inline-block; margin: 0.5rem; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 5px; color: #667eea;">${genre}</span>`).join('')}
                </div>
                <p style="margin-top: 1.5rem; color: #667eea; font-weight: 600;">Search on Spotify, Apple Music, or YouTube Music!</p>
            </div>
        `;
    } else if (category === 'writing') {
        if (data.lines) {
            // Poetry
            html = `
                <div class="result-item">
                    <h2 class="result-title">${data.title}</h2>
                    <div class="result-meta">by ${data.author}</div>
                    <div class="result-description" style="white-space: pre-line; font-style: italic; line-height: 2;">
${data.lines.join('\n')}
                    </div>
                </div>
            `;
        } else {
            // Quote
            html = `
                <div class="result-item">
                    <h2 class="result-title">${data.title}</h2>
                    <div class="result-meta">— ${data.author}</div>
                    <div class="result-description" style="font-size: 1.3rem; line-height: 1.8; font-style: italic; color: #667eea;">
                        "${data.content}"
                    </div>
                </div>
            `;
        }
    }
    
    resultsContent.innerHTML = html;
}

// Make functions available globally
window.showSplash = showSplash;
window.showResults = showResults;
window.applyFoodFilter = applyFoodFilter;

