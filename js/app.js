import { colorOptions, aesthetics, productCatalog, countries } from './constants.js';
import { createCustomSelect } from './customSelect.js';
import { apiService } from './apiService.js';
import { buildPromptContext, buildPrompts, formatThemeNameForFile, copyToClipboard } from './utils.js';
import { parseAIJsonResponse } from './jsonParser.js';

// --- COST ESTIMATION ---
// --- COST ESTIMATION ---
function estimateGenerationCost(model, inputTokens = 20000, outputTokens = 5000) {
    if (!model.pricing) return 'N/A';
    const promptCost = (inputTokens / 1000000) * (Number(model.pricing.prompt) || 0);
    const completionCost = (outputTokens / 1000000) * (Number(model.pricing.completion) || 0);
    const total = promptCost + completionCost;
    return total.toFixed(4); // in USD cents usually, but show as decimal
}

// --- ELAPSED TIME COUNTER ---
let generationStartTime = null;
let generationTimer = null;
let finalElapsedTime = null;
let timerProgressInterval = null;

// --- ADD CAPABILITIES TO MODEL DATA ---
function enhanceModelData(models) {
    return models.map(model => ({
        ...model,
        capabilities: {
            vision: /vision|dall|claude-3|gpt-4.*vision|gemini.*vision/.test(model.id) || model.description?.toLowerCase().includes('vision'),
            tools: /gpt-4|claude-3|o1|gemini.*pro|command/.test(model.id) || model.description?.toLowerCase().includes('tools' || 'function'),
        }
    }));
}

// --- RENDER MODEL CARDS ---
function renderModelCards(models, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    models.forEach(model => {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.dataset.id = model.id;

        const provider = model.id.split('/')[0];
        const contextPercentage = Math.min((model.context_length / 200000) * 100, 100);

        // Clean model name by removing provider prefix if present
        const cleanName = model.name.replace(new RegExp(`^${provider}:\\s*`, 'i'), '');

        const capabilitiesHTML = [];
        if (model.pricing?.prompt === "0" && model.pricing?.completion === "0") capabilitiesHTML.push('<span class="capability-tag bg-gray-500 text-white">free</span>');
        if (model.capabilities.vision) capabilitiesHTML.push('<span class="capability-tag bg-blue-500 text-white">vision</span>');
        if (model.capabilities.tools) capabilitiesHTML.push('<span class="capability-tag bg-green-500 text-white">tools</span>');

        // Normalize pricing to $/M tokens (multiply by 1,000,000 since API returns $/token)
        const inputPrice = (Number(model.pricing?.prompt) || 0) * 1000000;
        const outputPrice = (Number(model.pricing?.completion) || 0) * 1000000;

        card.innerHTML = `
            <div class="model-name">${cleanName}</div>
            <div class="context-bar">
                <div class="context-bar-fill" style="width: ${contextPercentage}%"></div>
            </div>
            <div class="pricing">
                Input: $${inputPrice.toFixed(2)}/M tokens<br>
                Output: $${outputPrice.toFixed(2)}/M tokens
            </div>
            <div class="capabilities">${capabilitiesHTML.join('')}</div>
        `;

        card.addEventListener('click', () => selectModel(model.id));
        container.appendChild(card);
    });

    // Select first model by default
    if (models.length > 0) {
        selectModelVisual(models[0].id);
        state.selectedModelId = models[0].id;
    }
}

function selectModelVisual(modelId) {
    document.querySelectorAll('.model-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === modelId);
    });
}

function selectModel(modelId) {
    state.selectedModelId = modelId;
    selectModelVisual(modelId);
}

// --- GLOBAL VARIABLES ---
let allModels = []; // To store the original, unsorted list of models from the API

// --- STATE MANAGEMENT ---
const getDefaultState = () => ({
    generationMode: 'custom',
    apiKey: '',
    selectedModelId: null,
    gender: "Automatic",
    productCategory: "Automatic",
    productType: "Automatic",
    primaryColor: "Automatic",
    accentColor: "Automatic",
    country: "Automatic",
    designer: "Automatic",
    aesthetic: aesthetics[0],
    creativeMode: 'none',
    keyLimits: null,
});

