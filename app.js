const OMDB_KEY = "18193162";
const OMDB_BASE = "https://www.omdbapi.com/";

document.getElementById("movieInput").addEventListener("keydown", e => {
  if (e.key === "Enter") searchMovie();
});

async function searchMovie() {
  const title = document.getElementById("movieInput").value.trim();
  if (!title) return;

  setError("");
  document.getElementById("hero").innerHTML = "";
  document.getElementById("similar").innerHTML = "";
  document.getElementById("loader").style.display = "block";

  try {
    const movie = await fetchByTitle(title);
    if (!movie) return;

    const primaryGenre = movie.Genre.split(",")[0].trim();
    const top3 = await fetchTop3ByGenre(primaryGenre, movie.Title);

    renderHero(movie);
    renderSimilar(top3, primaryGenre);
  } catch {
    setError("Something went wrong. Check your API key or network.");
  } finally {
    document.getElementById("loader").style.display = "none";
  }
}

async function fetchByTitle(title) {
  const res = await fetch(`${OMDB_BASE}?t=${encodeURIComponent(title)}&apikey=${OMDB_KEY}`);
  const data = await res.json();
  if (data.Response === "False") {
    setError("Movie not found. Try a different title.");
    return null;
  }
  return data;
}

async function fetchTop3ByGenre(genre, excludeTitle) {
  const searches = await Promise.all(
    [1, 2, 3].map(page =>
      fetch(`${OMDB_BASE}?s=${encodeURIComponent(genre)}&type=movie&page=${page}&apikey=${OMDB_KEY}`)
        .then(r => r.json())
    )
  );

  const imdbIds = searches
    .flatMap(s => s.Search ?? [])
    .filter(m => m.Title.toLowerCase() !== excludeTitle.toLowerCase())
    .map(m => m.imdbID);

  const details = await Promise.all(
    imdbIds.map(id =>
      fetch(`${OMDB_BASE}?i=${id}&apikey=${OMDB_KEY}`).then(r => r.json())
    )
  );

  return details
    .filter(m => m.Response === "True" && parseFloat(m.imdbRating) > 0)
    .sort((a, b) => parseFloat(b.imdbRating) - parseFloat(a.imdbRating))
    .slice(0, 3);
}

function parseRatings(m) {
  const raw = Object.fromEntries((m.Ratings ?? []).map(r => [r.Source, r.Value]));
  const imdb = parseFloat(m.imdbRating) || null;
  const rt   = raw["Rotten Tomatoes"] ? parseInt(raw["Rotten Tomatoes"]) / 10 : null;
  const mc   = raw["Metacritic"]      ? parseInt(raw["Metacritic"]) / 10      : null;
  return { imdb, rt, mc };
}

function calcWorthScore(ratings) {
  const weights = { imdb: 0.5, rt: 0.3, mc: 0.2 };
  let score = 0, total = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (ratings[key] !== null) { score += ratings[key] * w; total += w; }
  }
  return total ? (score / total).toFixed(1) : null;
}

function verdictLabel(score) {
  if (!score) return null;
  if (score >= 8)   return { text: "Must Watch",     color: "#2ecc71" };
  if (score >= 6.5) return { text: "Worth Watching", color: "#f5c518" };
  if (score >= 5)   return { text: "Mixed Bag",      color: "#e67e22" };
  return                    { text: "Skip It",        color: "#e74c3c" };
}

function ratingBarsHTML(ratings) {
  const bars = [
    { label: "IMDb", value: ratings.imdb, color: "#f5c518" },
    { label: "RT",   value: ratings.rt,   color: "#fa320a" },
    { label: "MC",   value: ratings.mc,   color: "#6cb4e4" },
  ];
  return bars.filter(b => b.value !== null).map(b => `
    <div class="rating-row">
      <span class="rating-label" style="color:${b.color}">${b.label}</span>
      <div class="rating-bar-bg">
        <div class="rating-bar" style="width:${(b.value / 10) * 100}%;background:${b.color}"></div>
      </div>
      <span class="rating-value" style="color:${b.color}">${b.value.toFixed(1)}</span>
    </div>`).join("");
}

function renderHero(m) {
  const ratings = parseRatings(m);
  const score   = calcWorthScore(ratings);
  const verdict = verdictLabel(score);
  const hasPoster = m.Poster && m.Poster !== "N/A";

  document.getElementById("hero").innerHTML = `
    <div class="hero-card">
      ${hasPoster
        ? `<img class="hero-poster" src="${m.Poster}" alt="${m.Title}"/>`
        : `<div class="hero-no-poster">No Image</div>`}
      <div class="hero-body">
        <div class="hero-tag">Your Movie</div>
        <div class="hero-title">${m.Title}</div>
        <div class="hero-meta">${m.Year} &nbsp;·&nbsp; ${m.Runtime} &nbsp;·&nbsp; ${m.Rated}</div>
        <div class="hero-genre">
          ${m.Genre.split(",").map(g => `<span class="badge">${g.trim()}</span>`).join("")}
        </div>
        <p class="hero-plot">${m.Plot}</p>
        ${verdict ? `
          <div class="worth-badge">
            <span class="worth-score" style="color:${verdict.color}">${score}</span>
            <span class="worth-label" style="color:${verdict.color}">${verdict.text}</span>
          </div>` : ""}
        <div class="hero-ratings">${ratingBarsHTML(ratings)}</div>
        <div class="people">🎬 ${m.Director !== "N/A" ? m.Director : "—"}</div>
        <div class="people">🎭 ${m.Actors !== "N/A" ? m.Actors : "—"}</div>
      </div>
    </div>`;
}

function renderSimilar(movies, genre) {
  if (!movies.length) {
    document.getElementById("similar").innerHTML =
      "<p style='text-align:center;color:#555;margin-top:1rem'>No similar movies found.</p>";
    return;
  }

  const cards = movies.map(m => {
    const ratings = parseRatings(m);
    const score   = calcWorthScore(ratings);
    const verdict = verdictLabel(score);
    const hasPoster = m.Poster && m.Poster !== "N/A";

    return `
      <div class="card">
        ${hasPoster ? `<img src="${m.Poster}" alt="${m.Title}"/>` : `<div class="no-poster">No Image</div>`}
        <div class="card-body">
          <div class="title">${m.Title}</div>
          <div class="year">${m.Year} · ${m.Runtime}</div>
          ${verdict ? `
            <div class="worth-badge">
              <span class="worth-score" style="color:${verdict.color}">${score}</span>
              <span class="worth-label" style="color:${verdict.color}">${verdict.text}</span>
            </div>` : ""}
          ${ratingBarsHTML(ratings)}
          <div class="people">🎬 ${m.Director !== "N/A" ? m.Director : "—"}</div>
          <div class="people">🎭 ${m.Actors !== "N/A" ? m.Actors : "—"}</div>
        </div>
      </div>`;
  }).join("");

  document.getElementById("similar").innerHTML = `
    <div class="section-header">
      <hr/><span>Similar Movies in ${genre}</span><hr/>
    </div>
    <div class="cards-grid">${cards}</div>`;
}

function setError(msg) {
  document.getElementById("error").textContent = msg;
}
