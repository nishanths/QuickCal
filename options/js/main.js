$(document).foundation();

function saveOptions(updatedDiffObj) {
  chrome.storage.sync.set(updatedDiffObj, function() {
    console.log('Settings saved');
  });
}

chrome.storage.sync.get(null, function(c){
  if (c.mode !== "simple" && c.mode !== "advanced") { // No prior settings found
    document.mainForm.modeSelectS.checked = true; // set mode on page
    document.mainForm.modeSelectA.checked = false;
    saveOptions({ mode:"simple", calendar_ids: [], notificationClickEdit: false, locale: "en-us" });
  } 
  
  else { // Restore options from storage
    // mode
    if (c.mode === "simple") {
      document.mainForm.modeSelectS.checked = true;
      document.mainForm.modeSelectA.checked = false;
      $('#slide-advanced').css("visibility", "hidden");
    } else if (c.mode === "advanced") {
      document.mainForm.modeSelectA.checked = true;
      document.mainForm.modeSelectS.checked = false;
    }
  }
});

// Page creation time - clear one
if ($('input[name=mode]:checked').val() === "advanced") {
  $('#slide-advanced').addClass("pullDown");
  $('#simpleLabel').addClass('fade');
  $('#advancedLabel').removeClass('fade');
  saveOptions({ mode: "advanced" }); // options.mode
} else if (($('input[name=mode]:checked').val() === "simple")) {
  $('#slide-advanced').removeClass("pullDown");
  $('#advancedLabel').addClass('fade'); 
  $('#simpleLabel').removeClass('fade'); 
  saveOptions({ mode: "simple" }); // options.mode
}

// Transition 
$('input[name=mode]').click(function() {
  if ($('input[name=mode]:checked').val() === "advanced") {
    $('#slide-advanced').addClass("pullDown");
    $('#simpleLabel').addClass('fade');
    $('#advancedLabel').removeClass('fade');
    $('#slide-advanced').css('visibility','visible');
  } else if ($('input[name=mode]:checked').val() === "simple") {            
    $('#slide-advanced').removeClass("pullDown");
    $('#advancedLabel').addClass('fade');
    $('#slide-advanced').css('visibility','hidden');
    $('#simpleLabel').removeClass('fade');
  }
  saveOptions({ mode: $('input[name=mode]:checked').val() }); // options.mode
});

// Calendar names and ids
var app = angular.module('calIDs', ['xeditable']);
app.run(function(editableOptions) {
  editableOptions.theme = 'bs2';
});

app.controller('main', function($scope, $timeout){ 
  $scope.cals = [];
  
  chrome.storage.sync.get(null, function(c) {
    if (c.calendar_ids && (c.calendar_ids.length !== 0)) {
      $scope.cals = c.calendar_ids;
    }
    $scope.$apply();
  });
  
  // + Add button
  $scope.newCal = function(){
    $scope.cals.push({name:'', id: '', isNew: true});
    saveOptions({ calendar_ids: $scope.cals });
  };
  
  // Update button
  $scope.updateCal = function(){
    // Real updating is taken care of by library, only do saving
    saveOptions({ calendar_ids: $scope.cals });
  }
  
  // - Delete button
  $scope.removeCal = function(i){
    $scope.cals.splice(i,1);
    saveOptions({ calendar_ids: $scope.cals });
  };
}); 
