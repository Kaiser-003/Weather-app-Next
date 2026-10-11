import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as {
      userId: number;
    };

   const result = await pool.query(
  `SELECT
      id,
      city_name,
      state,
      country,
      latitude,
      longitude,
      is_primary
   FROM user_cities
   WHERE user_id = $1
   ORDER BY is_primary DESC, created_at DESC`,
  [decoded.userId]
);

    return NextResponse.json({
      cities: result.rows,
    });
  } catch (error) {
    console.error("Get cities error:", error);

    return NextResponse.json(
      { message: "Failed to load cities" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get JWT from request
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as {
      userId: number;
      email: string;
    };

    // Get city data
    const {
  cityName,
  state,
  country,
  latitude,
  longitude,
  isPrimary,
} = await request.json();

    if (!cityName || !country || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { message: "City information is required" },
        { status: 400 }
      );
    }

    // Save city for logged-in user
  if (isPrimary) {
  await pool.query(
    `UPDATE user_cities
     SET is_primary = FALSE
     WHERE user_id = $1`,
    [decoded.userId]
  );
}

const result = await pool.query(
  `INSERT INTO user_cities
    (user_id, city_name, state, country, latitude, longitude, is_primary)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING *`,
  [
    decoded.userId,
    cityName,
    state || null,
    country,
    latitude,
    longitude,
    isPrimary === true,
  ]
);

    return NextResponse.json(
      {
        message: "City added successfully",
        city: result.rows[0],
      },
      { status: 201 }
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Save city error:", error);

    // Duplicate city
    if (error.code === "23505") {
      return NextResponse.json(
        { message: "This city is already added" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Failed to save city" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as {
      userId: number;
    };

    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get("id");

    if (!cityId) {
      return NextResponse.json(
        { message: "City ID is required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM user_cities
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [cityId, decoded.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { message: "City not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "City removed successfully",
    });
  } catch (error) {
    console.error("Delete city error:", error);

    return NextResponse.json(
      { message: "Failed to remove city" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as {
      userId: number;
    };

    const { cityId } = await request.json();

    if (!cityId) {
      return NextResponse.json(
        { message: "City ID is required" },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE user_cities
       SET is_primary = FALSE
       WHERE user_id = $1`,
      [decoded.userId]
    );

    const result = await pool.query(
      `UPDATE user_cities
       SET is_primary = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [cityId, decoded.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { message: "City not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Primary city updated successfully",
      city: result.rows[0],
    });
  } catch (error) {
    console.error("Update primary city error:", error);

    return NextResponse.json(
      { message: "Failed to update primary city" },
      { status: 500 }
    );
  }
}