let state = getDefaultState();
const customSelects = {};

// --- DOM ELEMENTS ---
const DOMElements = {
    generateBtn: document.getElementById('generateBtn'),
    resetBtn: document.getElementById('resetBtn'),
    apiKeyInput: document.getElementById('api_key'),
    verifyKeyBtn: document.getElementById('verifyKeyBtn'),
    apiKeyMessage: document.getElementById('apiKeyMessage'),
    modelControlsWrapper: document.getElementById('model_controls_wrapper'),
    sortModelSelect: document.getElementById('sort_model_select'),
    filterProviderSelect: document.getElementById('filter_provider_select'),
    modelSelectWrapper: document.getElementById('model_select_wrapper'),
    jsonOutput: document.getElementById('json-output'),
    outputContainer: document.getElementById('output'),
    loader: document.getElementById('loader'),
    errorContainer: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    copyBtn: document.getElementById('copyBtn'),
    filenameContainer: document.getElementById('filename_container'),
    filenameOutput: document.getElementById('filename-output'),
    copyFilenameBtn: document.getElementById('copyFilenameBtn'),
    modeCustomRadio: document.getElementById('modeCustom'),
    modeAestheticRadio: document.getElementById('modeAesthetic'),
    creativeModeRadios: document.querySelectorAll('input[name="creativeMode"]'),
    creativeModeDescription: document.getElementById('creativeModeDescription'),
    aestheticSelectWrapper: document.getElementById('aesthetic_select_container_wrapper'),
    horizontalBar: document.querySelector('.horizontal-bar'),
    // Limit display elements
    limitDisplay: document.getElementById('limit_display'),
    limitRemainingValue: document.getElementById('limit_remaining_value'),
    limitTotal: document.getElementById('limit_total'),
    limitUsage: document.getElementById('limit_usage'),
    limitMessage: document.getElementById('limit_message'),
    // Additional limit display elements
    keyLabel: document.getElementById('key_label'),
    isFreeTier: document.getElementById('is_free_tier'),
    usageDaily: document.getElementById('usage_daily'),
    usageWeekly: document.getElementById('usage_weekly'),
    usageMonthly: document.getElementById('usage_monthly'),
    byokUsage: document.getElementById('byok_usage'),
    byokUsageDaily: document.getElementById('byok_usage_daily'),
    byokUsageWeekly: document.getElementById('byok_usage_weekly'),
    byokUsageMonthly: document.getElementById('byok_usage_monthly'),
    isProvisioningKey: document.getElementById('is_provisioning_key'),
    includeByokInLimit: document.getElementById('include_byok_in_limit'),
    limitReset: document.getElementById('limit_reset'),
};

// --- CORE LOGIC & EVENT HANDLERS ---

function setLoadingState(isLoading) {
    console.log('setLoadingState called with:', isLoading);
    console.log('Loader element:', DOMElements.loader);
    console.log('Horizontal bar element:', DOMElements.horizontalBar);

    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.loader.classList.toggle('hidden', !isLoading);
    DOMElements.generateBtn.textContent = isLoading ? 'Generating...' : 'Generate Prompt';

    if (isLoading) {
        generationStartTime = Date.now();
        startExtraordinaryTimer();
    } else {
        stopExtraordinaryTimer();

        // Store final elapsed time for display
        if (finalElapsedTime !== null) {
            document.getElementById('generation_time_value').textContent = `${finalElapsedTime}s`;
            document.getElementById('generation_time').classList.remove('hidden');
        }
        finalElapsedTime = null;
    }
}

function startExtraordinaryTimer() {
    const timerValue = document.getElementById('animated-timer');

    if (!timerValue) return;

    generationTimer = setInterval(() => {
        const elapsed = ((Date.now() - generationStartTime) / 1000).toFixed(1);
        finalElapsedTime = parseFloat(elapsed);

        // Update animated timer value
        timerValue.textContent = elapsed;

        // Street Fighter Power Gauge System
        updatePowerGaugeLayers(elapsed);

    }, 100);
}

