import { colorOptions, aesthetics, productCatalog, countries } from './constants.js';
import { createCustomSelect } from './customSelect.js';
import { apiService } from './apiService.js';
import { buildPromptContext, buildPrompts, formatThemeNameForFile, copyToClipboard } from './utils.js';

// --- STATE MANAGEMENT ---
const getDefaultState = () => ({
    generationMode: 'custom',
    model: 'deepseek',
    apiKey: '',
    gender: "Automatic",
    productCategory: "Automatic",
    productType: "Automatic",
    primaryColor: "Automatic",
    accentColor: "Automatic",
    country: "Automatic",
    designer: "Automatic",
    aesthetic: aesthetics[0],
    creativeMode: 'none', // 'none', 'fiction', 'historical'
});

let state = getDefaultState();
const customSelects = {};

// --- DOM ELEMENTS ---
const DOMElements = {
    generateBtn: document.getElementById('generateBtn'),
    resetBtn: document.getElementById('resetBtn'),
    apiKeyInput: document.getElementById('api_key'),
    jsonOutput: document.getElementById('json-output'),
    outputContainer: document.getElementById('output'),
    loader: document.getElementById('loader'),
    errorContainer: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    copyBtn: document.getElementById('copyBtn'),
    filenameContainer: document.getElementById('filename_container'),
    filenameOutput: document.getElementById('filename-output'),
    copyFilenameBtn: document.getElementById('copyFilenameBtn'),
    apiKeyContainer: document.getElementById('apiKeyContainer'),
    apiKeyMessage: document.getElementById('apiKeyMessage'),
    modeCustomRadio: document.getElementById('modeCustom'),
    modeAestheticRadio: document.getElementById('modeAesthetic'),
    creativeModeRadios: document.querySelectorAll('input[name="creativeMode"]'),
    creativeModeDescription: document.getElementById('creativeModeDescription'),
    aestheticSelectWrapper: document.getElementById('aesthetic_select_container_wrapper'),
    modelRadios: document.querySelectorAll('input[name="model"]'),
};

// --- UI HELPER FUNCTIONS ---
function setLoadingState(isLoading) {
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.resetBtn.disabled = isLoading;
    DOMElements.generateBtn.textContent = isLoading ? 'Generating...' : 'Generate Prompt';
    DOMElements.loader.style.display = isLoading ? 'flex' : 'none';
    if (isLoading) {
        DOMElements.outputContainer.classList.add('hidden');
        DOMElements.filenameContainer.classList.add('hidden');
    }
}

function updateUIWithResult(jsonText) {
    if (!jsonText) throw new Error("Failed to generate valid content from the model.");
    const cleanedJsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsedJson;
    try {
        parsedJson = JSON.parse(cleanedJsonText);
    } catch(e) {
        console.error("Failed to parse JSON:", cleanedJsonText);
        throw new Error("The model returned invalid JSON. Please try again.");
    }
    DOMElements.jsonOutput.textContent = JSON.stringify(parsedJson, null, 2);
    DOMElements.outputContainer.classList.remove('hidden');
    
    const nameToFormat = parsedJson.theme_name_romanized || parsedJson.theme_name;
    if (nameToFormat) {
        const formattedName = formatThemeNameForFile(nameToFormat);
        DOMElements.filenameOutput.textContent = formattedName;
        DOMElements.filenameContainer.classList.remove('hidden');
    }
}

function showError(message) {
    DOMElements.errorMessage.textContent = message;
    DOMElements.errorContainer.classList.remove('hidden');
}

function hideError() {
    DOMElements.errorContainer.classList.add('hidden');
}

function updateAccentColorOptions() {
    const primaryColorValue = state.primaryColor;
    let availableAccentColors = ["Automatic", "No Accent Color", ...colorOptions];

    if (primaryColorValue !== "Automatic") {
        availableAccentColors = availableAccentColors.filter(color => color !== primaryColorValue);
    }

    customSelects.accentColor.populateOptions(availableAccentColors);

    if (state.accentColor === primaryColorValue) {
        state.accentColor = "Automatic";
        customSelects.accentColor.updateButton("Automatic");
    }
}

// --- EVENT HANDLERS ---
function handleModeChange(newMode) {
    state.generationMode = newMode;
    const isAesthetic = newMode === 'theme';

    DOMElements.aestheticSelectWrapper.classList.toggle('hidden', !isAesthetic);
    
    const controlsToToggle = [
        customSelects.primaryColor, customSelects.accentColor,
        customSelects.country, customSelects.designer
    ];

    if (isAesthetic) {
        controlsToToggle.forEach(control => {
            if (control && control.button) control.button.disabled = true;
        });
        state.primaryColor = "Automatic";
        state.accentColor = "Automatic";
        state.country = "Automatic";
        state.designer = "Automatic";

    } else {
        controlsToToggle.forEach(control => {
            if (control && control.button) control.button.disabled = false;
        });
        customSelects.primaryColor.updateButton(state.primaryColor);
        customSelects.accentColor.updateButton(state.accentColor);
        customSelects.country.updateButton(state.country);
        customSelects.designer.updateButton(state.designer);
        customSelects.country.onSelect(state.country);
        updateAccentColorOptions();
    }
}

