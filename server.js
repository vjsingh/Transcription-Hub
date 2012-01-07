/**
 * Module dependencies.
 */

var express = require('express'),
  app = module.exports = express.createServer(),
  mongoose = require('mongoose'),
  mongoStore = require('connect-mongodb'),
  models = require('./models'),
  stylus = require('stylus'),
  siteConf = require('./lib/getConfig'),
  fs = require('fs'),
  db,
  Transcription, User, LoginToken, Bounty;
  //routes = require('./routes')

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', {pretty: true});
  app.set('db-uri', 'mongodb://transcriptionhub:spam1601@staff.mongohq.com:10093/jazz');
  app.use(express.bodyParser());

  app.use(express.cookieParser());
  app.use(express.session({
    store: mongoStore(app.set('db-uri')),
    secret: siteConf.sessionSecret
  }));
  app.use(express.methodOverride());
  app.use(stylus.middleware({
    src: __dirname + '/public',
    compress: true
  }));
  app.use(loadUser);
  app.use(checkUser);
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));

  app.dynamicHelpers({
    user: function(req, res) {
      return req.currentUser || new User();
    }
  });

});


app.configure('development', function(){
  //app.use(express.logger({format: ':method :uri' }));
  app.use(express.logger());
  app.use(express.errorHandler({
    dumpExceptions: true, showStack: true }));
  //app.set('db-uri', 'mongodb://localhost/jazz-dev');
});

app.configure('production', function(){
  app.use(express.logger());
  app.use(express.errorHandler());
  //app.set('db-uri', 'mongodb://localhost/jazz-prod');
});

app.configure('test', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  //app.set('db-uri', 'mongodb://localhost/jazz-test');
});

models.defineModels(mongoose, function() {
    app.Transcription = Transcription = mongoose.model('Transcription');
    app.User = User = mongoose.model('User');
    app.LoginToken = LoginToken = mongoose.model('LoginToken');
    app.Bounty = Bounty = mongoose.model('Bounty');
    db = mongoose.connect(app.set('db-uri'));
});

