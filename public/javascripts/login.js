$(document).ready(function() {
  function submitLogin() {
    $.ajax({
      url: '/checkValidLogin',
      type: 'post',
      dataType: 'json',
      data: $('form#loginTopBar').serialize(),
      success: function(data) {
        if (data.succeeded) {
          $('form#loginTopBar').removeClass('error');
          $('form#loginTopBar > input#loginSubmit').click();
        } else {
          $('form#loginTopBar').addClass('error');
        }
      }
    });
  }
  // Click on Enter
  $('#password').keypress(function(e) {
    if (e.which === 13) {
      //$('form#login').submit();
      submitLogin();
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
  //$('#username').popover(options);
  //$('#password-password').popover(options);
});

