const { invoke } = window.__TAURI__.core;

// State
let currentUnit = 'C'; // 'C' or 'F'
let weatherData = null; // Store fetched data
let chartInstance = null;

// Clock
function updateClock() {
  const now = new Date();
  document.getElementById('current-time').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('current-date').innerText = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// Unit Conversion
function toDisplayTemp(celsius) {
  if (currentUnit === 'F') {
    return Math.round((celsius * 9 / 5) + 32);
  }
  return Math.round(celsius);
}

// UI Update
function updateUI() {
  if (!weatherData) return;
  const { current, forecast } = weatherData;

  // 1. Current Weather
  document.getElementById('city-name').innerText = current.name;
  document.getElementById('weather-description').innerText = current.weather[0].description;

  // Icon
  const iconCode = current.weather[0].icon;
  const iconEl = document.getElementById('weather-icon');
  iconEl.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
  iconEl.classList.remove('hidden');

  // Temperatures
  document.getElementById('temp-display').innerText = toDisplayTemp(current.main.temp);
  document.getElementById('unit-display').innerText = `°${currentUnit}`;
  document.getElementById('feels-like').innerText = toDisplayTemp(current.main.feels_like);

  // Metrics
  document.getElementById('humidity').innerText = current.main.humidity;
  document.getElementById('wind-speed').innerText = Math.round(current.wind.speed * 3.6);

  // 2. Forecast List (Next 5 items approx)
  const listEl = document.getElementById('forecast-list');
  listEl.innerHTML = '';
  // Take every 8th item (approx 24h) or just next 5 3-hour chunks? Prompt said "5-day forecast grid" usually implies days, but let's show next 5 data points for detail or daily.
  // Let's filter for one per day or just next 5 slots. Let's do one per day for the list.
  const dailyForecast = forecast.list.filter((item) => item.dt_txt.includes("12:00:00")).slice(0, 5);

  dailyForecast.forEach(day => {
    const date = new Date(day.dt * 1000);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const icon = day.weather[0].icon;
    const temp = toDisplayTemp(day.main.temp);

    const html = `
        <div class="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition cursor-default">
          <div class="text-sm font-medium w-12 text-gray-300">${dayName}</div>
          <img src="https://openweathermap.org/img/wn/${icon}.png" class="w-8 h-8">
          <div class="text-sm text-gray-400 capitalize">${day.weather[0].main}</div>
          <div class="font-semibold">${temp}°</div>
        </div>`;
    listEl.innerHTML += html;
  });

  // 3. Chart (Next 24 hours -> 8 intervals of 3h)
  renderChart(forecast.list.slice(0, 8));
}

function renderChart(dataPoints) {
  const ctx = document.getElementById('tempChart').getContext('2d');
  const labels = dataPoints.map(d => {
    const date = new Date(d.dt * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const temps = dataPoints.map(d => toDisplayTemp(d.main.temp));

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Temp (°${currentUnit})`,
        data: temps,
        borderColor: 'rgba(96, 165, 250, 1)',
        backgroundColor: 'rgba(96, 165, 250, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#fff',
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#ccc' } },
        x: { grid: { display: false }, ticks: { color: '#ccc' } }
      }
    }
  });
}

// Fetch Logic
async function handleFetch(command, args) {
  const btn = document.getElementById('get-btn');
  const container = document.getElementById('weather-container');
  const spinner = document.getElementById('loading-spinner');

  // UI Loading State
  const originalText = btn.innerText;
  btn.innerText = '...';
  container.classList.add('opacity-0');
  setTimeout(() => spinner.classList.remove('hidden'), 200);

  try {
    const response = await invoke(command, args);
    weatherData = JSON.parse(response); // Store global
    updateUI(); // Render
  } catch (error) {
    console.error(error);
    alert('Error: ' + error);
  } finally {
    spinner.classList.add('hidden');
    container.classList.remove('opacity-0');
    btn.innerText = originalText;
  }
}

// Event Listeners
document.getElementById('get-btn').addEventListener('click', () => {
  const city = document.getElementById('city-input').value;
  if (city) handleFetch('get_weather', { city });
});

document.getElementById('city-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const city = e.target.value;
    if (city) handleFetch('get_weather', { city });
  }
});

document.getElementById('geo-btn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      handleFetch('get_weather_by_coords', {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      });
    }, () => {
      alert('Geolocation permission denied or unavailable.');
    });
  } else {
    alert('Geolocation not supported.');
  }
});

// Unit Toggle
document.getElementById('unit-toggle').addEventListener('change', (e) => {
  currentUnit = e.target.checked ? 'F' : 'C';
  updateUI(); // Re-render without fetch
});