import { NextResponse } from "next/server";
import { isR2Configured, uploadBufferToR2, deleteFromR2 } from "@/lib/storage";

export async function GET() {
  try {
    // Check if R2 is configured
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          status: "error",
          message: "R2 storage is not properly configured",
          missing: {
            accountId: !process.env.CLOUDFLARE_ACCOUNT_ID,
            accessKey: !process.env.CLOUDFLARE_R2_ACCESS_KEY,
            secretKey: !process.env.CLOUDFLARE_R2_SECRET_KEY,
            bucket: !process.env.CLOUDFLARE_R2_BUCKET,
            publicDomain: !process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN,
          },
        },
        { status: 500 }
      );
    }

    // Create a test file
    const testContent = `R2 Storage Test - ${new Date().toISOString()}`;
    const testBuffer = Buffer.from(testContent, "utf-8");
    const testKey = `test/test-${Date.now()}.txt`;

    // Upload test file
    const uploadedUrl = await uploadBufferToR2(
      testBuffer,
      testKey,
      "text/plain"
    );

    // Clean up test file
    await deleteFromR2(testKey);

    return NextResponse.json({
      status: "ok",
      message: "R2 storage is properly configured and working",
      testUploadUrl: uploadedUrl,
      config: {
        bucket: process.env.CLOUDFLARE_R2_BUCKET,
        publicDomain: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "R2 storage test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
