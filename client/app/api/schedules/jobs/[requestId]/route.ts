import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const type = request.nextUrl.searchParams.get("type"); // "schedule" hoặc "metrics"

    if (!type || !["schedule", "metrics"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid query parameter: type must be 'schedule' or 'metrics'" },
        { status: 400 }
      );
    }

    const url = `${API_BASE_URL}/api/v1/schedules/jobs/${requestId}/${type}`;
    console.log(`[proxy] Fetching ${type} from:`, url);

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[proxy] ${type} fetch failed:`, response.status, text);
      return new NextResponse(text || JSON.stringify({ detail: `Failed to fetch ${type}` }), {
        status: response.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    const data = await response.json();
    console.log(`[proxy] ✓ ${type} fetched successfully`);
    return NextResponse.json(data, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[proxy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
