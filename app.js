require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
var GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Shh, its a secret!",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());

app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/skrrtdb", { useUnifiedTopology: true, useNewUrlParser: true });
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    username: String, 
    password: String, 
    email: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const userInfo = mongoose.model("userInfo", userSchema);

passport.use(userInfo.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    userInfo.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/dashboard",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    userInfo.findOrCreate({  googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/dashboard', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/dashboard');
  });

app.get('/register', function(req, res){
    res.render("register");
});

app.post('/reg', function(req, res){
    userInfo.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/login");
            });
        }
    });
});

app.get("/dashboard", function(req, res){
    if(req.isAuthenticated()){
        res.render("dashboard")
    }
    else{
        res.redirect("/login");
    }
});

app.get('/login', function(req, res){
    if(req.isAuthenticated()){
        res.render("dashboard");
    }
    else{
        res.render("login"); 
    }
});

app.post('/authenticate', function(req, res){
    
    const user = new userInfo({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local", {successFlash: "VERIFIED", failureFlash: "SOMETHING WENT WRONG"})(req, res, function(){
                res.redirect("/dashboard");
            });
        }
    });
});

app.post("/logout", function(req, res){
    req.logout();
    res.redirect("/login");
});

app.post("/getweatha", function(req, res){
    let api = `http://api.openweathermap.org/data/2.5/weather?q=${req.body.cityname}&appid=${process.env.WEATHA_API_KEY}`;
    fetch(api)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            res.render("result",{country: data.sys.country, city: data.name, temp: data.main.temp, humidity: data.main.humidity});
        })
        .catch(err => {
            console.log(err);
        })
})
 