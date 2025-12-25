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
    document.getElementById('splash-page').classList.remove('active');
    document.getElementById('results-page').classList.add('active');
    
    const resultsContent = document.getElementById('results-content');
    
    // Handle "surprise me" - fetch random Wikipedia page
    if (category === 'surprise') {
        resultsContent.innerHTML = '<div class="loading">Finding something COOL!</div>';
        fetchWikipedia().then(data => {
            displayResults('surprise', data);
        }).catch(error => {
            resultsContent.innerHTML = `
                <div style="text-align: center; color: #e74c3c;">
                    <p style="font-size: 1.2rem; margin-bottom: 1rem;">Oops! Something went wrong.</p>
                    <p>${error.message}</p>
                    <button onclick="showSplash()" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
                </div>
            `;
        });
        return;
    }
    
    // Show filter options for food, music, and writing categories
    if (category === 'food') {
        showFoodFilters(resultsContent);
    } else if (category === 'music') {
        showMusicFilters(resultsContent);
    } else if (category === 'writing') {
        showWritingFilters(resultsContent);
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
            return await fetchWriting(options.length);
        default:
            throw new Error('Unknown category');
    }
}

// Spoonacular API Configuration
// TODO: Replace 'YOUR_API_KEY' with your actual Spoonacular API key
const SPOONACULAR_API_KEY = '0aad6bff82ba439383447f26b87c9f50';
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

// Food API - Using Spoonacular API
async function fetchFood(cuisine = null, category = null, ingredient = null) {
    try {
        // Check if API key is set
        if (!SPOONACULAR_API_KEY || SPOONACULAR_API_KEY === 'YOUR_API_KEY') {
            throw new Error('Please set your Spoonacular API key in script.js');
        }
        
        // Normalize filter values
        const hasCuisine = cuisine && cuisine !== 'random';
        const hasCategory = category && category !== 'random';
        const hasIngredient = ingredient && ingredient !== '' && ingredient !== 'random';
        
        let recipe;
        
        // If all filters are null/empty, get completely random recipe
        if (!hasCuisine && !hasCategory && !hasIngredient) {
            const response = await fetch(
                `${SPOONACULAR_BASE_URL}/recipes/random?apiKey=${SPOONACULAR_API_KEY}&number=1`
            );
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            if (!data.recipes || data.recipes.length === 0) {
                throw new Error('No recipes found. Please try again.');
            }
            
            recipe = data.recipes[0];
        } else {
            // Build complex search query with filters
            const searchParams = new URLSearchParams({
                apiKey: SPOONACULAR_API_KEY,
                number: 1, // Get 1 result to save API quota
                addRecipeInformation: 'true',
                fillIngredients: 'true'
            });
            
            // Add filters
            if (hasCuisine) {
                searchParams.append('cuisine', cuisine);
            }
            if (hasCategory) {
                // Map dietary categories to Spoonacular diet parameter
                if (category === 'Vegan') {
                    searchParams.append('diet', 'vegan');
                } else if (category === 'Vegetarian') {
                    searchParams.append('diet', 'vegetarian');
                } else if (category === 'Ovo-Vegetarian') {
                    // Ovo-vegetarian = vegetarian + no dairy (eggs allowed)
                    searchParams.append('diet', 'vegetarian');
                    searchParams.append('excludeIngredients', 'milk,cheese,butter,yogurt,cream,whey,casein');
                }
            }
            if (hasIngredient) {
                searchParams.append('includeIngredients', ingredient);
            }
            
            const searchUrl = `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${searchParams.toString()}`;
            const searchResponse = await fetch(searchUrl);
            
            if (!searchResponse.ok) {
                throw new Error(`API error: ${searchResponse.status} ${searchResponse.statusText}`);
            }
            
            const searchData = await searchResponse.json();
            
            if (!searchData.results || searchData.results.length === 0) {
                throw new Error('No recipes found with those filters. Try a different selection.');
            }
            
            // Get the first (and only) recipe from results
            const foundRecipe = searchData.results[0];
            
            // Get full recipe details if not already included
            if (foundRecipe.id && !foundRecipe.instructions) {
                const detailResponse = await fetch(
                    `${SPOONACULAR_BASE_URL}/recipes/${foundRecipe.id}/information?apiKey=${SPOONACULAR_API_KEY}`
                );
                
                if (detailResponse.ok) {
                    const detailData = await detailResponse.json();
                    recipe = detailData;
                } else {
                    recipe = foundRecipe;
                }
            } else {
                recipe = foundRecipe;
            }
        }
        
        // Extract cuisine from recipe if not provided
        let recipeCuisine = cuisine;
        if (!recipeCuisine && recipe.cuisines && recipe.cuisines.length > 0) {
            recipeCuisine = recipe.cuisines[0];
        } else if (!recipeCuisine && recipe.dishTypes && recipe.dishTypes.length > 0) {
            recipeCuisine = recipe.dishTypes[0];
        }
        
        // Extract category from recipe if not provided
        let recipeCategory = category;
        if (!recipeCategory && recipe.diets && recipe.diets.length > 0) {
            recipeCategory = recipe.diets[0];
        } else if (!recipeCategory && recipe.dishTypes && recipe.dishTypes.length > 0) {
            recipeCategory = recipe.dishTypes[0];
        }
        
        // Format instructions - Spoonacular returns HTML or plain text
        let instructions = '';
        if (recipe.instructions) {
            instructions = recipe.instructions;
            // Remove HTML tags if present
            instructions = instructions.replace(/<[^>]*>/g, '');
        } else if (recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0) {
            // Build instructions from steps
            instructions = recipe.analyzedInstructions[0].steps
                .map(step => `${step.number}. ${step.step}`)
                .join('\n\n');
        }
        
        return {
            title: recipe.title,
            description: instructions || 'No instructions available.',
            image: recipe.image,
            category: recipeCategory || 'General',
            area: recipeCuisine || 'International',
            youtube: recipe.sourceUrl || null,
            source: recipe.sourceUrl || recipe.spoonacularSourceUrl || null
        };
    } catch (error) {
        throw new Error(error.message || 'Failed to fetch recipe. Please try again.');
    }
}

