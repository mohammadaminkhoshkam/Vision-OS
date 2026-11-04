// Live weather from Open-Meteo (free, no key). Only the chosen city's coordinates are sent;
// results are cached for 30 minutes and the pill simply hides when offline.
import { createStore, loadJson, saveJson } from '../lib/store';

export interface City {
  name: string;
  lat: number;
  lon: number;
}

export interface Weather {
  temp: number;
  code: number;
  isDay: boolean;
  at: number;
}

const KEY = 'vos.weather';
const cached = loadJson<{ city: City; weather: Weather | null }>(KEY, { city: { name: 'Tehran', lat: 35.6892, lon: 51.389 }, weather: null });

export const weather = createStore({ city: cached.city, weather: cached.weather, error: false });

export function describe(code: number): { label: string; icon: 'sun' | 'cloud' | 'rain' | 'moon' } {
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code <= 3) return { label: 'Partly cloudy', icon: 'cloud' };
  if (code <= 48) return { label: 'Fog', icon: 'cloud' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', icon: 'rain' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Snow', icon: 'cloud' };
  return { label: 'Thunderstorm', icon: 'rain' };
}

export async function refreshWeather(force = false) {
  const { city, weather: w } = weather.get();
  if (!force && w && Date.now() - w.at < 30 * 60000) return;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,is_day`);
    const j = await r.json();
    const next: Weather = { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, isDay: j.current.is_day === 1, at: Date.now() };
    weather.set({ weather: next, error: false });
    saveJson(KEY, { city, weather: next });
  } catch {
    weather.set({ error: true });
  }
}

/** Look a city up by name (in any language) and make it the weather location. */
export async function setCity(name: string): Promise<boolean> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en`);
    const j = await r.json();
    const hit = j.results?.[0];
    if (!hit) return false;
    const city = { name: hit.name as string, lat: hit.latitude as number, lon: hit.longitude as number };
    weather.set({ city, weather: null });
    saveJson(KEY, { city, weather: null });
    await refreshWeather(true);
    return true;
  } catch {
    return false;
  }
}
