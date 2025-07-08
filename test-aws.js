import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

console.log("=== AWS CREDENTIALS TEST ===");
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("AWS_ACCESS_KEY_ID exists:", !!process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_ACCESS_KEY_ID prefix:", process.env.AWS_ACCESS_KEY_ID?.substring(0, 4) + "...");
console.log("AWS_SECRET_ACCESS_KEY exists:", !!process.env.AWS_SECRET_ACCESS_KEY);
console.log("AWS_SECRET_ACCESS_KEY length:", process.env.AWS_SECRET_ACCESS_KEY?.length);
console.log("==============================");

const client = new TextractClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Test with a simple 1x1 pixel PNG image (base64 encoded)
const testImage = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", 
    "base64"
);

const command = new DetectDocumentTextCommand({
    Document: { Bytes: testImage },
});

console.log("Testing AWS Textract connection...");

try {
    const response = await client.send(command);
    console.log("✅ SUCCESS! AWS Textract is working!");
    console.log("Response blocks:", response.Blocks?.length || 0);
    console.log("Full response:", JSON.stringify(response, null, 2));
} catch (error) {
    console.log("❌ ERROR! AWS Textract failed:");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.$metadata?.httpStatusCode);
    
    if (error.name === "UnrecognizedClientException") {
        console.log("\n🔧 SOLUTION: Your AWS credentials are invalid or expired.");
        console.log("1. Create new AWS access keys in IAM console");
        console.log("2. Make sure the user has AmazonTextractFullAccess policy");
        console.log("3. Update your .env.local file with new credentials");
    } else if (error.name === "AccessDeniedException") {
        console.log("\n🔧 SOLUTION: Your AWS user doesn't have Textract permissions.");
        console.log("1. Go to IAM console → Users → your user → Permissions");
        console.log("2. Add policy: AmazonTextractFullAccess");
    }
}