// Fetch lists for dropdowns - Using common cuisines for Spoonacular
async function fetchAreas() {
    // Spoonacular supports many cuisines, returning common ones
    return [
        'African', 'American', 'British', 'Cajun', 'Caribbean', 'Chinese', 
        'Eastern European', 'European', 'French', 'German', 'Greek', 'Indian',
        'Irish', 'Italian', 'Japanese', 'Jewish', 'Korean', 'Latin American',
        'Mediterranean', 'Mexican', 'Middle Eastern', 'Nordic', 'Southern',
        'Spanish', 'Thai', 'Vietnamese'
    ].sort();
}

// Note: fetchCategories and fetchIngredients are not needed with Spoonacular
// as it handles dietary filters and ingredients directly in the search
async function fetchCategories() {
    // Return dietary options supported by Spoonacular
    return ['Vegan', 'Vegetarian', 'Ovo-Vegetarian'];
}

async function fetchIngredients() {
    // Spoonacular accepts any ingredient name, so we don't need a predefined list
    // Return empty array - users can type any ingredient
        return [];
}

// Show food filter selection UI
async function showFoodFilters(resultsContent) {
    resultsContent.innerHTML = '<div class="loading">NomNomNom...</div>';
    
    try {
        const [areas, ingredients] = await Promise.all([
            fetchAreas(),
            fetchIngredients()
        ]);
        
        const html = `
            <div class="food-filters">
                <h2 style="color: #667eea; margin-bottom: 2rem; font-size: 2rem;">Need Some Food Inspiration?</h2>
                <p style="color: #666; margin-bottom: 2rem;">Make some selections. Leave blank for totally random</p>
                
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
                        <option value="Ovo-Vegetarian">Dairy Free</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="ingredient-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Main Ingredient:</label>
                    <input type="text" id="ingredient-input" class="filter-input" placeholder="Type an ingredient (tofu, peanut butter, persimmon). ">
                </div>
                
                <button onclick="applyFoodFilter()" class="filter-button">Get Recipe!</button>
            </div>
        `;
        
        resultsContent.innerHTML = html;
    } catch (error) {
        resultsContent.innerHTML = `
            <div style="text-align: center; color: #e74c3c;">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Something went wrong.</p>
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
    resultsContent.innerHTML = '<div class="loading">NomNomNom...</div>';
    
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
                <p style="font-size: 1.2rem; margin-bottom: 1rem;"> Something went wrong.</p>
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
            <h2 style="color: #667eea; margin-bottom: 2rem; font-size: 2rem;">Feeling Musical???</h2>
            <p style="color: #666; margin-bottom: 2rem;">Select a genre below</p>
            
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
    resultsContent.innerHTML = '<div class="loading">Finding MUSICCCCC</div>';
    
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
                <p style="font-size: 1.2rem; margin-bottom: 1rem;"> Something went wrong</p>
                <p>${error.message}</p>
                <button onclick="showResults('music')" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
            </div>
        `;
    }
}

