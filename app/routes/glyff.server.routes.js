/**********************
 GLYFF MODULE ROUTING
 **********************/
 module.exports = function(app, express) {

    // Require modules
    var glyff = require('../controllers/glyff.server.controller');
    var globals = require('../../configs/globals');
    var upload = require('../../configs/aws').upload;
    var router = express.Router();

    // Routing
    router.post('/saveGlyff', globals.isAuthorised, upload.array('files', 3), glyff.saveGlyff);
    router.get('/fetchUserGlyff/:userId', globals.isAuthorised, glyff.fetchUserGlyff);
    router.get('/searchCaptionBasedGlyphs', globals.isAuthorised, glyff.searchCaptionBasedGlyphs);
    router.post('/editGlyph/:glyphId', globals.isAuthorised, upload.array('files', 3), glyff.editGlyph);
    router.post('/saveGlyffFavourite', globals.isAuthorised, glyff.saveGlyffFavourite);
    router.post('/removeFavouriteGlyff', globals.isAuthorised, glyff.removeFavouriteGlyff);
    router.get('/fetchGlyffDetail/:glyphId', globals.isAuthorised, glyff.fetchGlyffDetail);
    router.post('/shareGlyff', globals.isAuthorised, glyff.shareGlyff);
    router.post('/removeGlyff', globals.isAuthorised, glyff.removeGlyff);
    router.get('/fetchGlyffByUser', globals.isAuthorised, glyff.fetchGlyffByUser);
    router.post('/viewGlyff', globals.isAuthorised, glyff.viewGlif);
    router.post('/getFavouriteCountUser/:userId', globals.isAuthorised, glyff.getFavouriteCountUser);
    router.get('/fetchAllGlif', globals.isAuthorised, glyff.fetchAllGlif);
    router.get('/deleteMemeByAdmin/:id', globals.isAuthorised, glyff.deleteMemeByAdmin);
    //router.post('/addGlyffViewCount', globals.isAuthorised, glyff.addGlyffViewCount);

    app.use(config.baseApiUrl, router);
};
