/**
 * Module dependencies.
 */

var express = require('express'),
  jade = require('jade'),
  expressValidator = require('express-validator'),
  check = require('validator').check,
  sanitize = require('validator').sanitize,
  app = module.exports = express.createServer(),
  mongoose = require('mongoose'),
  mongoStore = require('connect-mongo'),
  models = require('./models'),
  stylus = require('stylus'),
  siteConf = require('./lib/getConfig'),
  fs = require('fs'),
  path = require('path'),
  db,
  Transcription, User, LoginToken, Bounty;
  //routes = require('./routes')

var sys = require('util');
var exec = require('child_process').exec;
function puts(error, stdout, stderr) { sys.puts(stdout) }

// Configuration
var IS_LOCAL_MACHINE = siteConf.isLocal;
var TRANSCRIPTION_FILE_DIR = '/mongodb/transcriptions/';

var serverDir;
if (IS_LOCAL_MACHINE) {
  serverDir = '/Users/Varun/Documents/workspace/jazz/jazz/';
} else {
  serverDir = '/var/jazz/';
}
process.chdir(serverDir);

function getIsFirefox(req) {
  return (/firefox/i).test(req.headers['user-agent']);
}
app.configure(function(){
  app.set('db-uri', 'mongodb://localhost/' + siteConf.dbName);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  // set pretty to false for editable fields in transcriptionDisplay
  // Extra whitespace added when editing AARGHHH
  app.set('view options', {pretty: false});
  //app.set('db-uri', 'mongodb://transcriptionhub:spam1601@staff.mongohq.com:10093/jazz');
  var fileUploadDir;
  if (IS_LOCAL_MACHINE) {
    fileUploadDir = '/Users/Varun/tmp/transcriptions/';
  } else {
    fileUploadDir = TRANSCRIPTION_FILE_DIR + 'tmp/';
  }

  app.use(express.bodyParser({uploadDir: fileUploadDir}));
  app.use(expressValidator);

  app.use(express.cookieParser());
  app.use(express.session({
    store: new mongoStore({
      db: siteConf.dbName,
      host: 'localhost'
    }),
    secret: siteConf.sessionSecret,
    maxAge: new Date(Date.now() + 3600000)
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
      var scripts = [];
      if (IS_LOCAL_MACHINE) {
        scripts.push('http://localhost:8001/vogue-client.js');
      }
      return scripts;
    },
    cssScripts: function(req, res) {
      var scripts = [];
      return scripts;
    },
    isFirefox: function(req, res) {
      return getIsFirefox(req);
    }
  });
  process.on('uncaughtException', function(err) {
    console.log("ZQX Caught Exception: ", err);
  });

});

