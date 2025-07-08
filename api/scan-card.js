import formidable from 'formidable';
import fs from 'fs';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

export const config = {
    api: {
        bodyParser: false,
    },
};


export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const form = formidable({
            maxTotalFileSize: 15 * 1024 * 1024, // 15 MB
            keepExtensions: true,
        });

        const [fields, files] = await form.parse(req);

        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        console.log("Received file:", file);

        if (!file) {
            console.error("No file found in files object:", files);
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Get the file path - try multiple properties for compatibility
        const filePath = file.filepath || file.path || file.newFilename;
        console.log("Using file path:", filePath);

        if (!filePath) {
            console.error("Filepath is missing:", file);
            return res.status(400).json({ message: "Uploaded file has no valid path" });
        }

        // Check if file exists before reading
        if (!fs.existsSync(filePath)) {
            console.error("File does not exist at path:", filePath);
            return res.status(400).json({ message: "Uploaded file not found" });
        }

        // Read the file buffer
        let imageBuffer = await fs.promises.readFile(filePath);
        console.log("Successfully read file buffer, size:", imageBuffer.length);

        const ext = file.originalFilename?.split('.').pop().toLowerCase();
        const supported = ['jpg', 'jpeg', 'png'];

        if (!supported.includes(ext)) {
            console.log(`File extension .${ext} is not supported by Textract, converting to JPEG...`);
            imageBuffer = await sharp(imageBuffer)
                .jpeg({ quality: 90 }) // adjust quality if needed
                .toBuffer();
            console.log('Conversion complete, new buffer size:', imageBuffer.length);
        }
        if (imageBuffer.length > 5 * 1024 * 1024) {
            console.log("Image too large for Textract, resizing...");
            imageBuffer = await sharp(imageBuffer)
                .resize({ width: 2000, withoutEnlargement: true }) // adjust width to reduce size
                .jpeg({ quality: 80 }) // reduce quality for compression
                .toBuffer();
            console.log("Resized buffer size:", imageBuffer.length);
        }

        console.log("Buffer size:", imageBuffer.length);
        console.log("First 16 bytes:", imageBuffer.subarray(0, 16));

        // DEBUG: Check environment variables
        console.log("=== AWS ENVIRONMENT DEBUG ===");
        console.log("AWS_REGION:", process.env.AWS_REGION);
        console.log("AWS_ACCESS_KEY_ID exists:", !!process.env.AWS_ACCESS_KEY_ID);
        console.log("AWS_ACCESS_KEY_ID prefix:", process.env.AWS_ACCESS_KEY_ID?.substring(0, 4) + "...");
        console.log("AWS_SECRET_ACCESS_KEY exists:", !!process.env.AWS_SECRET_ACCESS_KEY);
        console.log("AWS_SECRET_ACCESS_KEY length:", process.env.AWS_SECRET_ACCESS_KEY?.length);
        console.log("=== END DEBUG ===");

        // Initialize AWS Textract client
        const client = new TextractClient({
            region: process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        // Create and send the Textract command
        const command = new DetectDocumentTextCommand({
            Document: { Bytes: imageBuffer },
        });

        console.log("Sending request to AWS Textract...");
        const textractResponse = await client.send(command);
        console.log("Textract response received:", {
            blocksCount: textractResponse.Blocks?.length || 0,
            blocks: textractResponse.Blocks?.slice(0, 3) // First 3 blocks for debugging
        });

        // Process the response
        const blocks = textractResponse.Blocks || [];
        console.log("Total blocks found:", blocks.length);

        const lineBlocks = blocks.filter(b => b.BlockType === "LINE");
        console.log("LINE blocks found:", lineBlocks.length);

        const lines = lineBlocks
            .map(b => b.Text)
            .filter(text => text); // Remove empty strings

        console.log("Extracted lines:", lines);

        // Find the Pokemon name - look for a line that's likely the main name
        const name = lines.find(line => {
            const cleanLine = line.trim();
            // Skip common non-name lines
            const skipWords = ['evolves', 'stage', 'hp', 'pokémon', 'power:', 'weakness', 'resistance', 'retreat', 'illus', 'does nothing', 'fire spin', 'energy burn'];
            const hasSkipWord = skipWords.some(word => cleanLine.toLowerCase().includes(word));

            // Look for lines that are likely Pokemon names (short, capitalized, not numbers)
            const isShortLine = cleanLine.length > 2 && cleanLine.length < 20;
            const startsWithCapital = /^[A-Z]/.test(cleanLine);
            const notJustNumbers = !/^\d+$/.test(cleanLine);
            const notSymbols = !/^[-+*/#]/.test(cleanLine);

            return !hasSkipWord && isShortLine && startsWithCapital && notJustNumbers && notSymbols;
        });

        // Find the date/copyright section - combine related lines
        let date = null;
        const illustratorIndex = lines.findIndex(line => line.toLowerCase().includes('illus'));

        if (illustratorIndex !== -1) {
            // Combine illustrator line with the next 1-2 lines (year and card number)
            const dateParts = [];

            // Add illustrator line
            dateParts.push(lines[illustratorIndex]);

            // Add year line if it exists and looks like a year
            if (illustratorIndex + 1 < lines.length) {
                const nextLine = lines[illustratorIndex + 1];
                if (/\b(19|20)\d{2}\b/.test(nextLine) || nextLine.includes('©')) {
                    dateParts.push(nextLine);
                }
            }

            // Add card number line if it exists and looks like a card number (contains / or *)
            if (illustratorIndex + 2 < lines.length) {
                const cardLine = lines[illustratorIndex + 2];
                if (cardLine.includes('/') || cardLine.includes('*') || /^\d+\/\d+/.test(cardLine)) {
                    dateParts.push(cardLine);
                }
            }

            date = dateParts.join(' ');
        } else {
            // Fallback: look for any line with copyright or year
            date = lines.find(line => {
                const cleanLine = line.toLowerCase();
                return cleanLine.includes('©') ||
                    cleanLine.includes('copyright') ||
                    /\b(19|20)\d{2}\b/.test(line);
            });
        }

        console.log("Found name:", name);
        console.log("Found date:", date);

        // Clean up the temporary file
        try {
            await fs.promises.unlink(filePath);
            console.log("Temporary file cleaned up");
        } catch (unlinkError) {
            console.warn("Could not clean up temporary file:", unlinkError.message);
        }

        return res.status(200).json({
            name: name || "Not found",
            date: date || "Not found",
            lines,
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return res.status(500).json({
            message: "Error processing request",
            error: error.message
        });
    }
}