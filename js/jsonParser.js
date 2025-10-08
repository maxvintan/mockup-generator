// JSON parsing utilities for handling AI model responses
// Extracted from app.js for better organization and reusability

// Main function to parse and repair JSON from AI models
export function parseRepairedJson(jsonText) {
    let repaired = jsonText;

    // Fix 1: Standardize quotes for object keys (single quotes → double quotes)
    // This handles cases like {'key': 'value'} → {"key": "value"}
    repaired = repaired.replace(/'([^']+)'(\s*:)/g, '"$1"$2');

    // Fix 2: Handle mixed quote scenarios in nested objects
    // Look for patterns like "key": 'value' and convert to "key": "value"
    repaired = repaired.replace(/"([^"]+)"\s*:\s*'([^']+)'/g, '"$1": "$2"');

    // Fix 3: Handle cases where values have single quotes but should be double quotes
    // This is more complex, so we'll use a more targeted approach
    repaired = repaired.replace(/'([^']*)'/g, (match, content) => {
        // Only replace single quotes that are likely string values
        // Avoid replacing single quotes in the middle of words or contractions
        if (content.includes(':') || content.includes(',') || content.includes('{') || content.includes('}')) {
            return match; // Keep single quotes for complex content
        }
        return `"${content}"`;
    });

    // Fix 4: Handle trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Fix 5: Handle missing commas between object properties
    // This is tricky, so we'll use a more conservative approach
    repaired = repaired.replace(/}(\s*){/g, '},$1{');
    repaired = repaired.replace(/](\s*)\[/g, '],$1[');

    // Fix 6: Remove unexpected properties that don't belong in objects
    // This handles cases where AI adds extra properties like "prefix" in hardware object
    repaired = removeUnexpectedProperties(repaired);

    // Fix 7: Try to fix common structural issues
    repaired = fixStructuralIssues(repaired);

    console.log("Repaired JSON:", repaired);

    try {
        return JSON.parse(repaired);
    } catch (parseError) {
        console.error("Still failing to parse after repairs, trying alternative approach:", parseError.message);

        // Last resort: try to extract and fix individual sections
        return parseWithAlternativeMethod(repaired);
    }
}

// Remove unexpected properties that AI models sometimes add incorrectly
export function removeUnexpectedProperties(jsonText) {
    // Remove properties that commonly cause issues (like "prefix" in hardware objects)
    jsonText = jsonText.replace(/"prefix"\s*:\s*"[^"]*",?\s*/g, '');

    // Remove other common problematic properties that AI might add
    jsonText = jsonText.replace(/"suffix"\s*:\s*"[^"]*",?\s*/g, '');

    return jsonText;
}

// Fix common structural issues in JSON
export function fixStructuralIssues(jsonText) {
    // Fix unclosed objects/brackets by ensuring proper nesting
    const openBraces = (jsonText.match(/\{/g) || []).length;
    const closeBraces = (jsonText.match(/\}/g) || []).length;
    const openBrackets = (jsonText.match(/\[/g) || []).length;
    const closeBrackets = (jsonText.match(/\]/g) || []).length;

    // Add missing closing braces if needed
    if (openBraces > closeBraces) {
        const missingBraces = openBraces - closeBraces;
        for (let i = 0; i < missingBraces; i++) {
            jsonText += '}';
        }
    }

    // Add missing closing brackets if needed
    if (openBrackets > closeBrackets) {
        const missingBrackets = openBrackets - closeBrackets;
        for (let i = 0; i < missingBrackets; i++) {
            jsonText += ']';
        }
    }

    return jsonText;
}

// Alternative parsing method as last resort
export function parseWithAlternativeMethod(jsonText) {
    try {
        // Try to manually construct a valid JSON object by parsing section by section
        const sections = jsonText.split(/("metadata"|"product"|"design"|"branding"|"photography")/);

        let validJson = '{';
        let currentSection = '';

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            if (section.startsWith('"metadata"') || section.startsWith('"product"') ||
                section.startsWith('"design"') || section.startsWith('"branding"') ||
                section.startsWith('"photography"')) {
                currentSection = section.replace(/"/g, '');
                validJson += `"${currentSection}":`;
            } else if (section === ',' && currentSection) {
                validJson += ',';
            } else if (currentSection && section) {
                // Try to parse this section as a complete object
                try {
                    const testParse = JSON.parse(section);
                    validJson += JSON.stringify(testParse);
                    currentSection = '';
                } catch {
                    // If this section fails, try to clean it up
                    const cleanedSection = cleanupJsonSection(section);
                    try {
                        const testParse = JSON.parse(cleanedSection);
                        validJson += JSON.stringify(testParse);
                        currentSection = '';
                    } catch {
                        console.warn("Could not parse section:", section);
                    }
                }
            }
        }

        validJson += '}';
        console.log("Alternative parsing result:", validJson);

        return JSON.parse(validJson);
    } catch (finalError) {
        console.error("All parsing methods failed:", finalError);
        throw new Error("Unable to parse AI response as valid JSON. The model may need different instructions or a different model should be selected.");
    }
}

// Clean up individual JSON sections
export function cleanupJsonSection(section) {
    let cleaned = section;

    // Remove any trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Fix any remaining quote issues
    cleaned = cleaned.replace(/'([^']+)'(\s*:)/g, '"$1"$2');

    return cleaned;
}

// Enhanced JSON parsing with multiple fallback methods
export function parseAIJsonResponse(jsonText) {
    if (!jsonText) throw new Error("Failed to generate valid content from the model.");

    // Clean up markdown code blocks first
    const cleanedJsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedJson;
    try {
        // First attempt: direct parsing
        parsedJson = JSON.parse(cleanedJsonText);
    } catch(e) {
        console.warn("Direct JSON parsing failed, attempting to repair JSON:", e.message);

        try {
            // Second attempt: repair common JSON issues
            parsedJson = parseRepairedJson(cleanedJsonText);
        } catch(repairError) {
            console.error("Failed to parse JSON after repair attempt:", cleanedJsonText);
            console.error("Repair error:", repairError.message);
            throw new Error("The model returned invalid JSON that could not be parsed. Please try again with a different model or prompt.");
        }
    }

    return parsedJson;
}
