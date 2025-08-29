window.CONFIG = {
    // Using Replit's built-in database - will need to be configured via Supabase or alternative
    SUPABASE_URL: 'https://your-project.supabase.co', // You'll need to set up your own Supabase project
    SUPABASE_ANON_KEY: 'your-anon-key-here', // Your actual Supabase anon key
    EMAIL_WEBHOOK_URL: 'nRABfso2u5UuC-ErS',

    APP_NAME: 'Sistema de Estoque TI',
    VERSION: '1.0.0',
    
    // Database configuration
    DATABASE_URL: 'postgresql://postgres:password@helium/heliumdb?sslmode=disable',
    
    // Table names
    TABLES: {
        PRODUTOS: 'produtos',
        MOVIMENTACOES: 'movimentacoes',
        ENVIOS_FILIAIS: 'envios_filiais',
        FILIAIS: 'filiais'
    }
};
