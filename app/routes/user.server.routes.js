/**********************
 GLYFF MODULE ROUTING
 **********************/
 module.exports = function(app, express) {

    // Require modules
    var user = require('../controllers/user.server.controller');
    var globals = require('../../configs/globals');
    var upload = require('../../configs/aws').upload;
    var router = express.Router();
    
    // Routing
    router.get('/peopleList', globals.isAuthorised, user.peopleList);
    router.get('/userProfile/:userId', globals.isAuthorised, user.userProfile);
    router.post('/setFollow', globals.isAuthorised, user.setFollow);
    router.post('/editProfile/:userId', globals.isAuthorised, upload.single('file'), user.editProfile);
    router.post('/acceptFollowRequest', globals.isAuthorised, user.acceptFollowRequest);
    router.post('/denyFollowRequest', globals.isAuthorised, user.denyFollowRequest);
    router.get('/searchPeople', globals.isAuthorised, user.searchPeople);
    router.get('/fetchFollowees', globals.isAuthorised, user.fetchFollowees);
    router.get('/fetchFollowers', globals.isAuthorised, user.fetchFollowers);
    router.get('/userList', globals.isAuthorised, user.userList);
    router.get('/deleteUserByAdmin/:id', globals.isAuthorised, user.deleteUserByAdmin);
    router.post('/blockMemeByAdmin', globals.isAuthorised, user.blockMemeByAdmin);
    
    app.use(config.baseApiUrl, router);

};