function stopExtraordinaryTimer() {
    if (generationTimer) {
        clearInterval(generationTimer);
        generationTimer = null;
    }
    if (timerProgressInterval) {
        clearInterval(timerProgressInterval);
        timerProgressInterval = null;
    }

    // Reset all power gauge layers
    resetPowerGaugeLayers();

    generationStartTime = null;
}

// --- STREET FIGHTER POWER GAUGE SYSTEM ---
function updatePowerGaugeLayers(elapsed) {
    // Define layer timing intervals (in seconds)
    const layerIntervals = [60, 120, 180, 240]; // 4 layers covering up to 240+ seconds

    // Get all power layer elements
    const layer1 = document.querySelector('.power-layer-1');
    const layer2 = document.querySelector('.power-layer-2');
    const layer3 = document.querySelector('.power-layer-3');
    const layer4 = document.querySelector('.power-layer-4');

    if (!layer1) return;

    // Layer 1: 0-60 seconds (Golden Yellow)
    if (elapsed <= layerIntervals[0]) {
        const progress1 = (elapsed / layerIntervals[0]) * 100;
        layer1.style.width = `${Math.min(progress1, 100)}%`;
        layer2.style.width = '0%';
        layer3.style.width = '0%';
        layer4.style.width = '0%';
    }
    // Layer 2: 60-120 seconds (Orange)
    else if (elapsed <= layerIntervals[1]) {
        layer1.style.width = '100%'; // Keep first layer full
        const progress2 = ((elapsed - layerIntervals[0]) / (layerIntervals[1] - layerIntervals[0])) * 100;
        layer2.style.width = `${Math.min(progress2, 100)}%`;
        layer3.style.width = '0%';
        layer4.style.width = '0%';
    }
    // Layer 3: 120-180 seconds (Red)
    else if (elapsed <= layerIntervals[2]) {
        layer1.style.width = '100%';
        layer2.style.width = '100%';
        const progress3 = ((elapsed - layerIntervals[1]) / (layerIntervals[2] - layerIntervals[1])) * 100;
        layer3.style.width = `${Math.min(progress3, 100)}%`;
        layer4.style.width = '0%';
    }
    // Layer 4: 180-240+ seconds (Dark Red)
    else {
        layer1.style.width = '100%';
        layer2.style.width = '100%';
        layer3.style.width = '100%';
        const progress4 = ((elapsed - layerIntervals[2]) / (layerIntervals[3] - layerIntervals[2])) * 100;
        layer4.style.width = `${Math.min(progress4, 100)}%`;
    }
}

function resetPowerGaugeLayers() {
    const layer1 = document.querySelector('.power-layer-1');
    const layer2 = document.querySelector('.power-layer-2');
    const layer3 = document.querySelector('.power-layer-3');
    const layer4 = document.querySelector('.power-layer-4');

    if (layer1) layer1.style.width = '0%';
    if (layer2) layer2.style.width = '0%';
    if (layer3) layer3.style.width = '0%';
    if (layer4) layer4.style.width = '0%';
}

function updateDisplayedModels() {
    const sortBy = DOMElements.sortModelSelect.value;
    const filterBy = DOMElements.filterProviderSelect.value;
    const searchTerm = document.getElementById('search_models').value.toLowerCase();
    const filterFree = document.getElementById('filter_free').checked;
    const filterVision = document.getElementById('filter_vision').checked;
    const filterTools = document.getElementById('filter_tools').checked;

    let processedModels = [...allModels];

    // Text search
    if (searchTerm) {
        processedModels = processedModels.filter(model =>
            model.name.toLowerCase().includes(searchTerm) ||
            model.id.toLowerCase().includes(searchTerm)
        );
    }

    // Provider filter
    if (filterBy !== 'all') {
        processedModels = processedModels.filter(model => model.id.startsWith(filterBy + '/'));
    }

    // Capability filters
    if (filterFree) {
        processedModels = processedModels.filter(model => model.pricing?.prompt === "0" && model.pricing?.completion === "0");
    }
    if (filterVision) {
        processedModels = processedModels.filter(model => model.capabilities.vision);
    }
    if (filterTools) {
        processedModels = processedModels.filter(model => model.capabilities.tools);
    }

    // Sorting
    processedModels.sort((a, b) => {
        switch (sortBy) {
            case 'price_asc':
                return (Number(a.pricing?.prompt) || Infinity) - (Number(b.pricing?.prompt) || Infinity);
            case 'price_desc':
                return (Number(b.pricing?.prompt) || 0) - (Number(a.pricing?.prompt) || 0);
            case 'context_desc':
                return (b.context_length || 0) - (a.context_length || 0);
            case 'date_desc':
                return (b.created || 0) - (a.created || 0);
            case 'mockup_optimized':
                // Calculate mockup suitability score
                const scoreA = calculateMockupScore(a);
                const scoreB = calculateMockupScore(b);
                return scoreB - scoreA; // Higher score first
            case 'recommended':
            default:
                return (b.context_length || 0) - (a.context_length || 0);
        }
    });

    renderModelCards(processedModels, 'model_cards_container');
}

