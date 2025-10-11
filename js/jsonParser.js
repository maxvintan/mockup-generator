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

// Handle truncated JSON by attempting to recover partial data
export function handleTruncatedJson(jsonText) {
    try {
        // Find the last complete section and truncate there
        let cleaned = jsonText;

        // First try to close any unclosed strings at the end
        const lastOpenQuoteIndex = cleaned.lastIndexOf('"');
        if (lastOpenQuoteIndex !== -1) {
            // Find if there's a closing quote after this
            const afterQuote = cleaned.substring(lastOpenQuoteIndex + 1);
            const nextQuoteIndex = afterQuote.indexOf('"');

            if (nextQuoteIndex === -1) {
                // Unclosed string, try to fix by adding closing quote and brace
                cleaned = cleaned + '"}';
            }
        }

        // Try to fix structural issues
        cleaned = fixStructuralIssues(cleaned);

        // Try to complete incomplete object/array structures
        cleaned = completeIncompleteStructure(cleaned);

        // Attempt to parse the recovered JSON
        try {
            return JSON.parse(cleaned);
        } catch(recoveryError) {
            console.warn("Direct recovery failed, attempting section-by-section recovery...");

            // As a last resort, try to extract complete sections
            return recoverPartialJson(cleaned);
        }

    } catch(recoveryError) {
        console.error("JSON truncation recovery failed:", recoveryError);
        throw new Error("Unable to recover from truncated JSON response");
    }
}

// Complete incomplete JSON structures
export function completeIncompleteStructure(jsonText) {
    let cleaned = jsonText;

    // Count braces and brackets to identify what's missing
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;

    // Add missing braces/brackets at end
    if (openBraces > closeBraces) {
        const missing = openBraces - closeBraces;
        cleaned += '}'.repeat(missing);
    }

    if (openBrackets > closeBrackets) {
        const missing = openBrackets - closeBrackets;
        cleaned += ']'.repeat(missing);
    }

    return cleaned;
}

// Recover partial JSON by extracting complete sections
export function recoverPartialJson(jsonText) {
    const result = {};
    let currentObject = result;

    // Split into lines and process each one
    const lines = jsonText.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
        try {
            // Try to match key-value pairs
            const keyValueMatch = line.match(/"([^"]+)"\s*:\s*(.+?)(?=,|\}|$)/);
            if (keyValueMatch) {
                const [, key, value] = keyValueMatch;
                try {
                    // Try to parse the value
                    const parsedValue = JSON.parse(value.trim());
                    currentObject[key] = parsedValue;
                } catch {
                    // If value can't be parsed, store as string if it looks complete
                    if (value.trim().startsWith('"') && value.trim().endsWith('"')) {
                        currentObject[key] = JSON.parse(value.trim());
                    } else if (!value.includes('"') || value.split('"').length >= 3) {
                        // For partially truncated strings, try to clean them up
                        let cleanedValue = value.trim();
                        if (cleanedValue.startsWith('"') && !cleanedValue.endsWith('"')) {
                            cleanedValue += '"'; // Add closing quote
                        }
                        try {
                            currentObject[key] = JSON.parse(cleanedValue);
                        } catch {
                            // Skip malformed values
                            console.warn(`Skipping malformed value for key ${key}: ${cleanedValue}`);
                        }
                    }
                }
            }
        } catch (lineError) {
            console.warn("Could not parse line:", line, lineError);
        }
    }

    // If we didn't recover anything meaningful, throw error
    if (Object.keys(result).length === 0) {
        throw new Error("Could not recover any valid data from truncated JSON");
    }

    console.log("Recovered partial JSON:", result);
    return result;
}

// Detect if JSON response appears to be truncated
export function detectTruncation(jsonText) {
    // Check if text ends with incomplete string (unclosed quote)
    const trimmed = jsonText.trim();

    // Count quotes from the end backward
    let openQuotes = 0;
    for (let i = trimmed.length - 1; i >= 0; i--) {
        const char = trimmed[i];
        if (char === '"') {
            // Check if this quote is escaped by looking at previous character
            if (i > 0 && trimmed[i-1] !== '\\') {
                openQuotes++;
            }
        }
        // Stop counting after finding significant closing brackets/braces
        if (char === '}' || char === ']') {
            break;
        }
    }

    // If we have odd number of quotes (unclosed string), it's likely truncated
    return openQuotes % 2 === 1;
}

// Enhanced JSON parsing with multiple fallback methods
export function parseAIJsonResponse(jsonText) {
    if (!jsonText) throw new Error("Failed to generate valid content from the model.");

    // Clean up markdown code blocks first
    const cleanedJsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedJson;
    const isTruncated = detectTruncation(cleanedJsonText);

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

            if (isTruncated) {
                // Special handling for truncated JSON
                console.warn("Detected truncated JSON response, attempting recovery...");
                try {
                    parsedJson = handleTruncatedJson(cleanedJsonText);
                } catch(truncationError) {
                    console.error("Truncation recovery failed:", truncationError);
                    throw new Error("The model's response appears to be truncated/incomplete. This often happens with longer responses or token limits. Try using a model with higher context limits, shortening your prompt details, or generating again.");
                }
            } else {
                throw new Error("The model returned invalid JSON that could not be parsed. Please try again with a different model or prompt.");
            }
        }
    }

    return parsedJson;
}
