var map;
var markers = {};
var circles = {};
var containers = {};
var geocoder = new google.maps.Geocoder();
var socket = io();


// Generate a UUID for a marker.
var getUUID = (function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return function() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  };
})();

// Removes given circle from map.
var removeCircle = function(circleUID) {
  var circle = circles[circleUID];
  var container = containers[circleUID];
  container.close();
  circle.setMap(null);
  delete containers[circleUID];
  delete circles[circleUID]; 
};

// Removes given marker from map.
var removeMarker = function(markerUUID) {
  var marker = markers[markerUUID];
  marker.setMap(null); // set markers setMap to null to remove it from map
  delete markers[markerUUID]; // delete marker instance from markers object
  socket.emit('remove marker request', markerUUID);
  removeCircle(marker.id);
};

// Removes marker from the Marked Places list
var removeMarkerFromPlacesList = function(markerUUID) {
  removeMarker(markerUUID);
  if (Object.keys(markers).length === 0) {
    $('.marker-list').css('visibility', 'hidden');
    $('.deleteMarkersButton').css('visibility', 'hidden');
  }
  var markerListElement = document.getElementById(markerUUID.trim());
  markerListElement.remove();
};

// Removes all markers from map.
var removeAllMarkers = function() {
  $.each(markers, function (markerUUID, marker) {
    removeMarkerFromPlacesList(markerUUID);
  });
};

// Adds marker to the Marked Places list
var addMarkerToPlacesList = function(marker) {
  if (Object.keys(markers).length !== 0) {
    $('.marker-list').css('visibility', 'visible');
    $('.deleteMarkersButton').css('visibility', 'visible');
  }
  $('.marker-list').append('<li class="list-group-item" id="' + marker.id + '">' + marker.title + 
    '<span class="glyphicon glyphicon-remove" onclick="removeMarkerFromPlacesList(\'' + marker.id + '\')"></span></li>');
};

// Generates content for the info container
var getInfoContainerContent = function(marker, circle, feature, result) {
  var content = '<div class="infoContainer" id="container_' + marker.id + '">' + 
                  '<p class="containerHeader">' + 
                    '<span class="containerTitle">Place: ' + marker.title + ', </span>' + 
                    '<span class="containerRadius"> Radius: ' + Math.round(circle.getRadius() / 1000) + ' km </span>' +
                  '</p>';
  if (feature === "trend" && result) {
    content +=  '<div class="alert alert-info" role="alert" id="tweetTrends_' + marker.id + '">' + 
                '<strong>Trending Tweet Topics: </strong><span class="realtimeTrends">' + ' ' + result + '</span>' + 
                '</div>'; 
  } else if (feature === "count" && result) {
    content +=  '<div class="alert alert-info" role="alert" id="tweetCount_' + marker.id + '">' + 
                '<strong>Tweet Count: </strong><span class="realtimeCount">' + ' ' + result + '</span>' + 
                '</div>'; 
  } else if (feature === "trend") {
    content +=  '<div class="alert alert-info" role="alert" id="tweetTrends_' + marker.id + '">' + 
                '<strong>Trending Tweet Topics: </strong><span class="realtimeTrends">Loading...</span>' + 
                '</div>'; 
  } else if (feature === "count") {
    content +=  '<div class="alert alert-info" role="alert" id="tweetCount_' + marker.id + '">' + 
                '<strong>Tweet Count: </strong><span class="realtimeCount"> Loading...</span>' + 
                '</div>'; 
  } else {
    content +=  '<div class="btn-group" role="group" aria-label="...">' + 
                  '<button type="button" class="btn btn-default" onclick="getTweetCount(\'' + marker.id + '\')">Get Tweet Count</button>' +
                  '<button type="button" class="btn btn-default" onclick="getTweetTrends(\'' + marker.id + '\')">Get Trending Tweet Topics</button>' +
                '</div>';
  }
  content += '</div>';
  return content;
};

// Draws a circle around a marker
var drawCircleForMarker = function(marker, radius, feature) {
  var isEditable = true;
  if (feature) {
    isEditable = false;
  }
  var circleOptions = {
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#FF0000',
    fillOpacity: 0.35,
    map: map,
    center: marker.position,
    radius: radius,
    editable: isEditable,
    clickable: true
  };
  // Add the circle for this city to the map.
  var circle = new google.maps.Circle(circleOptions);
  circle.bindTo('center', marker, 'position');
  // Create info window for circle
  var infoWindow = new google.maps.InfoWindow({
    content:  getInfoContainerContent(marker, circle, feature)
  });
  google.maps.event.addListener(circle, 'click', function(ev){
    infoWindow.setPosition(ev.latLng);
    infoWindow.open(map);
  });
  google.maps.event.addListener(circle, 'radius_changed', function(ev){
    var container = containers[marker.id];
    container.setContent(getInfoContainerContent(marker, circle)); 
  });
  // Add the container to containers map
  containers[marker.id] = infoWindow;
  // Add the circle to circless map
  circles[marker.id] = circle;
};