function populateProviderFilter() {
    const providers = new Set(allModels.map(model => model.id.split('/')[0]));
    DOMElements.filterProviderSelect.innerHTML = '<option value="all">All Providers</option>';
    
    [...providers].sort().forEach(provider => {
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
        DOMElements.filterProviderSelect.appendChild(option);
    });
}

async function handleVerifyKey() {
    hideError();
    const apiKey = state.apiKey.trim();
    if (!apiKey) {
        showError("Please enter an API key first.");
        return;
    }

    DOMElements.verifyKeyBtn.disabled = true;
    DOMElements.verifyKeyBtn.textContent = 'Verifying...';
    DOMElements.apiKeyMessage.textContent = 'Attempting to verify your key...';
    DOMElements.modelControlsWrapper.classList.add('hidden');
    DOMElements.modelSelectWrapper.classList.add('hidden');

    // Show loading state for limits
    showLimitLoading();

    try {
        // Fetch both models and limits in parallel
        const [models, limits] = await Promise.all([
            apiService.verifyAndFetchModels(apiKey),
            apiService.fetchKeyLimits(apiKey).catch(error => {
                // If limits fetch fails, continue without limits data
                console.warn("Could not fetch key limits:", error);
                return null;
            })
        ]);

        allModels = enhanceModelData(models);
        state.keyLimits = limits;

        DOMElements.apiKeyMessage.textContent = '✅ Key verified successfully. Models loaded.';

        populateProviderFilter();
        updateDisplayedModels();
        updateLimitDisplay(limits);

        DOMElements.modelControlsWrapper.classList.remove('hidden');
        DOMElements.modelSelectWrapper.classList.remove('hidden');
    } catch (error) {
        allModels = [];
        state.keyLimits = null;
        state.selectedModelId = null;

        console.error("API Key Verification Error:", error);
        let userMessage = "Could not connect to OpenRouter. Please check your network.";
        if (error.status === 401) {
            userMessage = "Authentication failed. The API key you provided is invalid.";
        }
        DOMElements.apiKeyMessage.textContent = 'Verification failed. Please check your key.';
        showError(userMessage);
        showLimitError();
    } finally {
        DOMElements.verifyKeyBtn.disabled = false;
        DOMElements.verifyKeyBtn.textContent = 'Verify';
    }
}

function populateModelSelect(models) {
    // Legacy function, replaced by renderModelCards
}

async function handleGenerateClick() {
    console.log('Generate button clicked');
    console.log('API Key:', state.apiKey.trim() ? 'Present' : 'Missing');
    console.log('Selected Model:', state.selectedModelId);

    if (!state.apiKey.trim()) { showError("Please enter and verify your API key."); return; }
    if (!state.selectedModelId) { showError("Please verify your key and select a model."); return; }

    console.log('Starting generation process...');
    setLoadingState(true);
    hideError();
    try {
        const promptContext = buildPromptContext(state, productCatalog, colorOptions, countries);
        const { systemPrompt, userPrompt } = buildPrompts(promptContext, colorOptions);
        console.log('Calling API service...');
        const generatedJsonText = await apiService.generate(systemPrompt, userPrompt, state.apiKey, state.selectedModelId);
        console.log('API call completed');
        updateUIWithResult(generatedJsonText);
    } catch (error) {
        console.error("Error generating prompt:", error);
        let userMessage = error.message || "An unknown error occurred.";
        if (error.status === 401) { userMessage = "Authentication failed. The API key you provided is likely invalid or incorrect."; }
        else if (error.status === 403) { userMessage = "Permission Denied. Your API key may not have the necessary permissions."; }
        showError(userMessage);
    } finally {
        console.log('Setting loading state to false');
        setLoadingState(false);
    }
}