app.configure('development', function(){
  //app.use(express.logger({format: ':method :uri' }));
  app.use(express.logger());
  app.use(express.errorHandler({
    dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.logger());
  //app.use(express.errorHandler());
});

app.configure('test', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Error
app.error(function(err, req, res, next) {
  console.log("ZQX GOT ERROR, in app.error");
  console.log(err);
  console.log(err.stack);
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



//**********************************
// Helper functions
//**********************************

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

function getReadableTime(mill) {
}


//**********************************
//Middleware
//**********************************

function member(req, res, next) {
  if (!req.currentUser) {
      res.redirect('/register');
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
function validateErr(req, res, next) {
  req.onValidationError(function(msg) {
    console.log('Validation Error: ' + msg);
    throw new Error(msg);
  });
  next();
}

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);



//**********************************
// Routes
//**********************************

app.get('/svg', function(req, res) {
  throw new Error('fake error!');
  res.render('svg', {layout: ''});
});
app.get('/', function(req, res) {
  Transcription.count({}, function(err, trCount) {
    if (err) {
      throw new Error(err);
    }
    User.count({}, function(err, userCount) {
      if (err) {
        throw new Error(err);
      }
      res.render('index', {
        locals: {
          trCount: trCount,
          userCount: userCount
        }
      });
    });
  });
});
app.get('/privacy', function(req, res) {
  res.render('privacy');
});

app.get('/upload', member, function(req, res) {
  res.render('upload', {
  });
});
app.get('/about', function(req, res) {
  res.render('about');
});

// Bounty
app.get('/bounty', function(req, res) {
  Bounty.find()
  .sort('points', -1)
  .execFind(function(err, bounties) {
    if (err) {
      throw new Error(err);
    }
    res.render('transcriptions', { locals: {
        searchItems: bounties,
        search: {},
        type: 'bounty'
      }
    });
  });
});
app.get('/bounty/:id', function(req, res) {
  Bounty.findById(req.params.id, function(err, b) {
    if (err) {
      throw new Error(err);
    }
    res.render('transcriptions', {
      locals: {
        searchItems: [b],
        search: {},
        type: 'bounty'
      }
    });
  });
});

app.get('/createBounty', member, function(req, res) {
  res.render('newBounty');
});

function addToBounty(bounty, points, req, res) {
  bounty.points = parseInt(bounty.points, 10) + parseInt(points, 10);
  bounty.save();
  //User.findById(req.currentUser.id, function(err, user) {
  var user = req.currentUser;
  if (user.karmaPoints < points) {
    console.log('ZQX Cheater: ' + user.id + user.username);
    throw new Error('Stop trying to cheat! Your account has been flagged');
  }
  user.karmaPoints = user.karmaPoints - points;
  user.save();
  res.redirect('/bounty');
  //});
}
app.post('/createBounty', member, function(req, res) {
  var bounty = new Bounty(req.body.bounty);

  // set points to 0 b/c added later in addToBounty
  var points = bounty.points;
  bounty.points = 0;

  bounty.userId = req.currentUser.id;
  bounty.save(function(err) {
    if (err) {
      throw new Error(err);
    }
    addToBounty(bounty, points, req, res);
  });
});

app.post('/addToBounty', member, function(req, res) {
  var points = req.body.bounty.points;
  var bountyId = req.body.bountyId;
  Bounty.findById(bountyId, function(err, bounty) {
    if (err) {
      throw new Error(err);
    }
    addToBounty(bounty, points, req, res);
  });
});

// Shouldn't happen
app.get('/fillBounty', member, function(req, res) {
  res.redirect('/');
});
app.post('/fillBounty/:bId', member, function(req, res) {
  var bId = req.params.bId;
  var trId = req.body.trId;
  Transcription.findById(trId, function(err, tr) {
    if (!tr) {
      res.json('INVALID_TRANSCRIPTION');
    } else {
      Bounty.findById(bId, function(err, bounty) {
        bounty.hasUploaded = true;
        bounty.transcriptionId = trId;
        bounty.filledById = req.currentUser.id;
        bounty.save();
      });
      res.json('SUCCESS');
    }
  });
});

// Users
app.get('/profile', member, function(req, res) {
  res.render('profile', {
    locals: {
      profileUser: req.currentUser
    }
  });
});

app.get('/user/:userId', member, function(req, res) {
  User.findById(req.params.userId, function(err, user) {
    if (err) {
      throw new Error(err);
    }

    // This is duplicated in '/profile' above
    res.render('profile', {
      locals: {
        profileUser: user
      }
    });
  });
});

app.get('/register', function(req, res) {
  res.render('register', {
    locals: { user: new User() }
  });
});

app.post('/register', function(req, res) {
  var user = new User(req.body.user);
  var paramsToCheck = ['username', 'email', 'password'];
  paramsToCheck.forEach(function(v) {
    user[v] = sanitize(user[v]).trim();
    check(user[v], 'Invalid ' + v + '!').notEmpty().len(3, 64);
  });
  check(user.email).isEmail();


  function userSaveFailed() {
    req.flash('error', 'Account creation failed');
    res.render('register', {
      locals: { user: user }
    });
  }

  user.registerTime = Date.now();
  user.save(function(err) {
    if (err) return userSaveFailed();

    //req.flash('info', 'Your account has been created');
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

app.get('/checkPoints/', function(req, res) {
  if (!req.currentUser) {
    res.write('false');
  } else if (!req.query || !req.query.bounty || !req.query.bounty.points) {
    res.write('true');
    res.end();
  } else {
    var points = parseInt(req.query.bounty.points, 10);
    //User.findById(req.currentUser.id, function(err, user) {
      //if (err) {
  //} else {
    if (req.currentUser.karmaPoints >= points) {
      res.write('true');
      res.end();
    } else {
      res.write('false');
      res.end();
    }
      //}
    //});
  }
});

var profileTrsDisplayTemple = makeTemplate('userProfileTranscriptions');
app.get('/userTranscriptions/:userId', member, function(req, res) {
  Transcription.find({userId: req.params.userId}, function(err, trs) {
    if (err) {
      throw new Error(err);
    }
    var html = profileTrsDisplayTemple({
      trs: trs
    });
    res.json({
      html: html
    });
  });
});

var profileBountyDisplayTemple = makeTemplate('userProfileBounties');
app.get('/userBounties/:userId', member, function(req, res) {
  Bounty.find({userId: req.params.userId}, function(err, bounties) {
    if (err) {
      throw new Error(err);
    }
    var html = profileBountyDisplayTemple({
      bounties: bounties
    });
    res.json({
      html: html
    });
  });
});

var profilePendingBountyDisplayTemple = makeTemplate('userProfilePendingBounties');
app.get('/userPendingBounties/:userId', member, function(req, res) {
  // only show for own profile
  console.log(req.params.userId, req.currentUser.id);
  if (req.params.userId !== req.currentUser.id) {
    res.json(false);
  } else {
    Bounty.find({userId: req.params.userId, hasUploaded: true, fulfilled: false}, function(err, bounties) {
      if (err) {
        throw new Error(err);
      }
      console.log(bounties);
      if (!bounties || bounties.length === 0) {
        res.json(false);
      } else {
        var html = profilePendingBountyDisplayTemple({
          bounties: bounties
        });
        res.json({
          html: html
        });
      }
    });
  }
});

app.get('/confirmBountyTr/:isCorrect/:bId', function(req, res) {
  Bounty.findById(req.params.bId, function(err, bounty) {
    if (err) {
      throw new Error(err);
    }
    if (req.params.isCorrect === 'true') {
      User.findById(bounty.filledById, function(err, user) {
        if (err) {
          throw new Error(err);
        }
        user.karmaPoints = user.karmaPoints + bounty.points;
        user.save();
        bounty.fulfilled = true;
        bounty.save();
        res.json(true);
      });
    } else {
      bounty.hasUploaded = false;
      bounty.transcriptionId = '';
      bounty.save();
      res.json(true);
    }
  });
});

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
    res.redirect('/browse');
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

app.get('/logout', member, function(req, res) {
  if (req.session) {
    LoginToken.remove({ username: req.currentUser.username }, function() {});
    res.clearCookie('logintoken');
    req.session.destroy(function() {});
  }
  res.redirect('/');
  res.end();
});

// Transcription list
app.get('/transcriptions', function(req, res) {
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
app.get('/transcriptionPdf/:download/:fileLoc', function(req, res) {
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
      throw new Error("Couldn't find Pdf " + fileLoc);
    }
  });
});

app.get('/getUsername/:userId', function(req, res) {
  var userId = req.params.userId;
  // TODO: Only get username field
  User.findById(userId, function(err, user) {
    if (err) {
      throw Error(err);
    }
    res.write(user.username + "");
    res.end();
  });
});

// Votes
function getHasVoted(req, trId, cb) {
  if (!req.currentUser) {
    cb(false);
  } else {
    var userId = req.currentUser.id;
    User.hasVoted(userId, trId, function(err, hasVoted) {
      if (err) {
        throw new Error(err);
      }
      cb(hasVoted);
    });
  }

}
app.get('/hasVoted/:trId', function(req, res) {
  getHasVoted(req, req.params.trId, function(hasVoted) {
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
    console.log("ZQX ERROR IN removeVote");
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
        console.log("ZQX ERROR ALERT:  removing vote thats not there");
        cb(false);
      } else {
        user[voteArrType].splice(trIdIndex, 1);
        user.save();
        cb(true);
      }
    });
  });
}
function doVote(typeVote, userId, trId, req, res) {
  Transcription.findById(trId, function(err, tr) {
    if (err) {
      throw new Error(err);
    }

    // Can't vote for your own transcriptions
    console.log(tr.userId, userId);
    if (userId === tr.userId + '') {
      res.end(JSON.stringify({
        success: false,
        ownTranscription: true
      }));
    } else {
      if (typeVote === '1') {
        tr.downVotes = tr.downVotes + 1;
      } else if (typeVote === '2') {
        tr.upVotes = tr.upVotes + 1;
      }

      // can't use tr.votes b/c hasn't saved yet
      numVotes = tr.upVotes - tr.downVotes;
      trUserId = tr.userId;
      tr.save();

      User.findById(userId, function(err, user) {
        if (err) {
          throw new Error(err);
        }
        User.findById(trUserId, function(err, trUser) {
          if (err) {
            throw new Error(err);
          }
          if (!trUser || ! user) {
            throw new Error('ERROR IN DO VOTE');
          }
          if (typeVote === '1') {
            user.downVotes.push(trId);
            trUser.karmaPoints = trUser.karmaPoints - 1;
          } else if (typeVote === '2') {
            user.upVotes.push(trId);
            trUser.karmaPoints = trUser.karmaPoints + 1;
          }
          user.save();
          trUser.save();
          res.end(JSON.stringify({
            success: true,
            numVotes: numVotes
          }));
        });
      });
    }
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
      doVote(typeVote, userId, trId, req, res);
    // Change vote
    } else if (hasVoted !== typeVote) {
      removeVote(typeVote, userId, trId, function(valid) {
        if (!valid) {
          res.end(failObjStr);
        } else {
          doVote(typeVote, userId, trId, req, res);
        }
      });
    // Don't let vote again
    } else {
      res.end(failObjStr);
    }
  });
});

// CRUD for transcriptions

// Create
function gotNewTranscription(req, res, isMultipleFile) {
  // Can post with either a url or a pdf
  var isFilePost = false;
  var file = req.files.transcription.file;
  if (file && file.name) {
    isFilePost = true;
  }
  var transcription = new Transcription(req.body.transcription);

  // Check params, sanitize
  var paramsToCheck = ['title', 'artist', 'album'];
  paramsToCheck.forEach(function(v) {
    check(transcription[v], 'Invalid ' + v + '!').notEmpty().len(3, 64);
  });

  // sanitize description for xss
  var oldDescription = transcription.description;
  transcription.description = sanitize(transcription.description).xss();
  if (oldDescription !== transcription.description) {
    console.log('ZQX XSS ATTACK!: ' + req.currentUser.id + ' ' + oldDescription + ' ' + transcription.description);
  }
  if (isFilePost && path.extname(file.name) !== '.pdf') {
    throw new Error('Only pdf documents are allowed');
  }
  function addTranscription(transcription) {
    transcription.userId = req.currentUser.id;
    transcription.uploadTime = Date.now();
    if (transcription.title === 'Unknown') {
      transcription.title = transcription.fileLocation;
    }
    transcription.save(function(err) {
      if (err) {
        throw new Error(err);
      }
      if (isMultipleFile) {
        res.write('{success: true}');
        res.end();
      } else {
        res.redirect('/transcriptions/' + transcription.id);
      }
    });
  }
  if (!isFilePost) {
    addTranscription(transcription);
  } else {
    var foundNewFileName = function(fileLoc) {
      //fs.chmod(file.path, '0664', function(err) {
      fs.rename(
        file.path,
        fileLoc,
        function(err) {
          if (err) {
            throw new Error(err);
          }
          transcription.fileLocation = path.basename(fileLoc);
          addTranscription(transcription);
        }
      );
      //});
    };
    // some fun recursive functions to recur asynchronously until we find a filename
    // thats not already there. Append increasing numbers till we get there
    var recurCheckFileName = function(fileLoc, addition, isFirstTime) {
      return function(exists) {
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
  }
}
app.post('/transcriptions.:format?', member, function(req, res) {
  gotNewTranscription(req, res);
});
app.get('/Multiupload', member, function(req, res) {
  res.render('multiupload.jade', {
  });
});
app.post('/multipletranscriptions', member, function(req, res) {
  req.files.transcription = {};
  req.files.transcription.file = req.files.qqfile;
  delete req.files.qqfile;
  gotNewTranscription(req, res, true);
});
app.post('/asdqwezxc', function(req, res) {
  req.currentUser = {
    id: '4f19850106e5980b09000007'
  };
  gotNewTranscription(req, res);
});

app.get('/transcriptions/new', member, function(req, res) {
  res.render('transcriptions/new.jade', {
    locals: {t: new Transcription() }
  });
});

// Read
function makeTemplate(fileName) {
  var displayFile = fs.readFileSync('./views/' + fileName + '.jade');
  return jade.compile(displayFile.toString('utf8'));
}

var trDisplayTemple = makeTemplate('transcriptionDisplay');

app.get('/getTranscription/:id', function(req, res) {
  Transcription.findById(req.params.id, function(err, t) {
    var isFirefox = getIsFirefox(req);
    var html = trDisplayTemple({
      t: t,
      isFirefox: isFirefox
    });
    res.json({
      url: '/transcriptions/' + req.params.id,
      html: html
    });
  });
});

var bountyDisplayTemple = makeTemplate('bountyDisplay');

app.get('/getBounty/:id', function(req, res) {
  Bounty.findById(req.params.id, function(err, b) {
    var html = bountyDisplayTemple({
      b: b
    });
    res.json({
      url: '/bounty/' + req.params.id,
      html: html
    });
  });
});

// Browse
var browseDisplayTemple = makeTemplate('browseDisplay');
app.get('/browse/:browseType', function(req, res) {
  var browseType = req.params.browseType;
  var gotResults = function(browseItems) {
    //if (req.params.format === 'json') {
    var html = browseDisplayTemple({
      browseItems: browseItems
    });
    res.json({
    //url: '/browse/' + req.params.browseType + '.html',
        url: '/browse/',
        html: html
      });
    /*
    } else {
      res.render('browseDisplay', {
        browseItems: agg
      });
    }
    */
  };
  if (browseType === 'latest') {
    Transcription.find()
      .sort('uploadTime', -1)
      .execFind(function(err, trs) {
        if (err) {
          throw new Error(err);
        }
        var returnObjs = [];
        // duplicated below :(
        trs.forEach(function(tr) {
          var returnObj = {};
          returnObj.value = tr.artist + ' - ' + tr.title;
          returnObj.url = '/transcriptions/' + tr.id;
          returnObjs.push(returnObj);
        });
        gotResults(returnObjs);
      });
  } else {
    Transcription.distinct(req.params.browseType, {}, function(err, docs) {
      if (err) {
        throw new Error(err);
      }
      function getCounts(fieldName, fields, agg) {
        if (fields.length === 0) {
          agg.sort(function(a, b) {
            return b.count - a.count;
          });
          gotResults(agg);
        } else {
          var obj = {};
          var fieldVal = fields[0];
          obj[fieldName] = fieldVal;
          Transcription.count(obj, function(err, count) {
            if (err) {
              throw new Error(err);
            }
            var returnObj = {};
            returnObj.value = fieldVal;
            returnObj.count = count;
            returnObj.url = '/searchParam/?' + fieldName + '=' + fieldVal;
            agg.push(returnObj);
            fields.splice(0, 1);
            getCounts(fieldName, fields, agg);
          });
        }
      }
      getCounts(req.params.browseType, docs, []);
    });
  }
});

app.post('/transcriptions/:id', function(req, res) {
  res.redirect('/transcriptions/' + req.params.id);
});

app.get('/transcriptions/:id', function(req, res) {
  Transcription.findById(req.params.id, function(err, t) {
    if (err) {
      throw new Error(err);
    }
    res.render('transcriptions', {
      locals: {
        searchItems: [t],
        search: {},
        type: 'transcriptions'
      }
    });
  });
});

// Edit
var allTranscriptionParams = ['title', 'album', 'artist', 'genre', 'instrument'];
app.post('/transcriptions/edit/:id', member, function(req, res) {
  console.log(req.body, req.params.id, req.currentUser.username);
  var newParamType = req.body.param;
  var newParamValue = req.body.value;
  Transcription.findById(req.params.id, function(err, t) {
    if (err) {
      throw new Error(err);
    }
    if (t[newParamType] === newParamValue) {
      res.json(newParamValue);
    } else {
      var newInfoLog = {};

      // Update with current info
      allTranscriptionParams.forEach(function(param) {
        newInfoLog[param] = t[param];
      });
      // Add new info
      newInfoLog[newParamType] = newParamValue;

      // Push history state to infoLog
      var infoLog = t.infoLog;
      var infoLogType = infoLog[newParamType] || [];
      var infoLogTypeUsr = infoLog[newParamType + 'Usr'] || [];
      infoLogType.push(t[newParamType]);
      infoLogTypeUsr.push(req.currentUser.id);
      infoLog[newParamType] = infoLogType;
      infoLog[newParamType + 'Usr'] = infoLogTypeUsr;
      t.infoLogObj = infoLog;

      // Update t and save
      t[newParamType] = newParamValue;
      t.save();
      res.json(newParamValue);
    }
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
app.post('/search', function(req, res) {
  var search = req.body.search;
  doSearch(req, res, search);
});
app.get('/search', function(req, res) {
  var search = req.query.search;
  if (search && search.type) {
    doSearch(req, res, search);
  } else {
    res.render('transcriptions', {
      locals: {
        searchItems: [],
        search: {},
        type: 'transcriptions'
      }
    });
  }
});
app.get('/browse', function(req, res) {
  res.render('browse', {
    locals: {
      searchItems: [],
      search: {},
      type: 'transcriptions',
      displayType: 'browse'
    }
  });
});
app.get('/bounty', function(req, res) {
  res.render('transcriptions', {
    locals: {
      searchItems: [],
      search: {},
      type: 'bounty'
    }
  });
});

// Can be a search for transcriptions or bounties
// for transcriptions, can be:
//    One string that should match any fields
//    Set of strings that should match all fields
function doSearch(req, res, search) {
  // Bastardized to also take bounties
  function gotTrs(err, trs) {
    if (err) {
      throw new Error(err);
    }

    function finished(newTrs) {
      //console.log(newTrs);
      res.render('transcriptions', {
        locals: {
          searchItems: newTrs,
          search: search || {},
          type: (search && search.type) || 'transcriptions'
        }
      });
    }
    /*
    function addHasVoted(index, acc) {
      if (index === (trs.length)) {
        finished(acc);
      } else {
        var newTr = trs[index];
        getHasVoted(req, newTr.id, function(hasVoted) {
          //console.log(index);
          var obj = trs[0];
          newTr.hasVoted = hasVoted;
          newTr.asdfdsfd = 5;
          //console.log(newTr);
          acc.push(newTr);
          addHasVoted(index + 1, acc);
        });
      }
    }
    */
    // TOOD: WTF
    //var newTr = trs[0];
    //trs[0].asfdasf = 6;
    //console.log(trs[0]);
    //addHasVoted(0, []);
    finished(trs);
  }

  // If strict, match the exact string as a substring
  // Othwerise, split on spaces, and match one or more words
  function makeReg(search, doStrict) {
    if (!search) {
      return (/.?/);
    }
    if (doStrict) {
      return new RegExp('.?' + search + '.?', 'i');
    }
    var splitArr = search.split(' ');
    var regSearch = '^';
    var isFirstTime = true;
    splitArr.forEach(function(word) {
      regSearch += '(?=.*?(';
      //if (!isFirstTime) {
        //regSearch += '|';
      //}
      regSearch += word;
      regSearch += '))';
      isFirstTime = false;
    });
    regSearch += '.*$';
    return new RegExp(regSearch, 'i');
  }

  var type;
  if (search.type === 'transcriptions') {
    type = Transcription;
  } else {
    type = Bounty;
  }
  // Search by field
  if (search.omniSearch !== '' && !search.omniSearch) {
    var title = makeReg(search.title, true);
    var artist = makeReg(search.artist, true);
    var album  = makeReg(search.album, true);
    var instrument  = makeReg(search.instrument, true);
    type
      .where('title', title)
      .where('artist', artist)
      .where('album', album)
      .where('instrument', instrument)
      .sort('votes', -1)
      .execFind(gotTrs);

  // Omnisearch -- Search all fields
  } else {
    search = search.omniSearch;
    if (search === '') {
      type.find()
      .sort('votes', -1)
      .execFind(gotTrs);
    } else {
      search = makeReg(search);
      type
        .$where('(' + search + ').test(this.title + this.artist + this.album + this.instrument)')
          //' || (' + search + ').test(this.artist)' +
          //' || (' + search + ').test(this.album)')
        .sort('votes', -1)
        .execFind(gotTrs);
    }
  }
}
app.get('/searchParam', function(req, res) {
  var searchObj = {
    title: '',
    artist: '',
    album: '',
    instrument: '',
    type: 'transcriptions'
  };
  var querySearch = req.query;
  for (var prop in querySearch) {
  //for (var i in a) {
    if (querySearch.hasOwnProperty(prop)) {
      searchObj[prop] = querySearch[prop];
    }
  }
  doSearch(req, res, searchObj);
});
function makeEmailList() {
  var stream = fs.createWriteStream('subscribers.txt');
  stream.once('open', function(fd) {
    User.find({}, function(err, users) {
      if (err) {
        throw new Error(err);
      }
      console.log('writing');
      stream.write('Email Address,Username\n');
      users.forEach(function(user) {
        stream.write(user.email + ',' + user.username + '\n');
      });
    });
  });
}
makeEmailList();
Transcription.find({title: 'Unknown'}, function(err, trs) {
  trs.forEach(function(tr) {
    if (tr.title === 'Unknown') {
      tr.title = tr.fileLocation;
    }
    tr.save();
    /*
    if (!tr.uploadTime) {
      tr.uploadTime = 1327262166151;
      tr.save();
    }
    */
  });
});
User.find({}, function(err, users) {
  users.forEach(function(user) {
    if (user.karmaPoints < 10) {
      user.karmaPoints = user.karmaPoints + 10;
      user.save();
    }
  });
});
