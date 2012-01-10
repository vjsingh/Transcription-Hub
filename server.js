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
  path = require('path'),
  db,
  Transcription, User, LoginToken, Bounty;
  //routes = require('./routes')

var sys = require('sys');
var exec = require('child_process').exec;
function puts(error, stdout, stderr) { sys.puts(stdout) }

// Configuration
var IS_LOCAL_MACHINE = siteConf.isLocal;
var TRANSCRIPTION_FILE_DIR = '/mongodb/transcriptions/';

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', {pretty: true});
  //app.set('db-uri', 'mongodb://transcriptionhub:spam1601@staff.mongohq.com:10093/jazz');
  var fileUploadDir;
  if (IS_LOCAL_MACHINE) {
    fileUploadDir = '/Users/Varun/tmp/transcriptions/';
  } else {
    fileUploadDir = TRANSCRIPTION_FILE_DIR + 'tmp/';
  }
  app.use(express.bodyParser({uploadDir: fileUploadDir}));

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
  app.use(function(req, res, next) {
    res.render('404');
  });

  app.dynamicHelpers({
    user: function(req, res) {
      return req.currentUser || new User();
    },
    scripts: function(req, res) {
      return [];
    },
    cssScripts: function(req, res) {
      return [];
    }
  });
  process.on('uncaughtException', function(err) {
    console.log("AAAAAAAAAAAAAAAAA Caught Exception: ", err);
  });

});

app.configure('development', function(){
  //app.use(express.logger({format: ':method :uri' }));
  app.use(express.logger());
  app.use(express.errorHandler({
    dumpExceptions: true, showStack: true }));
  app.set('db-uri', 'mongodb://localhost/jazz-dev');
});

app.configure('production', function(){
  app.use(express.logger());
  app.use(express.errorHandler());
  app.set('db-uri', 'mongodb://localhost/jazz-prod');
});

app.configure('test', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.set('db-uri', 'mongodb://localhost/jazz-test');
});

