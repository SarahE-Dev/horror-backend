const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const getHorrorMovies = async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching movies' });
  }
};

module.exports = { getHorrorMovies };