// Show writing filter selection UI
function showWritingFilters(resultsContent) {
    const html = `
        <div class="food-filters">
            <h2 style="color: #667eea; margin-bottom: 2rem; font-size: 2rem;">Need a new poem?</h2>
            
            <div class="filter-group">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Poem Length:</label>
                <div style="display: flex; gap: 1rem;">
                    <button id="short-toggle" onclick="toggleWritingLength('short')" class="writing-toggle-button" style="flex: 1; padding: 12px 16px; font-size: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; background: white; color: #333; cursor: pointer; transition: all 0.3s ease; font-family: inherit;">
                        Short
                    </button>
                    <button id="long-toggle" onclick="toggleWritingLength('long')" class="writing-toggle-button" style="flex: 1; padding: 12px 16px; font-size: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; background: white; color: #333; cursor: pointer; transition: all 0.3s ease; font-family: inherit;">
                        Long
                    </button>
                </div>
            </div>
            
            <button onclick="applyWritingFilter()" class="filter-button">Find a Poem</button>
        </div>
    `;
    
    resultsContent.innerHTML = html;
    
    // Initialize button states
    const shortButton = document.getElementById('short-toggle');
    const longButton = document.getElementById('long-toggle');
    if (shortButton) shortButton.dataset.selected = 'false';
    if (longButton) longButton.dataset.selected = 'false';
}

// Toggle writing length filter
function toggleWritingLength(length) {
    const shortButton = document.getElementById('short-toggle');
    const longButton = document.getElementById('long-toggle');
    
    // Reset both buttons
    shortButton.style.background = 'white';
    shortButton.style.color = '#333';
    shortButton.style.borderColor = '#e0e0e0';
    shortButton.dataset.selected = 'false';
    
    longButton.style.background = 'white';
    longButton.style.color = '#333';
    longButton.style.borderColor = '#e0e0e0';
    longButton.dataset.selected = 'false';
    
    // Toggle the clicked button
    if (length === 'short') {
        if (shortButton.dataset.selected === 'true') {
            // Deselect
            shortButton.dataset.selected = 'false';
        } else {
            // Select
            shortButton.dataset.selected = 'true';
            shortButton.style.background = '#667eea';
            shortButton.style.color = 'white';
            shortButton.style.borderColor = '#667eea';
        }
    } else if (length === 'long') {
        if (longButton.dataset.selected === 'true') {
            // Deselect
            longButton.dataset.selected = 'false';
        } else {
            // Select
            longButton.dataset.selected = 'true';
            longButton.style.background = '#667eea';
            longButton.style.color = 'white';
            longButton.style.borderColor = '#667eea';
        }
    }
}

