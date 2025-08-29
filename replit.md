# Overview

This is a Portuguese IT inventory management system built as a single-page web application. The system allows users to track IT equipment inventory, manage product movements between branches, and generate reports. It features a dashboard with key statistics, product management capabilities, and branch-to-branch transfer functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Single Page Application (SPA)**: Built with vanilla JavaScript using a class-based architecture (`EstoqueApp`)
- **UI Framework**: Tailwind CSS for styling with custom CSS overrides
- **Page Navigation**: Client-side routing system with dynamic page switching
- **Component Structure**: Modular approach with separate concerns for different functionalities (dashboard, products, movements, branch transfers)

## Authentication System
- **Simple Authentication**: Basic username/password authentication using Base64 encoded credentials
- **Session Management**: Browser sessionStorage for maintaining login state
- **Access Control**: Redirect-based protection for unauthorized access

## Data Management
- **Real-time Database**: Supabase as the primary backend service
- **Local State Management**: JavaScript objects for caching data (`produtos`, `movimentacoes`, `filiais`)
- **Data Synchronization**: Real-time updates between client and Supabase database

## Database Schema
The system uses four main tables:
- **produtos**: IT equipment inventory items
- **movimentacoes**: Stock movement tracking (in/out operations)
- **envios_filiais**: Inter-branch transfer records
- **filiais**: Branch/location management

## User Interface Features
- **Toast Notifications**: Custom notification system for user feedback
- **Excel Export**: Client-side Excel file generation using SheetJS
- **Responsive Design**: Mobile-friendly interface using Tailwind CSS
- **Icon System**: Font Awesome for consistent iconography

## Development Setup
- **Build Tool**: Vite for development server and build process
- **CSS Processing**: Tailwind CSS with custom input.css for additional styles
- **Local Development**: Configured for both local and network access with custom domain support

# External Dependencies

## Backend Services
- **Supabase**: Primary database and real-time backend service
  - Local development instance running on `192.168.2.100:54321`
  - Handles data persistence and real-time synchronization

## Email Services  
- **EmailJS**: Client-side email functionality for notifications and reports
  - Public key configured for sending emails directly from the browser

## Frontend Libraries
- **Supabase JavaScript Client**: Official client library for Supabase integration
- **SheetJS (XLSX)**: Excel file generation and manipulation
- **Tailwind CSS**: Utility-first CSS framework via CDN
- **Font Awesome**: Icon library for UI elements

## Development Tools
- **Vite**: Development server and build tool
- **Tailwind CLI**: CSS processing and optimization
- **Live Server**: Alternative development server option

## Configuration Management
- Centralized configuration in `config.js` with environment-specific settings
- Separate API keys and service endpoints for easy deployment management