import { NextRequest, NextResponse } from "next/server";

type NominatimLocation = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");

    if (!city || !city.trim()) {
      return NextResponse.json(
        { message: "City name is required" },
        { status: 400 }
      );
    }

    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=jsonv2` +
      `&q=${encodeURIComponent(city.trim())}` +
      `&addressdetails=1` +
      `&limit=10`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "WeatherDashboard/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "Location search failed" },
        { status: 500 }
      );
    }

    const data: NominatimLocation[] = await response.json();

    const results = data.map((location) => ({
      placeId: location.place_id,

      name:
        location.address?.city ||
        location.address?.town ||
        location.address?.village ||
        location.address?.municipality ||
        location.name ||
        "Unknown",

      state: location.address?.state || "",

      country: location.address?.country || "",

      // Keep these for the weather API.
      // They are NOT displayed in the UI.
      latitude: Number(location.lat),
      longitude: Number(location.lon),

      displayName: location.display_name,
    }));

    return NextResponse.json({
      results,
    });
  } catch (error) {
    console.error("Nominatim search error:", error);

    return NextResponse.json(
      { message: "Something went wrong while searching for the city" },
      { status: 500 }
    );
  }
}