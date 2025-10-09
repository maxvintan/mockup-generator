// --- UTILITY FUNCTIONS ---
export function cleanColorName(colorString) {
    if (typeof colorString !== 'string') return '';
    return colorString.split('(')[0].trim();
}

export function formatThemeNameForFile(themeName) {
    if (typeof themeName !== 'string') return '';
    return themeName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

export function copyToClipboard(textToCopy, buttonElement, originalText = 'Copy') {
    if (!textToCopy) return;
    
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            buttonElement.textContent = 'Copied!';
            setTimeout(() => { buttonElement.textContent = originalText; }, 2000);
        } else {
            return false;
        }
    } catch (err) {
        console.error('Fallback: Gagal menyalin teks', err);
        return false;
    }

    document.body.removeChild(textArea);
    return true;
}

export function buildPromptContext(state, productCatalog, colorOptions, countries) {
    const context = { ...state };
    
    if (context.gender === 'Automatic') {
        const genders = ["Unisex", "Women", "Men"];
        context.gender = genders[Math.floor(Math.random() * genders.length)];
    }
    if (context.productCategory === 'Automatic') {
        const categories = Object.keys(productCatalog);
        context.productCategory = categories[Math.floor(Math.random() * categories.length)];
    }
    if (context.productType === 'Automatic') {
        const availableTypes = productCatalog[context.productCategory];
        context.productType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }
    const genderString = context.gender === 'Unisex' ? 'unisex' : context.gender.toLowerCase() + '’s';
    context.fullProductType = `${genderString} ${context.productType.toLowerCase()}`;

    if (state.generationMode === 'custom') {
        if (context.primaryColor === 'Automatic') {
            context.primaryColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
        }
        if (context.accentColor === 'Automatic') {
            let accentOptions = colorOptions.filter(c => c !== context.primaryColor);
            context.accentColor = accentOptions[Math.floor(Math.random() * accentOptions.length)];
        } else if (context.accentColor === 'No Accent Color') {
            context.accentColor = '';
        }
        if (context.country === 'Automatic') {
            const countryKeys = Object.keys(countries);
            context.country = countryKeys[Math.floor(Math.random() * countryKeys.length)];
        }
         if (context.designer === 'Automatic') {
            if (context.country && context.country !== 'None') {
                const designerList = countries[context.country].designers;
                context.designer = designerList[Math.floor(Math.random() * designerList.length)];
            } else { 
                const allDesigners = Object.values(countries).flatMap(c => c.designers);
                context.designer = allDesigners[Math.floor(Math.random() * allDesigners.length)];
            }
        }
        if (context.designer === 'None' || context.country === 'None' || !context.designer) {
            context.designer = '';
        }
    } else { // 'theme' mode
         context.primaryColor = "AI-selected based on aesthetic";
         context.accentColor = "AI-selected based on aesthetic";
         context.country = "";
         context.designer = "";
    }
    return context;
}

