/**********************
 BLOCK MODULE ROUTING
 **********************/
module.exports = function(app, express) {

    // Require modules
    var block = require('../controllers/block.server.controller');
    var globals = require('../../configs/globals');
    var router = express.Router();

    // Routing
    router.post('/blockUser', globals.isAuthorised, block.blockUser);
    router.get('/fetchBlockUsers/:userId', globals.isAuthorised, block.fetchBlockUsers);
    router.post('/unblockUser', globals.isAuthorised, block.unblockUser);

    app.use(config.baseApiUrl, router);
};
