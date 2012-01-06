$(function () {
    // add alphanumeric check for username
    $.validator.addMethod('loginRegex', function(val, element) {
      return this.optional(element) || /^[a-zA-Z0-9]+$/i.test(val);
    }, "Username must contain only letters and numbers");
    function find_container(input) {
        return input.parent().parent();
        //return input.parent();
    }
    function remove_validation_markup(input) {
        var cont = find_container(input);
        cont.removeClass('error success warning');
        $('.help-inline.error, .help-inline.success, .help-inline.warning',
            cont).remove();
    }
    function add_validation_markup(input, cls, caption) {
        var cont = find_container(input);
        cont.addClass(cls);
        input.addClass(cls);

        if (caption) {
            var msg = $('<span class="help-inline"/>');
            msg.addClass(cls);
            msg.text(caption);
            input.next('.help-inline').remove();
            input.after(msg);
        }
    }
    function remove_all_validation_markup(form) {
        $('.help-inline.error, .help-inline.success, .help-inline.warning',
            form).remove();
        $('.error, .success, .warning', form)
            .removeClass('error success warning');
    }
    $('form').each(function () {
        var form = $(this);
        var specialArgsObj = {
          register: {
            messages: {
              'user[username]': {
                remote: "Username Taken"
              },
              password2: {
                required: "Repeat your password",
                equalTo: "Passwords don't match!"
              }
            },
            checkErrorLabelOr: function() {
              return (find_container($('#regPassword')).hasClass('success') &&
              $(element).attr('id') === 'password2');
            }
          },
          uploadForm: {
            messages: {
              'transcription[file]': {
                accept: 'Only PDF documents are allowed'
              }
            }
          },
          newBounty: {
            messages: {
              'bounty[points]': {
                min: 'Must commit at least 1 point'
              }
            }
          }
        };
        var formId = form.attr('id');
        var specialArgs = specialArgsObj[formId] || {};
        specialArgs.checkErrorLabelOr = specialArgs.checkErrorLabelOr || function() {return false;};

        form
            .validate({
              messages: specialArgs.messages || {},
              unhighlight: function(element, errClass) {
                remove_validation_markup($(element));
                add_validation_markup($(element), 'success');
              },
              errorPlacement: function(err, element) {
                // Only markup if not empty
                if ($(element).val() !== '' ||
                  specialArgs.checkErrorLabelOr()) {
                  remove_validation_markup($(element));
                  add_validation_markup($(element), 'error', err.html());
                } else {
                    remove_validation_markup($(element));
                  }
              }

            }).form();
    });
});
