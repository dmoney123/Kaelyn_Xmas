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
    
    // Show filter options for food and music categories
    if (category === 'food') {
        showFoodFilters(resultsContent);
    } else if (category === 'music') {
        showMusicFilters(resultsContent);
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
            return await fetchMusic(options.genre, options.artist);
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
        
        // Normalize filter values
        const hasCuisine = cuisine && cuisine !== 'random';
        const hasCategory = category && category !== 'random';
        const hasIngredient = ingredient && ingredient !== '' && ingredient !== 'random';
        
        // If all filters are null/empty, get completely random meal
        if (!hasCuisine && !hasCategory && !hasIngredient) {
            const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
            const data = await response.json();
            meal = data.meals[0];
        } else {
            // Determine which filter to use for initial API call
            // Priority: dietary category > ingredient > cuisine (dietary usually has fewer results)
            let primaryFilter = null;
            let primaryFilterType = null;
            
            if (hasCategory) {
                primaryFilter = category;
                primaryFilterType = 'category';
            } else if (hasIngredient) {
                primaryFilter = ingredient;
                primaryFilterType = 'ingredient';
            } else if (hasCuisine) {
                primaryFilter = cuisine;
                primaryFilterType = 'cuisine';
            }
            
            // Build filter URL
            let filterUrl = 'https://www.themealdb.com/api/json/v1/1/filter.php?';
            if (primaryFilterType === 'cuisine') {
                filterUrl += `a=${encodeURIComponent(primaryFilter)}`;
            } else if (primaryFilterType === 'category') {
                filterUrl += `c=${encodeURIComponent(primaryFilter)}`;
            } else if (primaryFilterType === 'ingredient') {
                filterUrl += `i=${encodeURIComponent(primaryFilter)}`;
            }
            
            const filterResponse = await fetch(filterUrl);
            const filterData = await filterResponse.json();
            
            // TheMealDB returns {meals: null} when no results found
            if (!filterData || !filterData.meals || filterData.meals === null || 
                (Array.isArray(filterData.meals) && filterData.meals.length === 0)) {
                throw new Error('No recipes found with those filters. Try a different selection.');
            }
            
            // If we have multiple filters, we need to filter client-side
            let filteredMeals = filterData.meals;
            
            if ((hasCuisine && primaryFilterType !== 'cuisine') || 
                (hasCategory && primaryFilterType !== 'category') || 
                (hasIngredient && primaryFilterType !== 'ingredient')) {
                // We have multiple filters - need to lookup and filter
                const lookupPromises = filteredMeals.slice(0, 20).map(meal => 
                    fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`)
                        .then(res => res.json())
                        .then(data => data.meals ? data.meals[0] : null)
                        .catch(() => null)
                );
                
                const fullMeals = await Promise.all(lookupPromises);
                const validMeals = fullMeals.filter(m => m !== null);
                
                // Filter by secondary criteria
                filteredMeals = validMeals.filter(meal => {
                    let matches = true;
                    
                    if (hasCuisine && primaryFilterType !== 'cuisine') {
                        matches = matches && meal.strArea === cuisine;
                    }
                    if (hasCategory && primaryFilterType !== 'category') {
                        matches = matches && meal.strCategory === category;
                    }
                    if (hasIngredient && primaryFilterType !== 'ingredient') {
                        // Check if ingredient is in the ingredients list
                        const ingredients = [];
                        for (let i = 1; i <= 20; i++) {
                            const ing = meal[`strIngredient${i}`];
                            if (ing && ing.trim()) {
                                ingredients.push(ing.toLowerCase().trim());
                            }
                        }
                        matches = matches && ingredients.some(ing => 
                            ing.includes(ingredient.toLowerCase()) || 
                            ingredient.toLowerCase().includes(ing)
                        );
                    }
                    return matches;
                }).map(meal => ({ idMeal: meal.idMeal }));
                
                if (filteredMeals.length === 0) {
                    throw new Error('No recipes found matching all your filters. Try a different combination.');
                }
            }
            
            // Pick a random meal from filtered results
            const randomMeal = filteredMeals[Math.floor(Math.random() * filteredMeals.length)];
            
            // Get full details using lookup
            const lookupResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${randomMeal.idMeal}`);
            const lookupData = await lookupResponse.json();
            
            // Check if lookup was successful
            if (!lookupData.meals || lookupData.meals === null || lookupData.meals.length === 0) {
                throw new Error('Recipe details could not be loaded. Please try again.');
            }
            
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
        const [areas, ingredients] = await Promise.all([
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
                    <label for="category-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Dietary:</label>
                    <select id="category-select" class="filter-select">
                        <option value="random">None</option>
                        <option value="Vegan">Vegan</option>
                        <option value="Vegetarian">Vegetarian</option>
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
    
    // Pass all selected filters (can combine multiple filters now)
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '<div class="loading">Finding your perfect recipe...</div>';
    
    try {
        const options = {
            cuisine: cuisine && cuisine !== 'random' ? cuisine : null,
            category: category && category !== 'random' ? category : null,
            ingredient: ingredient && ingredient !== '' ? ingredient : null
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

// Music API - Using iTunes Search API (free, no API key needed)
async function fetchMusic(genre = null, artist = null) {
    try {
        // If artist filter is on (Bon Iver), search by artist
        if (artist === 'bon iver') {
            const response = await fetch(
                `https://itunes.apple.com/search?term=bon+iver&attribute=artistTerm&media=music&limit=200&entity=song`
            );
            const data = await response.json();
            
            if (!data.results || data.results.length === 0) {
                return getFallbackMusicSuggestion();
            }
            
            // Pick a random track from Bon Iver results
            const randomTrack = data.results[Math.floor(Math.random() * data.results.length)];
            
            return {
                title: randomTrack.trackName || randomTrack.collectionName,
                artist: randomTrack.artistName,
                album: randomTrack.collectionName,
                genre: randomTrack.primaryGenreName,
                previewUrl: randomTrack.previewUrl,
                artwork: randomTrack.artworkUrl100 || randomTrack.artworkUrl60,
                releaseDate: randomTrack.releaseDate
            };
        }
        
        // Map our genre labels to iTunes genre names and search terms
        const genreMap = {
            'pop': { search: 'pop music', genres: ['Pop', 'Dance'] },
            'rock': { search: 'rock music', genres: ['Rock', 'Alternative'] },
            'jazz': { search: 'jazz', genres: ['Jazz'] },
            'hip hop': { search: 'hip hop', genres: ['Hip-Hop/Rap', 'Rap'] },
            'electronic': { search: 'electronic music', genres: ['Electronic', 'Dance'] },
            'indie': { search: 'indie', genres: ['Alternative', 'Indie', 'Indie Rock'] },
            'country': { search: 'country music', genres: ['Country'] },
            'classical': { search: 'classical music', genres: ['Classical'] },
            'r&b': { search: 'r&b', genres: ['R&B/Soul', 'Soul', 'R&B'] },
            'folk': { search: 'folk music', genres: ['Folk', 'Singer/Songwriter'] },
            'alternative': { search: 'alternative rock', genres: ['Alternative', 'Alternative Rock'] },
            'blues': { search: 'blues', genres: ['Blues'] },
            'reggae': { search: 'reggae', genres: ['Reggae'] },
            'latin': { search: 'latin music', genres: ['Latin', 'Salsa', 'Latin Pop'] },
            'metal': { search: 'heavy metal', genres: ['Metal', 'Heavy Metal'] },
            'punk': { search: 'punk rock', genres: ['Punk', 'Punk Rock'] },
            'soul': { search: 'soul music', genres: ['Soul', 'R&B/Soul'] },
            'funk': { search: 'funk', genres: ['Funk', 'R&B/Soul'] },
            'disco': { search: 'disco', genres: ['Disco', 'Dance'] }
        };
        
        let searchTerm;
        let targetGenres = null;
        
        // If genre is provided, use mapped search term and genres
        if (genre && genre !== 'random' && genreMap[genre]) {
            searchTerm = genreMap[genre].search;
            targetGenres = genreMap[genre].genres;
        } else {
            // List of popular genres to search for variety
            const searchTerms = [
                'pop music', 'rock music', 'jazz', 'hip hop', 'electronic music', 'indie', 
                'country music', 'classical music', 'r&b', 'folk music', 'alternative rock', 
                'blues', 'reggae', 'latin music'
            ];
            searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        }
        
        // Search iTunes for music - get more results to filter from
        const response = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=200&entity=song`
        );
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
            // Fallback to a curated suggestion if API fails
            return getFallbackMusicSuggestion();
        }
        
        // Filter by genre if a specific genre was selected
        let filteredResults = data.results;
        if (targetGenres && targetGenres.length > 0) {
            filteredResults = data.results.filter(track => {
                const trackGenre = track.primaryGenreName || '';
                return targetGenres.some(genre => 
                    trackGenre.toLowerCase().includes(genre.toLowerCase()) ||
                    genre.toLowerCase().includes(trackGenre.toLowerCase())
                );
            });
            
            // If no results match the genre, try again with broader search
            if (filteredResults.length === 0) {
                filteredResults = data.results;
            }
        }
        
        // Pick a random track from filtered results
        const randomTrack = filteredResults[Math.floor(Math.random() * filteredResults.length)];
        
        return {
            title: randomTrack.trackName || randomTrack.collectionName,
            artist: randomTrack.artistName,
            album: randomTrack.collectionName,
            genre: randomTrack.primaryGenreName,
            previewUrl: randomTrack.previewUrl,
            artwork: randomTrack.artworkUrl100 || randomTrack.artworkUrl60,
            releaseDate: randomTrack.releaseDate
        };
    } catch (error) {
        // Fallback to curated suggestions if API fails
        return getFallbackMusicSuggestion();
    }
}

// Show music genre selection UI
function showMusicFilters(resultsContent) {
    const genres = [
        { value: 'random', label: 'Random' },
        { value: 'pop', label: 'Pop' },
        { value: 'rock', label: 'Rock' },
        { value: 'jazz', label: 'Jazz' },
        { value: 'hip hop', label: 'Hip Hop' },
        { value: 'electronic', label: 'Electronic' },
        { value: 'indie', label: 'Indie' },
        { value: 'country', label: 'Country' },
        { value: 'classical', label: 'Classical' },
        { value: 'r&b', label: 'R&B' },
        { value: 'folk', label: 'Folk' },
        { value: 'alternative', label: 'Alternative' },
        { value: 'blues', label: 'Blues' },
        { value: 'reggae', label: 'Reggae' },
        { value: 'latin', label: 'Latin' },
        { value: 'metal', label: 'Metal' },
        { value: 'punk', label: 'Punk' },
        { value: 'soul', label: 'Soul' },
        { value: 'funk', label: 'Funk' },
        { value: 'disco', label: 'Disco' }
    ];
    
    const html = `
        <div class="food-filters">
            <h2 style="color: #667eea; margin-bottom: 2rem; font-size: 2rem;">Choose Your Music</h2>
            <p style="color: #666; margin-bottom: 2rem;">Select a genre below, or choose "Random" for a surprise!</p>
            
            <div class="filter-group">
                <label for="genre-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Genre:</label>
                <select id="genre-select" class="filter-select">
                    ${genres.map(genre => `<option value="${genre.value}">${genre.label}</option>`).join('')}
                </select>
            </div>
            
            <div class="filter-group">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Artist Filter:</label>
                <button id="artist-toggle" onclick="toggleArtistFilter()" class="artist-toggle-button" style="width: 100%; padding: 12px 16px; font-size: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; background: white; color: #333; cursor: pointer; transition: all 0.3s ease; font-family: inherit;">
                    Press for Bon Iver Only
                </button>
            </div>
            
            <button onclick="applyMusicFilter()" class="filter-button">Get Music!</button>
        </div>
    `;
    
    resultsContent.innerHTML = html;
}

// Toggle artist filter between Bon Iver and All Artists
function toggleArtistFilter() {
    const button = document.getElementById('artist-toggle');
    const currentState = button.dataset.artist || 'all';
    
    if (currentState === 'all') {
        button.dataset.artist = 'bon iver';
        button.textContent = 'Bon Iver Only (Active)';
        button.style.background = '#667eea';
        button.style.color = 'white';
        button.style.borderColor = '#667eea';
    } else {
        button.dataset.artist = 'all';
        button.textContent = 'Press for Bon Iver Only';
        button.style.background = 'white';
        button.style.color = '#333';
        button.style.borderColor = '#e0e0e0';
    }
}

// Apply music filter and fetch track
async function applyMusicFilter() {
    const genre = document.getElementById('genre-select').value;
    const artistButton = document.getElementById('artist-toggle');
    const artist = artistButton && artistButton.dataset.artist === 'bon iver' ? 'bon iver' : null;
    
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '<div class="loading">Finding your perfect track...</div>';
    
    try {
        const options = {
            genre: genre && genre !== 'random' ? genre : null,
            artist: artist
        };
        
        const data = await fetchContent('music', options);
        displayResults('music', data);
    } catch (error) {
        resultsContent.innerHTML = `
            <div style="text-align: center; color: #e74c3c;">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Oops! Something went wrong.</p>
                <p>${error.message}</p>
                <button onclick="showResults('music')" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
            </div>
        `;
    }
}

// Fallback music suggestions if iTunes API fails
function getFallbackMusicSuggestion() {
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
        // Check if it's iTunes API data or fallback suggestion
        if (data.previewUrl || data.artwork) {
            // iTunes API result
            html = `
                <div class="result-item">
                    ${data.artwork ? `<img src="${data.artwork.replace('100x100', '300x300')}" alt="${data.title}" style="max-width: 200px; border-radius: 10px; margin-bottom: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">` : ''}
                    <h2 class="result-title">${data.title}</h2>
                    <div class="result-meta">by ${data.artist}</div>
                    ${data.album ? `<div class="result-meta" style="margin-top: 0.5rem;">Album: ${data.album}</div>` : ''}
                    ${data.genre ? `<div style="margin-top: 1rem;"><span style="display: inline-block; padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 5px; color: #667eea; font-weight: 600;">${data.genre}</span></div>` : ''}
                    <div style="margin-top: 1.5rem;">
                        ${data.previewUrl ? `<a href="${data.previewUrl}" target="_blank" class="result-link" style="padding: 10px 20px; background: #667eea; color: white; border-radius: 5px; text-decoration: none; display: inline-block;">▶ Preview</a>` : ''}
                    </div>
                </div>
            `;
        } else {
            // Fallback suggestion
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
        }
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
window.applyMusicFilter = applyMusicFilter;
window.toggleArtistFilter = toggleArtistFilter;