var getTitleFromGeoCode = function(position, fn) {
  geocoder.geocode({'latLng': position}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      if (results[1]) {
        fn(results[1].formatted_address);  
      } else {
        console.log('No results found');
      }
    } else {
      console.log('Geocoder failed due to: ' + status);
    }
  });
};

var updatePlaceName = function(marker) {
  var newMarkerTitle;
  getTitleFromGeoCode(marker.position, function(title) {
    newMarkerTitle = title;
    if (newMarkerTitle) {
      marker.title = newMarkerTitle;
      document.getElementById(marker.id).innerHTML = newMarkerTitle + 
      '<span class="glyphicon glyphicon-remove" onclick="removeMarkerFromPlacesList(\'' + marker.id + '\')"></span>';
      // Update Info Container content
      var circle = circles[marker.id];
      var container = containers[marker.id];
      container.setContent(getInfoContainerContent(marker, circle));   
    }  
  });
};

// Generate Marker DOM
var generateMarker = function(UUID, title, position, radius, feature) {
  // Check if marker should be draggable
  var isDraggable = true;
  if (feature) {
    isDraggable = false;
  }
  // Create the marker object.
  var marker = new google.maps.Marker({
    map: map,
    id: UUID,
    title: title,
    position: position,
    draggable: isDraggable
  });
  // Add event listener for marker to update new position
  google.maps.event.addListener(marker, 'dragend', function() {
    updatePlaceName(marker);
  });
  // Add the marker to markers map
  markers[marker.id] = marker;
  // Add marker to the Marked Places List on the UI.
  addMarkerToPlacesList(marker);
  // Draw circle around the marker.
  drawCircleForMarker(marker, radius, feature);
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
      var UUID = getUUID();
      var title = place.name;
      var position = place.geometry.location;
      generateMarker(UUID, title, position, 200000);
      bounds.extend(position);
    }
    // Set the zoom after fitbounds.
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

// Initialize Google Maps
google.maps.event.addDomListener(window, 'load', initialize);

// Load marker that already exists in the database
socket.on('load marker', function(marker) {
  var bounds = new google.maps.LatLngBounds();
  var UUID = marker.id;
  var position = new google.maps.LatLng(marker.lat, marker.lng);
  var radius = marker.radius;
  var feature = marker.type;
  getTitleFromGeoCode(position, function(title) {
    var title = title;
    if (title) {
      generateMarker(UUID, title, position, radius, feature);
      map.setZoom(3);
      var marker = markers[UUID];
      var container = containers[UUID];
      map.panTo(marker.position); 
      container.setPosition(marker.position);
      container.open(map);
    } 
  });
});

// Load marker that already exists in the database
socket.on('load twitter data', function(updatedMarkers) {
  $.each(updatedMarkers, function( index, markerInfo ){
    if (markers[markerInfo.id]) {
      var marker = markers[markerInfo.id];
      var circle = circles[markerInfo.id];
      var container = containers[markerInfo.id];
      var feature = markerInfo.feature;
      var result;
      if (feature === "trend") {
        result = markerInfo.trends.join(", ");
      } else {
        result = markerInfo.count;
      }
      container.setContent(getInfoContainerContent(marker, circle, feature, result));
    }
  });
});

var getTweetCount = function(markerUID) { 
  var marker = markers[markerUID];
  var circle = circles[markerUID];
  var container = containers[markerUID];
  marker.setDraggable(false);
  circle.setEditable(false);
  var request = {};
  request.feature = "count";
  request.id = marker.id;
  request.lat = marker.position.lat();
  request.lon = marker.position.lng();
  request.radius_km = Math.round(circle.getRadius() / 1000);
  container.setContent(getInfoContainerContent(marker, circle, request.feature));
  socket.emit('count request', request);
};

var getTweetTrends = function(markerUID) {
  var marker = markers[markerUID];
  var circle = circles[markerUID];
  var container = containers[markerUID];
  marker.setDraggable(false);
  circle.setEditable(false);
  var request = {};
  request.feature = "trend";
  request.id = marker.id;
  request.lat = marker.position.lat();
  request.lon = marker.position.lng();
  request.radius_km = Math.round(circle.getRadius() / 1000);
  container.setContent(getInfoContainerContent(marker, circle, request.feature));
  socket.emit('trend request', request);
};