function resetForm() {
    const currentApiKey = state.apiKey;
    state = getDefaultState();
    state.apiKey = currentApiKey;

    DOMElements.modeCustomRadio.checked = true;
    DOMElements.creativeModeRadios[0].checked = true;
    handleCreativeModeChange('none');

    for (const key in customSelects) {
        if (key !== 'model' && customSelects[key].defaultConfig) {
            customSelects[key].updateButton(customSelects[key].defaultConfig);
        }
    }

    customSelects.productCategory.onSelect(state.productCategory);
    updateAccentColorOptions();
    handleModeChange('custom');

    allModels = [];
    DOMElements.modelControlsWrapper.classList.add('hidden');
    DOMElements.modelSelectWrapper.classList.add('hidden');
    DOMElements.sortModelSelect.value = 'recommended';
    DOMElements.filterProviderSelect.innerHTML = '<option value="all">All Providers</option>';
    state.selectedModelId = null;
    state.keyLimits = null;
    if (customSelects.model) {
        document.getElementById('model_select_container').innerHTML = '';
        delete customSelects.model;
    }

    // Reset limit display
    resetLimitDisplay();

    hideError();
    DOMElements.outputContainer.classList.add('hidden');
    DOMElements.jsonOutput.textContent = '';
    DOMElements.filenameContainer.classList.add('hidden');
    DOMElements.filenameOutput.textContent = '';
    document.getElementById('generation_time').classList.add('hidden');
}

function setupEventListeners() {
    DOMElements.modeCustomRadio.addEventListener('change', () => handleModeChange('custom'));
    DOMElements.modeAestheticRadio.addEventListener('change', () => handleModeChange('theme'));
    DOMElements.creativeModeRadios.forEach(radio => { radio.addEventListener('change', (e) => handleCreativeModeChange(e.target.value)); });

    DOMElements.verifyKeyBtn.addEventListener('click', handleVerifyKey);

    DOMElements.sortModelSelect.addEventListener('change', updateDisplayedModels);
    DOMElements.filterProviderSelect.addEventListener('change', updateDisplayedModels);
    document.getElementById('search_models').addEventListener('input', updateDisplayedModels);
    document.getElementById('filter_free').addEventListener('change', updateDisplayedModels);
    document.getElementById('filter_vision').addEventListener('change', updateDisplayedModels);
    document.getElementById('filter_tools').addEventListener('change', updateDisplayedModels);

    DOMElements.apiKeyInput.addEventListener('input', (e) => {
        state.apiKey = e.target.value;
        sessionStorage.setItem('signifo_api_key', state.apiKey);
        DOMElements.modelControlsWrapper.classList.add('hidden');
        DOMElements.modelSelectWrapper.classList.add('hidden');
        state.selectedModelId = null;
        allModels = [];
    });

    DOMElements.generateBtn.addEventListener('click', (e) => {
        console.log('Generate button clicked - event listener triggered');
        handleGenerateClick();
    });
    DOMElements.resetBtn.addEventListener('click', resetForm);
    DOMElements.copyBtn.addEventListener('click', () => copyToClipboard(DOMElements.jsonOutput.textContent, DOMElements.copyBtn, 'Copy'));
    DOMElements.copyFilenameBtn.addEventListener('click', () => copyToClipboard(DOMElements.filenameOutput.textContent, DOMElements.copyFilenameBtn, 'Copy'));
    document.addEventListener('click', () => {
        Object.values(customSelects).forEach(select => select.closeOptions());
    });
}

