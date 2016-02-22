$(function() {

  var map
  var locations = {}
  var markers
  var timeRangeStart = moment().subtract(29, 'days')
  var timeRangeEnd = moment()
  var dateFormat = 'DD/MM/YYYY'
  var min = 0
  var max = 0
  var visibleRobberies = {}
  var visibleRobberiesTries = {}
  var visibleDates = []

  L.Icon.Default.imagePath = '/images'

  var functions = {

    init: function () {
      map = L.map('map', {
        attributionControl: false,
        maxZoom: 18
      }).setView([52.1, 5], 14)

      map.on('moveend', function () {
        functions.update()
      })

      L.control.locate().addTo(map);

      var loadingControl = L.Control.loading({
          separate: true
      });
      map.addControl(loadingControl);

      markers = new L.MarkerClusterGroup()

      new L.Control.GeoSearch({
          provider: new L.GeoSearch.Provider.Google(),
          showMarker: false,
          zoomLevel: 14,
          position: 'topright'
      }).addTo(map);

      $('.leaflet-control-geosearch').prependTo($('#filter-form > .form-group:first'))

      var hash = new L.Hash(map);

      $('#hide-content').click(function () {
        $('body').toggleClass('show-content')
      })

      $('#leaflet-control-geosearch-qry').addClass('form-control').attr('placeholder', 'Zoek naar een plaats')
      L.tileLayer('http://{s}.tilemill.studiofonkel.nl/style/{z}/{x}/{y}.png?id=tmstyle:///home/administrator/styles/dark.tm2').addTo(map)

      $('#reportrange').daterangepicker(
          {
            opens: 'left',
            ranges: {
               'Afgelopen 7 dagen': [moment().subtract(6, 'days'), moment()],
               'Deze maand': [moment().startOf('month'), moment().endOf('month')],
               'Afgelopen 3 maanden': [moment().subtract(3, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            },
            format: 'DD/MM/YYYY',
            locale: {
              fromLabel: 'Van',
              toLabel: 'Tot',
              customRangeLabel: 'Selecteer datumbereik',
              applyLabel: 'Filteren',
              cancelLabel: 'Sluiten',
            },
            startDate: moment().subtract(29, 'days'),
            endDate: moment()
          },
          function(start, end) {
            timeRangeStart = start
            timeRangeEnd = end
            $('#reportrange span').html(start.format(dateFormat) + ' - ' + end.format(dateFormat));
            functions.update()
          }
      );

      $('#reportrange').on('shown', function () {
        $(this).addClass('focus')
      })

      $('#reportrange').on('hidden', function () {
        $(this).removeClass('focus')
      })

      $('.checkbox-filters').click(function () {
        functions.update()
      })

      $('#reportrange span').html(moment().subtract(29, 'days').format(dateFormat) + ' - ' + moment().format(dateFormat));

      setTimeout(function () {
        if (window.location.hash) {
          functions.update()
        }
      }, 300)
    },

    update: function () {
      $('body').addClass('loading')
        $('#map').trigger('dataloading')

      var viewport = map.getBounds().toBBoxString()

      var selectedFilters = []
      var visibleRobberies = {}
      var visibleRobberiesTries = {}
      var visibleDates = []

      $.each($('.checkbox-filters'), function (index, item) {
        if ($(item).is(':checked')) {
          selectedFilters.push("'" + $(item).val() + "'")
        }
      })

      // Needed format 2013-10-25 00:00:01
      var dbTimeFormat = 'YYYY-MM-DD hh:mm:ss'

      var query = 'SELECT DISTINCT ON (postal_code, date) postal_code,' +
      ' sum(case when  categoryId  != \'\' then 1 else 0 end) as count, ' +
      ' sum(case when  categoryId  = \'1\' then 1 else 0 end) as ct1,' +
      ' sum(case when  categoryId  = \'2\' then 1 else 0 end) as ct2,' +
      ' min(date) as date,' + // The bug is here.
      ' the_geom FROM misdaad WHERE ST_Contains(ST_MakeEnvelope(' + viewport + ', 4326), the_geom)' +
      ' AND (date >= (\'' + timeRangeStart.format(dbTimeFormat) + '\') AND date <= (\'' + timeRangeEnd.format(dbTimeFormat) + '\'))'

      if (selectedFilters.length) {
         query = query + ' AND categoryId IN (' + selectedFilters.join(',') + ')'
      }

      query = query + ' GROUP BY the_geom, postal_code ORDER BY date'

      $.get('http://danielbeeke.cartodb.com/api/v2/sql?q=' + query + '&format=GeoJSON', function (result) {

        max = 0
        min = 0

        markers.clearLayers()
        markers = new L.MarkerClusterGroup({
          singleMarkerMode: true,
          showCoverageOnHover: false,
          iconCreateFunction: function(cluster) {
            var count1 = 0
            var count2 = 0
            var classes = []

            $.each(cluster.getAllChildMarkers(), function (index, child) {
              count1 = count1 + child.data.properties.ct1
              count2 = count2 + child.data.properties.ct2
            })

            var total = count1 + count2

            if (total > 99) {
              classes.push('greater-than-99')
            }

            if (total > 999) {
              classes.push('greater-than-999')
            }

            if (max < total) {
              max = total
            }

            if (min > total) {
              min = total
            }

            return new L.DivIcon({ html: '<div class="pieContainer ' + classes.join(' ') + '">' +
            '<span class="pie" data-diameter="36" data-total="' + total + '">' + count1 + ',' + count2 + '</span>' +
            '<span class="number">' + total + '</span></div>' })
          }
        })

        $.each(result.features, function (index, row) {

          var date = row.properties.date
          var momentDate = moment(date)
          momentDate.locale('nl')
          var formattedDate = momentDate.format('DD-MM-YYYY')

          if (jQuery.inArray(formattedDate, visibleDates) == -1) {
            visibleDates.push(formattedDate)
          }

          if (!visibleRobberies[date]) {
            visibleRobberies[date] = 0
          }

          if (row.properties.ct1) {
            visibleRobberies[date] = parseInt(visibleRobberies[date]) + parseInt(row.properties.ct1)
          }

          if (!visibleRobberiesTries[date]) {
            visibleRobberiesTries[date] = 0
          }

          if (row.properties.ct2) {
            visibleRobberiesTries[date] = parseInt(visibleRobberiesTries[date]) + parseInt(row.properties.ct2)
          }

          var marker = new L.Marker([row.geometry.coordinates[1], row.geometry.coordinates[0]])
          marker.data = row
          markers.addLayer(marker)
        })

        map.addLayer(markers);

        var arrVisibleRobberiesTries = array_values(visibleRobberiesTries)
        var arrVisibleRobberies = array_values(visibleRobberies)

        var series = []

        if ($('#poging-tot-woninginbraak:checked').length || selectedFilters.length == 0) {
          series.push({
            name: 'Inbraakpogingen',
            color: '#FFAD00',
            data: arrVisibleRobberiesTries
          })
        }

        if ($('#woninginbraak:checked').length || selectedFilters.length == 0) {
          series.push({
            name: 'Inbraken',
            color: '#ac0000',
            data: arrVisibleRobberies
          })
        }

        var chart = $('#chart').highcharts({
                    title: {
                        text: '',
                    },
                    legend: {
                      enabled: false
                    },
                    credits: {
                      enabled: false
                    },
                    xAxis: {
                        categories: visibleDates,
                        labels: {
                          enabled: false
                        }
                    },
                    yAxis: {
                        title: {
                            text: ''
                        },
                        min: 0,
                    },
                    series: series
                });

        // Smallest marker is 30px
        // Biggest is 70px

        $.each($('span.pie'), function () {
          var that = this
          $(this).peity('pie', {
            colours: ["#ac0000", "#FFAD00"],
            diameter: function () {
              var total = $(that).attr('data-total')

              var count = total - min

              var percentage = 100 / max * count

              return 30 + (percentage * 0.50) + 'px'
            }
          })
        })

        $('#map').trigger('dataload')
        $('body').removeClass('loading')
      })
    }
  }

  functions.init()

})

function array_values(input) {
  //  discuss at: http://phpjs.org/functions/array_values/
  // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // improved by: Brett Zamir (http://brett-zamir.me)
  //   example 1: array_values( {firstname: 'Kevin', surname: 'van Zonneveld'} );
  //   returns 1: {0: 'Kevin', 1: 'van Zonneveld'}

  var tmp_arr = [],
    key = '';

  if (input && typeof input === 'object' && input.change_key_case) { // Duck-type check for our own array()-created PHPJS_Array
    return input.values();
  }

  for (key in input) {
    tmp_arr[tmp_arr.length] = input[key];
  }

  return tmp_arr;
}