// Apply writing filter and fetch content
async function applyWritingFilter() {
    const shortButton = document.getElementById('short-toggle');
    const longButton = document.getElementById('long-toggle');
    
    let length = null;
    if (shortButton.dataset.selected === 'true') {
        length = 'short';
    } else if (longButton.dataset.selected === 'true') {
        length = 'long';
    }
    
    const resultsContent = document.getElementById('results-content');
    resultsContent.innerHTML = '<div class="loading">Finding inspiration...</div>';
    
    try {
        const options = {
            length: length
        };
        
        const data = await fetchContent('writing', options);
        displayResults('writing', data);
    } catch (error) {
        resultsContent.innerHTML = `
            <div style="text-align: center; color: #e74c3c;">
                <p style="font-size: 1.2rem; margin-bottom: 1rem;">Something went wrong</p>
                <p>${error.message}</p>
                <button onclick="showResults('writing')" style="margin-top: 1rem; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Try Again</button>
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

// Wikipedia API - Fetch random page with image and summary
async function fetchWikipedia() {
    try {
        // Step 1: Get a random Wikipedia page title
        const randomResponse = await fetch(
            'https://en.wikipedia.org/w/api.php?action=query&format=json&list=random&rnnamespace=0&rnlimit=1&origin=*'
        );
        
        if (!randomResponse.ok) {
            throw new Error('Failed to fetch random Wikipedia page');
        }
        
        const randomData = await randomResponse.json();
        
        if (!randomData.query || !randomData.query.random || randomData.query.random.length === 0) {
            throw new Error('No random page found');
        }
        
        const pageTitle = randomData.query.random[0].title;
        
        // Step 2: Get the page summary and image using REST API
        const summaryResponse = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
        );
        
        if (!summaryResponse.ok) {
            throw new Error('Failed to fetch page summary');
        }
        
        const summaryData = await summaryResponse.json();
        
        return {
            title: summaryData.title,
            extract: summaryData.extract || 'No summary available.',
            thumbnail: summaryData.thumbnail ? summaryData.thumbnail.source : null,
            thumbnailWidth: summaryData.thumbnail ? summaryData.thumbnail.width : null,
            thumbnailHeight: summaryData.thumbnail ? summaryData.thumbnail.height : null,
            url: summaryData.content_urls ? summaryData.content_urls.desktop.page : null
        };
    } catch (error) {
        throw new Error(error.message || 'Failed to fetch Wikipedia content. Please try again.');
    }
}

// Writing API - Using PoetryDB (free, no API key needed)
async function fetchWriting(length = null) {
    try {
        // If length filter is specified, fetch multiple random poems and filter
        if (length === 'short' || length === 'long') {
            // Fetch multiple random poems to find one that matches the length criteria
            const maxAttempts = 10;
            let attempts = 0;
            
            while (attempts < maxAttempts) {
                const response = await fetch('https://poetrydb.org/random/5');
                const poems = await response.json();
                
                // Filter poems by length
                const filteredPoems = poems.filter(poem => {
                    const lineCount = poem.linecount || (poem.lines ? poem.lines.length : 0);
                    if (length === 'short') {
                        return lineCount < 20;
                    } else if (length === 'long') {
                        return lineCount >= 20;
                    }
                    return true;
                });
                
                if (filteredPoems.length > 0) {
                    const poem = filteredPoems[0];
                    return {
                        title: poem.title,
                        author: poem.author,
                        lines: poem.lines,
                        linecount: poem.linecount
                    };
                }
                
                attempts++;
            }
            
            // If we couldn't find a matching poem after max attempts, throw error
            throw new Error(`Could not find a ${length} poem. Please try again.`);
        } else {
            // No filter - just get a random poem
        const response = await fetch('https://poetrydb.org/random');
        const poems = await response.json();
        const poem = poems[0];
        
        return {
            title: poem.title,
            author: poem.author,
            lines: poem.lines,
            linecount: poem.linecount
        };
        }
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
            throw new Error(error.message || 'Failed to fetch. Please try again.');
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
                    ${data.previewUrl ? `
                    <div style="margin-top: 1.5rem;">
                        <p style="margin-bottom: 0.5rem; font-weight: 600; color: #667eea;">Preview:</p>
                        <audio controls style="width: 100%; max-width: 500px; margin-top: 0.5rem;">
                            <source src="${data.previewUrl}" type="audio/mpeg">
                            <source src="${data.previewUrl}" type="audio/mp4">
                            Your browser does not support the audio element. <a href="${data.previewUrl}" target="_blank">Download preview</a>
                        </audio>
                    </div>
                    ` : ''}
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
    } else if (category === 'surprise') {
        // Wikipedia article
        html = `
            <div class="result-item">
                <h2 class="result-title">${data.title}</h2>
                <div class="result-meta" style="margin-bottom: 1rem;">From Wikipedia</div>
                ${data.thumbnail ? `<img src="${data.thumbnail}" alt="${data.title}" style="max-width: 100%; border-radius: 10px; margin: 1rem 0; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">` : ''}
                <div class="result-description">${data.extract}</div>
                ${data.url ? `<a href="${data.url}" target="_blank" class="result-link" style="margin-top: 1rem; display: inline-block;">Read more on Wikipedia →</a>` : ''}
            </div>
        `;
    }
    
    resultsContent.innerHTML = html;
}

// Make functions available globally
window.showSplash = showSplash;
window.showResults = showResults;
window.applyFoodFilter = applyFoodFilter;
window.applyMusicFilter = applyMusicFilter;
window.toggleArtistFilter = toggleArtistFilter;
window.applyWritingFilter = applyWritingFilter;
window.toggleWritingLength = toggleWritingLength;

