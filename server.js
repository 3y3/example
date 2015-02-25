var fs = require('fs');
var express = require('express');
var app = express();
var multipart = require('connect-multiparty');
var multipartMW = multipart();

app.set('port', (process.env.PORT || 80));
app.use(express.static(__dirname + '/build'));

app.get('/~nop', function(req, res) {
  if (global._needsReload) {
    res.send('location.reload()');
    global._needsReload = false;
  }
  else res.send('');
});
app.get('/~cfg_ask_xml', function(req, res) {
  var path;
  if (req.query.type == 'cfg') {
    path = '/config/Config.xml';
  } else if (req.query.type == 'coproc') {
    var type = req.query.num > 8 ? 'OUT' : 'IN';
    path = '/config/Config' + req.query.num + '.xml';
  } else if (req.query.type == 'typedevices') {
    path = '/config/TypeDevices.xml';
  } else {
    throw new Error('~cfg_ask_xml: Неизвестный тип документа');
  }

  fs.readFile(__dirname + path, function(error, result) {
    if (error) return res.send(404, error);
    
    res.set('content-type', 'text/xml');
    res.send(result);
  });
});
app.post('/~cfg_save_xml', multipartMW, function(req, res, next) {
  var path;
  if (req.query.type == 'cfg') {
    path = './config/Config.xml';
  } else if (req.query.type == 'coproc') {
    path = './config/Config' + req.query.num + '.xml';
  } else if (req.query.type == 'typedevices') {
    path = './config/TypeDevices.xml';
  } else {
    throw new Error('~cfg_save_xml: Неизвестный тип документа');
  }
  var file = fs.createWriteStream(path);
  var rs = fs.createReadStream(req.files.config.ws.path);
  rs.pipe(file);
  res.end();
  rs.on('end', function() {
    fs.unlink(req.files.config.ws.path);
  });
});


app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});