export function buildPrompts(context, colorOptions) {
    let themeLanguageInstruction = (context.country && context.country !== 'None' && context.country !== 'Automatic')
        ? `The 'theme_name' MUST be in the primary language of ${context.country}.`
        : "The 'theme_name' MUST be in English.";

    const baseTemplate = {
        metadata: {
            theme_name: "{{creative_theme_name}}",
            theme_name_romanized: "{{romanized_version_for_filename}}"
        },
        product: {
            type: context.fullProductType,
            structure: "{{creative_structure_description}}",
            material: "polyester canvas fabric, oxford weave",
            color_scheme: {
                primary_panel: "",
                accent_panel: ""
            }
        },
        design: {
            hardware: {
                material: "{{hardware_material}}",
                components: "{{hardware_components}}",
                finish: "{{hardware_finish}}"
            },
            stitching: {
                thread_color: "{{stitching_thread_color}}",
                style: "{{stitching_style}}"
            }
        },
        branding: {
            logo_text: "SIGNIFO",
            font: "{{logo_font}}",
            material: "shimmering, reflective metallic gold (#dbc35b)",
            application: "{{logo_application}}",
            location: "{{logo_location}}"
        },
        photography: {
            composition: {
                view: "{{photo_view_angle}}",
                focus: "sharp focus on stitching and woven polyester canvas fabric surface, background softly blurred"
            },
            environment: {
                background: {
                    type: "seamless studio background",
                    color_hex: "#FFFFFF"
                },
                lighting: {
                    type: "soft studio lighting",
                    effect: "evenly illuminating the fabric and emphasizing the woven canvas texture"
                }
            },
            style: {
                photography: "High-end product photography, highlighting the woven polyester canvas texture with subtle light reflections.",
                feel: "{{style_feel}}",
                aspect_ratio: "1:1",
                realism: "2K, ultra-detailed, photorealistic."
            }
        }
    };

    const creativeConstraints = `
CREATIVE CONSTRAINTS FOR ENHANCED ORIGINALITY:
- Theme names should be evocative, poetic, and create emotional resonance from combining color palettes with structural elements, hardware choices, and stitching patterns
- Draw inspiration from art movements, nature, architecture, cultural references, and the product's complete design language
- Create unexpected but harmonious combinations across all design elements (structure, colors, hardware, stitching)
- Design details should showcase innovative thinking about how canvas structure, hardware materials, and stitching styles work together
- Photography concepts should highlight the unique interplay of woven canvas fabric texture, hardware details, and stitching patterns
- Hardware choices should complement the canvas material and chosen structure in unexpected ways
- Think about how to make polyester canvas feel luxurious and premium through integrated design elements
- Incorporate storytelling elements that tie together the product structure, hardware, and finishing details
- Theme names should reflect this integrated design approach rather than focusing on colors alone
`;

    const fictionModeConstraints = `
FICTION MODE - EXPANDED CREATIVE FREEDOM:
- Draw inspiration from fantasy, sci-fi, mythology, and fictional worlds
- Imagine this product existing in magical realms, futuristic societies, or epic adventures
- Incorporate elements from fictional universes:
  COMICS: DC Comics (Batman, Superman, Wonder Woman, Justice League, The Flash, Green Lantern), Marvel (Spider-Man, Avengers, X-Men, Fantastic Four, Guardians of the Galaxy, Deadpool)
  ANIMATION: Disney (Disney Princesses, Pixar films like Toy Story and Cars, classic Disney animations), Studio Ghibli (Spirited Away, My Neighbor Totoro), Warner Bros (Looney Tunes, Hanna-Barbera like Scooby-Doo and Flintstones)
  LITERATURE: Lord of the Rings, Harry Potter, and other fantasy worlds
  GAMING: Nintendo franchises (Mario, Zelda, Pokémon), major video game universes
  ADDITIONAL PUBLISHERS: Dark Horse Comics (Hellboy, Sin City, Umbrella Academy), Image Comics (The Walking Dead, Spawn, Invincible, Saga), IDW Publishing (Teenage Mutant Ninja Turtles, Transformers, Star Trek), Boom! Studios (Power Rangers, Mighty Morphin' series)
- Think about how iconic characters from these worlds would use this product
- Create mythical or futuristic design elements while keeping the actual material as canvas
- Design hardware that looks like it could be magical artifacts, advanced technology, or superhero gadgets
- Consider how lighting and photography could create magical, cinematic, or otherworldly effects
- The product should feel like it belongs in a story or fictional universe
- Push creative boundaries beyond real-world constraints while maintaining elegance
`;

    const historicalModeConstraints = `
HISTORICAL MODE - ANCIENT & HISTORICAL INSPIRATION:
- Draw inspiration from historical periods, ancient civilizations, and bygone eras
- Imagine this product as it would have existed in ancient Egypt, Rome, Greece, medieval Europe, etc.
- Incorporate design elements from specific historical periods (Renaissance, Victorian, Art Deco, etc.)
- Think about how historical figures or people from different eras would have used this product
- Create hardware that resembles historical artifacts, ancient tools, or period-appropriate materials
- Consider how lighting and photography could evoke the atmosphere of historical settings
- The product should feel like it was discovered from a different time period
- Use authentic historical color palettes and design motifs appropriate to the chosen era
- Reference specific historical techniques, craftsmanship, and artistic styles
- Create a sense of timelessness and historical significance
`;

    // Country-specific historical contexts
    const countryHistoricalContexts = {
        'Italy': 'Draw specific inspiration from Italian history: Roman Empire architecture, Renaissance art and craftsmanship, Venetian merchant culture, Etruscan artifacts, or Baroque design elements.',
        'France': 'Draw specific inspiration from French history: Louis XIV opulence, French Revolution era, Art Nouveau movement, Belle Époque, or medieval French castles and cathedrals.',
        'Japan': 'Draw specific inspiration from Japanese history: Edo period samurai culture, Heian era courtly elegance, Meiji Restoration, traditional Shinto craftsmanship, or Zen Buddhist minimalism.',
        'India': 'Draw specific inspiration from Indian history: Mughal Empire architecture, Vedic period traditions, British Raj colonial era, ancient Indus Valley civilization, or traditional Rajasthani craftsmanship.',
        'Egypt': 'Draw specific inspiration from Egyptian history: Pharaonic dynasties, Ptolemaic period, ancient hieroglyphics and papyrus, Nile Valley civilization, or Coptic Christian traditions.',
        'Mexico': 'Draw specific inspiration from Mexican history: Aztec civilization, Mayan culture, Spanish colonial period, Mexican Revolution era, or pre-Columbian Mesoamerican traditions.',
        'China': 'Draw specific inspiration from Chinese history: Imperial dynasties (Han, Tang, Ming), Silk Road merchants, traditional Confucian aesthetics, ancient bronze age artifacts, or Forbidden City opulence.',
        'United Kingdom': 'Draw specific inspiration from British history: Victorian era industrial design, Tudor period craftsmanship, Georgian architecture, medieval castles, or British Empire colonial influences.',
        'Germany': 'Draw specific inspiration from German history: Holy Roman Empire, Prussian military precision, Bauhaus movement, medieval Gothic architecture, or traditional Bavarian craftsmanship.',
        'Spain': 'Draw specific inspiration from Spanish history: Moorish Al-Andalus period, Spanish Golden Age, colonial empire, traditional flamenco culture, or Gothic cathedrals.',
        'Greece': 'Draw specific inspiration from Greek history: Classical Athens philosophy and democracy, Byzantine Empire, ancient Minoan civilization, or traditional Mediterranean craftsmanship.',
        'Turkey': 'Draw specific inspiration from Turkish history: Ottoman Empire grandeur, Byzantine Constantinople, ancient Hittite civilization, or traditional Anatolian craftsmanship.',
        'Russia': 'Draw specific inspiration from Russian history: Tsarist imperial Russia, Soviet era constructivism, traditional Slavic folk art, or Byzantine Orthodox religious traditions.',
        'Brazil': 'Draw specific inspiration from Brazilian history: Portuguese colonial period, indigenous Tupi-Guarani culture, Amazonian traditions, or Afro-Brazilian heritage.',
        'Indonesia': 'Draw specific inspiration from Indonesian history: Majapahit Empire, traditional batik craftsmanship, Hindu-Buddhist temple architecture, or spice trade era.',
        'South Korea': 'Draw specific inspiration from Korean history: Joseon Dynasty, traditional hanbok design, Buddhist temple architecture, or ancient Silla kingdom artifacts.',
        'Nigeria': 'Draw specific inspiration from Nigerian history: ancient Nok civilization, Yoruba kingdom traditions, Benin Empire bronze work, or Hausa-Fulani cultural heritage.',
        'South Africa': 'Draw specific inspiration from South African history: Zulu kingdom traditions, Dutch colonial Cape architecture, indigenous San rock art, or apartheid era resilience.',
        'Saudi Arabia': 'Draw specific inspiration from Saudi history: ancient Nabatean civilization, Islamic Golden Age, traditional Bedouin craftsmanship, or pre-Islamic Arabian kingdoms.',
        'Sweden': 'Draw specific inspiration from Swedish history: Viking Age exploration, Swedish Empire period, traditional Scandinavian minimalism, or Sami indigenous culture.'
    };

    const themeNameRules = `
        - For 'theme_name': It must be creative, evocative, and max 4 words. Incorporate elements from product structure, hardware design, stitching details, and color schemes to create holistic themes that reflect the complete product concept. ${themeLanguageInstruction}
        - For 'theme_name_romanized': It MUST be the direct Romanized (Latin alphabet) equivalent of the 'theme_name'. Spaces between words are required. Do not use symbols.
        - Theme names should be poetic, memorable, and create emotional connections. Draw inspiration from art movements, nature, architecture, cultural references, and the product's physical characteristics.
    `;

    // Add creative mode constraints based on selected mode
    let finalConstraints = creativeConstraints;
    let creativeModeContext = '';
    
    if (context.creativeMode === 'fiction') {
        finalConstraints = creativeConstraints + fictionModeConstraints;
        creativeModeContext = 'Think about how this could be expressed in a fictional or fantasy context.';
    } else if (context.creativeMode === 'historical') {
        // Add country-specific historical context if a specific country is selected
        let countrySpecificContext = '';
        if (context.country && context.country !== 'Automatic' && context.country !== 'None' && countryHistoricalContexts[context.country]) {
            countrySpecificContext = `\n\nCOUNTRY-SPECIFIC HISTORICAL CONTEXT FOR ${context.country.toUpperCase()}:\n${countryHistoricalContexts[context.country]}`;
        }
        
        finalConstraints = creativeConstraints + historicalModeConstraints + countrySpecificContext;
        creativeModeContext = 'Think about how this could be expressed through historical or ancient civilization inspiration.';
    }

    if (context.generationMode === 'theme') {
        const colorListString = colorOptions.join(', ');
        const systemPrompt = `You are an innovative creative director with exceptional taste. Your task is to generate a highly original and imaginative product concept based on the "${context.aesthetic}" aesthetic. Fill out the entire JSON template with values that are creative, unexpected, and deeply resonant with the aesthetic while showcasing the premium qualities of polyester canvas fabric.

${finalConstraints}

RULES: 
1. All generated values must strongly reflect the essence of the "${context.aesthetic}" aesthetic in innovative ways
2. For colors, you MUST CHOOSE from the provided SIGNIFO Color Palette
3. Do NOT change any locked, pre-filled values (material: "polyester canvas fabric, oxford weave", logo_text: "SIGNIFO")
4. Follow these naming rules: ${themeNameRules}
5. Push creative boundaries while maintaining elegance and sophistication
6. The output MUST be only the completed JSON object.`;

        const themeTemplate = { ...baseTemplate };
        themeTemplate.metadata.aesthetic = context.aesthetic;
        themeTemplate.product.color_scheme = { primary_panel: "{{chosen_primary_color_from_palette}}", accent_panel: "{{chosen_accent_color_from_palette_or_empty}}" };
        themeTemplate.photography.style.feel = "{{style_feel_that_matches_the_aesthetic}}";
        
        const userPrompt = `SIGNIFO Color Palette: [${colorListString}]. Create an exceptionally creative and original concept for a "${context.fullProductType}" inspired by the "${context.aesthetic}" aesthetic. ${creativeModeContext || 'Think about how this aesthetic can be expressed through polyester canvas in innovative ways.'} Template: ${JSON.stringify(themeTemplate)}`;
        return { systemPrompt, userPrompt };

    } else { // Custom Build
        let systemPrompt;
        if (context.designer) {
            systemPrompt = `Act as the world-renowned designer, ${context.designer}, known for pushing creative boundaries. All creative choices should reflect their signature innovative style while designing for the SIGNIFO brand. Complete the JSON template with exceptional creativity and originality.

${finalConstraints}

RULES: 
1. Do NOT change locked values (material: "polyester canvas fabric, oxford weave", logo_text: "SIGNIFO")
2. Follow these naming rules: ${themeNameRules}
3. Output MUST be only the completed JSON object.`;
        } else {
            systemPrompt = `You are an exceptionally creative assistant for SIGNIFO. Your task is to complete the JSON template by filling in all "{{...}}" placeholders with highly original, imaginative, and sophisticated values that showcase the premium potential of polyester canvas fabric.

${finalConstraints}

RULES: 
1. Do NOT change locked values (material: "polyester canvas fabric, oxford weave", logo_text: "SIGNIFO")
2. Follow these naming rules: ${themeNameRules}
3. Output MUST be only the completed JSON object.`;
        }
        const cleanPrimary = cleanColorName(context.primaryColor);
        const cleanAccent = cleanColorName(context.accentColor);

        const customTemplate = { ...baseTemplate };
        customTemplate.product.color_scheme = { primary_panel: context.primaryColor, accent_panel: context.accentColor };

        let creativeContext = '';
        if (context.creativeMode === 'fiction') {
            creativeContext = 'Imagine this product in a fictional world - think about fantasy, sci-fi, or mythological contexts where this product would exist.';
        } else if (context.creativeMode === 'historical') {
            // Add country-specific context if available
            let countrySpecificNote = '';
            if (context.country && context.country !== 'Automatic' && context.country !== 'None' && countryHistoricalContexts[context.country]) {
                countrySpecificNote = ` Specifically draw inspiration from ${context.country}'s historical heritage.`;
            }
            creativeContext = `Imagine this product as it would have existed in ancient civilizations or historical periods - think about ancient Egypt, Rome, medieval Europe, etc.${countrySpecificNote}`;
        } else {
            creativeContext = 'Think about how these colors can work together in unexpected but harmonious ways on polyester canvas.';
        }

        const userPrompt = `Create an exceptionally creative and original concept for a "${context.fullProductType}" with primary color "${cleanPrimary}" and accent color "${cleanAccent}". ${creativeContext} Template: ${JSON.stringify(customTemplate)}`;
        return { systemPrompt, userPrompt };
    }
}
