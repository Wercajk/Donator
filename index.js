// Config
var cwd = process.cwd()+'/';
var config = require(cwd+'config.json');

var koa = require('koa');
var _ = require('lodash-node');

var thunkify = require('thunkify');

var route = require('koa-route')
var paramify = require('koa-params');
var route = paramify(route);
var param = route.param;
var get = route.get;

var nodemailer = require('nodemailer');
var validator = require('validator');

var Datastore = require('nedb');
var db = new Datastore({ filename: config.donatorsDatabaseFile });
db.loadDatabase();

var cors = require('koa-cors');

var app = koa();

app.use(cors());

// Setup params
param('email', function*(email, next){

  // Validate email address
  if ( !validator.isEmail(email) ) {
    this.body = {failed: true, error: 'Email not valid'};
    return this.status = 404;
  }

  this.email = email;
  yield next;
});

param('amount', function*(amount, next){

  // Validate amount
  if ( !validator.isNumeric(amount) ) {
    this.body = {failed: true, error: 'Amount not valid'};
    return this.status = 404;
  }

  this.amount = amount;
  yield next;
});

param('download', function*(donator_id, next){
  this.donator_id = donator_id;
  yield next;
});


// Create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: config.gmailAccount,
        pass: config.gmailPassword
    }
});


// Root response
app.use(get('/', function*(){
  this.body = '<html><body><h1>Thank you for using Donator <a href="https://github.com/Wercajk/Donator">https://github.com/Wercajk/Donator</a></h1></body></html>';
}));


var getDonorThunk = function (id, callback) {
  return function(callback) {
    db.find({_id: id}, callback);
  };
}

app.use(get('/:download', function *(){

  var donors = yield getDonorThunk(this.donator_id);

  if ( donors[0] !== undefined ) {
    this.redirect(config.targetFile);
  } else {
    console.log(donors)
  }

}));


var buildEmailOptions = function (email, amount, id) {

  var downloadLink = 'http://'+ config.domain +'/'+ id;

  return {
    from: config.name +' <'+ config.gmailAccount +'>',
    to: email,
    subject: 'Thank you for $'+ amount +'!',
    text: config.downloadText +' '+ downloadLink,
    html: config.downloadText +' <a href=\"'+ downloadLink +'\">' +downloadLink+ '</a>'
  };
}

app.use(get('/:email/:amount', function*(){

  var data = {
    email: this.email,
    amount: this.amount,
    time: new Date()
  };

  // Insert to database
  db.insert(data, function(err, doc){

    // send mail with defined transport object
    smtpTransport.sendMail(buildEmailOptions(data.email, data.amount, doc._id), function(error, response){

      if(error){
        console.log(error);
        this.body = {failed: true, error: error};
      }else{
        console.log("Message sent: " + response.message);
      }

    });

  });

  if ( this.amount > 0 ) {
    this.body = '<html><head><script type="text/javascript">setTimeout(function(){window.location="'+ config.targetFile +'";}, 3000);</script><title>Thank you!</title></head><body><h1>Payment was successful... download will begin shortly.</h1></body></html>';
  }

}));

app.listen(3000);