function calculateMockupScore(model) {
    let score = 0;

    // Context length (up to 50 points, scaled to 200k max)
    const contextScore = (model.context_length / 200000) * 50;
    score += Math.min(contextScore, 50);

    // Vision capability (30 points)
    if (model.capabilities.vision) score += 30;

    // Tools/functions capability (20 points)
    if (model.capabilities.tools) score += 20;

    // Price factor (penalty for expensive models)
    const inputPrice = Number(model.pricing?.prompt) || 0;
    const pricePenalty = Math.min(inputPrice * 1000, 50); // Up to 50 point penalty
    score = Math.max(0, score - pricePenalty);

    return Math.round(score * 100) / 100; // Round to 2 decimals
}

function initializeApp() {
    const hexRegex = /#([0-9a-fA-F]{6})/;
    customSelects.aesthetic = createCustomSelect('aesthetic_select_container', aesthetics, { inputId: 'aesthetic_value', default: aesthetics[0], render: (option) => `<span>${option}</span>`, onSelect: (option) => state.aesthetic = option });
    customSelects.primaryColor = createCustomSelect('primary_color_select', ["Automatic", ...colorOptions], { inputId: 'primary_color_value', default: "Automatic", render: (option) => { if (option === "Automatic") return `<span>✨ Automatic</span>`; const hexMatch = option.match(hexRegex); const hex = hexMatch ? hexMatch[0] : '#ffffff'; return `<div class="color-swatch" style="background-color: ${hex}"></div> ${option}`; }, onSelect: (option) => { state.primaryColor = option; updateAccentColorOptions(); } });
    customSelects.accentColor = createCustomSelect('accent_color_select', ["Automatic", "No Accent Color", ...colorOptions], { inputId: 'accent_color_value', default: "Automatic", render: (option) => { if (option === "Automatic") return `<span>✨ Automatic</span>`; if (option === "No Accent Color") return `<span>⛔ No Accent Color</span>`; const hexMatch = option.match(hexRegex); const hex = hexMatch ? hexMatch[0] : '#ffffff'; return `<div class="color-swatch" style="background-color: ${hex}"></div> ${option}`; }, onSelect: (option) => state.accentColor = option });
    customSelects.gender = createCustomSelect('gender_select_container', ["Automatic", "Unisex", "Women", "Men"], { inputId: 'gender_value', default: "Automatic", render: (option) => (option === "Automatic") ? `<span>✨ Automatic</span>` : `<span>${option}</span>`, onSelect: (gender) => state.gender = gender });
    customSelects.productType = createCustomSelect('product_type_select_container', [{value: 'Automatic', label: '✨ Automatic'}], { inputId: 'product_type_value', default: { value: 'Automatic', label: '✨ Automatic' }, render: (option) => `<span>${option.label}</span>`, onSelect: (option) => state.productType = option.value });
    customSelects.productCategory = createCustomSelect('product_category_select_container', ["Automatic", ...Object.keys(productCatalog)], { inputId: 'product_category_value', default: "Automatic", render: (option) => (option === "Automatic") ? `<span>✨ Automatic</span>` : `<span>${option}</span>`, onSelect: (category) => { state.productCategory = category; const isAutomatic = category === 'Automatic'; const types = isAutomatic ? ["Automatic", ...new Set(Object.values(productCatalog).flat())] : ["Automatic", ...productCatalog[category]]; customSelects.productType.populateOptions(types.map(p => ({ value: p, label: p === 'Automatic' ? '✨ Automatic' : p }))); customSelects.productType.button.disabled = false; customSelects.productType.updateButton({ value: 'Automatic', label: '✨ Automatic' }); state.productType = "Automatic"; } });
    customSelects.designer = createCustomSelect('designer_select_container', ["Automatic", "None"], { inputId: 'designer_value', default: "Automatic", render: (option) => { const value = (typeof option === 'object' && option !== null) ? option.value : option; const label = (typeof option === 'object' && option !== null) ? option.label : option; if (value === "Automatic") return `<span>✨ Automatic</span>`; if (value === "None") return `<span>⛔ None</span>`; return `<span>${label}</span>`; }, onSelect: (option) => { state.designer = (typeof option === 'object' && option !== null) ? option.value : option; } });
    const sortedCountries = Object.keys(countries).sort();
    customSelects.country = createCustomSelect('country_select_container', ["Automatic", "None", ...sortedCountries], { inputId: 'country_value', default: "Automatic", render: (option) => { if (option === "Automatic") return `<span>✨ Automatic</span>`; if (option === "None") return `<span>⛔ None</span>`; return `<span class="fi fi-${countries[option].code} mr-3"></span> ${option}`; }, onSelect: (country) => { state.country = country; const designerButton = customSelects.designer.button; let designerOptions = []; if (country === "None") { designerOptions = []; customSelects.designer.updateButton({ value: 'None', label: 'Select a country first' }); designerButton.disabled = true; state.designer = "None"; } else if (country === "Automatic") { designerOptions = ["Automatic", "None"].map(d => ({ value: d, label: d })); designerButton.disabled = false; } else { designerOptions = ["Automatic", "None", ...countries[country].designers].map(d => ({ value: d, label: d })); designerButton.disabled = false; } customSelects.designer.onSelect('Automatic'); customSelects.designer.updateButton({ value: 'Automatic', label: '✨ Automatic' }); customSelects.designer.populateOptions(designerOptions); } });

    const savedApiKey = sessionStorage.getItem('signifo_api_key');
    if (savedApiKey) { DOMElements.apiKeyInput.value = savedApiKey; state.apiKey = savedApiKey; }
    customSelects.productCategory.onSelect(state.productCategory);
    updateAccentColorOptions();
    handleModeChange('custom');
    setupEventListeners();
}

