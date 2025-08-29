window.CONFIG = {
    // Using Replit's built-in database - will need to be configured via Supabase or alternative
     SUPABASE_URL: 'http://000.0.2.100:0',
    SUPABASE_ANON_KEY: '000.0.0', // sua chave real aqui
    EMAIL_WEBHOOK_URL: '00-ErS',

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
