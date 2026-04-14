const express = require('express');
const cors = require('cors');

module.exports = {
    initApp: () => {
        const app = express();
        // Configuraciones base necesarias para el arranque
        app.disable('x-powered-by');
        return app;
    },
    getCors: () => cors({
        origin: '*',
        credentials: true
    }),
    getStaticOptions: () => ({
        dotfiles: 'ignore',
        index: false
    })
};
