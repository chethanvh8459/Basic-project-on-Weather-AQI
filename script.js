/* --------------- CONFIG --------------- */
/* 1) Put your OpenWeatherMap API key here */
const OWM_API_KEY = "dd78411b156256116ebac1b555a05b02";

/* 2) Refresh interval (ms) */
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
/* -------------------------------------- */

/* Elements */
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locateBtn = document.getElementById('locateBtn');
const modeToggle = document.getElementById('modeToggle');

const cityNameEl = document.getElementById('cityName');
const lastUpdatedEl = document.getElementById('lastUpdated');
const aqiValueEl = document.getElementById('aqiValue');
const aqiCategoryEl = document.getElementById('aqiCategory');
const aqiEmojiEl = document.getElementById('aqiEmoji');
const pm25El = document.getElementById('pm25');
const pm10El = document.getElementById('pm10');
const tempEl = document.getElementById('temp');

const weatherEmoji = document.getElementById('weatherEmoji');
const weatherCond = document.getElementById('weatherCond');
const wTemp = document.getElementById('wTemp');
const wHum = document.getElementById('wHum');
const wWind = document.getElementById('wWind');

const p_pm25 = document.getElementById('p_pm25');
const p_pm10 = document.getElementById('p_pm10');
const p_co = document.getElementById('p_co');
const p_no2 = document.getElementById('p_no2');
const p_so2 = document.getElementById('p_so2');
const p_o3 = document.getElementById('p_o3');

const stationsList = document.getElementById('stationsList');
const mapCity = document.getElementById('mapCity');
const openMapLink = document.getElementById('openMapLink');
const bgVideo = document.getElementById('bgVideo');

// helpers
function formatTime(ts = Date.now()){
  return new Date(ts).toLocaleString();
}
function setLoadingStations(){
  stationsList.innerHTML = '<div class="loader">Loading stations…</div>';
}
function clearStations(){
  stationsList.innerHTML = '';
}

/* AQI category helper (OpenWeatherMap air_pollution uses 1..5 scale) */
function aqiCategory(aqi){
  const map = {
    1: {label: 'Good', color:'#2ecc71', emoji:'😄'},
    2: {label: 'Fair', color:'#f1c40f', emoji:'🙂'},
    3: {label: 'Moderate', color:'#e67e22', emoji:'😐'},
    4: {label: 'Poor', color:'#e74c3c', emoji:'😷'},
    5: {label: 'Very Poor', color:'#8e44ad', emoji:'🤢'}
  };
  return map[aqi] || {label:'—', color:'#999', emoji:'—'};
}

/* set background video depending on weather main */
function setVideoForWeather(weatherMain){
  const key = (weatherMain || '').toLowerCase();
  if(key.includes('rain') || key.includes('drizzle') || key.includes('thunder')) {
    bgVideo.src = 'https://www.pexels.com/download/video/4323285/';
  } else if(key.includes('cloud')) {
    bgVideo.src = 'https://www.pexels.com/download/video/3129769/';
  } else {
    bgVideo.src = 'https://www.pexels.com/download/video/856572/';
  }
  bgVideo.load();
  bgVideo.play().catch(()=>{ /* autoplay may be blocked */ });
}

/* Update DOM with data from OpenWeatherMap */
async function updateDashboardFromCoords(lat, lon){
  try {
    // 1) Weather
    const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric`;
    const wRes = await fetch(weatherURL);
    if(!wRes.ok) throw new Error('Weather fetch failed');
    const wData = await wRes.json();

    const city = wData.name + (wData.sys && wData.sys.country ? ', ' + wData.sys.country : '');
    cityNameEl.textContent = city;
    mapCity.textContent = city;
    openMapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    wTemp.textContent = `${Math.round(wData.main.temp)} °C`;
    wHum.textContent = `${wData.main.humidity}%`;
    wWind.textContent = `${wData.wind.speed} m/s`;
    weatherCond.textContent = `${wData.weather[0].main} — ${wData.weather[0].description}`;
    weatherEmoji.textContent = (wData.weather[0].main === 'Clear') ? '☀️' :
                               (wData.weather[0].main.includes('Cloud')) ? '☁️' :
                               (wData.weather[0].main.includes('Rain')) ? '🌧️' : '🌤️';
    setVideoForWeather(wData.weather[0].main);

    // 2) AQI (OpenWeatherMap air_pollution)
    const aqiURL = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}`;
    const aRes = await fetch(aqiURL);
    if(!aRes.ok) throw new Error('AQI fetch failed');
    const aData = await aRes.json();

    const aqiVal = aData.list && aData.list[0] && aData.list[0].main ? aData.list[0].main.aqi : null;
    const comps = aData.list && aData.list[0] && aData.list[0].components ? aData.list[0].components : {};

    aqiValueEl.textContent = aqiVal || '--';
    const cat = aqiCategory(aqiVal);
    aqiCategoryEl.textContent = cat.label;
    aqiEmojiEl.textContent = cat.emoji;
    aqiValueEl.style.background = cat.color ? hexToRGBA(cat.color,0.12) : '';
    pm25El.textContent = comps.pm2_5 ? Math.round(comps.pm2_5) : '—';
    pm10El.textContent = comps.pm10 ? Math.round(comps.pm10) : '—';
    tempEl.textContent = wData.main.temp ? Math.round(wData.main.temp) : '—';

    // pollutant details
    p_pm25.textContent = comps.pm2_5 ? comps.pm2_5 : '—';
    p_pm10.textContent = comps.pm10 ? comps.pm10 : '—';
    p_co.textContent = comps.co ? comps.co : '—';
    p_no2.textContent = comps.no2 ? comps.no2 : '—';
    p_so2.textContent = comps.so2 ? comps.so2 : '—';
    p_o3.textContent = comps.o3 ? comps.o3 : '—';

    lastUpdatedEl.textContent = `Last updated: ${formatTime()}`;

  } catch (err) {
    console.error(err);
    cityNameEl.textContent = 'Location / Data unavailable';
  }
}

