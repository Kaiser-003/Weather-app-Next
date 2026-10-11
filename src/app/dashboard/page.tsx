"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

type User = {
  name: string;

  email: string;
};

type WeatherData = {
  current: {
    temperature_2m: number;

    relative_humidity_2m: number;

    apparent_temperature: number;

    weather_code: number;

    wind_speed_10m: number;
  };

  daily: {
    time: string[];

    weather_code: number[];

    temperature_2m_max: number[];

    temperature_2m_min: number[];

    precipitation_probability_max: number[];
  };
};

type CityResult = {
  placeId: number;

  name: string;

  state: string;

  country: string;

  latitude: number;

  longitude: number;

  displayName: string;
};

type SavedCity = {
  id: number;

  city_name: string;

  state: string | null;

  country: string;

  latitude: number;

  longitude: number;

  is_primary: boolean;
};

export default function DashboardPage() {
  const router = useRouter();

  const [city, setCity] = useState("");

  const [user, setUser] = useState<User | null>(null);

  const [searchResults, setSearchResults] = useState<CityResult[]>([]);

  const [savedCities, setSavedCities] = useState<SavedCity[]>([]);

  const [weatherData, setWeatherData] = useState<Record<number, WeatherData>>(
    {},
  );

  const [aiPredictions, setAiPredictions] = useState<Record<number, string>>(
    {},
  );

  const [aiRisks, setAiRisks] = useState<Record<number, string>>({});

  const [aiProbabilities, setAiProbabilities] = useState<
    Record<number, number | null>
  >({});

  const [searching, setSearching] = useState(false);

  const [searchError, setSearchError] = useState("");

  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");

      return;
    }

    const loadDashboard = async () => {
      try {
        // Get logged-in user

        const userResponse = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!userResponse.ok) {
          localStorage.removeItem("token");

          router.push("/");

          return;
        }

        const userData = await userResponse.json();

        setUser(userData.user);

        // Get saved cities

        const citiesResponse = await fetch("/api/cities", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!citiesResponse.ok) {
          return;
        }

        const citiesData = await citiesResponse.json();

        const cities = citiesData.cities || [];

        setSavedCities(cities);

        // Get weather for all saved cities

        const weatherResults = await Promise.all(
          cities.map(async (savedCity: SavedCity) => {
            try {
              const weatherResponse = await fetch(
                `/api/weather?latitude=${savedCity.latitude}&longitude=${savedCity.longitude}`,
              );

              if (!weatherResponse.ok) {
                return null;
              }

              const weather = await weatherResponse.json();

              const aiResponse = await fetch("/api/ai-weather", {
                method: "POST",

                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  city: savedCity.city_name,

                  weather,
                }),
              });

              let aiPrediction = null;

              let aiRisk = null;

              let aiProbability = null;

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();

                aiPrediction = aiData.prediction;

                aiRisk = aiData.risk;

                aiProbability = aiData.highestProbability;
              }

              return {
                cityId: savedCity.id,

                weather,

                aiPrediction,

                aiRisk,

                aiProbability,
              };
            } catch (error) {
              console.error(`Weather error for ${savedCity.city_name}:`, error);

              return null;
            }
          }),
        );

        const weatherMap: Record<number, WeatherData> = {};

        const predictionMap: Record<number, string> = {};

        const riskMap: Record<number, string> = {};

        const probabilityMap: Record<number, number | null> = {};

        weatherResults.forEach((result) => {
          if (result) {
            weatherMap[result.cityId] = result.weather;

            if (result.aiPrediction) {
              predictionMap[result.cityId] = result.aiPrediction;
            }

            if (result.aiRisk) {
              riskMap[result.cityId] = result.aiRisk;
            }

            if (
              typeof result.aiProbability === "number" ||
              result.aiProbability === null
            ) {
              probabilityMap[result.cityId] = result.aiProbability;
            }
          }
        });

        setWeatherData(weatherMap);

        setAiPredictions(predictionMap);

        setAiRisks(riskMap);

        setAiProbabilities(probabilityMap);
      } catch (error) {
        console.error("Dashboard loading error:", error);
      }
    };

    loadDashboard();
  }, [router]);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!city.trim()) {
      setSearchResults([]);

      return;
    }

    try {
      setSearching(true);

      setSearchError("");

      const response = await fetch(
        `/api/city-search?city=${encodeURIComponent(city)}`,
      );

      const data = await response.json();

      if (!response.ok) {
        setSearchError(data.message || "City search failed");

        setSearchResults([]);

        return;
      }

      setSearchResults(data.results || []);
    } catch (error) {
      console.error("City search error:", error);

      setSearchError("Unable to search city");

      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleCitySelect = async (selectedCity: CityResult) => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");

      return;
    }

    try {
      const response = await fetch("/api/cities", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          cityName: selectedCity.name,

          state: selectedCity.state,

          country: selectedCity.country,

          latitude: selectedCity.latitude,

          longitude: selectedCity.longitude,

          isPrimary: savedCities.length === 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to add city");

        return;
      }

      setCity("");

      setSearchResults([]);

      const newCity = data.city;

      setSavedCities((previousCities) => [newCity, ...previousCities]);

      // Get weather for newly saved city

      try {
        const weatherResponse = await fetch(
          `/api/weather?latitude=${newCity.latitude}&longitude=${newCity.longitude}`,
        );

        
if (weatherResponse.ok) {
  const weather = await weatherResponse.json();

  setWeatherData((previousWeather) => ({
    ...previousWeather,
    [newCity.id]: weather,
  }));

  // Get AI weather insight for the newly added city
  try {
    const aiResponse = await fetch("/api/ai-weather", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        city: newCity.name,
        weather,
      }),
    });

    const aiData = await aiResponse.json();

    if (aiResponse.ok) {
      setAiPredictions((previous) => ({
        ...previous,
        [newCity.id]: aiData.prediction,
      }));

      setAiRisks((previous) => ({
        ...previous,
        [newCity.id]: aiData.risk,
      }));

      setAiProbabilities((previous) => ({
        ...previous,
        [newCity.id]: aiData.highestProbability,
      }));
    } else {
      console.error("AI weather error:", aiData.error);
    }
  } catch (error) {
    console.error("New city AI insight error:", error);
  }
}

      } catch (error) {
        console.error("New city weather error:", error);
      }
    } catch (error) {
      console.error("Add city error:", error);

      alert("Something went wrong");
    }
  };

  const handleMakePrimary = async (cityId: number) => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");

      return;
    }

    try {
      const response = await fetch("/api/cities", {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          cityId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to update primary city");

        return;
      }

      setSavedCities((previousCities) =>
        previousCities.map((savedCity) => ({
          ...savedCity,

          is_primary: savedCity.id === cityId,
        })),
      );
    } catch (error) {
      console.error("Make primary error:", error);

      alert("Something went wrong");
    }
  };

  const handleRemoveCity = async (cityId: number) => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");

      return;
    }

    try {
      const response = await fetch(`/api/cities?id=${cityId}`, {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to remove city");

        return;
      }

      setSavedCities((previousCities) =>
        previousCities.filter((savedCity) => savedCity.id !== cityId),
      );

      setWeatherData((previousWeather) => {
        const updatedWeather = { ...previousWeather };

        delete updatedWeather[cityId];

        return updatedWeather;
      });
    } catch (error) {
      console.error("Remove city error:", error);

      alert("Something went wrong");
    }
  };

  const handleMyLocation = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/");

      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");

      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Convert GPS coordinates into city/state/country

          const locationResponse = await fetch(
            `/api/location?latitude=${latitude}&longitude=${longitude}`,
          );

          const locationData = await locationResponse.json();

          if (!locationResponse.ok) {
            alert(locationData.message || "Unable to find your location.");

            return;
          }

          if (!locationData.city) {
            alert("Could not determine your city.");

            return;
          }

          // Save detected city

          const cityResponse = await fetch("/api/cities", {
            method: "POST",

            headers: {
              "Content-Type": "application/json",

              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              cityName: locationData.city,

              state: locationData.state,

              country: locationData.country,

              latitude,

              longitude,

              isPrimary: savedCities.length === 0,
            }),
          });

          const cityData = await cityResponse.json();

          if (!cityResponse.ok) {
            if (cityResponse.status === 409) {
              alert("Your current city is already added.");

              return;
            }

            alert(cityData.message || "Failed to save your current location.");

            return;
          }

          const newCity = cityData.city;

          // Add city to dashboard

          setSavedCities((previousCities) => [newCity, ...previousCities]);

          // Get weather for detected city

          try {
            const weatherResponse = await fetch(
              `/api/weather?latitude=${latitude}&longitude=${longitude}`,
            );

            if (weatherResponse.ok) {
              const weather = await weatherResponse.json();

              setWeatherData((previousWeather) => ({
                ...previousWeather,

                [newCity.id]: weather,
              }));
            }
          } catch (error) {
            console.error("Current location weather error:", error);
          }

          alert(
            `${locationData.city}, ${locationData.state}, ${locationData.country} added successfully!`,
          );
        } catch (error) {
          console.error("My location error:", error);

          alert("Something went wrong while detecting your location.");
        } finally {
          setLocating(false);
        }
      },

      (error) => {
        console.error("Location error:", error);

        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          alert("Please allow location access in your browser.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          alert("Your location is currently unavailable.");
        } else if (error.code === error.TIMEOUT) {
          alert("Location request timed out.");
        } else {
          alert("Unable to detect your location.");
        }
      },
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("token");

    router.push("/");
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) {
      return "Clear Sky";
    }

    if ([1, 2, 3].includes(code)) {
      return "Partly Cloudy";
    }

    if ([45, 48].includes(code)) {
      return "Foggy";
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
      return "Drizzle";
    }

    if ([61, 63, 65, 66, 67].includes(code)) {
      return "Rain";
    }

    if ([71, 73, 75, 77].includes(code)) {
      return "Snow";
    }

    if ([80, 81, 82].includes(code)) {
      return "Rain Showers";
    }

    if ([85, 86].includes(code)) {
      return "Snow Showers";
    }

    if ([95, 96, 99].includes(code)) {
      return "Thunderstorm";
    }

    return "Unknown";
  };

  const getWeatherIcon = (code: number) => {
    if (code === 0) {
      return "☀️";
    }

    if ([1, 2, 3].includes(code)) {
      return "⛅";
    }

    if ([45, 48].includes(code)) {
      return "🌫️";
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
      return "🌦️";
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
      return "🌧️";
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      return "❄️";
    }

    if ([95, 96, 99].includes(code)) {
      return "⛈️";
    }

    return "🌤️";
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Weather Dashboard
            </h1>

            <p className="text-sm text-slate-500">
              Welcome, {user?.name || "User"}!
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:px-4"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-900">Search City</h2>

          <p className="mt-1 text-sm text-slate-500">
            Search for a city to view its weather.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-5 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);

                setSearchError("");
              }}
              placeholder="Enter city name..."
              className="w-full min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-auto"
            />

            <button
              type="submit"
              disabled={searching}
              className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {searching ? "Searching..." : "Search"}
            </button>

            <button
              type="button"
              onClick={handleMyLocation}
              disabled={locating}
              className="w-full rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {locating ? "Detecting..." : "📍 My Location"}
            </button>
          </form>

          {searchError && (
            <p className="mt-4 text-sm text-red-600">{searchError}</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              {searchResults.map((result) => (
                <button
                  key={result.placeId}
                  type="button"
                  onClick={() => handleCitySelect(result)}
                  className="block w-full border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
                >
                  <p className="font-semibold text-slate-900">{result.name}</p>

                  <p className="mt-1 text-sm text-slate-500">
                    {result.state
                      ? `${result.state}, ${result.country}`
                      : result.country}
                  </p>
                </button>
              ))}
            </div>
          )}

          {!searching &&
            city.trim() &&
            searchResults.length === 0 &&
            !searchError && (
              <p className="mt-4 text-sm text-slate-500">No locations found.</p>
            )}
        </div>

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">My Cities</h2>

            <p className="text-sm text-slate-500">
              Your saved weather locations
            </p>
          </div>

          {savedCities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-5xl">🌤️</div>

              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No cities added yet
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Search for a city and add it to your dashboard.
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {savedCities.map((savedCity) => {
                const weather = weatherData[savedCity.id];

                return (
                  <div
                    key={savedCity.id}
                    className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6"
                  >
                    <div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="break-words text-xl font-bold text-slate-900">
                          {savedCity.city_name}
                        </h3>

                        {savedCity.is_primary && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                            Primary
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {savedCity.state
                          ? `${savedCity.state}, ${savedCity.country}`
                          : savedCity.country}
                      </p>
                    </div>

                    {weather ? (
                      <>
                        <div className="mt-6">
                          <div className="flex items-center gap-3">
                            <span className="text-5xl font-bold text-slate-900">
                              {Math.round(weather.current.temperature_2m)}°
                            </span>

                            <div>
                              <p className="font-semibold text-slate-800">
                                {getWeatherDescription(
                                  weather.current.weather_code,
                                )}
                              </p>

                              <p className="text-sm text-slate-500">
                                Feels like{" "}
                                {Math.round(
                                  weather.current.apparent_temperature,
                                )}
                                °
                              </p>
                            </div>
                          </div>
                        </div>


                        <div className="mt-6 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Humidity</p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {weather.current.relative_humidity_2m}%
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Wind</p>

                            <p className="mt-1 font-semibold text-slate-800">
                              {Math.round(weather.current.wind_speed_10m)} km/h
                            </p>
                          </div>
                        </div>

                        

                        <div className="mt-6">
                          <h4 className="mb-3 text-sm font-semibold text-slate-700">
                            7-Day Forecast
                          </h4>

                          <div className="space-y-2">
                            {weather.daily.time.map((date, index) => (
                              <div
                                key={date}
                                className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-2 sm:px-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xl">
                                    {getWeatherIcon(
                                      weather.daily.weather_code[index],
                                    )}
                                  </span>

                                  <span className="text-sm font-medium text-slate-700">
                                    {index === 0
                                      ? "Today"
                                      : new Date(date).toLocaleDateString(
                                          "en-US",

                                          {
                                            weekday: "short",
                                          },
                                        )}
                                  </span>
                                </div>

                                <div className="text-right">
                                  <span className="text-sm font-semibold text-slate-800">
                                    {Math.round(
                                      weather.daily.temperature_2m_max[index],
                                    )}
                                    °
                                  </span>

                                  <span className="ml-2 text-sm text-slate-400">
                                    {Math.round(
                                      weather.daily.temperature_2m_min[index],
                                    )}
                                    °
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                     

                        <div className="mt-4 rounded-xl bg-blue-50 p-3">
                          <p className="text-xs text-blue-600">
                            Rain probability today
                          </p>

                          <p className="mt-1 font-semibold text-blue-800">
                            {weather.daily.precipitation_probability_max[0]}%
                          </p>
                        </div>

                        

                        <div className="mt-4 min-w-0 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                            <h4 className="font-semibold text-indigo-900">
                              🤖 AI Rain Insight
                            </h4>

                            {aiRisks[savedCity.id] && (
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  aiRisks[savedCity.id] === "High"
                                    ? "bg-red-100 text-red-700"
                                    : aiRisks[savedCity.id] === "Moderate"
                                      ? "bg-amber-100 text-amber-700"
                                      : aiRisks[savedCity.id] === "Low"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {aiRisks[savedCity.id]} Risk
                              </span>
                            )}
                          </div>

                          {typeof aiProbabilities[savedCity.id] ===
                            "number" && (
                            <p className="mt-3 text-sm font-medium text-indigo-900">
                              Highest rain probability:{" "}
                              {aiProbabilities[savedCity.id]}%
                            </p>
                          )}

                          <p className="mt-2 break-words text-sm leading-6 text-indigo-800">
                            {aiPredictions[savedCity.id] ||
                              "AI rain insight is currently unavailable."}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-center">
                        <p className="text-sm text-slate-500">
                          Loading weather...
                        </p>
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleMakePrimary(savedCity.id)}
                        disabled={savedCity.is_primary}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:cursor-default disabled:text-slate-400"
                      >
                        {savedCity.is_primary ? "Primary City" : "Make Primary"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveCity(savedCity.id)}
                        className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
