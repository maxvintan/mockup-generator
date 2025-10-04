// --- CUSTOM SELECT COMPONENT FACTORY ---
export function createCustomSelect(containerId, options, config) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const template = document.getElementById('custom-select-template').content.cloneNode(true);
    container.appendChild(template);
    
    const button = container.querySelector('button');
    const buttonContent = button.querySelector('span');
    const optionsContainer = container.querySelector('.custom-select-options');
    const hiddenInput = container.querySelector('input');
    hiddenInput.id = config.inputId;
    hiddenInput.name = config.inputId;
    
    function updateButton(option) {
        const value = (typeof option === 'object' && option !== null) ? option.value : option;
        buttonContent.innerHTML = config.render(option);
        hiddenInput.value = value;
    }

    function toggleOptions() {
        if (button.disabled) return;
        const isHidden = optionsContainer.classList.toggle('hidden');
        optionsContainer.classList.toggle('opacity-0', isHidden);
        optionsContainer.classList.toggle('transform', isHidden);
        optionsContainer.classList.toggle('-translate-y-2', isHidden);
        button.setAttribute('aria-expanded', !isHidden);
    }

    function closeOptions() {
        optionsContainer.classList.add('hidden', 'opacity-0', 'transform', '-translate-y-2');
        button.setAttribute('aria-expanded', 'false');
    }

    function populateOptions(currentOptions) {
        optionsContainer.innerHTML = '';
        currentOptions.forEach(option => {
            const optionEl = document.createElement('div');
            optionEl.className = 'custom-select-option';
            optionEl.setAttribute('role', 'option');
            optionEl.innerHTML = config.render(option);
    
            optionEl.dataset.value = (typeof option === 'object' && option !== null) ? option.value : option;
            
            optionEl.addEventListener('click', () => {
                updateButton(option);
                closeOptions();
                if (config.onSelect) config.onSelect(option);
            });
            optionsContainer.appendChild(optionEl);
        });
    }

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-options').forEach(el => {
            if (el !== optionsContainer) el.classList.add('hidden', 'opacity-0', 'transform', '-translate-y-2');
        });
        toggleOptions();
    });
    
    populateOptions(options);
    updateButton(config.default);

    const instance = { populateOptions, updateButton, closeOptions, button, defaultConfig: config.default, inputId: config.inputId };
    if (config.onSelect) {
        instance.onSelect = config.onSelect;
    }
    
    return instance;
}
