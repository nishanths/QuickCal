// persistent: true
// needs oauth2.js to be present in the current HTML document

(function(){
	"use strict";
	
	var calendar_id = "primary"; // for options later
	var locale = "en-us";
	var edit_url = ""; // On notification click
	var current_text = ""; // for retrying
	
	var path_to_root = "../../../";
	var calendar_date_icon_path = "icons/classic/calendars-notification/";
  var remote_cal_date_notification_url = "http://github.com/nishanths/QuickCal/tree/master/icons/classic/calendars-notification/"
	var dark_icon = "icons/dark/512.png";
	
	// Simple helpers
	function isToday_NotDateTime(d) {
		var t = new Date.today().addDays(-1);
		return d.toDateString() == t.toDateString();
	}
	function isTomorrow_NotDateTime(d) {
	  return d.toDateString() == (new Date()).toDateString();
	}
	function isToday_DateTime(d) {
	  return d.toDateString() == (new Date()).toDateString();
	}
	function isTomorrow_DateTime(d) {
	  var t = new Date.today().addDays(1);
	  return d.toDateString() == t.toDateString();
	}
	
	// Converts to the time format we want
	function to12Time(d) {
		var h = d.getHours();
		var m = d.getMinutes();
		var suffix = "AM";
		var space = " ";
		
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
				
		return h.toString() + ":" + m_string + space + suffix;
	}
	
	// Converts to the kind of date we want, uses some helpers
	function beautifulDate(d, is_dt) {
		var comma = ", ";
		var space = " ";

		var date = d.getDate().toString();
		var month = d.getMonthName();
		var year = d.getFullYear();
		var day = d.getDayName();
		// day = day.slice(0,3);
		
		var result = day + comma + month + space + date + comma + year;
		
		if (is_dt) { // DateTime
			if (isToday_DateTime(d)) {
				result = "today";
			} else if (isTomorrow_DateTime(d)) {
				result = "tomorrow";
			} 
		} 
		
		else { // not DateTime
			if (isToday_NotDateTime(d)) {
				result = "today";
			} else if (isTomorrow_NotDateTime(d)) {
				result = "tomorrow";
			}
		}
		
		return result;
	}
	
	// Updates calendar id
	function updateCalendarId(new_id) {
	  calendar_id = new_id;
	}

	// Create context menu item
	chrome.contextMenus.create({
	  type    : "normal", // the default textual option
	  id      : "atc-addtocal-cm", // for later reference (clearing)
	  title   : "Add to Calendar", // the text that is displayed
	  contexts  : ["selection"], // only display on selected text
	  onclick   : function (obj) { addStringToCal(obj.selectionText); }, // attempt cal add
	  documentUrlPatterns: ["<all_urls>"] // show on all addresses
	});
	
	// Open Cal with edit
	chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex){
		if (notificationId === "atc-addtocal-n-addactionresult") {
			if (buttonIndex === 0) { chrome.tabs.create({ url: edit_url }, function(t) {}); }
		}
		
		if (notificationId === "atc-addtocal-n-addactionresult-bad") {
			if (buttonIndex == 0) { addStringToCal(current_text); }
		}
	});

	// Construct Google's oauth object
	var google = new OAuth2('google', {
	  client_id: '512064202793-n2ahv2cr871ocopha2ed456sfl42iju8.apps.googleusercontent.com',
	  client_secret: 'S9KnsYZDycCxHvq_lm-SoZDc',
	  api_scope: 'https://www.googleapis.com/auth/calendar'
	});

	function addStringToCal(text_to_add) {
	  google.authorize(function(){
	    var GCAL_POST_URL = 'https://www.googleapis.com/calendar/v3/calendars/' + calendar_id + '/events/quickAdd';
	    var xhr = new XMLHttpRequest();
			current_text = text_to_add;
    
	    xhr.onreadystatechange = function(event) {
	      if (xhr.readyState == 4) {
					if(xhr.status == 200) {
	          var res = JSON.parse(xhr.responseText); // console.log(res);
						edit_url = res.htmlLink;
						var notification_title = "An untitled event was added";
						var notification_message = {	part1: "",	part2: "" };
						
						// Start and end information from the reponse
						var start = { includesTime: !!res.start.dateTime, date_string: res.start.dateTime || res.start.date };
						var end = { includesTime: !!res.end.dateTime,	date_string: res.end.dateTime || res.end.date };
						var start_date_obj = new Date(start.date_string);
						var end_date_obj = new Date(end.date_string);
						
						// Event title exists?
						if (res.summary)  { 
							notification_title = "Added: " + res.summary;
						}
							              					
						// Time vs all-day
						if (start.includesTime) {
							notification_message.part1 = "Starting at " + to12Time(start_date_obj) + ", " + beautifulDate(start_date_obj, start.includesTime);
						} else { // all day event
							start_date_obj = new Date(start.date_string);
							notification_message.part1 = "all-day, " + beautifulDate(start_date_obj, start.includesTime);
						}
						
						// Notifications
						chrome.notifications.clear("atc-addtocal-n-addactionresult", function (a) {});
						chrome.notifications.clear("atc-addtocal-n-addactionresult-bad", function (a) {});
						
						chrome.notifications.create("atc-addtocal-n-addactionresult", {
	            type: "basic",
	            iconUrl: remote_cal_date_notification_url + (start_date_obj.getMonth() + 1).toString() + "/" + (start_date_obj.getDate()).toString() + ".png",
	            title: notification_title,
	            message: notification_message.part1,
							buttons: [{title: "Edit event"}],
							isClickable: true
	          }, function(ni){ console.log(ni); });
	        } 
					
					else {	// Request failure
	          console.log("No response received.");
						chrome.notifications.clear("atc-addtocal-n-addactionresult", function (a) {});
						chrome.notifications.clear("atc-addtocal-n-addactionresult-bad", function (a) {});

	          chrome.notifications.create("atc-addtocal-n-addactionresult-bad", {
							type: "basic", 
							iconUrl: path_to_root + dark_icon, 
							title: "Event not added", 
							message:"Something messed up and the event wasn't added.",
							buttons: [{title: "Try again?"}]
						}, function(ni){ console.log(ni); });
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

