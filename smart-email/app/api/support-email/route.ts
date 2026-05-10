import { NextResponse } from "next/server";

const SUPPORT_EMAIL_API_URL =
  process.env.SUPPORT_EMAIL_API_URL ??
  "http://zhangsu1305.australiaeast.azurecontainer.io:1880/api/support-email";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const upstreamResponse = await fetch(SUPPORT_EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseText = await upstreamResponse.text();

    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while forwarding support email request.",
      },
      { status: 500 },
    );
  }
}