function authenticateFromLoginToken(req, res, next) {
  var cookie = JSON.parse(req.cookies.logintoken);

  LoginToken.findOne({ username: cookie.username,
                       series: cookie.series,
                       token: cookie.token }, (function(err, token) {
    if (!token) {
      next();
      return;
    }

    User.findOne({ username: token.username }, function(err, user) {
      if (user) {
        req.session.user_id = user.id;
        req.currentUser = user;

        token.token = token.randomToken();
        token.save(function() {
          res.cookie('logintoken', token.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
          next();
        });
      } else {
        next();
      }
    });
  }));
}

function member(req, res, next) {
  if (!req.currentUser) {
      res.redirect('/login');
  } else {
    next();
  }
}
function loadUser(req, res, next) {
  function foundUser(err, user) {
    if (user) {
      req.currentUser = user;
      next();
    }
  }
  if (req.session.user_id) {
    User.findById(req.session.user_id, foundUser);
  } else if (req.cookies.logintoken) {
    authenticateFromLoginToken(req, res, next);
  } else {
    next();
  }
}
function checkUser(req, res, next) {
  //console.log(req.currentUser);
  next();
}

// Routes

app.get('/', function(req, res) {
  Transcription.find(function(err, transcriptions) {
    transcriptions = transcriptions.map(function(t) {
        var tData = t._doc;
      return {title: tData.title, id: tData._id};
    });
    //console.log(transcriptions);
    //console.log(req.currentUser);
    res.render('index', {
      locals: {
        title: 'A Title',
        transcriptions: transcriptions
      }
    });
  });
});

app.get('/upload', member, function(req, res) {
  res.render('upload', {
  });
});
app.get('/about', function(req, res) {
  res.render('about');
});

// Bounty
app.get('/bounty', member, function(req, res) {
  console.log("AA");
  Bounty.find(function(err, bounties) {
    console.log("AA", bounties);
    //res.render('bounty', { locals: {
    res.render('transcriptions', { locals: {
        searchItems: bounties,
        search: {},
        type: 'bounty'
      }
    });
  });
});
app.get('/bounty/:id', member, function(req, res) {
  console.log("bounty id", req.params.id);
  Bounty.find(function(err, bounties) {
    console.log("AA", bounties);
    //res.render('bounty', { locals: {
    res.render('transcriptions', { locals: {
        searchItems: bounties,
        search: {},
        type: 'bounty'
      }
    });
  });
});
app.get('/newBounty', member, function(req, res) {
  res.render('newBounty');
});
app.post('/newBounty', member, function(req, res) {
  var bounty = new Bounty(req.body.bounty);
  bounty.save(function(err) {
    console.log("bounty err", err);
    res.redirect('/bounty');
  });
});

// Users
app.get('/profile', function(req, res) {
  res.render('profile');
});

app.get('/register', function(req, res) {
  res.render('register', {
    locals: { user: new User() }
  });
});

app.post('/register', function(req, res) {
  var user = new User(req.body.user);
  console.log(user);
  console.log(User);

  function userSaveFailed() {
    req.flash('error', 'Account creation failed');
    res.render('register', {
      locals: { user: user }
    });
  }

  user.save(function(err) {
    console.log("SAVING", err);
    if (err) return userSaveFailed();
    console.log("GOT HERE");

    req.flash('info', 'Your account has been created');
    //emails.sendWelcome(user);

    switch (req.params.format) {
      case 'json':
        res.send(user.toObject());
      break;

      default:
        req.session.user_id = user.id;
        res.redirect('/transcriptions4');
    }
  });
});

// Check Registration Duplicate
(function() {
  function checkField(fieldName, req, res) {
    if (!req.query || !req.query.user || !req.query.user[fieldName]) {
      res.write('true');
      res.end();
    } else {
      var field = req.query.user[fieldName];
      if (!field.length || field.length < 3) {
        res.write('true');
        res.end();
      } else {
        var searchObj = {};
        searchObj[fieldName] = field;
        User.findOne(searchObj, function(err, user) {
          if (err || user) {
            res.write('false');
            res.end();
          } else {
            res.write('true');
            res.end();
          }
        });
      }
    }
  }
  app.get('/checkUsername/', function(req, res) {
    checkField('username', req, res);
  });
  app.get('/checkEmail/', function(req, res) {
    checkField('email', req, res);
  });
})();

// Sessions
app.get('/login', function(req, res) {
  res.render('login.jade');
});

app.post('/checkValidLogin', function(req, res) {
  var returnObj = {
    url: '/'
  };
  function loginFailed() {
    returnObj.succeeded = false;
    res.write(JSON.stringify(returnObj));
    res.end();
  }
  function loginSucceed() {
    returnObj.succeeded = true;
    res.write(JSON.stringify(returnObj));
    res.end();
  }
  if (!req.body.user || !req.body.user.username || !req.body.user.password) {
    loginFailed();
    return;
  }
  var username = req.body.user.username,
      password = req.body.user.password;
  User.findOne({ username: username}, function(err, user) {
    if (user && user.authenticate(req.body.user.password)) {
      loginSucceed();
    } else {
      loginFailed();
    }
  });
});

app.post('/login', function(req, res) {
  function loginFailed() {
    res.redirect('/loginFailed');
    res.end();
  }
  function loginSucceed() {
    res.redirect('/transcriptions');
    res.end();
  }
  if (!req.body.user || !req.body.user.username || !req.body.user.password) {
    loginFailed();
    return;
  }
  var username = req.body.user.username,
      password = req.body.user.password;
  User.findOne({ username: username}, function(err, user) {
    if (user && user.authenticate(req.body.user.password)) {
      req.session.user_id = user.id;
      req.currentUser = user;

      // Remember me
      //if (req.body.remember_me) {
      if (true) {
        var loginToken = new LoginToken({ username: user.username });
        loginToken.save(function() {
          res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
          loginSucceed();
        });
      } else {
        loginSucceed();
      }
    } else {
      loginFailed();
    }
  });
});

app.get('/logout', function(req, res) {
  if (req.session) {
    LoginToken.remove({ username: req.currentUser.username }, function() {});
    res.clearCookie('logintoken');
    req.session.destroy(function() {});
  }
  res.redirect('/');
  res.end();
});

// Transcription list
app.get('/transcriptions', member, function(req, res) {
  res.redirect('/search');
  /*
  Transcription.find({ user_id: req.currentUser.id },
                [], { sort: ['title', 'descending'] },
                function(err, transcriptions) {
    transcriptions = transcriptions.map(function(d) {
      return { title: d.title, id: d._id };
    });
    res.render('transcriptions/index.jade', {
      locals: { transcriptions: transcriptions, currentUser: req.currentUser }
    });
  });
  */
});

app.listen(3000, '127.0.0.1');
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

// CRUD for transcriptions

// List
app.get('/transcriptions.:format?', member, function(req, res) {
  Transcription.find().all(function(transcriptions) {
    switch (req.params.format) {
      case 'json':
        res.send(transcriptions.map(function(t) {
          return d.__doc;
        }));
        break;
      default:
        res.render('transcriptions/index.jade');
        break;
    }
  });
});

// Create
app.post('/transcriptions.:format?', function(req, res) {
  var transcription = new Transcription(req.body.transcription);
  var file = req.files.transcription.file;
  var newFileLoc = './transcriptions/' + file.name;
  transcription.fileLocation = newFileLoc;
  fs.rename(
    file.path,
    newFileLoc,
    function(err) {
      transcription.save(function() {
        res.redirect('/upload2');
      });
    }
  );
});
app.get('/transcriptions/new', member, function(req, res) {
  res.render('transcriptions/new.jade', {
    locals: {t: new Transcription() }
  });
});

// Read
app.get('/transcriptions/:id.:format?', member, function(req, res) {
  Transcription.findById(req.params.id, function(err, t) {
    switch (req.params.format) {
    case 'json':
      res.render('404');
      break;
    case 'html':
      res.render('transcriptionDisplay', {
        locals: {
          t: t
        },
        layout: ''
      });
      break;
    default:
      res.render('404');
      break;
    }
  });
});

// Edit
app.get('/transcriptions/edit/:id.:format?', member, function(req, res) {
  Transcription.findById(req.params.id, function(t) {
    res.render('transcriptions/edit.jade', {
      locals: {t : t}
    });
  });
});

var updateOrDel = function(opString) {
  return function(req, res) {
    //Load the Transcription
    Transcription.findById(req.body.transcription.id, function(t) {
      t.title = req.body.document.title;
      t.data = req.body.document.data;

      // Save
      t[opString](function() {
        switch (req.params.format) {
        case 'json':
          res.send(t.__doc);
          break;

        default:
          res.redirect('/transcriptions');
          break;
        }
      });
    });
  };
}
// Update
app.put('/transcriptions/:id.:format?', updateOrDel('save'));

// Delete
app.del('/transcriptions/:id.:format?', updateOrDel('delete'));

// Search
app.get('/search', member, function(req, res) {
  res.render('transcriptions', {
    locals: {
      searchItems: [],
      search: {},
      type: 'transcriptions'
    }
  });
});

// Can be a search for transcriptions or bounties
// for transcriptions, can be:
//    One string that should match any fields
//    Set of strings that should match all fields
app.post('/search', member, function(req, res) {
  var search = req.body.search;
  console.log(search);

  // Bastardized to also take bounties
  function gotTrs(trs) {
    res.render('transcriptions', {
      locals: {
        searchItems: trs,
        search: search || {},
        type: (search && search.type) || 'transcriptions'
      }
    });
  }
  function makeReg(search) {
    var re = new RegExp('search', 'i');
    return "search".replace(re, search);
  }
  if (search) {
    var title = makeReg(search.title);
    var artist = makeReg(search.artist);
    var album  = makeReg(search.album);
    Transcription.find()
      .regex('title', title)
      .regex('artist', artist)
      .regex('album', album)
      .run(function(err, trs) {
        gotTrs(trs);
      }
    );
  } else {
    search = req.body.searchAll;
    var regSearch = makeReg(search);
    Transcription.find()
      .regex('title', regSearch)
      .run(function(err, trs1) {
        Transcription.find()
          .regex('album', regSearch)
          .run(function(err, trs2) {
            Transcription.find()
              .regex('artist', regSearch)
              .run(function(err, trs3) {
                var trs = trs1.concat(trs2).concat(trs3);

                // get only unique trs
                var trIds = {};
                var uniqueTrs = [];
                for (var i = 0; i < trs.length; i++) {
                  var tr = trs[i];
                  if (!trIds[tr.id]) {
                    trIds[tr.id] = true;
                    uniqueTrs.push(tr);
                  }
                }
                trs = uniqueTrs;
                gotTrs(trs);
            });
          });
      }
    );
  }
});
