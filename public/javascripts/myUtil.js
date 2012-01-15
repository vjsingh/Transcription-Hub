$(document).ready(function() {
  $('.jqueryHide').hide();

  // Feedback tab
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

