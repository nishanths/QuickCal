/* background.js, QuickCal */

// persistent: true
// Needs oauth2.js to be in the current HTML document

(function(){
  "use strict";
  
  var current_req_res_context = {
    edit_url: "", // On notification click
    current_text: "", // for retrying
    calendar_id: "",
    caller_cal_nickname: ""
  };
  
  var paths = {
    root: "../../../",
    remote_cal_date_notification_url: "http://raw.githubusercontent.com/nishanths/QuickCal/master/icons/classic/calendars-notification/",
    dark_icon: "icons/dark/512.png"
  };
  
  var options = {
    locale: "en-us",
    notificationClickEdit: false,
    mode: "simple",
    calendar_ids: [
      { name : "primary", id : "primary" }
    ]
  };
  
  /******************************* EVENT LISTENERS ******************************/ 
  
  // Check whether updated extension
  chrome.runtime.onInstalled.addListener(function(details){
    if (details.reason === "install"){
      // nothing
    } else if(details.reason === "update"){
      // nothing
    }
  });
    
  // Open Cal with edit on clicking the notification
  chrome.notifications.onClicked.addListener(function (notificationId){
    if (options.notificationClickEdit && notificationId === "atc-addtocal-n-addactionresult") {
      chrome.tabs.create({ url: current_req_res_context.edit_url }, function(t) {});
    }
  }); 
  
  // Open Cal with edit on clicking the Edit Event, Try again, and help buttons 
  chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex){
    if (notificationId === "atc-addtocal-n-addactionresult") {
      if (buttonIndex === 0) { chrome.tabs.create({ url: current_req_res_context.edit_url }, function(t) {}); }
    }
      
    if (notificationId === "atc-addtocal-n-addactionresult-bad") {
      if (buttonIndex === 0) { addStringToCal(current_req_res_context.text_to_add, current_req_res_context.calendar_id, current_req_res_context.caller_cal_nickname); }
      else if (buttonIndex === 1) { chrome.tabs.create({ url: "https://github.com/nishanths/QuickCal/blob/master/README.md" }, function(t) {}); }
    }
  });
  
  // Set the options global variable with the changed options and redoContext menus, when options change
  chrome.storage.onChanged.addListener(function() {
    setOptions();
  });

  /**************************** OPTIONS ******************************/
  
  function setOptions() {
    chrome.storage.sync.get(null, function(items){
      // Since we know the properties, set manually instead of iterating because it is more efficient
      options.mode = items.mode;
      options.calendar_ids = items.calendar_ids;
      options.notificationClickEdit = false;
      options.locale = "en-us";
      redoContextMenus();
    });
  }
  
  /**************************** CONTEXT MENU ******************************/
  
  function createSingleMenu_withNickname_andId(nickname, id) {
    chrome.contextMenus.create({ // Single menu option
      type    : "normal", // the default textual option
      id      : "atc-addtocal-cm" + nickname, // for later reference (clearing)
      title   : "Add to Calendar", // the text that is displayed
      contexts  : ["selection"], // only display on selected text
      onclick   : function (obj) { addStringToCal(obj.selectionText, id); }, // attempt cal add
      documentUrlPatterns: ["<all_urls>"] // show on all addresses
    });
  }
  
  // Mutiple menus, also passes nickname to the main event adding function
  function createMultiStyleMenus_withNickname_andId(nickname, id) {
    chrome.contextMenus.create({
      type    : "normal", 
      id      : "atc-addtocal-cm-" + nickname, 
      title   : "Add to " + nickname,
      contexts  : ["selection"],
      onclick   : function (obj) { addStringToCal(obj.selectionText, id, nickname); },
      documentUrlPatterns: ["<all_urls>"]
    });
  }
  
  function removeAllContextMenus() {
    chrome.contextMenus.removeAll();
  }
  
  // Removes all + Creates depending on options
  function redoContextMenus() {
    removeAllContextMenus();
    createContextMenus();
  }
  
  // Create context menus; create only one if there is only one calendar specified in options
  function createContextMenus() {
    var l = 0; // Count
    
    options.calendar_ids.forEach(function(cal) {
      if (cal.name && cal.id) {
        l += 1;
      }
    });
        
    if (options.mode === "simple" || l < 1) { // .Simple (or) chose .Advanced and did not specify anything
      createSingleMenu_withNickname_andId("primary", "primary");      
    }
   
    else if (options.mode === "advanced" && l === 1) { // .Advanced and specified one single calendar (cannot POST to 'primary' url) (and) (display one menu option with non-specialized title)       
      var single = {
        "nickname" : options.calendar_ids[0].name,
        "id"       : options.calendar_ids[0].id
      };
      createSingleMenu_withNickname_andId(single.nickname, single.id);
    }
    
    
    else { // .Advanced with multiple calendars
      options.calendar_ids.forEach(function(cal) {
        if (cal.name && cal.id) { // not empty strings
          createMultiStyleMenus_withNickname_andId(cal.name, cal.id);
        }
      });
    }    
  }
    
  /**************************** DATE HELPERS ******************************/
  
  function isToday(d) {
    return d.toDateString() == (new Date()).toDateString();
  }
  
  function isTomorrow(d) {
    var t = new Date.today().addDays(1);
    return d.toDateString() == t.toDateString();
  }
  
  // Input string with format: "yyyy-mm-dd"
  // Returns an array of integers [yyyy, m, d];
  function tokenizeGoogleDate(str) {
    var tokens = /(\d+)\-(\d+)\-(\d+)/.exec(str); 
    tokens.shift();
    tokens = tokens.map(Number);
    return tokens;
  }
    
  /**************************** DATE FORMATTING ******************************/
    
  // Converts to the time format we want
  // Input: JavaScript Date object
  function to12Time(d) {
    var h = d.getHours();
    var m = d.getMinutes();
    var suffix = "AM";
    
    // Format minutes
    var m_string = m.toString();
    if (m <= 9) m_string = "0" + m_string;

    // Format hour and suffix
    if (h === 0) {
      h += 12;
      if (m === 0) suffix = "midnight"
    } else if (h === 12) {
      if (m === 0) suffix = "noon";
    } else if (h > 13) {
      h -= 12;
      suffix = "PM";
    }
    
    if (suffix === "midnight" || suffix === "noon") {
      return h.toString() + " " + suffix;
    }
      
    return h.toString() + ":" + m_string + " " + suffix;
  }

  // Converts to the kind of date we want, uses some helpers
  // Input: JavaScript Date object
  function beautifulDate(d) {
    // All variables are strings
    var date = d.getDate().toString();
    var month = d.getMonthName();
    var year = d.getFullYear().toString();
    var day = d.getDayName();
  
    var result = day + ", " + month + " " + date + ", " + year;
    
    if (isToday(d)) {
      result = "today";
    } else if (isTomorrow(d)) {
      result = "tomorrow";
    } 
      
    return result;
  }

