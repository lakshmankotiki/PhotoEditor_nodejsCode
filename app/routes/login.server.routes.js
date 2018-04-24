/**********************
 GLYFF MODULE ROUTING
 **********************/
 module.exports = function(app, express) {

    // Require modules
    var login = require('../controllers/login.server.controller');
    var globals = require('../../configs/globals');
    var upload = require('../../configs/aws').upload;
    var router = express.Router();

    // Routing
    router.post('/signup', upload.single('file'), login.signup);
    router.post('/signin', login.signin);
    router.post('/signupfb', login.signupfb);
    router.get('/signout', globals.isAuthorised, login.signout);
    router.post('/changePassword', login.changePassword);
    router.post('/forgotPassword', login.forgotPassword);
    router.post('/resetPassword', login.resetPassword);
    router.get('/checkEmail', login.checkEmail);
    router.get('/checkUsername', login.checkUsername);
    router.post('/checkVerificationToken', login.checkVerificationToken);

    app.use(config.baseApiUrl, router);
};
