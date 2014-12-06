var map;
var markers = {};

// Removes given marker from map.
var removeMarker = function(markerUID) {
  var marker = markers[markerUID];
  marker.setMap(null); // set markers setMap to null to remove it from map
  delete markers[markerUID]; // delete marker instance from markers object
};

// Removes all markers from map.
var removeAllMarkers = function() {
  $.each(markers, function (markerUID, marker) {
    removeMarkerFromPlacesList(markerUID);
  });
};

// Concatenates given lat and lng with an underscore and returns it.
// This UID will be used as a key of marker to cache the marker in markers object.
var getMarkerUID = function(lat, lng) {
  return 'marker_' + lat + '_' + lng;
};

// Adds marker to the Marked Places list
var addMarkerToPlacesList = function(marker) {
  if (Object.keys(markers).length !== 0) {
    $('.marker-list').css('visibility', 'visible');
  }
  $('.marker-list').append('<li class="list-group-item" id="' + marker.id + '">' + 
    marker.title + 
    '<span class="glyphicon glyphicon-remove" onclick="removeMarkerFromPlacesList(\'' + marker.id + '\')"></span></li>');
}

// Removes marker from the Marked Places list
var removeMarkerFromPlacesList = function(markerUID) {
  removeMarker(markerUID);
  if (Object.keys(markers).length === 0) {
    $('.marker-list').css('visibility', 'hidden');
  }
  var markerListElement = document.getElementById(markerUID.trim());
  markerListElement.remove();
}

// Initializes the map and listens for marker additions.
var initialize = function() {
  map = new google.maps.Map(document.getElementById('map-canvas'), {
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    center: { lat: 0, lng: 0},
    zoom: 2,
    mapTypeControl: false
  });
  // Create the search box and link it to the UI element.
  var input = (document.getElementById('pac-input'));
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
  var searchBox = new google.maps.places.SearchBox((input));
  // Listen for the event fired when the user selects an item from the
  // pick list. Retrieve the matching places for that item.
  google.maps.event.addListener(searchBox, 'places_changed', function() {
    var places = searchBox.getPlaces();
    if (places.length == 0) {
      return;
    }
    // For each place, get the icon, place name, and location.
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0, place; place = places[i]; i++) {
      var position = place.geometry.location;
      var markerUID = getMarkerUID(position.lat(), position.lng());
      // Create a marker for each place.
      var marker = new google.maps.Marker({
        map: map,
        id: markerUID,
        title: place.name,
        position: position
      });
      markers[marker.id] = marker;
      addMarkerToPlacesList(marker);
      bounds.extend(position);
    }
    // This is needed to set the zoom after fitbounds.
    google.maps.event.addListener(map, 'zoom_changed', function() {
        zoomChangeBoundsListener = 
            google.maps.event.addListener(map, 'bounds_changed', function(event) {
                if (this.getZoom() > 3 && this.initialZoom == true) {
                    // Change max/min zoom here
                    this.setZoom(3);
                    this.initialZoom = false;
                }
            google.maps.event.removeListener(zoomChangeBoundsListener);
        });
    });
    map.initialZoom = true;
    map.fitBounds(bounds);
  });
}

$( document ).ready(function() {
  // Initialize Google Maps
  google.maps.event.addDomListener(window, 'load', initialize);
  
  //------------------------------------------------
  // Initialize Socket IO
  //var socket = io();
  // socket.on('appleTweet', function(appleTweets){
  //  $('#appleTweetCount').text(appleTweets.count);
  // });
  //------------------------------------------------

  $(".glyphicon-remove").click(function() {

  })
});