function handleModelSelectChange(event) {
    const newModel = event.target.value;
    state.model = newModel;
    DOMElements.apiKeyInput.value = '';
    state.apiKey = '';
    sessionStorage.removeItem('signifo_api_key');

    DOMElements.apiKeyInput.disabled = false;
    DOMElements.apiKeyInput.placeholder = 'Enter required API key';
    
    if (newModel === 'deepseek') {
        DOMElements.apiKeyMessage.textContent = 'An API key is required to use the Deepseek model.';
    } else if (newModel === 'openrouter') {
        DOMElements.apiKeyMessage.textContent = 'An API key is required to use the OpenRouter model.';
    }
}

async function handleGenerateClick() {
    if ((state.model === 'deepseek' || state.model === 'openrouter') && !state.apiKey.trim()) {
        showError("An API key is required for the selected model.");
        return;
    }
    setLoadingState(true);
    hideError();

    try {
        const promptContext = buildPromptContext(state, productCatalog, colorOptions, countries);
        const { systemPrompt, userPrompt } = buildPrompts(promptContext, colorOptions);
        const generatedJsonText = await apiService.generate(systemPrompt, userPrompt, state);
        updateUIWithResult(generatedJsonText);
    } catch (error) {
        console.error("Error generating prompt:", error);
        let userMessage = error.message || "An unknown error occurred.";
        if (error.status === 401) {
            userMessage = "Authentication failed. The API key you provided is likely invalid or incorrect.";
        } else if (error.status === 403) {
             userMessage = "Permission Denied. Your API key may not have the necessary permissions.";
        }
        showError(userMessage);
    } finally {
        setLoadingState(false);
    }
}

function resetForm() {
    const currentApiKey = state.apiKey;
    state = getDefaultState();
    state.apiKey = currentApiKey;
    
    DOMElements.modeCustomRadio.checked = true;
    DOMElements.modeAestheticRadio.checked = false;
    DOMElements.creativeModeRadios[0].checked = true; // Set "Standard" mode
    handleCreativeModeChange('none');
    
    for (const key in customSelects) {
        const select = customSelects[key];
        if (select.defaultConfig) {
            select.updateButton(select.defaultConfig);
        }
    }
    
    customSelects.productCategory.onSelect(state.productCategory);
    updateAccentColorOptions();

    handleModeChange('custom');

    DOMElements.modelRadios[0].checked = true;
    handleModelSelectChange({ target: { value: 'deepseek' }});

    hideError();
    DOMElements.outputContainer.classList.add('hidden');
    DOMElements.jsonOutput.textContent = '';
    DOMElements.filenameContainer.classList.add('hidden');
    DOMElements.filenameOutput.textContent = '';
}

// --- EVENT LISTENERS ---
function handleCreativeModeChange(mode) {
    state.creativeMode = mode;
    
    // Update description text
    const descriptions = {
        'none': 'Standard creative generation',
        'fiction': 'Fantasy, sci-fi, and fictional world-inspired designs',
        'historical': 'Historical periods and ancient civilizations-inspired designs'
    };
    DOMElements.creativeModeDescription.textContent = descriptions[mode];
}

function setupEventListeners() {
    DOMElements.modeCustomRadio.addEventListener('change', () => handleModeChange('custom'));
    DOMElements.modeAestheticRadio.addEventListener('change', () => handleModeChange('theme'));
    DOMElements.creativeModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => handleCreativeModeChange(e.target.value));
    });
    DOMElements.modelRadios.forEach(radio => radio.addEventListener('change', handleModelSelectChange));
    DOMElements.apiKeyInput.addEventListener('input', (e) => {
        state.apiKey = e.target.value;
        sessionStorage.setItem('signifo_api_key', state.apiKey);
    });
    DOMElements.generateBtn.addEventListener('click', handleGenerateClick);
    DOMElements.resetBtn.addEventListener('click', resetForm);
    DOMElements.copyBtn.addEventListener('click', () => copyToClipboard(DOMElements.jsonOutput.textContent, DOMElements.copyBtn, 'Copy'));
    DOMElements.copyFilenameBtn.addEventListener('click', () => copyToClipboard(DOMElements.filenameOutput.textContent, DOMElements.copyFilenameBtn, 'Copy'));
    document.addEventListener('click', () => {
        Object.values(customSelects).forEach(select => select.closeOptions());
    });
}

