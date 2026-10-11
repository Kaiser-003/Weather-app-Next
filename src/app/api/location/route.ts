import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");

    if (!latitude || !longitude) {
      return NextResponse.json(
        {
          message: "Latitude and longitude are required",
        },
        { status: 400 }
      );
    }

    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=jsonv2` +
      `&lat=${encodeURIComponent(latitude)}` +
      `&lon=${encodeURIComponent(longitude)}` +
      `&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "WeatherDashboard/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          message: "Unable to find location",
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    const address = data.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      "";

    const state = address.state || "";
    const country = address.country || "";

    return NextResponse.json({
      city,
      state,
      country,
      latitude: Number(latitude),
      longitude: Number(longitude),
      displayName: data.display_name || "",
    });
  } catch (error) {
    console.error("Reverse geocoding error:", error);

    return NextResponse.json(
      {
        message: "Something went wrong while finding your location",
      },
      { status: 500 }
    );
  }
}