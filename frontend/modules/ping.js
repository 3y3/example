var _pingInterval = setInterval(_ping, 1000);

module.exports.stop = function() {
  _pingInterval && clearInterval(_pingInterval);
}

function _ping() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET','/~nop');
  xhr.onload = function() {
      try {
        eval(xhr.response);
      }
      catch (error) {
        console.log(error);
      }
  }

  xhr.send();
}
