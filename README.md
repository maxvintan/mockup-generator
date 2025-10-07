# Mockup Generator

A sophisticated web-based mockup prompt generator for fashion and accessory design. Create AI-powered design prompts with customizable colors, aesthetics, countries, designers, and creative modes. Features advanced AI model selection through OpenRouter API with intelligent filtering and cost estimation.

(https://assets.zyrosite.com/mePvQZQyOMTq15Xq/mockup-generator-github-AzGM409PkBUJX9XX.jpg)

![Version](https://img.shields.io/badge/version-3.0-blue.svg)
![Last Updated](https://img.shields.io/badge/last_updated-October_7,_2025-green.svg)

## Overview

The Mockup Generator is a powerful web application that helps designers and creators generate structured JSON prompts for fashion and accessory mockups. Built with modern web technologies, it provides an intuitive interface for customizing design parameters and generating AI-ready prompts.

## Features

### 🎨 Generation Modes
- **Custom Build**: Fine-tune every aspect of your design with granular control
- **Aesthetic-Based**: Choose from predefined aesthetics for quick theme generation

### 🎭 Creative Modes
- **Standard**: Regular creative generation
- **Fiction Mode**: Fantasy, sci-fi, and fictional world-inspired designs
- **Historical Mode**: Historical periods and ancient civilizations-inspired designs

### 🎯 Design Customization
- **Color Selection**: 48+ carefully curated colors with hex codes
- **Primary & Accent Colors**: Automatic color coordination and conflict prevention
- **Country References**: 22 countries with flag icons and designer associations
- **Designer Inspiration**: Access to 150+ international fashion designers across 22 countries
- **Gender Options**: Automatic, Unisex, Women, Men
- **Product Categories**: Bags (20 types), Footwear (18 types), Wallets & Small Goods (17 types)
- **Product Types**: 55+ specific product variations across all categories

### 🤖 AI Model Support
- **OpenRouter**: Advanced AI model routing with 100+ available models
- **Smart Model Selection**: Filter by capabilities, pricing, and performance
- **Vision Model Support**: Automatic detection of vision-capable models
- **Cost Estimation**: Real-time pricing calculation for all models

### 🎪 Aesthetics Library
- Art Deco, Avant-Garde, Biomorphic, Bohemian (Boho)
- Cyberpunk, Futuristic, Gothic, Industrial
- Maximalist, Minimalist, Nautical, Preppy
- Rustic / Artisanal, Steampunk, Streetwear, Whimsical

## Installation & Usage

### Quick Start
1. Clone this repository
2. Open `index.html` in your web browser
3. No additional setup required - it's a pure client-side application

### API Configuration
1. Enter your OpenRouter API key in the provided field
2. Verify your key to load available models (100+ options)
3. Select from models with vision, tools, and various pricing tiers
4. Your API key is stored securely in session storage

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS with custom themes
- **Icons**: Flag Icons for country representations
- **Fonts**: Google Fonts (Calistoga, Inter)
- **Architecture**: Modular ES6 modules with clean separation of concerns

## Project Structure

```
mockup-generator/
├── index.html              # Main application entry point
├── css/
│   └── styles.css          # Custom styles and animations
├── js/
│   ├── app.js              # Main application logic and state management
│   ├── constants.js        # Data constants (colors, aesthetics, products, countries)
│   ├── customSelect.js     # Custom dropdown component
│   ├── apiService.js       # API communication layer
│   └── utils.js            # Utility functions and helpers
└── README.md               # Project documentation
```

## Key Components

### State Management
- Centralized state management for all user selections
- Persistent API key storage in session storage
- Real-time UI updates based on state changes

### Custom Select Components
- Beautiful, accessible dropdown menus
- Color swatches for visual color selection
- Country flags for international references
- Dynamic option filtering and validation

### API Service
- Robust error handling and user feedback
- Support for multiple AI model providers
- JSON validation and cleaning

### Advanced Model Selection
- **Intelligent Filtering**: Search by model name, provider, or capabilities
- **Capability Detection**: Automatic identification of vision and tools support
- **Performance-Based Sorting**: Mockup-optimized, context length, and pricing-based sorting
- **Real-Time Cost Preview**: Live calculation of generation costs across different models
- **Provider Management**: Support for 20+ AI model providers through OpenRouter

## Usage Examples

### Custom Build Mode
1. Select "Custom Build" generation mode
2. Choose primary and accent colors
3. Select country reference and designer
4. Configure gender, product category, and type
5. Generate your prompt

### Aesthetic-Based Mode
1. Select "Aesthetic-Based" generation mode
2. Choose from 16 predefined aesthetics
3. Configure basic parameters
4. Generate themed prompts instantly

## Output Format

The generator produces structured JSON output including:
- Theme names (original and romanized)
- Color schemes and palettes
- Design inspirations and references
- Product specifications
- File-safe naming suggestions

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

This project is part of the SIGNIFO Canvas ecosystem. For contributions or modifications, please contact the maintainers.

## License

&copy; 2025 SIGNIFO Canvas Indonesia. All Rights Reserved.

## Version History

- **v3.0** (October 7, 2025): Complete OpenRouter integration with advanced model selection, cost estimation, vision model support, enhanced filtering capabilities, and expanded product catalog (55+ variations across 22 countries)
- **v2.0** (October 4, 2025): Major update with enhanced UI, new creative modes, and improved AI integration
- **v1.0**: Initial release with basic prompt generation capabilities

---

**Built with ❤️ by SIGNIFO Canvas Indonesia**