/* Try to fetch nearby monitoring stations via OpenAQ (v2) */
async function loadNearbyStations(cityName){
  setLoadingStations();
  try {
    // attempt OpenAQ location search by city name (limit small)
    const q = encodeURIComponent(cityName || '');
    const url = `https://api.openaq.org/v2/locations?city=${q}&limit=50&page=1&sort=desc&order_by=lastUpdated`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('OpenAQ fetch failed');
    const json = await res.json();
    if(json && json.results && json.results.length){
      renderStations(json.results);
      return;
    }
    // fallback to nearest by coordinates (not implemented here) -> show sample
    renderSampleStations();
  } catch(e){
    console.warn('OpenAQ not available or error', e);
    renderSampleStations();
  }
}

/* Render station rows */
function renderStations(list){
  clearStations();
  list.forEach(loc => {
    const row = document.createElement('div');
    row.className = 'station-row';
    const name = document.createElement('div');
    name.className = 'station-name';
    name.textContent = loc.name || loc.location || loc.city;
    const aqi = document.createElement('div');
    aqi.className = 'station-aqi';
    // OpenAQ doesn't provide US-AQI directly; show primary pollutant value if available
    let v = '—';
    if(loc.parameters && loc.parameters.length){
      const pm25 = loc.parameters.find(p=>p.parameter==='pm25');
      v = pm25 ? `${Math.round(pm25.lastValue||pm25.average||0)} µg/m³` : (loc.parameters[0].lastValue || '—');
    }
    aqi.textContent = v;
    row.appendChild(name);
    row.appendChild(aqi);
    stationsList.appendChild(row);
  });
}

/* Sample fallback list (if OpenAQ not available) */
function renderSampleStations(){
  const sample = [
    { name: 'Brigade Road', aqi: 64, pm25:16},
    { name: 'Hebbal', aqi: 55, pm25:11},
    { name: 'Whitefield', aqi: 64, pm25:16},
    { name: 'Koramangala', aqi: 63, pm25:15},
    { name: 'BTM Layout', aqi: 64, pm25:16}
  ];
  clearStations();
  sample.forEach(s => {
    const row = document.createElement('div');
    row.className = 'station-row';
    row.innerHTML = `<div class="station-name">${s.name}</div><div class="station-aqi">${s.aqi}</div>`;
    stationsList.appendChild(row);
  });
}

/* UI helpers */
function hexToRGBA(hex, a=1){
  // simple hex to rgba for small tints
  hex = hex.replace('#','');
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* EVENTS */
searchBtn.addEventListener('click', async ()=>{
  const q = (searchInput.value || '').trim();
  if(!q) return alert('Enter a city name');
  // Use OpenWeatherMap geocoding to resolve city -> coords
  try {
    const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${OWM_API_KEY}`;
    const gres = await fetch(geoURL);
    const gjson = await gres.json();
    if(!gjson || !gjson.length) return alert('City not found');
    const {lat, lon, name} = gjson[0];
    await updateDashboardFromCoords(lat, lon);
    await loadNearbyStations(name);
  } catch(e){
    console.error(e);
    alert('Search failed');
  }
});

locateBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation) return alert('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    await updateDashboardFromCoords(lat, lon);
    // reverse geocode to get city name
    try{
      const revURL = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OWM_API_KEY}`;
      const rres = await fetch(revURL);
      const rjson = await rres.json();
      const cityName = rjson && rjson[0] && rjson[0].name ? rjson[0].name : '';
      await loadNearbyStations(cityName);
    }catch(e){
      renderSampleStations();
    }
  }, err=>{
    alert('Location permission denied or unavailable');
  }, {enableHighAccuracy:false, timeout:8000});
});

modeToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('light');
});

/* initial detect location on load */
window.addEventListener('load', async ()=>{
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      await updateDashboardFromCoords(lat, lon);
      try {
        const revURL = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OWM_API_KEY}`;
        const rres = await fetch(revURL);
        const rjson = await rres.json();
        const cityName = rjson && rjson[0] && rjson[0].name ? rjson[0].name : '';
        await loadNearbyStations(cityName);
      } catch(e){
        renderSampleStations();
      }
    }, async ()=>{ // on fail: fallback to default city
      await lookupDefaultCity('Bengaluru');
    }, {timeout:7000});
  } else {
    await lookupDefaultCity('Bengaluru');
  }

  // auto refresh loop
  setInterval(async ()=>{
    // determine current city coordinates from the displayed open map link
    // For simplicity, re-trigger a fetch for displayed city (searchInput can be used)
    const curCity = cityNameEl.textContent || searchInput.value || 'Bengaluru';
    try {
      await lookupDefaultCity(curCity);
    } catch(e){
      console.warn('Auto refresh failed', e);
    }
  }, REFRESH_MS);
});

async function lookupDefaultCity(q){
  try {
    const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${OWM_API_KEY}`;
    const gres = await fetch(geoURL);
    const gjson = await gres.json();
    if(!gjson || !gjson.length) {
      // fallback coordinates for Bengaluru
      await updateDashboardFromCoords(12.9716,77.5946);
      await loadNearbyStations('Bengaluru');
      return;
    }
    const {lat, lon, name} = gjson[0];
    await updateDashboardFromCoords(lat, lon);
    await loadNearbyStations(name);
  } catch(e){
    console.error(e);
  }
}