/********************************* RUN ***********************************/

  createContextMenus();

  // Construct Google's oauth object
  var google = new OAuth2('google', {
    client_id: '512064202793-n2ahv2cr871ocopha2ed456sfl42iju8.apps.googleusercontent.com',
    client_secret: 'V6Kwk6hyCCq79zoLGzxWHGl9',
    api_scope: 'https://www.googleapis.com/auth/calendar',
    prompt: 'select_account'
  });

  // Add to Google Calendar
  function addStringToCal(text_to_add, calendar_id, caller_cal_nickname) { 
    google.authorize(function(){
      var GCAL_POST_URL = 'https://www.googleapis.com/calendar/v3/calendars/' + calendar_id + '/events/quickAdd';
      console.log(GCAL_POST_URL);
      var xhr = new XMLHttpRequest();
      
      current_req_res_context.text_to_add = text_to_add;
      current_req_res_context.calendar_id = calendar_id;
      current_req_res_context.caller_cal_nickname = caller_cal_nickname;
    
      xhr.onreadystatechange = function(event) {
        if (xhr.readyState == 4) {
          if(xhr.status == 200) {
            var res = JSON.parse(xhr.responseText); console.log(res);
              current_req_res_context.edit_url = res.htmlLink;
              var notification_title = "An event with no title was added";
              var notification_message = { part1: "",  part2: "" };
              var contextMessage = "";
              
              if (res.summary)  { 
                notification_title = res.summary; 
                contextMessage = "Event added";
              } 
              
              // Start information from the reponse
              var start = { 
                includesTime: !!res.start.dateTime, 
                date_string: res.start.dateTime || res.start.date 
              };
              
              var start_date_obj;
                            
              // Time vs all-day
              if (start.includesTime) {
                start_date_obj = new Date(start.date_string);
                notification_message.part1 = to12Time(start_date_obj);
              } else { // all day event - Google's response has yyyy-mm-dd format
                var split = tokenizeGoogleDate(start.date_string);
                start_date_obj = new Date(split[0], split[1]-1, split[2]);
                notification_message.part1 = "all-day"
              }
              
              notification_message.part1 += ", " + beautifulDate(start_date_obj);
          
              // Compute data to make icon url
              var date = start_date_obj.getDate();
              
              // Event successfully added message
              if (!(typeof caller_cal_nickname === "undefined")) { // defined when there are multiple calendars
                contextMessage += " to " + caller_cal_nickname + " calendar";
              }
                      
              // Clear and create notification
              chrome.notifications.clear("atc-addtocal-n-addactionresult", function (a) {});
              chrome.notifications.clear("atc-addtocal-n-addactionresult-bad", function (a) {});            
              chrome.notifications.create("atc-addtocal-n-addactionresult", {
                type: "basic",
                iconUrl: paths.remote_cal_date_notification_url + (start_date_obj.getMonth() + 1).toString() + "/" + date.toString() + ".png",
                title: notification_title,
                message: notification_message.part1,
                contextMessage: contextMessage,
                buttons: [{title: "Edit event"}],
                isClickable: true
              }, function(a){});
          } 
                  
          else {  // Request failure
            chrome.notifications.clear("atc-addtocal-n-addactionresult", function (a) {});
            chrome.notifications.clear("atc-addtocal-n-addactionresult-bad", function (a) {});
            chrome.notifications.create("atc-addtocal-n-addactionresult-bad", {
              type: "basic", 
              iconUrl: paths.root + paths.dark_icon, 
              title: "Event not added", 
              message:"Something messed up and the event wasn't added.",
              buttons: [{title: "Try again?"}, {title: "Get help"}]
            }, function(a){});
          }
        }
      };

      var access_token = google.getAccessToken();
      GCAL_POST_URL += "?text=" + text_to_add + "&&sendNotifications=false&key=" + access_token;

      xhr.open('POST', GCAL_POST_URL, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'OAuth ' + google.getAccessToken());
      xhr.send();
    });
  }
})();