function handleModeChange(newMode) { state.generationMode = newMode; const isAesthetic = newMode === 'theme'; DOMElements.aestheticSelectWrapper.classList.toggle('hidden', !isAesthetic); const controlsToToggle = [customSelects.primaryColor, customSelects.accentColor, customSelects.country, customSelects.designer]; if (isAesthetic) { controlsToToggle.forEach(control => { if (control && control.button) control.button.disabled = true; }); state.primaryColor = "Automatic"; state.accentColor = "Automatic"; state.country = "Automatic"; state.designer = "Automatic"; } else { controlsToToggle.forEach(control => { if (control && control.button) control.button.disabled = false; }); customSelects.primaryColor.updateButton(state.primaryColor); customSelects.accentColor.updateButton(state.accentColor); customSelects.country.updateButton(state.country); customSelects.designer.updateButton(state.designer); customSelects.country.onSelect(state.country); updateAccentColorOptions(); } }
function updateAccentColorOptions() { const primaryColorValue = state.primaryColor; let availableAccentColors = ["Automatic", "No Accent Color", ...colorOptions]; if (primaryColorValue !== "Automatic") { availableAccentColors = availableAccentColors.filter(color => color !== primaryColorValue); } customSelects.accentColor.populateOptions(availableAccentColors); if (state.accentColor === primaryColorValue) { state.accentColor = "Automatic"; customSelects.accentColor.updateButton("Automatic"); } }
function updateUIWithResult(jsonText) {
    // Use the new robust JSON parser from jsonParser.js
    const parsedJson = parseAIJsonResponse(jsonText);

    DOMElements.jsonOutput.textContent = JSON.stringify(parsedJson, null, 2);
    DOMElements.outputContainer.classList.remove('hidden');

    const nameToFormat = parsedJson.metadata?.theme_name_romanized || parsedJson.metadata?.theme_name;
    if (nameToFormat) {
        const formattedName = formatThemeNameForFile(nameToFormat);
        DOMElements.filenameOutput.textContent = formattedName;
        DOMElements.filenameContainer.classList.remove('hidden');
    }
}