// --- INITIALIZATION ---
function initializeApp() {
    const hexRegex = /#([0-9a-fA-F]{6})/;
    
    customSelects.aesthetic = createCustomSelect('aesthetic_select_container', aesthetics, {
        inputId: 'aesthetic_value',
        default: aesthetics[0],
        render: (option) => `<span>${option}</span>`,
        onSelect: (option) => state.aesthetic = option
    });
    
    customSelects.primaryColor = createCustomSelect('primary_color_select', ["Automatic", ...colorOptions], {
        inputId: 'primary_color_value',
        default: "Automatic",
        render: (option) => {
            if (option === "Automatic") return `<span>✨ Automatic</span>`;
            const hexMatch = option.match(hexRegex);
            const hex = hexMatch ? hexMatch[0] : '#ffffff';
            return `<div class="color-swatch" style="background-color: ${hex}"></div> ${option}`;
        },
        onSelect: (option) => {
            state.primaryColor = option;
            updateAccentColorOptions();
        }
    });
    
    customSelects.accentColor = createCustomSelect('accent_color_select', ["Automatic", "No Accent Color", ...colorOptions], {
        inputId: 'accent_color_value',
        default: "Automatic",
        render: (option) => {
            if (option === "Automatic") return `<span>✨ Automatic</span>`;
            if (option === "No Accent Color") return `<span>⛔ No Accent Color</span>`;
            const hexMatch = option.match(hexRegex);
            const hex = hexMatch ? hexMatch[0] : '#ffffff';
            return `<div class="color-swatch" style="background-color: ${hex}"></div> ${option}`;
        },
        onSelect: (option) => state.accentColor = option
    });
    
    customSelects.gender = createCustomSelect('gender_select_container', ["Automatic", "Unisex", "Women", "Men"], {
        inputId: 'gender_value',
        default: "Automatic",
        render: (option) => (option === "Automatic") ? `<span>✨ Automatic</span>` : `<span>${option}</span>`,
        onSelect: (gender) => state.gender = gender
    });
    
    customSelects.productType = createCustomSelect('product_type_select_container', [{value: 'Automatic', label: '✨ Automatic'}], {
        inputId: 'product_type_value',
        default: { value: 'Automatic', label: '✨ Automatic' },
        render: (option) => `<span>${option.label}</span>`,
        onSelect: (option) => state.productType = option.value
    });
    
    customSelects.productCategory = createCustomSelect('product_category_select_container', ["Automatic", ...Object.keys(productCatalog)], {
        inputId: 'product_category_value',
        default: "Automatic",
        render: (option) => (option === "Automatic") ? `<span>✨ Automatic</span>` : `<span>${option}</span>`,
        onSelect: (category) => {
            state.productCategory = category;
            const isAutomatic = category === 'Automatic';
            const types = isAutomatic 
                ? ["Automatic", ...new Set(Object.values(productCatalog).flat())]
                : ["Automatic", ...productCatalog[category]];
            
            customSelects.productType.populateOptions(types.map(p => ({ value: p, label: p === 'Automatic' ? '✨ Automatic' : p })));
            customSelects.productType.button.disabled = false;
            customSelects.productType.updateButton({ value: 'Automatic', label: '✨ Automatic' });
            state.productType = "Automatic";
        }
    });
    
    customSelects.designer = createCustomSelect('designer_select_container', ["Automatic", "None"], {
        inputId: 'designer_value',
        default: "Automatic",
        render: (option) => {
            const value = (typeof option === 'object' && option !== null) ? option.value : option;
            const label = (typeof option === 'object' && option !== null) ? option.label : option;
            if (value === "Automatic") return `<span>✨ Automatic</span>`;
            if (value === "None") return `<span>⛔ None</span>`;
            return `<span>${label}</span>`;
        },
        onSelect: (option) => {
            state.designer = (typeof option === 'object' && option !== null) ? option.value : option;
        }
    });
    
    const sortedCountries = Object.keys(countries).sort();
    customSelects.country = createCustomSelect('country_select_container', ["Automatic", "None", ...sortedCountries], {
        inputId: 'country_value',
        default: "Automatic",
        render: (option) => {
            if (option === "Automatic") return `<span>✨ Automatic</span>`;
            if (option === "None") return `<span>⛔ None</span>`;
            return `<span class="fi fi-${countries[option].code} mr-3"></span> ${option}`;
        },
        onSelect: (country) => {
            state.country = country;
            const designerButton = customSelects.designer.button;
            let designerOptions = [];

            if (country === "None") {
                designerOptions = [];
                customSelects.designer.updateButton({ value: 'None', label: 'Select a country first' });
                designerButton.disabled = true;
                state.designer = "None";
            } else if (country === "Automatic") {
                designerOptions = ["Automatic", "None"].map(d => ({ value: d, label: d }));
                designerButton.disabled = false;
            } else {
                designerOptions = ["Automatic", "None", ...countries[country].designers].map(d => ({ value: d, label: d }));
                designerButton.disabled = false;
            }
            customSelects.designer.onSelect('Automatic');
            customSelects.designer.updateButton({ value: 'Automatic', label: '✨ Automatic' });
            customSelects.designer.populateOptions(designerOptions);
        }
    });

    const savedApiKey = sessionStorage.getItem('signifo_api_key');
    if (savedApiKey) {
        DOMElements.apiKeyInput.value = savedApiKey;
        state.apiKey = savedApiKey;
    }
    
    customSelects.productCategory.onSelect(state.productCategory);
    updateAccentColorOptions();
    handleModelSelectChange({ target: { value: state.model } });
    handleModeChange('custom'); 
    setupEventListeners();
}

// --- START THE APP ---
document.addEventListener('DOMContentLoaded', initializeApp);
