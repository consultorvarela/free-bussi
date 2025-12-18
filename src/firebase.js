// API REST para gestionar puntuaciones (sin exponer credenciales de Firebase)
const API_URL = 'https://free-bussi-backend.onrender.com/api';

/**
 * Cargar las 5 mejores puntuaciones desde la API
 * @returns {Promise<Array>} Array de objetos {score, initials}
 */
export async function loadHighScores() {
  console.log('loadHighScores called');
  try {
    const response = await fetch(`${API_URL}/highscores`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const scores = await response.json();
    console.log('Loaded scores from API:', scores);
    return scores;
  } catch (error) {
    console.error('Error loading high scores from API:', error);
    console.error('Error details:', error.message);
    // Fallback a localStorage si la API falla
    console.warn('Falling back to localStorage');
    return loadHighScoresFromLocalStorage();
  }
}

/**
 * Guardar nueva puntuación en la API
 * @param {number} score
 * @param {string} initials
 * @returns {Promise<Array>} Array actualizado de top 5 scores
 */
export async function saveHighScore(score, initials = '------') {
  console.log('saveHighScore called with:', { score, initials });
  try {
    const response = await fetch(`${API_URL}/highscores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ score, initials })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Score saved successfully:', result);

    // Retornar top 5 actualizado
    const updatedScores = await loadHighScores();
    console.log('Updated scores from API:', updatedScores);
    return updatedScores;
  } catch (error) {
    console.error('Error saving high score to API:', error);
    console.error('Error details:', error.message);
    // Fallback a localStorage si la API falla
    console.warn('Falling back to localStorage');
    return updateHighScoresInLocalStorage(score, initials);
  }
}

/**
 * Verificar si un score califica para el top 5
 * @param {number} score
 * @returns {Promise<boolean>}
 */
export async function qualifiesForHighScore(score) {
  try {
    const response = await fetch(`${API_URL}/highscores/qualify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ score })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.qualifies;
  } catch (error) {
    console.error('Error checking high score qualification:', error);
    // Fallback: verificar localmente
    const scores = await loadHighScores();
    if (scores.length < 5) return true;
    const lowest = scores[scores.length - 1];
    return score > (lowest?.score ?? 0);
  }
}

// ============================================
// FALLBACK: localStorage functions (backup)
// ============================================

function loadHighScoresFromLocalStorage() {
  try {
    const raw = localStorage.getItem('bussi-runner-highscores');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      if (typeof entry === 'number') {
        return { score: entry, initials: '------' };
      }
      return {
        score: Number(entry.score) || 0,
        initials: typeof entry.initials === 'string' ? entry.initials : '------'
      };
    }).slice(0, 5);
  } catch (e) {
    return [];
  }
}

function updateHighScoresInLocalStorage(score, initials = '------') {
  const scores = loadHighScoresFromLocalStorage();
  scores.push({ score, initials: initials || '------' });
  const sorted = scores.sort((a, b) => b.score - a.score).slice(0, 5);
  try {
    localStorage.setItem('bussi-runner-highscores', JSON.stringify(sorted));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
  return sorted;
}