// Robust JSON parser that handles common AI model formatting issues
function parseRepairedJson(jsonText) {
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
function removeUnexpectedProperties(jsonText) {
    // Remove properties that commonly cause issues (like "prefix" in hardware objects)
    jsonText = jsonText.replace(/"prefix"\s*:\s*"[^"]*",?\s*/g, '');

    // Remove other common problematic properties that AI might add
    jsonText = jsonText.replace(/"suffix"\s*:\s*"[^"]*",?\s*/g, '');

    return jsonText;
}

// Fix common structural issues in JSON
function fixStructuralIssues(jsonText) {
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
function parseWithAlternativeMethod(jsonText) {
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
function cleanupJsonSection(section) {
    let cleaned = section;

    // Remove any trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Fix any remaining quote issues
    cleaned = cleaned.replace(/'([^']+)'(\s*:)/g, '"$1"$2');

    return cleaned;
}
function showError(message) { DOMElements.errorMessage.textContent = message; DOMElements.errorContainer.classList.remove('hidden'); }
function hideError() { DOMElements.errorContainer.classList.add('hidden'); }
function handleCreativeModeChange(mode) { state.creativeMode = mode; const descriptions = { 'none': 'Standard creative generation', 'fiction': 'Fantasy, sci-fi, and fictional world-inspired designs', 'historical': 'Historical periods and ancient civilizations-inspired designs' }; DOMElements.creativeModeDescription.textContent = descriptions[mode]; }

// --- LIMIT DISPLAY FUNCTIONS ---
function showLimitLoading() {
    DOMElements.limitRemainingValue.textContent = '...';
    DOMElements.limitTotal.textContent = '...';
    DOMElements.limitUsage.textContent = '...';
    DOMElements.limitMessage.textContent = 'Loading limits...';
}

function updateLimitDisplay(limits) {
    if (!limits) {
        resetLimitDisplay();
        return;
    }

    // Main limit display (prominent)
    const limitRemaining = limits.limit_remaining || 0;
    DOMElements.limitRemainingValue.textContent = `$${limitRemaining.toFixed(2)}`;

    // Key Information Section
    DOMElements.keyLabel.textContent = limits.label || 'N/A';
    DOMElements.limitTotal.textContent = `$${limits.limit?.toFixed(2) || '0.00'}`;
    DOMElements.limitUsage.textContent = `$${limits.usage?.toFixed(2) || '0.00'}`;
    DOMElements.isFreeTier.textContent = limits.is_free_tier ? 'Yes' : 'No';

    // Usage Breakdown
    DOMElements.usageDaily.textContent = `$${limits.usage_daily?.toFixed(2) || '0.00'}`;
    DOMElements.usageWeekly.textContent = `$${limits.usage_weekly?.toFixed(2) || '0.00'}`;
    DOMElements.usageMonthly.textContent = `$${limits.usage_monthly?.toFixed(2) || '0.00'}`;

    // BYOK Usage
    DOMElements.byokUsage.textContent = `$${limits.byok_usage?.toFixed(2) || '0.00'}`;
    DOMElements.byokUsageDaily.textContent = `$${limits.byok_usage_daily?.toFixed(2) || '0.00'}`;
    DOMElements.byokUsageWeekly.textContent = `$${limits.byok_usage_weekly?.toFixed(2) || '0.00'}`;
    DOMElements.byokUsageMonthly.textContent = `$${limits.byok_usage_monthly?.toFixed(2) || '0.00'}`;

    // Account Status
    DOMElements.isProvisioningKey.textContent = limits.is_provisioning_key ? 'Yes' : 'No';
    DOMElements.includeByokInLimit.textContent = limits.include_byok_in_limit ? 'Yes' : 'No';
    DOMElements.limitReset.textContent = limits.limit_reset || 'None';

    // Update status message
    if (limits.is_free_tier) {
        DOMElements.limitMessage.textContent = 'Free tier account - All data loaded';
    } else {
        DOMElements.limitMessage.textContent = 'Verified account - All data loaded';
    }
}

function showLimitError() {
    DOMElements.limitRemainingValue.textContent = 'Error';
    DOMElements.limitTotal.textContent = 'Error';
    DOMElements.limitUsage.textContent = 'Error';
    DOMElements.limitMessage.textContent = 'Could not fetch limit information';
}

function resetLimitDisplay() {
    DOMElements.limitRemainingValue.textContent = '-';
    DOMElements.limitTotal.textContent = '-';
    DOMElements.limitUsage.textContent = '-';
    DOMElements.limitMessage.textContent = 'Verify your API key to see limits';
}

document.addEventListener('DOMContentLoaded', initializeApp);
