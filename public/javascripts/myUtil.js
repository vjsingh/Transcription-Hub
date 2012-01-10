$(document).ready(function() {
  $('#password-clear').show();
  $('#password-password').hide();

  $('#password-clear').focus(function() {
    $('#password-clear').hide();
    $('#password-password').show();
    $('#password-password').focus();
  });
  $('#password-password').blur(function() {
    if ($('#password-password').val() === '') {
      $('#password-clear').show();
      $('#password-password').hide();
    }
  });

  // Click on Enter
  $('#password').keypress(function(e) {
    if (e.which === 13) {
      // Do 2nd way for Jquery Validate Plugin
      $('form#login').submit();
      e.preventDefault();
      return false;
    }
  });

  $('#loginSubmit').hide();
  /*
  $('#login').validate({
    rules: {
      'user[username]': {
        required: true,
        remote: '/checkUsername/'
      },
      'user[password]': {
        required: true,
        remote: 'checkPassword'
      }
    },

    messages: {
      'user[username]': {
        remote: "Username Taken"
      }
    },

    highlight: function(element, errClass) {
      $(element).popover('show');
    },
    unhighlight: function(element, errClass) {
      $(element).popover('hide');
    },
    errorPlacement: function(err, element) {
      err.hide();
    }
  }).form();
  */

  // Make login errors popovers
  var options = {
    placement: 'below',
    offset: 20,
    trigger: 'manual'
  };
  $('#username').popover(options);
  $('#password-password').popover(options);

    var uvOptions = {};
    (function() {
      var uv = document.createElement('script'); uv.type = 'text/javascript'; uv.async = true;
      uv.src = ('https:' == document.location.protocol ? 'https://' : 'http://') + 'widget.uservoice.com/Je9bneyXUwyVuvYdCyJGAw.js';
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(uv, s);
      $('#footerFeedback').click(function() {
        UserVoice.showPopupWidget(uvOptions);
      });
    })();
});