// Error
app.error(function(err, req, res, next) {
  res.render('500.jade', {
    error: err
  });
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

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

// Routes

app.get('/svg', function(req, res) {
  res.render('svg', {layout: ''});
});
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
app.get('/profile', member, function(req, res) {
  res.render('profile');
});

app.get('/register', function(req, res) {
  res.render('register', {
    locals: { user: new User() }
  });
});

app.post('/register', function(req, res) {
  var user = new User(req.body.user);

  function userSaveFailed() {
    req.flash('error', 'Account creation failed');
    res.render('register', {
      locals: { user: user }
    });
  }

  user.save(function(err) {
    console.log("SAVING", err);
    if (err) return userSaveFailed();

    req.flash('info', 'Your account has been created');
    //emails.sendWelcome(user);

    req.session.user_id = user.id;
    res.redirect('/search');
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

//app.get('/transcriptionPdf/:fileLoc', member, function(req, res) {
app.get('/transcriptionPdf/:download/:fileLoc', member, function(req, res) {
  var fileLoc = TRANSCRIPTION_FILE_DIR + req.params.fileLoc;
  var download = req.params.download;
  path.exists(fileLoc, function(exists) {
    if (exists) {
      if (download) {
        res.writeHead(200);
      } else {
        res.writeHead(200, {'Content-Type': 'application/pdf'});
      }
      fs.readFile(fileLoc, function(err, pdfData) {
        if (err) {
          throw new Error(err);
        }
        res.end(pdfData, 'binary');
      });
    } else {
      throw new Error("Couldn't find Pdf");
    }
  });
});


// Votes
app.get('/hasVoted/:trId', member, function(req, res) {
  var userId = req.currentUser.id;
  var trId = req.params.trId;
  User.hasVoted(userId, trId, function(err, hasVoted) {
    if (err) {
      throw new Error(err);
    }
    res.end('' + hasVoted);
  });
});

function removeVote(typeVote, userId, trId, cb) {
  var voteArrType;
  // These are reversed b/c we want to remove the
  // other type
  if (typeVote === '1') {
    voteArrType = 'upVotes';
  } else if (typeVote === '2') {
    voteArrType = 'downVotes';
  } else {
    console.log("AAAAAAAA ERROR IN removeVote");
  }
  Transcription.findById(trId, function(err, tr) {
    if (err) {
      throw new Error(err);
    }
    tr[voteArrType] = tr[voteArrType] - 1;
    tr.save();
    User.findById(userId, function(err, user) {
      if (err) {
        throw new Error(err);
      }
      trIdIndex = user[voteArrType].indexOf(trId);
      if (trIdIndex === -1) {
        console.log("AAAAAAA ERROR ALERT:  removing vote thats not there");
        cb(false);
      } else {
        user[voteArrType].splice(trIdIndex, 1);
        user.save();
        cb(true);
      }
    });
  });
}
function doVote(typeVote, userId, trId, cb) {
  Transcription.findById(trId, function(err, tr) {
    if (err) {
      throw new Error(err);
    }
    if (typeVote === '1') {
      tr.downVotes = tr.downVotes + 1;
    } else if (typeVote === '2') {
      tr.upVotes = tr.upVotes + 1;
    }

    // can't use tr.votes b/c hasn't saved yet
    numVotes = tr.upVotes - tr.downVotes;
    tr.save();
    User.findById(userId, function(err, user) {
      if (err) {
        throw new Error(err);
      }
      if (typeVote === '1') {
        user.downVotes.push(trId);
      } else if (typeVote === '2') {
        user.upVotes.push(trId);
      }
      user.save();
      cb(true, numVotes);
    });
  });
}
app.get('/doVote/:typeVote/:trId', member, function(req, res) {
  var trId = req.params.trId;
  var typeVote = req.params.typeVote + '';
  var userId = req.currentUser.id;
  failObjStr = JSON.stringify({success: false});
  User.hasVoted(userId, trId, function(err, hasVoted) {
    if (err) {
      throw new Error(err);
    }
    hasVoted = hasVoted + '';

    // Never voted
    if (hasVoted === '0') {
      doVote(typeVote, userId, trId, function(success, numVotes) {
        res.end(JSON.stringify({
          success: s,
          numVotes: numVotes
        }));
      });

    // Change vote
    } else if (hasVoted !== typeVote) {
      removeVote(typeVote, userId, trId, function(valid) {
        if (!valid) {
          res.end(failObjStr);
        } else {
          doVote(typeVote, userId, trId, function(success, numVotes) {
            res.end(JSON.stringify({
              success: success,
              numVotes: numVotes
            }));
          });
        }
      });

    // Don't let vote again
    } else {
      res.end(failObjStr);
    }
  });
});

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
app.post('/transcriptions.:format?', member, function(req, res) {
  var transcription = new Transcription(req.body.transcription);
  var file = req.files.transcription.file;
  if (path.extname(file.name) !== '.pdf') {
    throw new Error('Only pdf documents are allowed');
  }
  var foundNewFileName = function(fileLoc) {
    console.log("found good file name", file.path, fileLoc);
    //fs.chmod(file.path, '0664', function(err) {
    fs.rename(
      file.path,
      fileLoc,
      function(err) {
        console.log('error', err);
        if (err) {
          throw new Error(err);
        }
        transcription.fileLocation = path.basename(newFileLoc);
        transcription.userId = req.currentUser.id;
        transcription.save(function() {
          res.redirect('/search');
        });
      }
    );
    //});
  };
  // some fun recursive functions to recur asynchronously until we find a filename
  // thats not already there. Append increasing numbers till we get there
  var recurCheckFileName = function(fileLoc, addition, isFirstTime) {
    return function(exists) {
      console.log('r', exists, fileLoc);
      if (!exists) {
        foundNewFileName(fileLoc);
      } else {
        fileLoc = path.dirname(fileLoc) + '/' + path.basename(fileLoc, '.pdf');
        if (!isFirstTime) {
          fileLoc = fileLoc.substring(0, fileLoc.length-( (String(addition-1)).length));
        }
        fileLoc = fileLoc + addition + '.pdf';
        path.exists(fileLoc, recurCheckFileName(fileLoc, addition + 1, false));
      }
    };
  };

  var newFileLoc = TRANSCRIPTION_FILE_DIR + file.name;
  var addition = 2;
  path.exists(newFileLoc, recurCheckFileName(newFileLoc, addition, true));
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
  function gotTrs(err, trs) {
    if (err) {
      throw new Error(err);
    }
    res.render('transcriptions', {
      locals: {
        searchItems: trs,
        search: search || {},
        type: (search && search.type) || 'transcriptions'
      }
    });
  }
  function makeReg(search) {
    var re = new RegExp(search, 'i');
    return re;
  }
  if (search) {
    var title = makeReg(search.title);
    var artist = makeReg(search.artist);
    console.log(artist);
    var album  = makeReg(search.album);
    Transcription
      .where('title', title)
      .where('artist', artist)
      .where('album', album)
      .sort('votes', -1)
      .execFind(gotTrs);
  } else { // search all fields
    search = req.body.searchAll;
    if (search === '') {
      console.log('empty');
      Transcription.find()
      .sort('votes', -1)
      .execFind(gotTrs);
    } else {
      Transcription
        .$where('(/' + search + '/i).test(this.title)' +
          ' || (/' + search + '/i).test(this.artist)' +
          ' || (/' + search + '/i).test(this.album)')
        .sort('votes', -1)
        .execFind(gotTrs);
    }
  }
});
